import * as vscode from 'vscode';
import { AnalysisResult, SerializationPoint } from '../types';
import { PHPAnalyzer } from './phpAnalyzer';

export class SerializationAnalyzer {
    private ast: any;
    private analyzer: PHPAnalyzer;

    constructor(ast: any) {
        this.ast = ast;
        this.analyzer = new PHPAnalyzer('');
        this.analyzer['ast'] = ast;
    }

    findSerializationPoints(document: vscode.TextDocument): AnalysisResult[] {
        const results: AnalysisResult[] = [];
        const calls = this.analyzer.getAllFunctionCalls();

        const unserializeCalls: any[] = [];
        const serializeCalls: any[] = [];

        for (const call of calls) {
            const funcName = this.getFunctionName(call);
            
            if (funcName === 'unserialize') {
                unserializeCalls.push(call);
            } else if (funcName === 'serialize') {
                serializeCalls.push(call);
            }
        }

        // Analyze unserialize calls
        for (const call of unserializeCalls) {
            const isDangerous = this.isUnserializeDangerous(call);
            const paramSource = this.analyzeParameterSource(call);
            const usesAllowedClasses = this.checkAllowedClasses(call);
            
            const loc = this.analyzer.getNodeLocation(call);
            const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
            const location = new vscode.Location(document.uri, position);

            results.push({
                type: 'Unserialize Call',
                severity: isDangerous ? 'error' : 'warning',
                message: `unserialize() ${isDangerous ? '⚠️ DANGEROUS' : ''}`,
                location,
                details: this.formatUnserializeDetails(paramSource, usesAllowedClasses, isDangerous),
                metadata: {
                    type: 'unserialize',
                    isDangerous,
                    paramSource,
                    usesAllowedClasses
                }
            });
        }

        // Analyze serialize calls
        for (const call of serializeCalls) {
            const loc = this.analyzer.getNodeLocation(call);
            const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
            const location = new vscode.Location(document.uri, position);

            results.push({
                type: 'Serialize Call',
                severity: 'info',
                message: 'serialize()',
                location,
                metadata: { type: 'serialize' }
            });
        }

        return results;
    }

    private getFunctionName(callNode: any): string {
        if (!callNode.what) {
            return '';
        }

        if (typeof callNode.what.name === 'string') {
            return callNode.what.name.toLowerCase();
        }

        if (callNode.what.kind === 'name') {
            return (callNode.what.name || '').toLowerCase();
        }

        return '';
    }

    private isUnserializeDangerous(callNode: any): boolean {
        const paramSource = this.analyzeParameterSource(callNode);
        const usesAllowedClasses = this.checkAllowedClasses(callNode);

        // Dangerous if parameter comes from user input
        if (paramSource.includes('$_GET') || paramSource.includes('$_POST') || 
            paramSource.includes('$_COOKIE') || paramSource.includes('$_REQUEST') ||
            paramSource.includes('php://input') || paramSource.includes('file_get_contents')) {
            return true;
        }

        // Dangerous if no allowed_classes restriction
        if (!usesAllowedClasses) {
            return true;
        }

        return false;
    }

    private analyzeParameterSource(callNode: any): string {
        if (!callNode.arguments || callNode.arguments.length === 0) {
            return 'unknown';
        }

        const firstArg = callNode.arguments[0];
        return this.traceArgumentSource(firstArg);
    }

    private traceArgumentSource(node: any): string {
        if (!node) {
            return 'unknown';
        }

        switch (node.kind) {
            case 'variable':
                return '$' + (node.name || 'unknown');
            
            case 'offsetlookup':
                // Array access like $_GET['data']
                if (node.what && node.what.kind === 'variable') {
                    const varName = '$' + node.what.name;
                    if (this.analyzer.isUserInputSource(varName)) {
                        return varName;
                    }
                    return varName;
                }
                return 'array access';
            
            case 'call':
                const funcName = this.getFunctionName(node);
                if (funcName === 'base64_decode') {
                    const innerSource = this.traceArgumentSource(node.arguments?.[0]);
                    return `base64_decode(${innerSource})`;
                }
                if (funcName === 'file_get_contents') {
                    return 'file_get_contents()';
                }
                return funcName + '()';
            
            case 'string':
                return '"string literal"';
            
            default:
                return node.kind || 'unknown';
        }
    }

    private checkAllowedClasses(callNode: any): boolean {
        // Check if second parameter (options array) contains allowed_classes
        if (!callNode.arguments || callNode.arguments.length < 2) {
            return false;
        }

        const optionsArg = callNode.arguments[1];
        
        if (optionsArg.kind === 'array') {
            // Check if array contains 'allowed_classes' key
            const items = optionsArg.items || [];
            for (const item of items) {
                if (item.key && item.key.kind === 'string' && item.key.value === 'allowed_classes') {
                    return true;
                }
            }
        }

        return false;
    }

    private formatUnserializeDetails(paramSource: string, usesAllowedClasses: boolean, isDangerous: boolean): string {
        let details = `Parameter source: ${paramSource}\n`;
        details += `Uses allowed_classes: ${usesAllowedClasses ? 'Yes ✓' : 'No ✗'}\n`;
        
        if (isDangerous) {
            details += '\n⚠️ DANGEROUS CONFIGURATION:\n';
            
            if (paramSource.includes('$_GET') || paramSource.includes('$_POST') || 
                paramSource.includes('$_COOKIE') || paramSource.includes('$_REQUEST')) {
                details += '  - Parameter comes from user input (HTTP request)\n';
            }
            
            if (paramSource.includes('file_get_contents') || paramSource.includes('php://input')) {
                details += '  - Parameter comes from external source\n';
            }
            
            if (!usesAllowedClasses) {
                details += '  - No class whitelist (allowed_classes) specified\n';
            }
            
            details += '\nRecommendation:\n';
            details += '  - Avoid unserializing user input\n';
            details += '  - Use JSON instead of serialize/unserialize\n';
            details += '  - If necessary, use allowed_classes to whitelist safe classes\n';
        }

        return details;
    }
}

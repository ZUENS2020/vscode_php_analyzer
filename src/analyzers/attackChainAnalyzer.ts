import * as vscode from 'vscode';
import { AnalysisResult, AttackChain, AttackChainStep } from '../types';
import { PHPAnalyzer } from './phpAnalyzer';

export class AttackChainAnalyzer {
    private ast: any;
    private analyzer: PHPAnalyzer;
    private maxDepth: number;
    private taintMap: Map<string, string>; // 变量名 -> 污点来源

    constructor(ast: any, maxDepth: number = 5) {
        this.ast = ast;
        this.analyzer = new PHPAnalyzer('');
        this.analyzer['ast'] = ast;
        this.maxDepth = maxDepth;
        this.taintMap = new Map();
        this.buildTaintMap();
    }

    // 构建污点映射，追踪变量来源
    private buildTaintMap(): void {
        const assignments = this.analyzer.getAllAssignments();
        
        for (const assign of assignments) {
            const leftName = this.getVariableName(assign.left);
            if (!leftName) continue;

            const source = this.getSourceFromNode(assign.right);
            if (source) {
                this.taintMap.set(leftName, source);
            }
        }
    }

    private getVariableName(node: any): string | null {
        if (!node) return null;
        if (node.kind === 'variable') {
            return node.name;
        }
        return null;
    }

    private getSourceFromNode(node: any): string | null {
        if (!node) return null;

        switch (node.kind) {
            case 'offsetlookup':
                // 检查是否是超全局变量访问
                if (node.what && node.what.kind === 'variable') {
                    const name = node.what.name;
                    if (['_GET', '_POST', '_COOKIE', '_REQUEST', '_FILES', '_SERVER'].includes(name)) {
                        return '$' + name;
                    }
                }
                // 递归检查
                return this.getSourceFromNode(node.what);
            
            case 'variable':
                const varName = node.name;
                // 检查是否是超全局变量
                if (['_GET', '_POST', '_COOKIE', '_REQUEST', '_FILES', '_SERVER'].includes(varName)) {
                    return '$' + varName;
                }
                // 检查是否已在 taintMap 中
                if (this.taintMap.has(varName)) {
                    return this.taintMap.get(varName)!;
                }
                return null;
            
            case 'call':
                // file_get_contents 等函数的返回值可能是污点
                const funcName = this.getFunctionName(node);
                if (funcName === 'file_get_contents') {
                    return 'file_get_contents()';
                }
                return null;
            
            case 'bin':
                // 二元操作符 (如 ?? 合并运算符)
                const leftSource = this.getSourceFromNode(node.left);
                if (leftSource) return leftSource;
                return this.getSourceFromNode(node.right);
            
            default:
                return null;
        }
    }

    analyzeAttackChains(document: vscode.TextDocument): AnalysisResult[] {
        const results: AnalysisResult[] = [];
        const chains = this.detectAttackChains(document);

        for (const chain of chains) {
            const severity = this.getSeverityFromRiskLevel(chain.riskLevel);
            const loc = chain.steps.length > 0 ? chain.steps[0].location : new vscode.Location(document.uri, new vscode.Position(0, 0));
            
            results.push({
                type: 'Attack Chain',
                severity,
                message: `${this.getRiskIcon(chain.riskLevel)} ${chain.name} (${chain.exploitability}%)`,
                location: loc,
                details: this.formatAttackChainDetails(chain),
                metadata: chain
            });
        }

        return results;
    }

    private detectAttackChains(document: vscode.TextDocument): AttackChain[] {
        const chains: AttackChain[] = [];

        // Pattern 1: Unserialize + Magic Method + Dangerous Function
        const unserializeChains = this.findUnserializationChains(document);
        chains.push(...unserializeChains);

        // Pattern 2: File operation + Phar deserialization
        const pharChains = this.findPharChains(document);
        chains.push(...pharChains);

        // Pattern 3: User input to dangerous function
        const directChains = this.findDirectInputChains(document);
        chains.push(...directChains);

        return chains;
    }

    private findUnserializationChains(document: vscode.TextDocument): AttackChain[] {
        const chains: AttackChain[] = [];
        const calls = this.analyzer.getAllFunctionCalls();

        for (const call of calls) {
            const funcName = this.getFunctionName(call);
            
            if (funcName === 'unserialize') {
                const source = this.analyzeCallSource(call);
                
                if (this.isUserControlled(source)) {
                    const loc = this.analyzer.getNodeLocation(call);
                    const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
                    const location = new vscode.Location(document.uri, position);

                    const chain: AttackChain = {
                        name: 'Unsafe Deserialization',
                        description: 'User-controlled data passed to unserialize() can lead to object injection',
                        riskLevel: 'critical',
                        exploitability: 90,
                        steps: [
                            {
                                type: 'Source',
                                description: `User input from ${source}`,
                                location,
                                code: 'User-controlled input'
                            },
                            {
                                type: 'Sink',
                                description: 'Data passed to unserialize()',
                                location,
                                code: 'unserialize($userInput)'
                            }
                        ],
                        preconditions: [
                            'User can control the serialized data',
                            'Application has exploitable gadget classes'
                        ],
                        mitigation: [
                            'Avoid unserializing user input',
                            'Use JSON instead of serialize/unserialize',
                            'Implement allowed_classes whitelist'
                        ]
                    };

                    chains.push(chain);
                }
            }
        }

        return chains;
    }

    private findPharChains(document: vscode.TextDocument): AttackChain[] {
        const chains: AttackChain[] = [];
        const pharTriggers = [
            'file_exists', 'file_get_contents', 'file_put_contents', 'file',
            'fopen', 'is_file', 'is_dir', 'is_readable', 'is_writable',
            'filesize', 'filetype', 'filemtime', 'filectime', 'fileatime',
            'copy', 'unlink', 'rename', 'rmdir', 'mkdir',
            'getimagesize', 'exif_read_data', 'stat', 'lstat'
        ];

        const calls = this.analyzer.getAllFunctionCalls();

        for (const call of calls) {
            const funcName = this.getFunctionName(call);
            
            if (pharTriggers.includes(funcName)) {
                const source = this.analyzeCallSource(call);
                
                if (this.isUserControlled(source)) {
                    const loc = this.analyzer.getNodeLocation(call);
                    const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
                    const location = new vscode.Location(document.uri, position);

                    const chain: AttackChain = {
                        name: 'Phar Deserialization',
                        description: `File operation ${funcName}() can trigger phar:// deserialization`,
                        riskLevel: 'high',
                        exploitability: 75,
                        steps: [
                            {
                                type: 'Source',
                                description: `User input from ${source}`,
                                location,
                                code: 'User-controlled filename'
                            },
                            {
                                type: 'Sink',
                                description: `Phar trigger via ${funcName}()`,
                                location,
                                code: `${funcName}('phar://...')`
                            }
                        ],
                        preconditions: [
                            'User can control file path parameter',
                            'phar:// wrapper is enabled',
                            'Application has exploitable gadget classes'
                        ],
                        mitigation: [
                            'Validate and sanitize file paths',
                            'Disable phar:// wrapper if not needed',
                            'Use realpath() to resolve paths'
                        ]
                    };

                    chains.push(chain);
                }
            }
        }

        return chains;
    }

    private findDirectInputChains(document: vscode.TextDocument): AttackChain[] {
        const chains: AttackChain[] = [];
        const dangerousFuncs = ['eval', 'assert', 'system', 'exec', 'passthru', 'shell_exec'];
        const calls = this.analyzer.getAllFunctionCalls();

        for (const call of calls) {
            const funcName = this.getFunctionName(call);
            
            if (dangerousFuncs.includes(funcName)) {
                const source = this.analyzeCallSource(call);
                
                if (this.isUserControlled(source)) {
                    const loc = this.analyzer.getNodeLocation(call);
                    const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
                    const location = new vscode.Location(document.uri, position);

                    const chain: AttackChain = {
                        name: `Direct ${funcName.toUpperCase()} Injection`,
                        description: `User input passed directly to ${funcName}()`,
                        riskLevel: 'critical',
                        exploitability: 95,
                        steps: [
                            {
                                type: 'Source',
                                description: `User input from ${source}`,
                                location,
                                code: 'User-controlled input'
                            },
                            {
                                type: 'Sink',
                                description: `Dangerous function ${funcName}()`,
                                location,
                                code: `${funcName}($userInput)`
                            }
                        ],
                        preconditions: [
                            'User can control function parameter'
                        ],
                        mitigation: [
                            `Avoid using ${funcName}() with user input`,
                            'Use safe alternatives',
                            'Implement strict input validation'
                        ]
                    };

                    chains.push(chain);
                }
            }
        }

        return chains;
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

        // 支持方法调用 $obj->method()
        if (callNode.what.kind === 'propertylookup') {
            const methodName = callNode.what.offset?.name || callNode.what.offset || '';
            return (typeof methodName === 'string' ? methodName : '').toLowerCase();
        }

        return '';
    }

    private analyzeCallSource(callNode: any): string {
        if (!callNode.arguments || callNode.arguments.length === 0) {
            return 'unknown';
        }

        const firstArg = callNode.arguments[0];
        // 使用新的污点追踪逻辑
        const taintSource = this.getSourceFromNode(firstArg);
        if (taintSource) {
            return taintSource;
        }
        return this.traceSource(firstArg);
    }

    private traceSource(node: any): string {
        if (!node) {
            return 'unknown';
        }

        switch (node.kind) {
            case 'variable':
                const varName = node.name || 'unknown';
                // 检查是否是超全局变量
                if (['_GET', '_POST', '_COOKIE', '_REQUEST', '_FILES', '_SERVER'].includes(varName)) {
                    return '$' + varName;
                }
                // 检查污点映射
                if (this.taintMap.has(varName)) {
                    return this.taintMap.get(varName)!;
                }
                return '$' + varName;
            
            case 'offsetlookup':
                if (node.what && node.what.kind === 'variable') {
                    const name = node.what.name;
                    if (['_GET', '_POST', '_COOKIE', '_REQUEST', '_FILES', '_SERVER'].includes(name)) {
                        return '$' + name;
                    }
                }
                return 'array access';
            
            case 'call':
                const funcName = this.getFunctionName(node);
                return funcName + '()';
            
            case 'bin':
                // 二元操作符
                const leftSource = this.traceSource(node.left);
                if (this.isUserControlled(leftSource)) {
                    return leftSource;
                }
                return this.traceSource(node.right);
            
            default:
                return node.kind || 'unknown';
        }
    }

    private isUserControlled(source: string): boolean {
        const userInputs = ['$_GET', '$_POST', '$_COOKIE', '$_REQUEST', '$_FILES', '$_SERVER', 'file_get_contents()'];
        return userInputs.some(input => source.includes(input));
    }

    private getSeverityFromRiskLevel(riskLevel: string): 'critical' | 'error' | 'warning' | 'info' {
        switch (riskLevel) {
            case 'critical':
                return 'critical';
            case 'high':
                return 'error';
            case 'medium':
                return 'warning';
            default:
                return 'info';
        }
    }

    private getRiskIcon(riskLevel: string): string {
        switch (riskLevel) {
            case 'critical':
                return '🔴';
            case 'high':
                return '🟠';
            case 'medium':
                return '🟡';
            default:
                return '🟢';
        }
    }

    private formatAttackChainDetails(chain: AttackChain): string {
        let details = `Name: ${chain.name}\n`;
        details += `Risk Level: ${this.getRiskIcon(chain.riskLevel)} ${chain.riskLevel.toUpperCase()}\n`;
        details += `Exploitability: ${chain.exploitability}%\n`;
        details += `\n${chain.description}\n`;
        
        details += `\nAttack Steps:\n`;
        for (let i = 0; i < chain.steps.length; i++) {
            const step = chain.steps[i];
            details += `  ${i + 1}. [${step.type}] ${step.description}\n`;
        }

        details += `\nPreconditions:\n`;
        for (const condition of chain.preconditions) {
            details += `  • ${condition}\n`;
        }

        details += `\nMitigation:\n`;
        for (const mitigation of chain.mitigation) {
            details += `  • ${mitigation}\n`;
        }

        return details;
    }
}

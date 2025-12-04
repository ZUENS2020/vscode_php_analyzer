import * as vscode from 'vscode';
import { AnalysisResult, VariableReference } from '../types';
import { PHPAnalyzer } from './phpAnalyzer';

export class VariableTracker {
    private ast: any;
    private analyzer: PHPAnalyzer;

    constructor(ast: any) {
        this.ast = ast;
        this.analyzer = new PHPAnalyzer('');
        this.analyzer['ast'] = ast;
    }

    trackVariable(variableName: string, document: vscode.TextDocument): AnalysisResult[] {
        const results: AnalysisResult[] = [];
        const references: VariableReference[] = [];

        this.analyzer.traverse(this.ast, (node, parent) => {
            if (this.isVariableNode(node, variableName)) {
                const ref = this.createVariableReference(node, parent, document);
                if (ref) {
                    references.push(ref);
                }
            }
        });

        // Group by type
        const definitions = references.filter(r => r.type === 'definition');
        const assignments = references.filter(r => r.type === 'assignment');
        const reads = references.filter(r => r.type === 'read');

        // Create results
        if (definitions.length > 0) {
            results.push({
                type: 'Variable Definitions',
                severity: 'info',
                message: `${variableName} defined ${definitions.length} time(s)`,
                location: definitions[0].location,
                details: definitions.map(d => `Line ${d.location.range.start.line + 1}: ${d.context}`).join('\n'),
                metadata: { references: definitions }
            });
        }

        if (assignments.length > 0) {
            results.push({
                type: 'Variable Assignments',
                severity: 'info',
                message: `${variableName} assigned ${assignments.length} time(s)`,
                location: assignments[0].location,
                details: assignments.map(a => `Line ${a.location.range.start.line + 1}: ${a.context}`).join('\n'),
                metadata: { references: assignments }
            });
        }

        if (reads.length > 0) {
            results.push({
                type: 'Variable References',
                severity: 'info',
                message: `${variableName} referenced ${reads.length} time(s)`,
                location: reads[0].location,
                details: reads.map(r => `Line ${r.location.range.start.line + 1}: ${r.context}`).join('\n'),
                metadata: { references: reads }
            });
        }

        return results;
    }

    private isVariableNode(node: any, variableName: string): boolean {
        if (!node || !node.kind) {
            return false;
        }

        if (node.kind === 'variable' && node.name === variableName.substring(1)) {
            return true;
        }

        return false;
    }

    private createVariableReference(node: any, parent: any, document: vscode.TextDocument): VariableReference | null {
        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return null;
        }

        const position = new vscode.Position(loc.line, loc.character);
        const range = document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
        const location = new vscode.Location(document.uri, range);

        let type: 'definition' | 'assignment' | 'read' = 'read';
        let context = '';
        let value: string | undefined;

        // Determine type based on parent
        if (parent) {
            if (parent.kind === 'assign' && parent.left === node) {
                type = 'assignment';
                context = this.getCodeSnippet(document, loc.line);
                if (parent.right) {
                    value = this.extractValue(parent.right);
                }
            } else if (parent.kind === 'parameter') {
                type = 'definition';
                context = 'Function parameter';
            } else {
                type = 'read';
                context = this.getCodeSnippet(document, loc.line);
            }
        }

        return {
            name: '$' + node.name,
            type,
            location,
            context,
            value
        };
    }

    private getCodeSnippet(document: vscode.TextDocument, line: number): string {
        if (line < 0 || line >= document.lineCount) {
            return '';
        }
        return document.lineAt(line).text.trim();
    }

    private extractValue(node: any): string {
        if (!node) {
            return 'unknown';
        }

        switch (node.kind) {
            case 'string':
                return `"${node.value}"`;
            case 'number':
                return String(node.value);
            case 'boolean':
                return String(node.value);
            case 'array':
                return '[array]';
            case 'call':
                const name = node.what?.name || 'function';
                return `${name}()`;
            case 'variable':
                return '$' + node.name;
            default:
                return node.kind || 'unknown';
        }
    }
}

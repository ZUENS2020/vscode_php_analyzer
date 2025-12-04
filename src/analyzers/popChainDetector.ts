import * as vscode from 'vscode';
import { AnalysisResult, POPChain, POPChainStep } from '../types';
import { PHPAnalyzer } from './phpAnalyzer';

export class POPChainDetector {
    private ast: any;
    private analyzer: PHPAnalyzer;
    private maxDepth: number;

    // Magic method trigger patterns
    private readonly triggerPatterns = {
        '__invoke': ['call_user_func', 'call_user_func_array', 'variable_as_function'],
        '__toString': ['echo', 'print', 'string_concat'],
        '__get': ['property_read'],
        '__set': ['property_write'],
        '__call': ['undefined_method_call'],
        '__destruct': ['unset', 'end_of_scope'],
        '__wakeup': ['unserialize'],
        '__sleep': ['serialize'],
        '__clone': ['clone'],
        '__isset': ['isset', 'empty'],
        '__unset': ['unset']
    };

    constructor(ast: any, maxDepth: number = 5) {
        this.ast = ast;
        this.analyzer = new PHPAnalyzer('');
        this.analyzer['ast'] = ast;
        this.maxDepth = maxDepth;
    }

    findPOPChains(document: vscode.TextDocument): AnalysisResult[] {
        const results: AnalysisResult[] = [];
        const chains = this.detectChains(document);

        for (const chain of chains) {
            const loc = chain.steps.length > 0 ? chain.steps[0].location : new vscode.Location(document.uri, new vscode.Position(0, 0));
            
            results.push({
                type: 'POP Chain',
                severity: chain.exploitability > 70 ? 'error' : chain.exploitability > 40 ? 'warning' : 'info',
                message: `${chain.entryPoint} → ... → ${chain.sink}`,
                location: loc,
                details: this.formatChainDetails(chain),
                metadata: chain
            });
        }

        return results;
    }

    private detectChains(document: vscode.TextDocument): POPChain[] {
        const chains: POPChain[] = [];
        const classes = this.analyzer.getAllClasses();

        // Find entry points (magic methods that auto-trigger)
        const entryPoints = ['__destruct', '__wakeup', '__toString'];

        for (const classNode of classes) {
            const className = classNode.name?.name || 'Unknown';
            
            if (!classNode.body) {
                continue;
            }

            for (const member of classNode.body) {
                if (member.kind === 'method') {
                    const methodName = member.name?.name || member.name || '';
                    
                    if (entryPoints.includes(methodName)) {
                        // Trace from this entry point
                        const foundChains = this.traceFromMethod(className, methodName, member, document, 0);
                        chains.push(...foundChains);
                    }
                }
            }
        }

        return chains;
    }

    private traceFromMethod(className: string, methodName: string, methodNode: any, document: vscode.TextDocument, depth: number): POPChain[] {
        if (depth >= this.maxDepth) {
            return [];
        }

        const chains: POPChain[] = [];
        const steps: POPChainStep[] = [];
        
        const loc = this.analyzer.getNodeLocation(methodNode);
        const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
        const location = new vscode.Location(document.uri, position);

        // Look for dangerous operations in this method
        const dangerousOps = this.findDangerousOperations(methodNode);

        for (const op of dangerousOps) {
            const step: POPChainStep = {
                className,
                methodName,
                operation: op.operation,
                location: op.location
            };

            chains.push({
                entryPoint: `${className}::${methodName}`,
                steps: [step],
                sink: op.operation,
                exploitability: this.calculateExploitability(methodName, op.operation),
                description: this.generateChainDescription(methodName, op.operation)
            });
        }

        // Look for method calls that could continue the chain
        this.analyzer.traverse(methodNode, (node) => {
            if (node.kind === 'call' && node.what && node.what.kind === 'propertylookup') {
                // This is a method call on an object property
                // Could be part of a gadget chain
                const methodCall = node.what.offset?.name || '';
                
                if (this.analyzer.isMagicMethod(methodCall)) {
                    // Found a magic method call - potential chain link
                    const nextStep: POPChainStep = {
                        className: 'Unknown',
                        methodName: methodCall,
                        operation: 'magic method call',
                        location
                    };

                    chains.push({
                        entryPoint: `${className}::${methodName}`,
                        steps: [nextStep],
                        sink: 'chain continues',
                        exploitability: 50,
                        description: `Calls magic method ${methodCall}`
                    });
                }
            }
        });

        return chains;
    }

    private findDangerousOperations(methodNode: any): Array<{ operation: string; location: vscode.Location }> {
        const operations: Array<{ operation: string; location: vscode.Location }> = [];
        
        this.analyzer.traverse(methodNode, (node) => {
            if (node.kind === 'call' && node.what) {
                const funcName = node.what.name || '';
                if (this.analyzer.isDangerousFunction(funcName)) {
                    const loc = this.analyzer.getNodeLocation(node);
                    const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
                    
                    operations.push({
                        operation: funcName,
                        location: new vscode.Location(vscode.Uri.file(''), position)
                    });
                }
            }
        });

        return operations;
    }

    private calculateExploitability(entryMethod: string, sinkFunction: string): number {
        let score = 0;

        // Entry point scoring
        if (entryMethod === '__destruct') {
            score += 40; // Auto-called after unserialize
        } else if (entryMethod === '__wakeup') {
            score += 35; // Auto-called after unserialize
        } else if (entryMethod === '__toString') {
            score += 30; // Can be triggered in many contexts
        } else {
            score += 10;
        }

        // Sink function scoring
        const highRiskFuncs = ['eval', 'assert', 'system', 'exec', 'passthru', 'shell_exec'];
        const mediumRiskFuncs = ['call_user_func', 'call_user_func_array', 'unserialize'];
        
        if (highRiskFuncs.includes(sinkFunction)) {
            score += 50;
        } else if (mediumRiskFuncs.includes(sinkFunction)) {
            score += 30;
        } else {
            score += 20;
        }

        return Math.min(score, 100);
    }

    private generateChainDescription(entryMethod: string, sinkFunction: string): string {
        return `POP chain starting from ${entryMethod} leading to ${sinkFunction}()`;
    }

    private formatChainDetails(chain: POPChain): string {
        let details = `Entry Point: ${chain.entryPoint}\n`;
        details += `Sink: ${chain.sink}\n`;
        details += `Exploitability: ${chain.exploitability}%\n`;
        details += `\nChain Steps:\n`;
        
        for (let i = 0; i < chain.steps.length; i++) {
            const step = chain.steps[i];
            details += `  ${i + 1}. ${step.className}::${step.methodName} - ${step.operation}\n`;
        }

        details += `\nDescription: ${chain.description}`;
        
        return details;
    }

    /**
     * Identify which magic method would be triggered by a given operation
     */
    identifyTrigger(operation: string): string[] {
        const triggers: string[] = [];
        
        for (const [magicMethod, patterns] of Object.entries(this.triggerPatterns)) {
            for (const pattern of patterns) {
                if (operation.includes(pattern) || pattern === operation) {
                    triggers.push(magicMethod);
                }
            }
        }
        
        return triggers;
    }

    /**
     * Check if a node is a magic method trigger point
     */
    isMagicMethodTrigger(node: any): { isTrigger: boolean; triggeredMethod: string; pattern: string } {
        let isTrigger = false;
        let triggeredMethod = '';
        let pattern = '';

        if (node.kind === 'call') {
            const funcName = node.what?.name || '';
            
            // Check for unserialize (triggers __wakeup)
            if (funcName === 'unserialize') {
                return { isTrigger: true, triggeredMethod: '__wakeup', pattern: 'unserialize' };
            }
            
            // Check for call_user_func (triggers __invoke)
            if (funcName === 'call_user_func' || funcName === 'call_user_func_array') {
                return { isTrigger: true, triggeredMethod: '__invoke', pattern: funcName };
            }

            // Dynamic function call like $var() triggers __invoke
            if (node.what && (node.what.kind === 'variable' || node.what.kind === 'propertylookup')) {
                return { isTrigger: true, triggeredMethod: '__invoke', pattern: 'variable_as_function' };
            }
        }

        // Property assignment triggers __set
        if (node.kind === 'propertylookup' && this.isInWriteContext(node)) {
            return { isTrigger: true, triggeredMethod: '__set', pattern: 'property_write' };
        }

        return { isTrigger, triggeredMethod, pattern };
    }

    /**
     * Check if a property lookup is in a write context (assignment)
     * NOTE: This is a simplified implementation. Full context detection would require
     * parent node tracking during AST traversal, which is not currently implemented.
     * This may lead to some false positives in __set trigger detection.
     */
    private isInWriteContext(node: any): boolean {
        // Simplified: assume property lookups could be writes
        // A full implementation would need to check if this node is the left side of an assignment
        return true;
    }
}

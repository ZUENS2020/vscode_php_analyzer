import * as vscode from 'vscode';
import { AnalysisResult, MagicMethod } from '../types';
import { PHPAnalyzer } from './phpAnalyzer';

export class MagicMethodDetector {
    private ast: any;
    private analyzer: PHPAnalyzer;

    constructor(ast: any) {
        this.ast = ast;
        this.analyzer = new PHPAnalyzer('');
        this.analyzer['ast'] = ast;
    }

    findMagicMethods(document: vscode.TextDocument): AnalysisResult[] {
        const results: AnalysisResult[] = [];
        const classes = this.analyzer.getAllClasses();

        for (const classNode of classes) {
            const className = classNode.name?.name || 'Unknown';
            
            if (!classNode.body) {
                continue;
            }

            for (const member of classNode.body) {
                if (member.kind === 'method') {
                    const methodName = member.name?.name || member.name || '';
                    
                    if (this.analyzer.isMagicMethod(methodName)) {
                        const isDangerous = this.isMethodDangerous(member);
                        const dangerousOps = this.findDangerousOperations(member);
                        
                        const loc = this.analyzer.getNodeLocation(member);
                        const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
                        const location = new vscode.Location(document.uri, position);

                        results.push({
                            type: 'Magic Method',
                            severity: isDangerous ? 'warning' : 'info',
                            message: `${className}::${methodName}${isDangerous ? ' ⚠️ DANGEROUS' : ''}`,
                            location,
                            details: this.getMagicMethodDetails(methodName, dangerousOps),
                            metadata: {
                                className,
                                methodName,
                                isDangerous,
                                dangerousOps
                            }
                        });
                    }
                }
            }
        }

        return results;
    }

    private isMethodDangerous(methodNode: any): boolean {
        const ops = this.findDangerousOperations(methodNode);
        return ops.length > 0;
    }

    private findDangerousOperations(methodNode: any): string[] {
        const operations: Set<string> = new Set();
        
        this.analyzer.traverse(methodNode, (node) => {
            if (node.kind === 'call' && node.what) {
                const funcName = node.what.name || '';
                if (this.analyzer.isDangerousFunction(funcName)) {
                    operations.add(funcName);
                }
            }
        });

        return Array.from(operations);
    }

    private getMagicMethodDetails(methodName: string, dangerousOps: string[]): string {
        const descriptions: { [key: string]: string } = {
            '__construct': 'Constructor - called when creating a new object',
            '__destruct': 'Destructor - called when object is destroyed (反序列化后自动调用)',
            '__wakeup': 'Called after unserialize() (反序列化时调用)',
            '__sleep': 'Called before serialize() (序列化时调用)',
            '__toString': 'Called when object is treated as string (对象转字符串时调用)',
            '__call': 'Called when invoking inaccessible methods (调用不存在的方法时触发)',
            '__callStatic': 'Called when invoking inaccessible static methods',
            '__get': 'Called when accessing inaccessible properties (访问不存在的属性时触发)',
            '__set': 'Called when setting inaccessible properties (设置不存在的属性时触发)',
            '__invoke': 'Called when object is used as function (对象作为函数调用时触发)',
            '__isset': 'Called when isset() is used on inaccessible properties',
            '__unset': 'Called when unset() is used on inaccessible properties',
            '__serialize': 'PHP 7.4+ replacement for __wakeup',
            '__unserialize': 'PHP 7.4+ replacement for __sleep',
            '__clone': 'Called when object is cloned',
            '__debugInfo': 'Called by var_dump()',
            '__set_state': 'Called for var_export()'
        };

        let details = descriptions[methodName] || 'Magic method';
        
        if (dangerousOps.length > 0) {
            details += '\n\n⚠️ Dangerous operations detected:\n';
            details += dangerousOps.map(op => `  - ${op}()`).join('\n');
        }

        return details;
    }
}

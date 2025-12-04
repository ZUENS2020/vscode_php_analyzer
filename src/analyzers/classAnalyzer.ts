import * as vscode from 'vscode';
import { AnalysisResult, ClassInfo, PropertyInfo, MethodInfo } from '../types';
import { PHPAnalyzer } from './phpAnalyzer';

export class ClassAnalyzer {
    private ast: any;
    private analyzer: PHPAnalyzer;

    constructor(ast: any) {
        this.ast = ast;
        this.analyzer = new PHPAnalyzer('');
        this.analyzer['ast'] = ast;
    }

    analyzeClass(className: string, document: vscode.TextDocument): AnalysisResult[] {
        const results: AnalysisResult[] = [];
        const classNode = this.analyzer.findClassByName(className);

        if (!classNode) {
            return [{
                type: 'Error',
                severity: 'error',
                message: `Class ${className} not found`,
                location: new vscode.Location(document.uri, new vscode.Position(0, 0))
            }];
        }

        const classInfo = this.extractClassInfo(classNode, document);
        
        // Basic info
        results.push({
            type: 'Class Info',
            severity: 'info',
            message: `Class: ${classInfo.name}`,
            location: classInfo.location,
            details: this.formatClassInfo(classInfo)
        });

        // Properties
        if (classInfo.properties.length > 0) {
            const propDetails = classInfo.properties.map(p => 
                `${p.visibility} ${p.isStatic ? 'static ' : ''}$${p.name}${p.defaultValue ? ' = ' + p.defaultValue : ''}`
            ).join('\n');

            results.push({
                type: 'Properties',
                severity: 'info',
                message: `${classInfo.properties.length} properties`,
                location: classInfo.location,
                details: propDetails,
                metadata: { properties: classInfo.properties }
            });
        }

        // Methods
        if (classInfo.methods.length > 0) {
            const methodDetails = classInfo.methods.map(m => 
                `${m.visibility} ${m.isStatic ? 'static ' : ''}${m.isAbstract ? 'abstract ' : ''}${m.name}(${this.formatParameters(m.parameters)})`
            ).join('\n');

            results.push({
                type: 'Methods',
                severity: 'info',
                message: `${classInfo.methods.length} methods`,
                location: classInfo.location,
                details: methodDetails,
                metadata: { methods: classInfo.methods }
            });
        }

        // Magic methods
        if (classInfo.magicMethods.length > 0) {
            const magicDetails = classInfo.magicMethods.map(m => 
                `${m.name} ${m.isDangerous ? '⚠️ DANGEROUS' : ''}`
            ).join('\n');

            results.push({
                type: 'Magic Methods',
                severity: classInfo.magicMethods.some(m => m.isDangerous) ? 'warning' : 'info',
                message: `${classInfo.magicMethods.length} magic methods`,
                location: classInfo.location,
                details: magicDetails,
                metadata: { magicMethods: classInfo.magicMethods }
            });
        }

        // Inheritance
        if (classInfo.extends) {
            results.push({
                type: 'Inheritance',
                severity: 'info',
                message: `Extends: ${classInfo.extends}`,
                location: classInfo.location
            });
        }

        if (classInfo.implements.length > 0) {
            results.push({
                type: 'Interfaces',
                severity: 'info',
                message: `Implements: ${classInfo.implements.join(', ')}`,
                location: classInfo.location
            });
        }

        return results;
    }

    private extractClassInfo(classNode: any, document: vscode.TextDocument): ClassInfo {
        const loc = this.analyzer.getNodeLocation(classNode);
        const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
        const location = new vscode.Location(document.uri, position);

        const info: ClassInfo = {
            name: classNode.name?.name || 'Unknown',
            namespace: this.extractNamespace(classNode),
            extends: classNode.extends?.name || undefined,
            implements: this.extractImplements(classNode),
            properties: [],
            methods: [],
            magicMethods: [],
            location
        };

        if (classNode.body) {
            for (const member of classNode.body) {
                if (member.kind === 'property') {
                    info.properties.push(this.extractProperty(member));
                } else if (member.kind === 'method') {
                    const method = this.extractMethod(member, document);
                    info.methods.push(method);
                    
                    if (this.analyzer.isMagicMethod(method.name)) {
                        info.magicMethods.push({
                            name: method.name,
                            className: info.name,
                            isDangerous: this.isMethodDangerous(member),
                            dangerousOperations: this.findDangerousOperations(member),
                            location
                        });
                    }
                }
            }
        }

        return info;
    }

    private extractNamespace(classNode: any): string | undefined {
        // Simplified namespace extraction
        return undefined;
    }

    private extractImplements(classNode: any): string[] {
        if (!classNode.implements) {
            return [];
        }
        return classNode.implements.map((i: any) => i.name || 'Unknown');
    }

    private extractProperty(propNode: any): PropertyInfo {
        const prop = propNode.properties?.[0] || propNode;
        return {
            name: prop.name?.name || prop.name || 'unknown',
            visibility: propNode.visibility || 'public',
            isStatic: propNode.isStatic || false,
            defaultValue: prop.value ? this.extractDefaultValue(prop.value) : undefined
        };
    }

    private extractMethod(methodNode: any, document: vscode.TextDocument): MethodInfo {
        return {
            name: methodNode.name?.name || methodNode.name || 'unknown',
            visibility: methodNode.visibility || 'public',
            isStatic: methodNode.isStatic || false,
            isAbstract: methodNode.isAbstract || false,
            parameters: this.extractParameters(methodNode),
            returnType: methodNode.type?.name || undefined
        };
    }

    private extractParameters(methodNode: any): any[] {
        if (!methodNode.arguments) {
            return [];
        }

        return methodNode.arguments.map((arg: any) => ({
            name: arg.name?.name || arg.name || 'unknown',
            type: arg.type?.name || undefined,
            defaultValue: arg.value ? this.extractDefaultValue(arg.value) : undefined
        }));
    }

    private extractDefaultValue(valueNode: any): string {
        if (!valueNode) return 'null';
        
        switch (valueNode.kind) {
            case 'string':
                return `"${valueNode.value}"`;
            case 'number':
                return String(valueNode.value);
            case 'boolean':
                return valueNode.value ? 'true' : 'false';
            case 'array':
                return '[]';
            default:
                return 'unknown';
        }
    }

    private isMethodDangerous(methodNode: any): boolean {
        const ops = this.findDangerousOperations(methodNode);
        return ops.length > 0;
    }

    private findDangerousOperations(methodNode: any): string[] {
        const operations: string[] = [];
        
        this.analyzer.traverse(methodNode, (node) => {
            if (node.kind === 'call' && node.what) {
                const funcName = node.what.name || '';
                if (this.analyzer.isDangerousFunction(funcName)) {
                    operations.push(funcName);
                }
            }
        });

        return operations;
    }

    private formatClassInfo(info: ClassInfo): string {
        let result = `Class: ${info.name}\n`;
        if (info.namespace) {
            result += `Namespace: ${info.namespace}\n`;
        }
        if (info.extends) {
            result += `Extends: ${info.extends}\n`;
        }
        if (info.implements.length > 0) {
            result += `Implements: ${info.implements.join(', ')}\n`;
        }
        result += `Properties: ${info.properties.length}\n`;
        result += `Methods: ${info.methods.length}\n`;
        result += `Magic Methods: ${info.magicMethods.length}`;
        return result;
    }

    private formatParameters(params: any[]): string {
        return params.map(p => {
            let result = '';
            if (p.type) {
                result += p.type + ' ';
            }
            result += '$' + p.name;
            if (p.defaultValue) {
                result += ' = ' + p.defaultValue;
            }
            return result;
        }).join(', ');
    }
}

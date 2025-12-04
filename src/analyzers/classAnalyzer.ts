import { PhpAnalyzer } from './phpAnalyzer';
import { ClassInfo, MagicMethod, ClassRelation } from '../models/analysisModels';

export class ClassAnalyzer {
    private readonly MAGIC_METHODS = [
        '__construct',
        '__destruct',
        '__call',
        '__callStatic',
        '__get',
        '__set',
        '__isset',
        '__unset',
        '__sleep',
        '__wakeup',
        '__serialize',
        '__unserialize',
        '__toString',
        '__invoke',
        '__set_state',
        '__clone',
        '__debugInfo'
    ];

    constructor(private analyzer: PhpAnalyzer) {}

    async analyzeClass(code: string, className: string): Promise<ClassInfo> {
        const ast = this.analyzer.parseCode(code);
        if (!ast) {
            throw new Error('Failed to parse PHP code');
        }

        // Find the class node
        const classNodes = this.analyzer.findNodes(ast, (node) => {
            if (node.kind === 'class') {
                const name = this.analyzer.extractClassName(node);
                return name === className;
            }
            return false;
        });

        if (classNodes.length === 0) {
            throw new Error(`Class ${className} not found`);
        }

        const classNode = classNodes[0];

        // Extract class information
        const properties = this.extractProperties(classNode);
        const methods = this.extractMethods(classNode);
        const magicMethods = this.extractMagicMethods(classNode);
        const parent = this.extractParent(classNode);
        const interfaces = this.extractInterfaces(classNode);
        const instantiations = this.findInstantiations(ast, className);

        return {
            name: className,
            location: this.analyzer.getLocation(classNode)!,
            properties,
            methods,
            magicMethods,
            parent,
            interfaces,
            instantiations
        };
    }

    async findAllMagicMethods(code: string): Promise<MagicMethod[]> {
        const ast = this.analyzer.parseCode(code);
        if (!ast) {
            throw new Error('Failed to parse PHP code');
        }

        const magicMethods: MagicMethod[] = [];

        // Find all class nodes
        const classNodes = this.analyzer.findNodesByType(ast, 'class');

        for (const classNode of classNodes) {
            const className = this.analyzer.extractClassName(classNode) || 'Unknown';
            const methods = this.extractMagicMethods(classNode);
            
            methods.forEach(method => {
                magicMethods.push({
                    ...method,
                    className
                });
            });
        }

        return magicMethods;
    }

    async buildClassHierarchy(code: string): Promise<ClassRelation[]> {
        const ast = this.analyzer.parseCode(code);
        if (!ast) {
            throw new Error('Failed to parse PHP code');
        }

        const relations: ClassRelation[] = [];
        const classNodes = this.analyzer.findNodesByType(ast, 'class');

        for (const classNode of classNodes) {
            const className = this.analyzer.extractClassName(classNode) || 'Unknown';
            const parent = this.extractParent(classNode);
            const interfaces = this.extractInterfaces(classNode);

            if (parent) {
                relations.push({
                    child: className,
                    parent: parent,
                    type: 'extends'
                });
            }

            interfaces.forEach(iface => {
                relations.push({
                    child: className,
                    parent: iface,
                    type: 'implements'
                });
            });
        }

        return relations;
    }

    private extractProperties(classNode: any): any[] {
        const properties: any[] = [];
        
        if (classNode.body) {
            for (const item of classNode.body) {
                if (item.kind === 'propertystatement') {
                    item.properties?.forEach((prop: any) => {
                        properties.push({
                            name: prop.name,
                            visibility: item.visibility || 'public',
                            isStatic: item.isStatic || false,
                            location: this.analyzer.getLocation(prop)
                        });
                    });
                }
            }
        }

        return properties;
    }

    private extractMethods(classNode: any): any[] {
        const methods: any[] = [];
        
        if (classNode.body) {
            for (const item of classNode.body) {
                if (item.kind === 'method') {
                    methods.push({
                        name: item.name?.name || 'unknown',
                        visibility: item.visibility || 'public',
                        isStatic: item.isStatic || false,
                        location: this.analyzer.getLocation(item)
                    });
                }
            }
        }

        return methods;
    }

    private extractMagicMethods(classNode: any): MagicMethod[] {
        const magicMethods: MagicMethod[] = [];
        
        if (classNode.body) {
            for (const item of classNode.body) {
                if (item.kind === 'method') {
                    const methodName = item.name?.name || '';
                    if (this.MAGIC_METHODS.includes(methodName)) {
                        magicMethods.push({
                            name: methodName,
                            location: this.analyzer.getLocation(item)!,
                            body: this.extractMethodBody(item),
                            isDangerous: this.isDangerousMagicMethod(methodName, item),
                            className: ''  // Will be set by caller
                        });
                    }
                }
            }
        }

        return magicMethods;
    }

    private extractParent(classNode: any): string | null {
        if (classNode.extends) {
            return classNode.extends.name || null;
        }
        return null;
    }

    private extractInterfaces(classNode: any): string[] {
        const interfaces: string[] = [];
        
        if (classNode.implements) {
            for (const iface of classNode.implements) {
                if (iface.name) {
                    interfaces.push(iface.name);
                }
            }
        }

        return interfaces;
    }

    private findInstantiations(ast: any, className: string): any[] {
        const instantiations: any[] = [];
        
        const newNodes = this.analyzer.findNodes(ast, (node) => {
            return node.kind === 'new' && node.what?.name === className;
        });

        for (const node of newNodes) {
            const location = this.analyzer.getLocation(node);
            if (location) {
                instantiations.push({
                    location,
                    arguments: node.arguments || []
                });
            }
        }

        return instantiations;
    }

    private extractMethodBody(methodNode: any): string {
        // Simplified body extraction
        if (methodNode.body && methodNode.body.children) {
            return `${methodNode.body.children.length} statements`;
        }
        return 'empty';
    }

    private isDangerousMagicMethod(methodName: string, methodNode: any): boolean {
        // Methods that are commonly used in deserialization attacks
        const dangerousMethods = ['__wakeup', '__destruct', '__toString', '__call'];
        
        if (!dangerousMethods.includes(methodName)) {
            return false;
        }

        // Check for dangerous operations in the method by traversing AST
        const dangerousFunctions = [
            'eval',
            'system',
            'exec',
            'passthru',
            'shell_exec',
            'file_get_contents',
            'file_put_contents',
            'unlink',
            'include',
            'require'
        ];

        // Traverse the method body to look for dangerous function calls
        const hasDangerousCall = (node: any): boolean => {
            if (!node || typeof node !== 'object') {
                return false;
            }

            if (node.kind === 'call') {
                const funcName = this.extractFunctionName(node);
                if (dangerousFunctions.includes(funcName)) {
                    return true;
                }
            }

            // Recursively check children
            const keys = Object.keys(node);
            for (const key of keys) {
                if (key === 'loc') {
                    continue;
                }
                const value = node[key];
                if (Array.isArray(value)) {
                    if (value.some(child => hasDangerousCall(child))) {
                        return true;
                    }
                } else if (typeof value === 'object' && hasDangerousCall(value)) {
                    return true;
                }
            }

            return false;
        };

        return hasDangerousCall(methodNode.body);
    }

    private extractFunctionName(callNode: any): string {
        if (callNode.what) {
            if (callNode.what.kind === 'identifier') {
                return callNode.what.name;
            }
            if (callNode.what.name) {
                return callNode.what.name;
            }
        }
        return '';
    }
}

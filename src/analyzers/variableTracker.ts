import { PhpAnalyzer } from './phpAnalyzer';
import { VariableReference, VariableDefinition, VariableTracking } from '../models/analysisModels';

export class VariableTracker {
    constructor(private analyzer: PhpAnalyzer) {}

    async trackVariable(code: string, variableName: string): Promise<VariableTracking> {
        const ast = this.analyzer.parseCode(code);
        if (!ast) {
            throw new Error('Failed to parse PHP code');
        }

        // Normalize variable name (remove $ if present)
        const normalizedName = variableName.startsWith('$') 
            ? variableName.substring(1) 
            : variableName;

        const definitions: VariableDefinition[] = [];
        const references: VariableReference[] = [];
        const typeChanges: any[] = [];

        // Find all variable nodes
        const variableNodes = this.analyzer.findNodes(ast, (node) => {
            if (node.kind === 'variable') {
                const name = this.analyzer.extractVariableName(node);
                return name === normalizedName;
            }
            return false;
        });

        // Categorize nodes as definitions or references
        for (const node of variableNodes) {
            const location = this.analyzer.getLocation(node);
            if (!location) continue;

            // Check if this is a definition (assignment)
            if (this.isDefinition(node)) {
                definitions.push({
                    name: normalizedName,
                    location: location,
                    type: this.inferType(node),
                    value: this.extractValue(node)
                });
            } else {
                references.push({
                    name: normalizedName,
                    location: location,
                    context: this.getContext(node)
                });
            }
        }

        // Track type changes
        const uniqueTypes = new Set<string>();
        definitions.forEach(def => {
            if (def.type && !uniqueTypes.has(def.type)) {
                uniqueTypes.add(def.type);
                typeChanges.push({
                    location: def.location,
                    type: def.type,
                    value: def.value
                });
            }
        });

        return {
            variableName: normalizedName,
            definitions,
            references,
            typeChanges
        };
    }

    private isDefinition(node: any): boolean {
        // Check if parent is an assignment
        let current = node;
        while (current) {
            if (current.kind === 'assign' && current.left === node) {
                return true;
            }
            if (current.kind === 'parameter') {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    private inferType(node: any): string {
        // Try to infer type from assignment value
        let current = node;
        while (current) {
            if (current.kind === 'assign') {
                const right = current.right;
                if (right) {
                    return this.getNodeType(right);
                }
            }
            current = current.parent;
        }
        return 'unknown';
    }

    private getNodeType(node: any): string {
        if (!node) return 'unknown';

        switch (node.kind) {
            case 'string':
                return 'string';
            case 'number':
                return 'number';
            case 'boolean':
                return 'boolean';
            case 'array':
                return 'array';
            case 'new':
                return node.what?.name || 'object';
            case 'call':
                return 'mixed';
            default:
                return 'unknown';
        }
    }

    private extractValue(node: any): string | null {
        let current = node;
        while (current) {
            if (current.kind === 'assign') {
                const right = current.right;
                if (right) {
                    return this.nodeToString(right);
                }
            }
            current = current.parent;
        }
        return null;
    }

    private nodeToString(node: any): string {
        if (!node) return '';

        switch (node.kind) {
            case 'string':
                return `"${node.value}"`;
            case 'number':
                return String(node.value);
            case 'boolean':
                return node.value ? 'true' : 'false';
            case 'array':
                return '[...]';
            case 'new':
                return `new ${node.what?.name || 'Unknown'}()`;
            case 'call':
                return `${node.what?.name || 'function'}()`;
            default:
                return '...';
        }
    }

    private getContext(node: any): string {
        const current = node.parent;
        if (current) {
            switch (current.kind) {
                case 'call':
                    return 'function call';
                case 'assign':
                    return 'assignment';
                case 'return':
                    return 'return statement';
                case 'if':
                    return 'condition';
                case 'echo':
                    return 'echo statement';
                default:
                    return current.kind || 'unknown';
            }
        }
        return 'unknown';
    }
}

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

        // Find all nodes and build parent-child relationships
        const nodesWithParents: Array<{ node: any; parent: any }> = [];
        
        const buildParentRefs = (node: any, parent: any = null) => {
            if (!node || typeof node !== 'object') {
                return;
            }

            nodesWithParents.push({ node, parent });

            const keys = Object.keys(node);
            for (const key of keys) {
                if (key === 'loc') {
                    continue;
                }
                const value = node[key];
                if (Array.isArray(value)) {
                    value.forEach(child => buildParentRefs(child, node));
                } else if (typeof value === 'object') {
                    buildParentRefs(value, node);
                }
            }
        };

        buildParentRefs(ast);

        // Find all variable nodes with the target name
        const variableNodes = nodesWithParents.filter(({ node }) => {
            if (node.kind === 'variable') {
                const name = this.analyzer.extractVariableName(node);
                return name === normalizedName;
            }
            return false;
        });

        // Categorize nodes as definitions or references
        for (const { node, parent } of variableNodes) {
            const location = this.analyzer.getLocation(node);
            if (!location) continue;

            // Check if this is a definition (assignment)
            if (this.isDefinition(node, parent)) {
                definitions.push({
                    name: normalizedName,
                    location: location,
                    type: this.inferType(node, parent),
                    value: this.extractValue(node, parent)
                });
            } else {
                references.push({
                    name: normalizedName,
                    location: location,
                    context: this.getContext(parent)
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

    private isDefinition(node: any, parent: any): boolean {
        if (!parent) {
            return false;
        }

        // Check if parent is an assignment and this node is the left side
        if (parent.kind === 'assign' && parent.left === node) {
            return true;
        }

        // Check if this is a function parameter
        if (parent.kind === 'parameter') {
            return true;
        }

        return false;
    }

    private inferType(node: any, parent: any): string {
        if (!parent) {
            return 'unknown';
        }

        // Try to infer type from assignment value
        if (parent.kind === 'assign' && parent.right) {
            return this.getNodeType(parent.right);
        }

        return 'unknown';
    }

    private extractValue(node: any, parent: any): string | null {
        if (!parent) {
            return null;
        }

        if (parent.kind === 'assign' && parent.right) {
            return this.nodeToString(parent.right);
        }

        return null;
    }

    private getContext(parent: any): string {
        if (!parent) {
            return 'unknown';
        }

        switch (parent.kind) {
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
                return parent.kind || 'unknown';
        }
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
}

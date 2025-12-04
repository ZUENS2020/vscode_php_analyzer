import * as vscode from 'vscode';
import { Condition, ConditionalBranch, PathNode } from '../types';
import { PHPAnalyzer } from './phpAnalyzer';

export class ConditionalPathAnalyzer {
    private ast: any;
    private analyzer: PHPAnalyzer;
    private document: vscode.TextDocument;
    
    private conditions: Condition[] = [];

    constructor(ast: any, document: vscode.TextDocument) {
        this.ast = ast;
        this.document = document;
        this.analyzer = new PHPAnalyzer('');
        this.analyzer['ast'] = ast;
    }

    public analyze(): Condition[] {
        // Reset state
        this.conditions = [];

        // Find all conditional constructs
        this.analyzer.traverse(this.ast, (node, parent) => {
            this.analyzeNode(node, parent);
        });

        return this.conditions;
    }

    private analyzeNode(node: any, parent: any): void {
        if (!node || !node.kind) {
            return;
        }

        switch (node.kind) {
            case 'if':
                this.analyzeIf(node);
                break;
            case 'switch':
                this.analyzeSwitch(node);
                break;
            case 'retif': // Ternary operator
                this.analyzeTernary(node);
                break;
            case 'bin':
                // Logical operators
                if (node.type === '&&' || node.type === '||' || node.type === 'and' || node.type === 'or') {
                    this.analyzeLogical(node);
                }
                break;
        }
    }

    private analyzeIf(node: any): void {
        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return;
        }

        const condition: Condition = {
            type: 'if',
            line: loc.line,
            column: loc.character,
            expression: this.getExpressionString(node.test) || 'unknown',
            branches: [],
            location: this.createLocation(loc)
        };

        // Process if branch
        if (node.body) {
            const ifBranch: ConditionalBranch = {
                condition: 'true',
                nodes: this.extractPathNodes(node.body),
                isTainted: false
            };
            condition.branches.push(ifBranch);
        }

        // Process else branch
        if (node.alternate) {
            const elseBranch: ConditionalBranch = {
                condition: 'false',
                nodes: this.extractPathNodes(node.alternate),
                isTainted: false
            };
            condition.branches.push(elseBranch);
        }

        this.conditions.push(condition);
    }

    private analyzeSwitch(node: any): void {
        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return;
        }

        const condition: Condition = {
            type: 'switch',
            line: loc.line,
            column: loc.character,
            expression: this.getExpressionString(node.test) || 'unknown',
            branches: [],
            location: this.createLocation(loc)
        };

        // Process each case
        if (node.body && Array.isArray(node.body)) {
            for (const caseNode of node.body) {
                if (caseNode.kind === 'case') {
                    const caseExpr = caseNode.test ? 
                        (this.getExpressionString(caseNode.test) || 'case') : 
                        'default';
                    
                    const branch: ConditionalBranch = {
                        condition: caseExpr,
                        nodes: this.extractPathNodes(caseNode.body),
                        isTainted: false
                    };
                    condition.branches.push(branch);
                }
            }
        }

        this.conditions.push(condition);
    }

    private analyzeTernary(node: any): void {
        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return;
        }

        const condition: Condition = {
            type: 'ternary',
            line: loc.line,
            column: loc.character,
            expression: this.getExpressionString(node.test) || 'unknown',
            branches: [],
            location: this.createLocation(loc)
        };

        // True branch (trueExpr)
        if (node.trueExpr) {
            const trueBranch: ConditionalBranch = {
                condition: 'true',
                nodes: this.extractPathNodes(node.trueExpr),
                isTainted: false
            };
            condition.branches.push(trueBranch);
        }

        // False branch (falseExpr)
        if (node.falseExpr) {
            const falseBranch: ConditionalBranch = {
                condition: 'false',
                nodes: this.extractPathNodes(node.falseExpr),
                isTainted: false
            };
            condition.branches.push(falseBranch);
        }

        this.conditions.push(condition);
    }

    private analyzeLogical(node: any): void {
        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return;
        }

        const condition: Condition = {
            type: 'logical',
            line: loc.line,
            column: loc.character,
            expression: `${this.getExpressionString(node.left)} ${node.type} ${this.getExpressionString(node.right)}`,
            branches: [],
            location: this.createLocation(loc)
        };

        // For && (and), right side only evaluated if left is true
        // For || (or), right side only evaluated if left is false
        const leftBranch: ConditionalBranch = {
            condition: 'left',
            nodes: this.extractPathNodes(node.left),
            isTainted: false
        };
        condition.branches.push(leftBranch);

        const rightBranch: ConditionalBranch = {
            condition: 'right',
            nodes: this.extractPathNodes(node.right),
            isTainted: false
        };
        condition.branches.push(rightBranch);

        this.conditions.push(condition);
    }

    private extractPathNodes(nodeOrBody: any): PathNode[] {
        const nodes: PathNode[] = [];

        if (!nodeOrBody) {
            return nodes;
        }

        // If it's an array (block), process each statement
        if (Array.isArray(nodeOrBody)) {
            for (const stmt of nodeOrBody) {
                const pathNode = this.createPathNode(stmt);
                if (pathNode) {
                    nodes.push(pathNode);
                }
            }
        } else if (nodeOrBody.kind === 'block' && nodeOrBody.children) {
            // It's a block node with children
            for (const child of nodeOrBody.children) {
                const pathNode = this.createPathNode(child);
                if (pathNode) {
                    nodes.push(pathNode);
                }
            }
        } else {
            // Single statement
            const pathNode = this.createPathNode(nodeOrBody);
            if (pathNode) {
                nodes.push(pathNode);
            }
        }

        return nodes;
    }

    private createPathNode(node: any): PathNode | null {
        if (!node) {
            return null;
        }

        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return null;
        }

        let type: PathNode['type'] = 'variable';
        let name = '';
        let operation = '';

        switch (node.kind) {
            case 'assign':
                type = 'variable';
                name = this.getExpressionString(node.left) || 'unknown';
                operation = 'assign';
                break;
            
            case 'call':
                type = 'function';
                name = this.getFunctionName(node) || 'unknown';
                operation = 'call';
                break;
            
            case 'return':
                type = 'return';
                name = this.getExpressionString(node.expr) || 'void';
                operation = 'return';
                break;
            
            case 'variable':
                type = 'variable';
                name = '$' + (node.name || 'unknown');
                operation = 'reference';
                break;
            
            default:
                type = 'variable';
                name = node.kind;
                operation = node.kind;
        }

        return {
            id: `pathnode_${loc.line}_${loc.character}`,
            type: type,
            name: name,
            line: loc.line,
            column: loc.character,
            operation: operation,
            location: this.createLocation(loc)
        };
    }

    private getExpressionString(node: any): string | null {
        if (!node) {
            return null;
        }

        switch (node.kind) {
            case 'variable':
                return '$' + (node.name || '');
            
            case 'string':
                return `"${node.value || ''}"`;
            
            case 'number':
                return String(node.value || '');
            
            case 'boolean':
                return node.value ? 'true' : 'false';
            
            case 'bin':
                const left = this.getExpressionString(node.left);
                const right = this.getExpressionString(node.right);
                if (left && right) {
                    return `${left} ${node.type} ${right}`;
                }
                return null;
            
            case 'unary':
                const expr = this.getExpressionString(node.what);
                if (expr) {
                    return `${node.type}${expr}`;
                }
                return null;
            
            case 'call':
                return this.getFunctionName(node);
            
            case 'propertylookup':
                const obj = this.getExpressionString(node.what);
                const prop = node.offset?.name || '';
                if (obj && prop) {
                    return `${obj}->${prop}`;
                }
                return null;
            
            case 'offsetlookup':
                const arr = this.getExpressionString(node.what);
                const offset = this.getExpressionString(node.offset);
                if (arr) {
                    return `${arr}[${offset || ''}]`;
                }
                return null;
            
            default:
                return node.kind || null;
        }
    }

    private getFunctionName(node: any): string | null {
        if (!node || node.kind !== 'call') {
            return null;
        }

        if (node.what) {
            if (node.what.kind === 'name') {
                return node.what.name || null;
            }
            
            if (node.what.kind === 'propertylookup') {
                const obj = this.getExpressionString(node.what.what);
                const method = node.what.offset?.name || '';
                if (obj && method) {
                    return `${obj}->${method}`;
                }
            }
        }

        return null;
    }

    private createLocation(loc: { line: number; character: number }): vscode.Location {
        const position = new vscode.Position(loc.line, loc.character);
        const range = new vscode.Range(position, position);
        return new vscode.Location(this.document.uri, range);
    }
}

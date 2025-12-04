import * as vscode from 'vscode';
import { CallRelation, Entity } from '../types';
import { PHPAnalyzer } from './phpAnalyzer';

export class CallGraphAnalyzer {
    private ast: any;
    private analyzer: PHPAnalyzer;
    private document: vscode.TextDocument;
    
    // Track function definitions and calls
    private functionDefs: Map<string, any> = new Map();
    private callRelations: CallRelation[] = [];
    private currentFunction: string = '<global>';

    constructor(ast: any, document: vscode.TextDocument) {
        this.ast = ast;
        this.document = document;
        this.analyzer = new PHPAnalyzer('');
        this.analyzer['ast'] = ast;
    }

    public analyze(): CallRelation[] {
        // Reset state
        this.functionDefs.clear();
        this.callRelations = [];
        this.currentFunction = '<global>';

        // First pass: find all function definitions
        this.findFunctionDefinitions();

        // Second pass: find all function calls
        this.findFunctionCalls();

        // Third pass: detect recursion
        this.detectRecursion();

        return this.callRelations;
    }

    private findFunctionDefinitions(): void {
        this.analyzer.traverse(this.ast, (node, parent) => {
            if (node.kind === 'function') {
                const funcName = node.name?.name || 'anonymous';
                this.functionDefs.set(funcName, node);
            }

            // Also track methods
            if (node.kind === 'method') {
                const className = this.getParentClassName(node, parent);
                const methodName = node.name?.name || 'anonymous';
                const fullName = className ? `${className}::${methodName}` : methodName;
                this.functionDefs.set(fullName, node);
            }
        });
    }

    private findFunctionCalls(): void {
        this.analyzer.traverse(this.ast, (node, parent) => {
            // Track which function we're currently in
            if (node.kind === 'function') {
                const oldFunction = this.currentFunction;
                this.currentFunction = node.name?.name || 'anonymous';
                
                // Process function body
                this.processFunctionBody(node);
                
                this.currentFunction = oldFunction;
            } else if (node.kind === 'method') {
                const oldFunction = this.currentFunction;
                const className = this.getParentClassName(node, parent);
                const methodName = node.name?.name || 'anonymous';
                this.currentFunction = className ? `${className}::${methodName}` : methodName;
                
                // Process method body
                this.processFunctionBody(node);
                
                this.currentFunction = oldFunction;
            }
        });
    }

    private processFunctionBody(funcNode: any): void {
        if (!funcNode.body) {
            return;
        }

        this.analyzer.traverse(funcNode.body, (node, parent) => {
            if (node.kind === 'call') {
                this.processCall(node, parent);
            }
        });
    }

    private processCall(node: any, parent: any): void {
        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return;
        }

        const callee = this.getCalleeName(node);
        if (!callee) {
            return;
        }

        // Extract arguments
        const args: Entity[] = [];
        if (node.arguments && Array.isArray(node.arguments)) {
            node.arguments.forEach((arg: any, index: number) => {
                const argLoc = this.analyzer.getNodeLocation(arg);
                if (argLoc) {
                    const argName = this.getExpressionString(arg) || `arg${index}`;
                    args.push({
                        id: `arg_${loc.line}_${loc.character}_${index}`,
                        name: argName,
                        type: 'variable',
                        line: argLoc.line,
                        column: argLoc.character,
                        location: this.createLocation(argLoc)
                    });
                }
            });
        }

        // Determine if call returns value that's used
        let returnValue: Entity | undefined;
        if (parent && parent.kind === 'assign') {
            const varName = this.getVariableName(parent.left);
            if (varName) {
                const retLoc = this.analyzer.getNodeLocation(parent.left);
                if (retLoc) {
                    returnValue = {
                        id: `ret_${loc.line}_${loc.character}`,
                        name: varName,
                        type: 'variable',
                        line: retLoc.line,
                        column: retLoc.character,
                        location: this.createLocation(retLoc)
                    };
                }
            }
        }

        // Create call relation
        const callRelation: CallRelation = {
            caller: this.currentFunction,
            callee: callee,
            arguments: args,
            returnValue: returnValue,
            line: loc.line,
            column: loc.character,
            isRecursive: false, // Will be determined later
            isTainted: false,   // Will be updated by data flow analyzer
            location: this.createLocation(loc)
        };

        this.callRelations.push(callRelation);
    }

    private detectRecursion(): void {
        // Build a map of caller -> callees
        const callMap = new Map<string, Set<string>>();
        
        for (const rel of this.callRelations) {
            if (!callMap.has(rel.caller)) {
                callMap.set(rel.caller, new Set());
            }
            callMap.get(rel.caller)!.add(rel.callee);
        }

        // Detect direct recursion
        for (const rel of this.callRelations) {
            if (rel.caller === rel.callee) {
                rel.isRecursive = true;
            }
        }

        // Detect indirect recursion (using DFS)
        for (const rel of this.callRelations) {
            if (!rel.isRecursive && this.hasIndirectRecursion(rel.caller, rel.callee, callMap, new Set())) {
                rel.isRecursive = true;
            }
        }
    }

    private hasIndirectRecursion(
        start: string, 
        current: string, 
        callMap: Map<string, Set<string>>,
        visited: Set<string>
    ): boolean {
        if (visited.has(current)) {
            return false;
        }
        
        visited.add(current);
        
        const callees = callMap.get(current);
        if (!callees) {
            return false;
        }

        // If current calls start, we have recursion
        if (callees.has(start)) {
            return true;
        }

        // Recursively check callees
        for (const callee of callees) {
            if (this.hasIndirectRecursion(start, callee, callMap, visited)) {
                return true;
            }
        }

        return false;
    }

    private getCalleeName(node: any): string | null {
        if (!node || node.kind !== 'call') {
            return null;
        }

        if (node.what) {
            // Simple function call
            if (node.what.kind === 'name') {
                return node.what.name || null;
            }

            // Method call
            if (node.what.kind === 'propertylookup') {
                const objectName = this.getVariableName(node.what.what) || 'unknown';
                const methodName = node.what.offset?.name || 'unknown';
                return `${objectName}->${methodName}`;
            }

            // Static method call
            if (node.what.kind === 'staticlookup') {
                const className = this.getClassName(node.what.what) || 'unknown';
                const methodName = node.what.offset?.name || 'unknown';
                return `${className}::${methodName}`;
            }
        }

        return null;
    }

    private getParentClassName(node: any, parent: any): string | null {
        // Walk up the tree to find the class definition
        let current = parent;
        while (current) {
            if (current.kind === 'class') {
                return current.name?.name || null;
            }
            // In practice, we need to track parents properly during traversal
            // For now, return null if we can't find it
            break;
        }
        return null;
    }

    private getClassName(node: any): string | null {
        if (!node) {
            return null;
        }

        if (node.kind === 'name') {
            return node.name || null;
        }

        if (typeof node === 'string') {
            return node;
        }

        return null;
    }

    private getVariableName(node: any): string | null {
        if (!node) {
            return null;
        }

        if (node.kind === 'variable') {
            return '$' + (node.name || '');
        }

        return null;
    }

    private getExpressionString(node: any): string | null {
        if (!node) {
            return null;
        }

        if (node.kind === 'variable') {
            return '$' + (node.name || '');
        }

        if (node.kind === 'string') {
            return `"${node.value || ''}"`;
        }

        if (node.kind === 'number') {
            return String(node.value || '');
        }

        if (node.kind === 'boolean') {
            return node.value ? 'true' : 'false';
        }

        if (node.kind === 'offsetlookup') {
            const what = this.getExpressionString(node.what);
            const offset = this.getExpressionString(node.offset);
            if (what && offset) {
                return `${what}[${offset}]`;
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

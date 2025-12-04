import * as vscode from 'vscode';
import { ObjectRelation, PropertyAccess, MethodCall, MethodChain, Entity } from '../types';
import { PHPAnalyzer } from './phpAnalyzer';

export class ObjectRelationAnalyzer {
    private ast: any;
    private analyzer: PHPAnalyzer;
    private document: vscode.TextDocument;
    
    // Track objects
    private objects: Map<string, ObjectRelation> = new Map();
    private objectClasses: Map<string, string> = new Map(); // object -> class mapping

    constructor(ast: any, document: vscode.TextDocument) {
        this.ast = ast;
        this.document = document;
        this.analyzer = new PHPAnalyzer('');
        this.analyzer['ast'] = ast;
    }

    public analyze(): ObjectRelation[] {
        // Reset state
        this.objects.clear();
        this.objectClasses.clear();

        // First pass: find object creations
        this.findObjectCreations();

        // Second pass: find property accesses
        this.findPropertyAccesses();

        // Third pass: find method calls
        this.findMethodCalls();

        // Fourth pass: build method chains
        this.buildMethodChains();

        return Array.from(this.objects.values());
    }

    private findObjectCreations(): void {
        this.analyzer.traverse(this.ast, (node, parent) => {
            if (node.kind === 'new') {
                this.processObjectCreation(node, parent);
            }
        });
    }

    private processObjectCreation(node: any, parent: any): void {
        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return;
        }

        // Get class name
        const className = this.getClassName(node);
        if (!className) {
            return;
        }

        // Get variable name if assigned
        let objectName = '';
        if (parent && parent.kind === 'assign') {
            objectName = this.getVariableName(parent.left) || '';
        }

        if (!objectName) {
            objectName = `anonymous_${loc.line}_${loc.character}`;
        }

        // Track the object
        this.objectClasses.set(objectName, className);

        // Create or update object relation
        if (!this.objects.has(objectName)) {
            this.objects.set(objectName, {
                objectName: objectName,
                className: className,
                line: loc.line,
                column: loc.character,
                properties: [],
                methods: [],
                methodChains: [],
                location: this.createLocation(loc)
            });
        }
    }

    private findPropertyAccesses(): void {
        this.analyzer.traverse(this.ast, (node, parent) => {
            if (node.kind === 'propertylookup') {
                this.processPropertyAccess(node, parent);
            }
        });
    }

    private processPropertyAccess(node: any, parent: any): void {
        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return;
        }

        // Get object name
        const objectName = this.getVariableName(node.what);
        if (!objectName) {
            return;
        }

        // Get property name
        const propertyName = node.offset?.name || '';
        if (!propertyName) {
            return;
        }

        // Determine if this is a write operation
        const isWrite = parent && parent.kind === 'assign' && parent.left === node;

        // Create property access record
        const propertyAccess: PropertyAccess = {
            objectName: objectName,
            propertyName: propertyName,
            line: loc.line,
            column: loc.character,
            isWrite: isWrite,
            isTainted: false, // Will be updated by data flow analyzer
            location: this.createLocation(loc)
        };

        // Add to object relation
        const className = this.objectClasses.get(objectName) || 'Unknown';
        if (!this.objects.has(objectName)) {
            this.objects.set(objectName, {
                objectName: objectName,
                className: className,
                line: loc.line,
                column: loc.character,
                properties: [],
                methods: [],
                methodChains: [],
                location: this.createLocation(loc)
            });
        }

        const objRel = this.objects.get(objectName)!;
        objRel.properties.push(propertyAccess);
    }

    private findMethodCalls(): void {
        this.analyzer.traverse(this.ast, (node, parent) => {
            if (node.kind === 'call' && node.what && node.what.kind === 'propertylookup') {
                this.processMethodCall(node, parent);
            }
        });
    }

    private processMethodCall(node: any, parent: any): void {
        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return;
        }

        const methodLookup = node.what;
        
        // Get object name
        const objectName = this.getVariableName(methodLookup.what);
        if (!objectName) {
            return;
        }

        // Get method name
        const methodName = methodLookup.offset?.name || '';
        if (!methodName) {
            return;
        }

        // Get arguments
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

        // Create method call record
        const methodCall: MethodCall = {
            objectName: objectName,
            methodName: methodName,
            arguments: args,
            line: loc.line,
            column: loc.character,
            isTainted: false, // Will be updated by data flow analyzer
            location: this.createLocation(loc)
        };

        // Add to object relation
        const className = this.objectClasses.get(objectName) || 'Unknown';
        if (!this.objects.has(objectName)) {
            this.objects.set(objectName, {
                objectName: objectName,
                className: className,
                line: loc.line,
                column: loc.character,
                properties: [],
                methods: [],
                methodChains: [],
                location: this.createLocation(loc)
            });
        }

        const objRel = this.objects.get(objectName)!;
        objRel.methods.push(methodCall);
    }

    private buildMethodChains(): void {
        // Look for method chains like $obj->method1()->method2()
        this.analyzer.traverse(this.ast, (node, parent) => {
            if (this.isMethodChain(node)) {
                this.processMethodChain(node);
            }
        });
    }

    private isMethodChain(node: any): boolean {
        // Check if this is a call where the object is also a call
        if (node.kind === 'call' && node.what && node.what.kind === 'propertylookup') {
            const what = node.what.what;
            // If what is a call, this is a method chain
            return what && what.kind === 'call';
        }
        return false;
    }

    private processMethodChain(node: any): void {
        const chain: MethodCall[] = [];
        
        // Recursively extract method calls from the chain
        this.extractMethodChain(node, chain);

        if (chain.length > 1) {
            // Find the object name (first in the chain)
            const firstCall = chain[0];
            const objectName = firstCall.objectName;

            const objRel = this.objects.get(objectName);
            if (objRel) {
                const methodChain: MethodChain = {
                    chain: chain,
                    isTainted: false
                };
                objRel.methodChains.push(methodChain);
            }
        }
    }

    private extractMethodChain(node: any, chain: MethodCall[]): void {
        if (node.kind === 'call' && node.what && node.what.kind === 'propertylookup') {
            const methodLookup = node.what;
            
            // Recursively process the object part
            if (methodLookup.what && methodLookup.what.kind === 'call') {
                this.extractMethodChain(methodLookup.what, chain);
            }

            // Add this method call
            const loc = this.analyzer.getNodeLocation(node);
            if (loc) {
                const objectName = this.getVariableName(methodLookup.what) || 
                                 (chain.length > 0 ? chain[chain.length - 1].objectName : 'unknown');
                const methodName = methodLookup.offset?.name || '';

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

                chain.push({
                    objectName: objectName,
                    methodName: methodName,
                    arguments: args,
                    line: loc.line,
                    column: loc.character,
                    isTainted: false,
                    location: this.createLocation(loc)
                });
            }
        }
    }

    private getClassName(node: any): string | null {
        if (!node || node.kind !== 'new') {
            return null;
        }

        if (node.what) {
            if (node.what.kind === 'name') {
                return node.what.name || null;
            }
            if (typeof node.what === 'string') {
                return node.what;
            }
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

        return null;
    }

    private createLocation(loc: { line: number; character: number }): vscode.Location {
        const position = new vscode.Position(loc.line, loc.character);
        const range = new vscode.Range(position, position);
        return new vscode.Location(this.document.uri, range);
    }
}

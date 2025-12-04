import * as vscode from 'vscode';
import { AnalysisResult } from '../models/analysisModels';

export class AnalysisTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private analysisResults: AnalysisResult | null = null;

    setAnalysisResults(results: AnalysisResult) {
        this.analysisResults = results;
        this._onDidChangeTreeData.fire();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!this.analysisResults) {
            return Promise.resolve([]);
        }

        if (!element) {
            // Root level
            return Promise.resolve(this.getRootItems());
        }

        // Child items
        return Promise.resolve(element.children || []);
    }

    private getRootItems(): TreeItem[] {
        if (!this.analysisResults) {
            return [];
        }

        switch (this.analysisResults.type) {
            case 'variable-tracking':
                return this.createVariableTrackingTree(this.analysisResults);
            case 'class-analysis':
                return this.createClassAnalysisTree(this.analysisResults);
            case 'serialization-points':
                return this.createSerializationTree(this.analysisResults);
            case 'pop-chains':
                return this.createPOPChainTree(this.analysisResults);
            case 'magic-methods':
                return this.createMagicMethodsTree(this.analysisResults);
            default:
                return [];
        }
    }

    private createVariableTrackingTree(results: any): TreeItem[] {
        const items: TreeItem[] = [];

        // Definitions
        if (results.results.definitions.length > 0) {
            const definitionsItem = new TreeItem(
                `Definitions (${results.results.definitions.length})`,
                vscode.TreeItemCollapsibleState.Expanded
            );
            definitionsItem.children = results.results.definitions.map((def: any) => {
                const item = new TreeItem(
                    `Line ${def.location.start.line}: ${def.type} = ${def.value || '...'}`,
                    vscode.TreeItemCollapsibleState.None
                );
                item.command = {
                    command: 'vscode.open',
                    title: 'Go to definition',
                    arguments: [
                        vscode.window.activeTextEditor?.document.uri,
                        { selection: this.locationToRange(def.location) }
                    ]
                };
                return item;
            });
            items.push(definitionsItem);
        }

        // References
        if (results.results.references.length > 0) {
            const referencesItem = new TreeItem(
                `References (${results.results.references.length})`,
                vscode.TreeItemCollapsibleState.Expanded
            );
            referencesItem.children = results.results.references.map((ref: any) => {
                const item = new TreeItem(
                    `Line ${ref.location.start.line}: ${ref.context}`,
                    vscode.TreeItemCollapsibleState.None
                );
                item.command = {
                    command: 'vscode.open',
                    title: 'Go to reference',
                    arguments: [
                        vscode.window.activeTextEditor?.document.uri,
                        { selection: this.locationToRange(ref.location) }
                    ]
                };
                return item;
            });
            items.push(referencesItem);
        }

        return items;
    }

    private createClassAnalysisTree(results: any): TreeItem[] {
        const items: TreeItem[] = [];
        const classInfo = results.results;

        // Magic methods
        if (classInfo.magicMethods.length > 0) {
            const magicItem = new TreeItem(
                `Magic Methods (${classInfo.magicMethods.length})`,
                vscode.TreeItemCollapsibleState.Expanded
            );
            magicItem.children = classInfo.magicMethods.map((method: any) => {
                const item = new TreeItem(
                    `${method.name}${method.isDangerous ? ' ⚠️' : ''}`,
                    vscode.TreeItemCollapsibleState.None
                );
                item.description = method.isDangerous ? 'Dangerous' : '';
                return item;
            });
            items.push(magicItem);
        }

        // Properties
        if (classInfo.properties.length > 0) {
            const propsItem = new TreeItem(
                `Properties (${classInfo.properties.length})`,
                vscode.TreeItemCollapsibleState.Collapsed
            );
            propsItem.children = classInfo.properties.map((prop: any) => 
                new TreeItem(`${prop.visibility} $${prop.name}`, vscode.TreeItemCollapsibleState.None)
            );
            items.push(propsItem);
        }

        return items;
    }

    private createSerializationTree(results: any): TreeItem[] {
        const items: TreeItem[] = [];

        // Dangerous points
        if (results.results.dangerousPoints.length > 0) {
            const dangerousItem = new TreeItem(
                `⚠️ Dangerous Points (${results.results.dangerousPoints.length})`,
                vscode.TreeItemCollapsibleState.Expanded
            );
            dangerousItem.children = results.results.dangerousPoints.map((point: any) => {
                const item = new TreeItem(
                    `Line ${point.location.start.line}: ${point.functionName}()`,
                    vscode.TreeItemCollapsibleState.None
                );
                item.description = point.dataSource || '';
                return item;
            });
            items.push(dangerousItem);
        }

        // Unserialize calls
        if (results.results.unserializeCalls.length > 0) {
            const unserializeItem = new TreeItem(
                `unserialize() calls (${results.results.unserializeCalls.length})`,
                vscode.TreeItemCollapsibleState.Collapsed
            );
            unserializeItem.children = results.results.unserializeCalls.map((call: any) =>
                new TreeItem(
                    `Line ${call.location.start.line}`,
                    vscode.TreeItemCollapsibleState.None
                )
            );
            items.push(unserializeItem);
        }

        return items;
    }

    private createPOPChainTree(results: any): TreeItem[] {
        const items: TreeItem[] = [];

        if (results.results.chains.length === 0) {
            items.push(new TreeItem('No POP chains detected', vscode.TreeItemCollapsibleState.None));
            return items;
        }

        results.results.chains.forEach((chain: any, index: number) => {
            const chainItem = new TreeItem(
                `Chain ${index + 1}${chain.isExploitable ? ' ⚠️' : ''}`,
                vscode.TreeItemCollapsibleState.Expanded
            );
            chainItem.description = chain.isExploitable ? 'Exploitable' : '';
            chainItem.children = chain.nodes.map((node: any) =>
                new TreeItem(
                    `${node.className}::${node.methodName}`,
                    vscode.TreeItemCollapsibleState.None
                )
            );
            items.push(chainItem);
        });

        return items;
    }

    private createMagicMethodsTree(results: any): TreeItem[] {
        const items: TreeItem[] = [];
        const methodsByClass = new Map<string, any[]>();

        // Group by class
        results.results.forEach((method: any) => {
            if (!methodsByClass.has(method.className)) {
                methodsByClass.set(method.className, []);
            }
            methodsByClass.get(method.className)!.push(method);
        });

        // Create tree items
        methodsByClass.forEach((methods, className) => {
            const classItem = new TreeItem(
                className,
                vscode.TreeItemCollapsibleState.Expanded
            );
            classItem.children = methods.map((method: any) => {
                const item = new TreeItem(
                    `${method.name}${method.isDangerous ? ' ⚠️' : ''}`,
                    vscode.TreeItemCollapsibleState.None
                );
                item.description = method.isDangerous ? 'Dangerous' : '';
                return item;
            });
            items.push(classItem);
        });

        return items;
    }

    private locationToRange(location: any): vscode.Range {
        return new vscode.Range(
            new vscode.Position(location.start.line - 1, location.start.column),
            new vscode.Position(location.end.line - 1, location.end.column)
        );
    }
}

class TreeItem extends vscode.TreeItem {
    children: TreeItem[] | undefined;

    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}

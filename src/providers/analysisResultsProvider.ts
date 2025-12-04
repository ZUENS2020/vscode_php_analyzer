import * as vscode from 'vscode';
import { AnalysisResult } from '../types';

export class AnalysisResultsProvider implements vscode.TreeDataProvider<ResultItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ResultItem | undefined | null | void> = new vscode.EventEmitter<ResultItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ResultItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private results: Map<string, AnalysisResult[]> = new Map();
    private currentCategory: string = '';

    updateResults(category: string, results: AnalysisResult[]) {
        this.currentCategory = category;
        this.results.set(category, results);
        this._onDidChangeTreeData.fire();
    }

    clearResults() {
        this.results.clear();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ResultItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ResultItem): Thenable<ResultItem[]> {
        if (!element) {
            // Root level - show categories
            const categories: ResultItem[] = [];
            
            for (const [category, results] of this.results.entries()) {
                const item = new ResultItem(
                    category,
                    `${category} (${results.length})`,
                    vscode.TreeItemCollapsibleState.Expanded
                );
                item.contextValue = 'category';
                categories.push(item);
            }
            
            return Promise.resolve(categories);
        } else if (element.contextValue === 'category') {
            // Category level - show results
            const categoryResults = this.results.get(element.category!) || [];
            const items: ResultItem[] = [];
            
            // Group by type
            const grouped = new Map<string, AnalysisResult[]>();
            for (const result of categoryResults) {
                const type = result.type;
                if (!grouped.has(type)) {
                    grouped.set(type, []);
                }
                grouped.get(type)!.push(result);
            }
            
            for (const [type, typeResults] of grouped.entries()) {
                for (const result of typeResults) {
                    const item = new ResultItem(
                        type,
                        result.message,
                        vscode.TreeItemCollapsibleState.None
                    );
                    item.contextValue = 'result';
                    item.result = result;
                    item.tooltip = result.details || result.message;
                    item.iconPath = this.getIconForSeverity(result.severity);
                    
                    item.command = {
                        command: 'vscode.open',
                        title: 'Go to location',
                        arguments: [
                            result.location.uri,
                            {
                                selection: result.location.range
                            }
                        ]
                    };
                    
                    items.push(item);
                }
            }
            
            return Promise.resolve(items);
        }
        
        return Promise.resolve([]);
    }

    private getIconForSeverity(severity: string): vscode.ThemeIcon {
        switch (severity) {
            case 'critical':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
            case 'error':
                return new vscode.ThemeIcon('error');
            case 'warning':
                return new vscode.ThemeIcon('warning');
            case 'info':
            default:
                return new vscode.ThemeIcon('info');
        }
    }
}

class ResultItem extends vscode.TreeItem {
    constructor(
        public readonly category: string,
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }

    result?: AnalysisResult;
}

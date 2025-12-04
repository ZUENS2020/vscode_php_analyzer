import * as vscode from 'vscode';

export class DecorationProvider {
    private variableReferenceDecoration: vscode.TextEditorDecorationType;
    private dangerousPointDecoration: vscode.TextEditorDecorationType;

    constructor() {
        this.variableReferenceDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 255, 0, 0.3)',
            border: '1px solid rgba(255, 255, 0, 0.8)'
        });

        this.dangerousPointDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 0, 0, 0.3)',
            border: '1px solid rgba(255, 0, 0, 0.8)',
            overviewRulerColor: 'rgba(255, 0, 0, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Right
        });
    }

    highlightVariableReferences(editor: vscode.TextEditor, results: any) {
        const decorations: vscode.DecorationOptions[] = [];

        // Add all references
        results.references.forEach((ref: any) => {
            const range = this.locationToRange(ref.location);
            decorations.push({
                range,
                hoverMessage: `Variable reference: ${ref.context}`
            });
        });

        // Add all definitions
        results.definitions.forEach((def: any) => {
            const range = this.locationToRange(def.location);
            decorations.push({
                range,
                hoverMessage: `Variable definition: ${def.type}`
            });
        });

        editor.setDecorations(this.variableReferenceDecoration, decorations);
    }

    highlightDangerousPoints(editor: vscode.TextEditor, dangerousPoints: any[]) {
        const decorations: vscode.DecorationOptions[] = [];

        dangerousPoints.forEach((point: any) => {
            const range = this.locationToRange(point.location);
            decorations.push({
                range,
                hoverMessage: `⚠️ Dangerous: ${point.functionName}() with ${point.dataSource || 'user input'}`
            });
        });

        editor.setDecorations(this.dangerousPointDecoration, decorations);
    }

    clearDecorations(editor: vscode.TextEditor) {
        editor.setDecorations(this.variableReferenceDecoration, []);
        editor.setDecorations(this.dangerousPointDecoration, []);
    }

    private locationToRange(location: any): vscode.Range {
        return new vscode.Range(
            new vscode.Position(location.start.line - 1, location.start.column),
            new vscode.Position(location.end.line - 1, location.end.column)
        );
    }

    dispose() {
        this.variableReferenceDecoration.dispose();
        this.dangerousPointDecoration.dispose();
    }
}

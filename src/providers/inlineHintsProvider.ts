import * as vscode from 'vscode';
import { VariableTracker } from '../analyzers/variableTracker';
import { SerializationAnalyzer } from '../analyzers/serializationAnalyzer';

export class InlineHintsProvider implements vscode.InlayHintsProvider {
    constructor(
        private variableTracker: VariableTracker,
        private serializationAnalyzer: SerializationAnalyzer
    ) {}

    async provideInlayHints(
        document: vscode.TextDocument,
        range: vscode.Range,
        token: vscode.CancellationToken
    ): Promise<vscode.InlayHint[]> {
        const config = vscode.workspace.getConfiguration('phpAnalyzer');
        if (!config.get('enableInlineHints')) {
            return [];
        }

        const hints: vscode.InlayHint[] = [];

        try {
            const code = document.getText();
            
            // Add hints for dangerous serialization points
            const serializationResults = await this.serializationAnalyzer.findSerializationPoints(code);
            
            for (const point of serializationResults.dangerousPoints) {
                if (this.isInRange(point.location, range)) {
                    const position = new vscode.Position(
                        point.location.start.line - 1,
                        point.location.end.column
                    );
                    
                    const hint = new vscode.InlayHint(
                        position,
                        ` ⚠️ Dangerous: ${point.dataSource || 'user input'}`,
                        vscode.InlayHintKind.Type
                    );
                    hint.paddingLeft = true;
                    hints.push(hint);
                }
            }
        } catch (error) {
            // Silently fail for inline hints
            console.error('Error providing inline hints:', error);
        }

        return hints;
    }

    private isInRange(location: any, range: vscode.Range): boolean {
        const startLine = location.start.line - 1;
        const endLine = location.end.line - 1;
        
        return startLine >= range.start.line && endLine <= range.end.line;
    }
}

import * as vscode from 'vscode';
import { PhpAnalyzer } from './analyzers/phpAnalyzer';
import { VariableTracker } from './analyzers/variableTracker';
import { ClassAnalyzer } from './analyzers/classAnalyzer';
import { SerializationAnalyzer } from './analyzers/serializationAnalyzer';
import { POPChainDetector } from './analyzers/popChainDetector';
import { AnalysisTreeProvider } from './providers/analysisTreeProvider';
import { InlineHintsProvider } from './providers/inlineHintsProvider';
import { DecorationProvider } from './providers/decorationProvider';

let phpAnalyzer: PhpAnalyzer;
let variableTracker: VariableTracker;
let classAnalyzer: ClassAnalyzer;
let serializationAnalyzer: SerializationAnalyzer;
let popChainDetector: POPChainDetector;
let decorationProvider: DecorationProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('PHP Code Analyzer extension is now active!');

    // Initialize analyzers
    phpAnalyzer = new PhpAnalyzer();
    variableTracker = new VariableTracker(phpAnalyzer);
    classAnalyzer = new ClassAnalyzer(phpAnalyzer);
    serializationAnalyzer = new SerializationAnalyzer(phpAnalyzer);
    popChainDetector = new POPChainDetector(phpAnalyzer, classAnalyzer);
    decorationProvider = new DecorationProvider();

    // Register tree view provider
    const treeProvider = new AnalysisTreeProvider();
    vscode.window.registerTreeDataProvider('phpAnalyzerView', treeProvider);

    // Register inline hints provider
    const inlineHintsProvider = new InlineHintsProvider(
        variableTracker,
        serializationAnalyzer
    );
    context.subscriptions.push(
        vscode.languages.registerInlayHintsProvider(
            { language: 'php' },
            inlineHintsProvider
        )
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.trackVariable', async () => {
            await trackVariableCommand(treeProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.analyzeClass', async () => {
            await analyzeClassCommand(treeProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.findSerializationPoints', async () => {
            await findSerializationPointsCommand(treeProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.findPOPChain', async () => {
            await findPOPChainCommand(treeProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.showMagicMethods', async () => {
            await showMagicMethodsCommand(treeProvider);
        })
    );

    // Listen to document changes for real-time analysis
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            const config = vscode.workspace.getConfiguration('phpAnalyzer');
            if (config.get('highlightDangerousPatterns')) {
                await analyzeDocument(event.document);
            }
        })
    );

    // Analyze active editor on startup
    if (vscode.window.activeTextEditor) {
        analyzeDocument(vscode.window.activeTextEditor.document);
    }

    // Listen to active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                analyzeDocument(editor.document);
            }
        })
    );
}

async function trackVariableCommand(treeProvider: AnalysisTreeProvider) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const document = editor.document;
    const selection = editor.selection;
    const wordRange = document.getWordRangeAtPosition(selection.active);
    
    if (!wordRange) {
        vscode.window.showErrorMessage('No variable selected');
        return;
    }

    const variableName = document.getText(wordRange);
    const code = document.getText();

    try {
        const results = await variableTracker.trackVariable(code, variableName);
        
        // Update tree view
        treeProvider.setAnalysisResults({
            type: 'variable-tracking',
            variableName,
            results
        });

        // Apply decorations
        decorationProvider.highlightVariableReferences(editor, results);

        vscode.window.showInformationMessage(
            `Found ${results.references.length} references to ${variableName}`
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Error tracking variable: ${error}`);
    }
}

async function analyzeClassCommand(treeProvider: AnalysisTreeProvider) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const document = editor.document;
    const selection = editor.selection;
    const wordRange = document.getWordRangeAtPosition(selection.active);
    
    if (!wordRange) {
        vscode.window.showErrorMessage('No class selected');
        return;
    }

    const className = document.getText(wordRange);
    const code = document.getText();

    try {
        const results = await classAnalyzer.analyzeClass(code, className);
        
        // Update tree view
        treeProvider.setAnalysisResults({
            type: 'class-analysis',
            className,
            results
        });

        vscode.window.showInformationMessage(
            `Analyzed class ${className}: ${results.magicMethods.length} magic methods found`
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Error analyzing class: ${error}`);
    }
}

async function findSerializationPointsCommand(treeProvider: AnalysisTreeProvider) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const code = editor.document.getText();

    try {
        const results = await serializationAnalyzer.findSerializationPoints(code);
        
        // Update tree view
        treeProvider.setAnalysisResults({
            type: 'serialization-points',
            results
        });

        // Highlight dangerous points
        decorationProvider.highlightDangerousPoints(editor, results.dangerousPoints);

        vscode.window.showInformationMessage(
            `Found ${results.serializeCalls.length} serialize() and ${results.unserializeCalls.length} unserialize() calls`
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Error finding serialization points: ${error}`);
    }
}

async function findPOPChainCommand(treeProvider: AnalysisTreeProvider) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const code = editor.document.getText();

    try {
        const results = await popChainDetector.detectPOPChains(code);
        
        // Update tree view
        treeProvider.setAnalysisResults({
            type: 'pop-chains',
            results
        });

        if (results.chains.length > 0) {
            vscode.window.showInformationMessage(
                `Found ${results.chains.length} potential POP chains`
            );
        } else {
            vscode.window.showInformationMessage('No POP chains detected');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error detecting POP chains: ${error}`);
    }
}

async function showMagicMethodsCommand(treeProvider: AnalysisTreeProvider) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const code = editor.document.getText();

    try {
        const results = await classAnalyzer.findAllMagicMethods(code);
        
        // Update tree view
        treeProvider.setAnalysisResults({
            type: 'magic-methods',
            results
        });

        vscode.window.showInformationMessage(
            `Found ${results.length} magic methods in the code`
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Error finding magic methods: ${error}`);
    }
}

async function analyzeDocument(document: vscode.TextDocument) {
    if (document.languageId !== 'php') {
        return;
    }

    const editor = vscode.window.visibleTextEditors.find(
        (e) => e.document === document
    );

    if (!editor) {
        return;
    }

    const code = document.getText();

    try {
        // Find and highlight dangerous patterns
        const serializationResults = await serializationAnalyzer.findSerializationPoints(code);
        decorationProvider.highlightDangerousPoints(editor, serializationResults.dangerousPoints);
    } catch (error) {
        // Silently fail for background analysis
        console.error('Error in background analysis:', error);
    }
}

export function deactivate() {
    // Clean up resources
}

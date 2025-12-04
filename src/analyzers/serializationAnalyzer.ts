import { PhpAnalyzer } from './phpAnalyzer';
import { SerializationPoint, SerializationAnalysis } from '../models/analysisModels';

export class SerializationAnalyzer {
    constructor(private analyzer: PhpAnalyzer) {}

    async findSerializationPoints(code: string): Promise<SerializationAnalysis> {
        const ast = this.analyzer.parseCode(code);
        if (!ast) {
            throw new Error('Failed to parse PHP code');
        }

        const serializeCalls: SerializationPoint[] = [];
        const unserializeCalls: SerializationPoint[] = [];
        const dangerousPoints: SerializationPoint[] = [];

        // Find all function calls
        const callNodes = this.analyzer.findNodesByType(ast, 'call');

        for (const node of callNodes) {
            const functionName = this.extractFunctionName(node);
            const location = this.analyzer.getLocation(node);

            if (!location) continue;

            if (functionName === 'serialize') {
                const point: SerializationPoint = {
                    type: 'serialize',
                    location,
                    functionName: 'serialize',
                    arguments: node.arguments || [],
                    isDangerous: false
                };
                serializeCalls.push(point);
            } else if (functionName === 'unserialize') {
                const isDangerous = this.isUnsafeUnserialize(node);
                const point: SerializationPoint = {
                    type: 'unserialize',
                    location,
                    functionName: 'unserialize',
                    arguments: node.arguments || [],
                    isDangerous,
                    dataSource: this.traceDataSource(node)
                };
                unserializeCalls.push(point);
                
                if (isDangerous) {
                    dangerousPoints.push(point);
                }
            }
        }

        // Also check for other dangerous functions
        const otherDangerous = this.findOtherDangerousFunctions(ast);
        dangerousPoints.push(...otherDangerous);

        return {
            serializeCalls,
            unserializeCalls,
            dangerousPoints,
            dataFlows: this.analyzeDataFlows(ast, unserializeCalls)
        };
    }

    private extractFunctionName(callNode: any): string {
        if (callNode.what) {
            if (callNode.what.kind === 'identifier') {
                return callNode.what.name;
            }
            if (callNode.what.name) {
                return callNode.what.name;
            }
        }
        return '';
    }

    private isUnsafeUnserialize(node: any): boolean {
        // Check if unserialize is called with user-controlled data
        if (!node.arguments || node.arguments.length === 0) {
            return false;
        }

        const arg = node.arguments[0];
        return this.isUserControlled(arg);
    }

    private isUserControlled(node: any): boolean {
        // Check if the data comes from user input
        const userInputSources = [
            '$_GET',
            '$_POST',
            '$_REQUEST',
            '$_COOKIE',
            '$_FILES',
            'file_get_contents'
        ];

        const nodeStr = JSON.stringify(node);
        return userInputSources.some(source => nodeStr.includes(source));
    }

    private traceDataSource(node: any): string {
        // Simplified data source tracing
        if (!node.arguments || node.arguments.length === 0) {
            return 'unknown';
        }

        const arg = node.arguments[0];
        
        if (arg.kind === 'variable') {
            return `$${arg.name}`;
        }
        
        if (arg.kind === 'offsetlookup') {
            // Something like $_GET['data']
            const what = arg.what;
            if (what && what.kind === 'variable') {
                return `$${what.name}`;
            }
        }

        if (arg.kind === 'call') {
            const funcName = this.extractFunctionName(arg);
            return `${funcName}()`;
        }

        return 'literal';
    }

    private findOtherDangerousFunctions(ast: any): SerializationPoint[] {
        const dangerousPoints: SerializationPoint[] = [];
        
        const dangerousFunctions = [
            'eval',
            'assert',
            'create_function',
            'preg_replace', // with /e modifier
            'call_user_func',
            'call_user_func_array'
        ];

        const callNodes = this.analyzer.findNodesByType(ast, 'call');

        for (const node of callNodes) {
            const functionName = this.extractFunctionName(node);
            const location = this.analyzer.getLocation(node);

            if (!location) continue;

            if (dangerousFunctions.includes(functionName)) {
                dangerousPoints.push({
                    type: 'dangerous-function',
                    location,
                    functionName,
                    arguments: node.arguments || [],
                    isDangerous: true
                });
            }
        }

        return dangerousPoints;
    }

    private analyzeDataFlows(ast: any, unserializeCalls: SerializationPoint[]): any[] {
        const dataFlows: any[] = [];

        // For each unserialize call, try to trace where the data comes from
        for (const call of unserializeCalls) {
            const flow = {
                unserializeLocation: call.location,
                source: call.dataSource,
                path: []  // Could be expanded to show the full data flow path
            };
            dataFlows.push(flow);
        }

        return dataFlows;
    }
}

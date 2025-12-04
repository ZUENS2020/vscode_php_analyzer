import * as vscode from 'vscode';
import {
    DataFlowAnalysis,
    DataSource,
    DataSink,
    DataFlowPath,
    Entity,
    Relationship,
    PathNode
} from '../types';
import { PHPAnalyzer } from './phpAnalyzer';

export class DataFlowAnalyzer {
    private ast: any;
    private analyzer: PHPAnalyzer;
    private document: vscode.TextDocument;
    
    // Taint tracking maps
    private taintedVariables: Map<string, boolean> = new Map();
    private taintedProperties: Map<string, boolean> = new Map();
    
    // Entity tracking
    private sources: DataSource[] = [];
    private sinks: DataSink[] = [];
    private entities: Entity[] = [];
    private relationships: Relationship[] = [];
    
    // Known dangerous sources and sinks
    private readonly SOURCES = {
        superglobals: ['$_GET', '$_POST', '$_COOKIE', '$_REQUEST', '$_FILES', '$_SERVER', '$_ENV'],
        files: ['file_get_contents', 'fread', 'fgets', 'file'],
        network: ['curl_exec', 'file_get_contents'],
        database: ['mysql_query', 'mysqli_query', 'pg_query']
    };
    
    private readonly SINKS = {
        eval: ['eval', 'assert', 'create_function'],
        exec: ['system', 'exec', 'passthru', 'shell_exec', 'popen', 'proc_open', '\\`'],
        sql: ['mysql_query', 'mysqli_query', 'pg_query', 'sqlite_query'],
        file: ['file_put_contents', 'fwrite', 'fputs', 'include', 'require', 'include_once', 'require_once'],
        deserialization: ['unserialize', 'yaml_parse'],
        callback: ['call_user_func', 'call_user_func_array', 'array_map', 'array_filter', 'usort', 'array_walk']
    };

    constructor(ast: any, document: vscode.TextDocument) {
        this.ast = ast;
        this.document = document;
        this.analyzer = new PHPAnalyzer('');
        this.analyzer['ast'] = ast;
    }

    public analyze(): DataFlowAnalysis {
        // Reset state
        this.sources = [];
        this.sinks = [];
        this.entities = [];
        this.relationships = [];
        this.taintedVariables.clear();
        this.taintedProperties.clear();

        // First pass: identify sources and sinks
        this.identifySourcesAndSinks();

        // Second pass: track data flow and taint propagation
        this.trackDataFlow();

        // Third pass: build paths from sources to sinks
        const paths = this.buildDataFlowPaths();

        return {
            sources: this.sources,
            sinks: this.sinks,
            paths: paths,
            entities: this.entities,
            relationships: this.relationships,
            conditions: [],
            objectGraph: [],
            callGraph: []
        };
    }

    private identifySourcesAndSinks(): void {
        this.analyzer.traverse(this.ast, (node, parent) => {
            this.detectSources(node, parent);
            this.detectSinks(node, parent);
        });
    }

    private detectSources(node: any, parent: any): void {
        if (!node || !node.kind) {
            return;
        }

        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return;
        }

        // Detect superglobal variables
        if (node.kind === 'variable') {
            const varName = '$' + (node.name || '');
            if (this.SOURCES.superglobals.includes(varName)) {
                const source: DataSource = {
                    id: `source_${this.sources.length}`,
                    name: varName,
                    type: 'superglobal',
                    line: loc.line,
                    column: loc.character,
                    isTainted: true,
                    location: this.createLocation(loc)
                };
                this.sources.push(source);
                
                // Mark as tainted
                this.taintedVariables.set(varName, true);
                
                // Add to entities
                this.entities.push({
                    id: source.id,
                    name: varName,
                    type: 'source',
                    line: loc.line,
                    column: loc.character,
                    isTainted: true,
                    location: source.location
                });
            }
        }

        // Detect offsetLookup (array access) on superglobals
        if (node.kind === 'offsetlookup' && node.what) {
            const varName = this.getVariableName(node.what);
            if (varName && this.SOURCES.superglobals.includes(varName)) {
                const source: DataSource = {
                    id: `source_${this.sources.length}`,
                    name: `${varName}[...]`,
                    type: 'superglobal',
                    line: loc.line,
                    column: loc.character,
                    isTainted: true,
                    location: this.createLocation(loc)
                };
                this.sources.push(source);
                
                // Mark the entire offsetlookup as tainted
                this.taintedVariables.set(`${varName}_offset`, true);
                
                this.entities.push({
                    id: source.id,
                    name: source.name,
                    type: 'source',
                    line: loc.line,
                    column: loc.character,
                    isTainted: true,
                    location: source.location
                });
            }
        }

        // Detect file reading functions
        if (node.kind === 'call') {
            const funcName = this.getFunctionName(node);
            if (this.SOURCES.files.includes(funcName)) {
                const source: DataSource = {
                    id: `source_${this.sources.length}`,
                    name: funcName,
                    type: 'file',
                    line: loc.line,
                    column: loc.character,
                    isTainted: true,
                    location: this.createLocation(loc)
                };
                this.sources.push(source);
                
                this.entities.push({
                    id: source.id,
                    name: funcName,
                    type: 'source',
                    line: loc.line,
                    column: loc.character,
                    isTainted: true,
                    location: source.location
                });
            }
        }
    }

    private detectSinks(node: any, parent: any): void {
        if (!node || !node.kind) {
            return;
        }

        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return;
        }

        // Detect function calls that are sinks
        if (node.kind === 'call') {
            const funcName = this.getFunctionName(node);
            
            for (const [category, funcs] of Object.entries(this.SINKS)) {
                if (funcs.includes(funcName)) {
                    const severity = this.getSinkSeverity(category);
                    const sink: DataSink = {
                        id: `sink_${this.sinks.length}`,
                        name: funcName,
                        type: category as any,
                        line: loc.line,
                        column: loc.character,
                        severity: severity,
                        location: this.createLocation(loc)
                    };
                    this.sinks.push(sink);
                    
                    this.entities.push({
                        id: sink.id,
                        name: funcName,
                        type: 'sink',
                        line: loc.line,
                        column: loc.character,
                        location: sink.location
                    });
                }
            }
        }

        // Detect eval-like constructs
        if (node.kind === 'eval') {
            const sink: DataSink = {
                id: `sink_${this.sinks.length}`,
                name: 'eval',
                type: 'eval',
                line: loc.line,
                column: loc.character,
                severity: 'critical',
                location: this.createLocation(loc)
            };
            this.sinks.push(sink);
            
            this.entities.push({
                id: sink.id,
                name: 'eval',
                type: 'sink',
                line: loc.line,
                column: loc.character,
                location: sink.location
            });
        }
    }

    private trackDataFlow(): void {
        this.analyzer.traverse(this.ast, (node, parent) => {
            this.trackAssignments(node, parent);
            this.trackFunctionCalls(node, parent);
            this.trackPropertyAccess(node, parent);
            this.trackStringConcatenation(node, parent);
        });
    }

    private trackAssignments(node: any, parent: any): void {
        if (!node || node.kind !== 'assign') {
            return;
        }

        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return;
        }

        // Get left and right side
        const leftVar = this.getVariableName(node.left);
        const rightTainted = this.isNodeTainted(node.right);

        if (leftVar && rightTainted) {
            // Propagate taint
            this.taintedVariables.set(leftVar, true);
            
            // Create relationship
            const sourceEntity = this.findOrCreateEntity(node.right, 'variable');
            const targetEntity = this.findOrCreateEntity(node.left, 'variable');
            
            if (sourceEntity && targetEntity) {
                this.relationships.push({
                    id: `rel_${this.relationships.length}`,
                    source: sourceEntity,
                    target: targetEntity,
                    type: 'assign',
                    isTainted: true,
                    location: this.createLocation(loc)
                });
            }
        }
    }

    private trackFunctionCalls(node: any, parent: any): void {
        if (!node || node.kind !== 'call') {
            return;
        }

        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return;
        }

        // Check if any argument is tainted
        if (node.arguments && Array.isArray(node.arguments)) {
            const hasTaintedArg = node.arguments.some((arg: any) => this.isNodeTainted(arg));
            
            if (hasTaintedArg) {
                const funcName = this.getFunctionName(node);
                const funcEntity = this.findOrCreateEntity(node, 'function');
                
                if (funcEntity) {
                    // Mark function call as processing tainted data
                    funcEntity.isTainted = true;
                    
                    // If assigned to a variable, that variable is tainted
                    if (parent && parent.kind === 'assign' && parent.right === node) {
                        const leftVar = this.getVariableName(parent.left);
                        if (leftVar) {
                            this.taintedVariables.set(leftVar, true);
                        }
                    }
                }
            }
        }
    }

    private trackPropertyAccess(node: any, parent: any): void {
        if (!node || node.kind !== 'propertylookup') {
            return;
        }

        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return;
        }

        // If object is tainted, property is tainted
        if (node.what && this.isNodeTainted(node.what)) {
            const propKey = this.getPropertyKey(node);
            if (propKey) {
                this.taintedProperties.set(propKey, true);
            }
        }
    }

    private trackStringConcatenation(node: any, parent: any): void {
        if (!node || node.kind !== 'bin') {
            return;
        }

        // Check for string concatenation (.)
        if (node.type === '.') {
            const leftTainted = this.isNodeTainted(node.left);
            const rightTainted = this.isNodeTainted(node.right);
            
            // If either side is tainted, result is tainted
            if (leftTainted || rightTainted) {
                // If this is assigned to a variable, mark it as tainted
                if (parent && parent.kind === 'assign' && parent.right === node) {
                    const leftVar = this.getVariableName(parent.left);
                    if (leftVar) {
                        this.taintedVariables.set(leftVar, true);
                    }
                }
            }
        }
    }

    private buildDataFlowPaths(): DataFlowPath[] {
        const paths: DataFlowPath[] = [];

        // For each sink, try to find paths from sources
        for (const sink of this.sinks) {
            // Check if any tainted data reaches this sink
            const reachingPaths = this.findPathsToSink(sink);
            paths.push(...reachingPaths);
        }

        return paths;
    }

    private findPathsToSink(sink: DataSink): DataFlowPath[] {
        const paths: DataFlowPath[] = [];
        
        // Find all sources that could reach this sink
        for (const source of this.sources) {
            const path = this.tracePath(source, sink);
            if (path && path.length > 0) {
                const dataFlowPath: DataFlowPath = {
                    id: `path_${paths.length}`,
                    source: source,
                    sink: sink,
                    path: path,
                    isTainted: true,
                    vulnerabilityType: this.getVulnerabilityType(source, sink),
                    severity: sink.severity,
                    conditions: []
                };
                paths.push(dataFlowPath);
            }
        }

        return paths;
    }

    private tracePath(source: DataSource, sink: DataSink): PathNode[] {
        const path: PathNode[] = [];
        
        // Find relationships that connect source to sink
        const relevantRels = this.relationships.filter(rel => 
            rel.isTainted && 
            rel.source.line >= source.line && 
            rel.target.line <= sink.line
        );

        // Build path from relationships
        for (const rel of relevantRels) {
            const pathNode: PathNode = {
                id: `pathnode_${path.length}`,
                type: this.getPathNodeType(rel.target),
                name: rel.target.name,
                line: rel.target.line,
                column: rel.target.column,
                operation: rel.type,
                location: rel.target.location
            };
            path.push(pathNode);
        }

        return path;
    }

    private isNodeTainted(node: any): boolean {
        if (!node) {
            return false;
        }

        // Check if it's a variable and tainted
        const varName = this.getVariableName(node);
        if (varName && this.taintedVariables.get(varName)) {
            return true;
        }

        // Check if it's a property access and tainted
        if (node.kind === 'propertylookup') {
            const propKey = this.getPropertyKey(node);
            if (propKey && this.taintedProperties.get(propKey)) {
                return true;
            }
        }

        // Check if it's an array offset of a superglobal
        if (node.kind === 'offsetlookup' && node.what) {
            const varName = this.getVariableName(node.what);
            if (varName && this.SOURCES.superglobals.includes(varName)) {
                return true;
            }
        }

        // Recursively check children
        if (node.kind === 'bin' && node.type === '.') {
            return this.isNodeTainted(node.left) || this.isNodeTainted(node.right);
        }

        return false;
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

    private getFunctionName(node: any): string {
        if (!node || node.kind !== 'call') {
            return '';
        }

        if (node.what) {
            if (node.what.kind === 'name') {
                return node.what.name || '';
            }
            if (typeof node.what === 'string') {
                return node.what;
            }
        }

        return '';
    }

    private getPropertyKey(node: any): string | null {
        if (!node || node.kind !== 'propertylookup') {
            return null;
        }

        const objName = this.getVariableName(node.what);
        const propName = node.offset?.name || '';
        
        if (objName && propName) {
            return `${objName}->${propName}`;
        }

        return null;
    }

    private findOrCreateEntity(node: any, type: string): Entity | null {
        const loc = this.analyzer.getNodeLocation(node);
        if (!loc) {
            return null;
        }

        const name = this.getEntityName(node);
        if (!name) {
            return null;
        }

        // Check if entity already exists
        const existing = this.entities.find(e => 
            e.name === name && e.line === loc.line && e.column === loc.character
        );

        if (existing) {
            return existing;
        }

        // Create new entity
        const entity: Entity = {
            id: `entity_${this.entities.length}`,
            name: name,
            type: type as any,
            line: loc.line,
            column: loc.character,
            isTainted: this.isNodeTainted(node),
            location: this.createLocation(loc)
        };

        this.entities.push(entity);
        return entity;
    }

    private getEntityName(node: any): string | null {
        if (!node) {
            return null;
        }

        const varName = this.getVariableName(node);
        if (varName) {
            return varName;
        }

        const funcName = this.getFunctionName(node);
        if (funcName) {
            return funcName;
        }

        return null;
    }

    private getPathNodeType(entity: Entity): PathNode['type'] {
        switch (entity.type) {
            case 'variable':
                return 'variable';
            case 'function':
                return 'function';
            default:
                return 'variable';
        }
    }

    private getVulnerabilityType(source: DataSource, sink: DataSink): string {
        const sourceType = source.type;
        const sinkType = sink.type;

        if (sinkType === 'eval') {
            return 'Code Injection';
        }
        if (sinkType === 'exec') {
            return 'Command Injection';
        }
        if (sinkType === 'sql') {
            return 'SQL Injection';
        }
        if (sinkType === 'file') {
            return 'Path Traversal / File Inclusion';
        }
        if (sinkType === 'deserialization') {
            return 'Insecure Deserialization';
        }
        if (sinkType === 'callback') {
            return 'Unsafe Callback';
        }

        return 'Tainted Data Flow';
    }

    private getSinkSeverity(category: string): 'critical' | 'high' | 'medium' | 'low' {
        switch (category) {
            case 'eval':
            case 'exec':
            case 'deserialization':
                return 'critical';
            case 'sql':
            case 'callback':
                return 'high';
            case 'file':
                return 'medium';
            default:
                return 'low';
        }
    }

    private createLocation(loc: { line: number; character: number }): vscode.Location {
        const position = new vscode.Position(loc.line, loc.character);
        const range = new vscode.Range(position, position);
        return new vscode.Location(this.document.uri, range);
    }
}

import * as vscode from 'vscode';

export interface AnalysisResult {
    type: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    location: vscode.Location;
    details?: string;
    code?: string;
    metadata?: any;
}

export interface MagicMethod {
    name: string;
    className: string;
    isDangerous: boolean;
    dangerousOperations: string[];
    location: vscode.Location;
}

export interface SerializationPoint {
    type: 'serialize' | 'unserialize';
    isDangerous: boolean;
    parameterSource: string;
    location: vscode.Location;
    usesAllowedClasses: boolean;
}

export interface POPChain {
    entryPoint: string;
    steps: POPChainStep[];
    sink: string;
    exploitability: number;
    description: string;
}

export interface POPChainStep {
    className: string;
    methodName: string;
    operation: string;
    location: vscode.Location;
}

export interface AttackChain {
    name: string;
    description: string;
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
    exploitability: number;
    steps: AttackChainStep[];
    preconditions: string[];
    mitigation: string[];
}

export interface AttackChainStep {
    type: string;
    description: string;
    location: vscode.Location;
    code: string;
}

export interface Vulnerability {
    id: string;
    name: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    location: vscode.Location;
    remediation: string;
    cwe?: string;
}

export interface ClassInfo {
    name: string;
    namespace?: string;
    extends?: string;
    implements: string[];
    properties: PropertyInfo[];
    methods: MethodInfo[];
    magicMethods: MagicMethod[];
    location: vscode.Location;
}

export interface PropertyInfo {
    name: string;
    visibility: 'public' | 'protected' | 'private';
    isStatic: boolean;
    defaultValue?: string;
}

export interface MethodInfo {
    name: string;
    visibility: 'public' | 'protected' | 'private';
    isStatic: boolean;
    isAbstract: boolean;
    parameters: ParameterInfo[];
    returnType?: string;
}

export interface ParameterInfo {
    name: string;
    type?: string;
    defaultValue?: string;
}

export interface VariableReference {
    name: string;
    type: 'definition' | 'assignment' | 'read';
    location: vscode.Location;
    context: string;
    value?: string;
}

export interface GraphNode {
    id: string;
    label: string;
    type: 'class' | 'method' | 'property' | 'magic' | 'serialization' | 'sink' | 'source';
    metadata?: any;
}

export interface GraphEdge {
    source: string;
    target: string;
    type: 'contains' | 'calls' | 'extends' | 'implements' | 'dataflow';
    label?: string;
}

export interface CodeGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

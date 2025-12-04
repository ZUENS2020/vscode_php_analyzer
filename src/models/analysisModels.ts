import { Location } from 'php-parser';

// Variable tracking models
export interface VariableDefinition {
    name: string;
    location: Location;
    type: string;
    value: string | null;
}

export interface VariableReference {
    name: string;
    location: Location;
    context: string;
}

export interface VariableTracking {
    variableName: string;
    definitions: VariableDefinition[];
    references: VariableReference[];
    typeChanges: any[];
}

// Class analysis models
export interface ClassInfo {
    name: string;
    location: Location;
    properties: any[];
    methods: any[];
    magicMethods: MagicMethod[];
    parent: string | null;
    interfaces: string[];
    instantiations: any[];
}

export interface MagicMethod {
    name: string;
    className: string;
    location: Location;
    body: string;
    isDangerous: boolean;
}

export interface ClassRelation {
    child: string;
    parent: string;
    type: 'extends' | 'implements';
}

// Serialization analysis models
export interface SerializationPoint {
    type: 'serialize' | 'unserialize' | 'dangerous-function';
    location: Location;
    functionName: string;
    arguments: any[];
    isDangerous: boolean;
    dataSource?: string;
}

export interface SerializationAnalysis {
    serializeCalls: SerializationPoint[];
    unserializeCalls: SerializationPoint[];
    dangerousPoints: SerializationPoint[];
    dataFlows: any[];
}

// POP chain models
export interface POPChainNode {
    className: string;
    methodName: string;
    location: Location;
    description?: string;
}

export interface POPChain {
    entryPoint?: POPChainNode;
    nodes: POPChainNode[];
    isExploitable: boolean;
    description: string;
}

export interface POPChainAnalysis {
    chains: POPChain[];
    allMagicMethods: MagicMethod[];
    classRelations: ClassRelation[];
}

// Analysis result models for tree view
export interface AnalysisResult {
    type: string;
    [key: string]: any;
}

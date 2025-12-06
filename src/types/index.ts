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
    type: 'class' | 'method' | 'property' | 'magic' | 'serialization' | 'sink' | 'source' | 'entry' | 'function' | 'interface' | 'variable' | 'chain';
    metadata?: GraphNodeMetadata;
}

export interface GraphNodeMetadata {
    sourceType?: string;
    sinkType?: string;
    isTainted?: boolean;
    line?: number;
    column?: number;
    value?: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
    className?: string;
    isWrite?: boolean;
    arguments?: Entity[];
    isFunction?: boolean;
    conditionType?: string;
    expression?: string;
    branches?: number;
    // Extended metadata properties
    visibility?: string;
    isMagic?: boolean;
    description?: string;
    triggeredBy?: string;
    usedAs?: string;
    toVariable?: string;
    dangerous?: boolean;
    isParent?: boolean;
    isInterface?: boolean;
    entryType?: string;
    exploitability?: number;
    operation?: string;
    [key: string]: any;  // Allow additional properties
}

export interface GraphEdge {
    source: string;
    target: string;
    type: 'contains' | 'calls' | 'extends' | 'implements' | 'dataflow' | 'triggers' | 
          'has_property' | 'has_method' | 'uses_property' | 'calls_dangerous' | 
          'assigns' | 'uses' | 'returns' | 'references';
    label?: string;
    metadata?: GraphEdgeMetadata;
}

export interface GraphEdgeMetadata {
    isTainted?: boolean;
    conditions?: Condition[];
    vulnerabilityType?: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
    isRecursive?: boolean;
    arguments?: Entity[];
}

export interface CodeGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

// ============================================================================
// Data Flow Analysis Types
// ============================================================================

export interface DataFlowAnalysis {
    sources: DataSource[];          // Data sources
    sinks: DataSink[];              // Data sinks
    paths: DataFlowPath[];          // Paths from sources to sinks
    entities: Entity[];             // All entities
    relationships: Relationship[];  // Entity relationships
    conditions: Condition[];        // Conditional branches
    objectGraph: ObjectRelation[];  // Object relationship graph
    callGraph: CallRelation[];      // Call relationship graph
}

export interface DataSource {
    id: string;
    name: string;
    type: 'superglobal' | 'file' | 'network' | 'database';
    line: number;
    column: number;
    isTainted: boolean;
    location: vscode.Location;
}

export interface DataSink {
    id: string;
    name: string;
    type: 'eval' | 'exec' | 'sql' | 'file' | 'deserialization' | 'callback';
    line: number;
    column: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    location: vscode.Location;
}

export interface DataFlowPath {
    id: string;
    source: DataSource;
    sink: DataSink;
    path: PathNode[];               // Intermediate nodes
    isTainted: boolean;             // Whether data is tainted
    vulnerabilityType: string;      // Vulnerability type
    severity: 'critical' | 'high' | 'medium' | 'low';
    conditions: Condition[];        // Conditions along the path
}

export interface PathNode {
    id: string;
    type: 'variable' | 'function' | 'property' | 'parameter' | 'return';
    name: string;
    line: number;
    column: number;
    operation?: string;
    location: vscode.Location;
}

export interface Entity {
    id: string;
    name: string;
    type: 'source' | 'sink' | 'transformer' | 'object' | 'variable' | 'function';
    line: number;
    column: number;
    value?: string;
    isTainted?: boolean;
    location: vscode.Location;
}

export interface Relationship {
    id: string;
    source: Entity;
    target: Entity;
    type: 'assign' | 'call' | 'access' | 'return' | 'parameter';
    isTainted: boolean;
    conditions?: Condition[];
    location: vscode.Location;
}

export interface ObjectRelation {
    objectName: string;
    className: string;
    line: number;
    column: number;
    properties: PropertyAccess[];
    methods: MethodCall[];
    methodChains: MethodChain[];
    location: vscode.Location;
}

export interface PropertyAccess {
    objectName: string;
    propertyName: string;
    line: number;
    column: number;
    isWrite: boolean;
    isTainted: boolean;
    location: vscode.Location;
}

export interface MethodCall {
    objectName: string;
    methodName: string;
    arguments: Entity[];
    line: number;
    column: number;
    isTainted: boolean;
    location: vscode.Location;
}

export interface MethodChain {
    chain: MethodCall[];
    isTainted: boolean;
}

export interface CallRelation {
    caller: string;
    callee: string;
    arguments: Entity[];
    returnValue?: Entity;
    line: number;
    column: number;
    isRecursive: boolean;
    isTainted: boolean;
    location: vscode.Location;
}

export interface Condition {
    type: 'if' | 'switch' | 'ternary' | 'logical';
    line: number;
    column: number;
    expression: string;
    branches: ConditionalBranch[];
    location: vscode.Location;
}

export interface ConditionalBranch {
    condition: string;
    nodes: PathNode[];
    isTainted: boolean;
}

// ============================================================================
// Multi-File Coordination Analysis Types
// ============================================================================

/**
 * 代表单个PHP文件的分析信息
 */
export interface PhpFileInfo {
    path: string;
    uri: vscode.Uri;
    content: string;
    ast: any;
    classes: ClassInfo[];
    functions: FunctionInfo[];
    interfaces: InterfaceInfo[];
    namespaces: string[];
    imports: ImportStatement[];
    analysisDuration: number;
}

/**
 * 函数信息
 */
export interface FunctionInfo {
    name: string;
    namespace?: string;
    parameters: ParameterInfo[];
    returnType?: string;
    visibility?: 'public' | 'protected' | 'private';
    isStatic?: boolean;
    location: vscode.Location;
}

/**
 * 接口信息
 */
export interface InterfaceInfo {
    name: string;
    namespace?: string;
    extends?: string[];
    methods: MethodInfo[];
    location: vscode.Location;
}

/**
 * 导入语句
 */
export interface ImportStatement {
    type: 'use' | 'require' | 'include' | 'require_once' | 'include_once';
    path: string;
    namespace?: string;
    alias?: string;
    location: vscode.Location;
}

/**
 * 多文件协同关系
 */
export interface FileCoordinationRelation {
    source: string;
    target: string;
    type: 'imports' | 'extends' | 'implements' | 'calls' | 'includes' | 'references';
    items: CoordinationItem[];
    severity?: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * 协同项（类、函数、接口等）
 */
export interface CoordinationItem {
    sourceIdentifier: string;
    targetIdentifier: string;
    itemType: 'class' | 'function' | 'interface' | 'trait' | 'constant';
    operation: string;
    location: vscode.Location;
    riskLevel?: 'critical' | 'high' | 'medium' | 'low';
    vulnerabilities?: string[];
}

/**
 * 多文件分析结果
 */
export interface MultiFileAnalysisResult {
    projectPath: string;
    files: PhpFileInfo[];
    relations: FileCoordinationRelation[];
    globalVulnerabilities: Vulnerability[];
    popChains: POPChain[];
    dataFlowPaths: DataFlowPath[];
    dependencyGraph: GraphNode[];
    dependencyEdges: GraphEdge[];
    analysisTime: number;
    fileCount: number;
    relationCount: number;
}

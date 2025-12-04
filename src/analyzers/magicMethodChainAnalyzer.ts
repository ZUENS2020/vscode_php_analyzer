import * as vscode from 'vscode';
import { PHPAnalyzer } from './phpAnalyzer';
import { Entity, PropertyAccess, MethodCall } from '../types';

export interface MagicMethodTrigger {
    className: string;
    methodName: string;
    triggeredBy: string;
    triggerType: 'auto' | 'manual';
    location: vscode.Location;
    line: number;
    column: number;
}

export interface MagicMethodChain {
    entryPoint: string;
    entryType: 'unserialize' | 'destruct' | 'toString';
    chain: MagicMethodTrigger[];
    propertyFlows: PropertyFlow[];
    dangerousSinks: string[];
}

export interface PropertyFlow {
    propertyName: string;
    fromClass: string;
    toVariable: string;
    usedAs: 'object' | 'callable' | 'parameter' | 'value';
    location: vscode.Location;
    line: number;
    column: number;
}

export class MagicMethodChainAnalyzer {
    private ast: any;
    private analyzer: PHPAnalyzer;
    private document: vscode.TextDocument;

    // Magic method trigger patterns
    private readonly triggerPatterns = {
        '__invoke': ['call_user_func', 'call_user_func_array', 'variable_as_function'],
        '__toString': ['echo', 'print', 'string_concat', 'string_context'],
        '__get': ['property_read'],
        '__set': ['property_write'],
        '__call': ['method_call'],
        '__destruct': ['unset', 'end_of_scope', 'script_end'],
        '__wakeup': ['unserialize'],
        '__sleep': ['serialize'],
        '__clone': ['clone'],
        '__isset': ['isset', 'empty'],
        '__unset': ['unset']
    };

    constructor(ast: any, document: vscode.TextDocument) {
        this.ast = ast;
        this.document = document;
        this.analyzer = new PHPAnalyzer('');
        this.analyzer['ast'] = ast;
    }

    /**
     * Find unserialize entry points in the code
     */
    findUnserializeEntries(): Array<{ location: vscode.Location; line: number; column: number; paramName?: string; paramSource?: string }> {
        const entries: Array<{ location: vscode.Location; line: number; column: number; paramName?: string; paramSource?: string }> = [];
        
        this.analyzer.traverse(this.ast, (node) => {
            if (node.kind === 'call' && node.what) {
                const funcName = node.what.name || '';
                if (funcName === 'unserialize') {
                    const loc = this.analyzer.getNodeLocation(node);
                    if (loc) {
                        const position = new vscode.Position(loc.line, loc.character);
                        
                        // 解析参数来源
                        let paramName: string | undefined;
                        let paramSource: string | undefined;
                        if (node.arguments && node.arguments.length > 0) {
                            const arg = node.arguments[0];
                            const extracted = this.extractParamSource(arg);
                            paramName = extracted.paramName;
                            paramSource = extracted.paramSource;
                        }
                        
                        entries.push({
                            location: new vscode.Location(this.document.uri, position),
                            line: loc.line,
                            column: loc.character,
                            paramName,
                            paramSource
                        });
                    }
                }
            }
        });

        return entries;
    }

    /**
     * 从 AST 节点提取参数来源信息
     */
    private extractParamSource(node: any): { paramName?: string; paramSource?: string } {
        if (!node) return {};
        
        // $_GET['data'], $_POST['data'] 等
        if (node.kind === 'offsetlookup' && node.what) {
            const source = this.nodeToString(node.what);
            const offset = node.offset ? this.nodeToString(node.offset) : undefined;
            if (source && ['$_GET', '$_POST', '$_REQUEST', '$_COOKIE'].includes(source)) {
                return {
                    paramName: offset?.replace(/["']/g, ''),
                    paramSource: source
                };
            }
        }
        
        // 变量: $data = $_GET['data']; unserialize($data);
        if (node.kind === 'variable') {
            const varName = node.name;
            // 简单情况，返回变量名
            return { paramName: varName, paramSource: 'variable' };
        }
        
        // base64_decode($_GET['data']) 等包装函数
        if (node.kind === 'call' && node.arguments && node.arguments.length > 0) {
            return this.extractParamSource(node.arguments[0]);
        }
        
        return {};
    }

    /**
     * 将 AST 节点转换为字符串表示
     */
    private nodeToString(node: any): string | undefined {
        if (!node) return undefined;
        if (node.kind === 'variable') return '$' + node.name;
        if (node.kind === 'string') return `"${node.value}"`;
        if (node.kind === 'number') return String(node.value);
        if (node.kind === 'identifier') return node.name;
        return undefined;
    }

    /**
     * Trace complete magic method chains from entry points
     */
    traceChains(): MagicMethodChain[] {
        const chains: MagicMethodChain[] = [];
        const classes = this.analyzer.getAllClasses();
        
        // Find all unserialize calls as entry points
        const unserializeEntries = this.findUnserializeEntries();
        
        // For each class with __wakeup or __destruct
        for (const classNode of classes) {
            const className = classNode.name?.name || 'Unknown';
            
            if (!classNode.body) {
                continue;
            }

            for (const member of classNode.body) {
                if (member.kind === 'method') {
                    const methodName = member.name?.name || member.name || '';
                    
                    // Check if this is an auto-triggered magic method
                    if (methodName === '__wakeup' || methodName === '__destruct') {
                        const chain = this.traceMagicMethodChain(className, methodName, member, classNode);
                        if (chain.chain.length > 0 || chain.dangerousSinks.length > 0) {
                            chains.push(chain);
                        }
                    }
                }
            }
        }

        return chains;
    }

    /**
     * Trace the execution chain starting from a magic method
     */
    private traceMagicMethodChain(className: string, methodName: string, methodNode: any, classNode: any): MagicMethodChain {
        const chain: MagicMethodTrigger[] = [];
        const propertyFlows: PropertyFlow[] = [];
        const dangerousSinks: string[] = [];
        
        const loc = this.analyzer.getNodeLocation(methodNode);
        const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
        const location = new vscode.Location(this.document.uri, position);

        // Add the entry point itself
        chain.push({
            className,
            methodName,
            triggeredBy: methodName === '__wakeup' ? 'unserialize' : 'object_destruction',
            triggerType: 'auto',
            location,
            line: loc?.line || 0,
            column: loc?.character || 0
        });

        // Analyze method body for triggers and flows
        this.analyzer.traverse(methodNode, (node) => {
            // Find property accesses that flow to variables
            if (node.kind === 'assign') {
                const propertyFlow = this.analyzePropertyAssignment(node, className);
                if (propertyFlow) {
                    propertyFlows.push(propertyFlow);
                }
            }

            // Find method calls on properties/variables (triggers __invoke, __call, etc.)
            if (node.kind === 'call') {
                const triggers = this.analyzeMethodCall(node, className);
                chain.push(...triggers);
                
                // Check for dangerous functions
                const funcName = node.what?.name || '';
                if (this.analyzer.isDangerousFunction(funcName)) {
                    dangerousSinks.push(funcName);
                }
            }

            // Find property writes (triggers __set)
            if (node.kind === 'propertylookup' && this.isInAssignmentContext(node)) {
                const trigger = this.analyzePropertyWrite(node, className);
                if (trigger) {
                    chain.push(trigger);
                }
            }

            // Find dynamic function calls (triggers __invoke)
            if (this.isDynamicFunctionCall(node)) {
                const trigger = this.analyzeDynamicCall(node, className);
                if (trigger) {
                    chain.push(trigger);
                }
            }
        });

        return {
            entryPoint: `${className}::${methodName}`,
            entryType: methodName === '__wakeup' ? 'unserialize' : 'destruct',
            chain,
            propertyFlows,
            dangerousSinks
        };
    }

    /**
     * Analyze a property assignment to track data flow
     */
    private analyzePropertyAssignment(node: any, currentClass: string): PropertyFlow | null {
        // Check if right side is a property lookup ($var = $this->property)
        if (node.right && node.right.kind === 'propertylookup') {
            const propertyName = node.right.offset?.name || '';
            const variableName = node.left?.name || '';
            
            if (propertyName && variableName) {
                const loc = this.analyzer.getNodeLocation(node);
                const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
                
                return {
                    propertyName,
                    fromClass: currentClass,
                    toVariable: variableName,
                    usedAs: 'value',
                    location: new vscode.Location(this.document.uri, position),
                    line: loc?.line || 0,
                    column: loc?.character || 0
                };
            }
        }
        
        return null;
    }

    /**
     * Analyze method calls to find magic method triggers
     */
    private analyzeMethodCall(node: any, currentClass: string): MagicMethodTrigger[] {
        const triggers: MagicMethodTrigger[] = [];
        
        // Check if calling a method on a variable that might trigger __call
        if (node.what && node.what.kind === 'propertylookup') {
            const methodName = node.what.offset?.name || '';
            const objectName = node.what.what?.name || '';
            
            const loc = this.analyzer.getNodeLocation(node);
            const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
            
            // This might trigger __call if the method doesn't exist
            triggers.push({
                className: 'Unknown',
                methodName: '__call',
                triggeredBy: `${objectName}->${methodName}()`,
                triggerType: 'manual',
                location: new vscode.Location(this.document.uri, position),
                line: loc?.line || 0,
                column: loc?.character || 0
            });
        }

        return triggers;
    }

    /**
     * Analyze property writes to detect __set triggers
     */
    private analyzePropertyWrite(node: any, currentClass: string): MagicMethodTrigger | null {
        const propertyName = node.offset?.name || '';
        const objectName = node.what?.name || '';
        
        if (propertyName && objectName) {
            const loc = this.analyzer.getNodeLocation(node);
            const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
            
            return {
                className: 'Unknown',
                methodName: '__set',
                triggeredBy: `${objectName}->${propertyName} = ...`,
                triggerType: 'manual',
                location: new vscode.Location(this.document.uri, position),
                line: loc?.line || 0,
                column: loc?.character || 0
            };
        }
        
        return null;
    }

    /**
     * Check if a node is in an assignment context (left side of assignment)
     * NOTE: This is a simplified implementation. Full context detection would require
     * parent node tracking during AST traversal, which is not currently implemented.
     * This may lead to some false positives in __set trigger detection.
     */
    private isInAssignmentContext(node: any): boolean {
        // Simplified: assume property lookups could be in assignment context
        // A full implementation would need to track parent nodes to determine actual context
        return true;
    }

    /**
     * Check if node is a dynamic function call like $var() or ($obj)()
     */
    private isDynamicFunctionCall(node: any): boolean {
        if (node.kind === 'call') {
            // Check if 'what' is a variable or expression
            if (node.what && (node.what.kind === 'variable' || node.what.kind === 'encapsed')) {
                return true;
            }
            // Check for expressions like ($this->name)($args)
            if (node.what && node.what.kind === 'propertylookup') {
                return true;
            }
        }
        return false;
    }

    /**
     * Analyze dynamic function calls to detect __invoke triggers
     */
    private analyzeDynamicCall(node: any, currentClass: string): MagicMethodTrigger | null {
        let triggeredBy = 'dynamic_call';
        
        if (node.what) {
            if (node.what.kind === 'variable') {
                triggeredBy = `${node.what.name}()`;
            } else if (node.what.kind === 'propertylookup') {
                const propertyName = node.what.offset?.name || '';
                triggeredBy = `$this->${propertyName}()`;
            }
        }
        
        const loc = this.analyzer.getNodeLocation(node);
        const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
        
        return {
            className: 'Unknown',
            methodName: '__invoke',
            triggeredBy,
            triggerType: 'manual',
            location: new vscode.Location(this.document.uri, position),
            line: loc?.line || 0,
            column: loc?.character || 0
        };
    }

    /**
     * Analyze property access patterns in a method
     */
    analyzePropertyAccess(methodNode: any, className: string): PropertyAccess[] {
        const accesses: PropertyAccess[] = [];
        
        this.analyzer.traverse(methodNode, (node) => {
            if (node.kind === 'propertylookup') {
                const propertyName = node.offset?.name || '';
                const objectName = node.what?.name || '';
                
                const loc = this.analyzer.getNodeLocation(node);
                const position = loc ? new vscode.Position(loc.line, loc.character) : new vscode.Position(0, 0);
                
                accesses.push({
                    objectName,
                    propertyName,
                    line: loc?.line || 0,
                    column: loc?.character || 0,
                    isWrite: this.isInAssignmentContext(node),
                    isTainted: false,
                    location: new vscode.Location(this.document.uri, position)
                });
            }
        });
        
        return accesses;
    }
}

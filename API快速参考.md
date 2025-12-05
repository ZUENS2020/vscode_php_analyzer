# PHP Security Analyzer - API 快速参考与开发指南

## 目录
1. [核心API快速参考](#核心api快速参考)
2. [常用代码样例](#常用代码样例)
3. [集成指南](#集成指南)
4. [故障排查](#故障排查)

---

## 核心API快速参考

### PHPAnalyzer

**基础用法**
```typescript
import { PHPAnalyzer } from './analyzers/phpAnalyzer';

// 创建解析器
const analyzer = new PHPAnalyzer(phpCode);

// 获取AST
const ast = analyzer.getAST();

// 遍历AST
analyzer.traverse(ast, (node, parent) => {
    console.log(node.kind);
});
```

**查询方法**

| 方法 | 返回类型 | 说明 |
|------|---------|------|
| `getAST()` | any | 获取抽象语法树 |
| `findNodesByType(type)` | any[] | 查找指定类型的所有节点 |
| `findClassByName(className)` | any\|null | 按名称查找类 |
| `findMethodInClass(className, methodName)` | any\|null | 查找类中的方法 |
| `getAllClasses()` | any[] | 获取所有类 |
| `getAllFunctionCalls()` | any[] | 获取所有函数调用 |
| `getAllAssignments()` | any[] | 获取所有赋值操作 |

**分类方法**

```typescript
// 判断是否为魔术方法
analyzer.isMagicMethod('__destruct')  // true

// 判断是否为危险函数
analyzer.isDangerousFunction('eval')  // true

// 判断是否为用户输入源
analyzer.isUserInputSource('$_GET')  // true

// 获取节点位置
const loc = analyzer.getNodeLocation(node);
// { line: 10, character: 5 }
```

**遍历方式**

```typescript
// 深度优先遍历
analyzer.traverse(ast, (node, parent) => {
    if (node.kind === 'call') {
        // 处理函数调用节点
    }
}, null);
```

---

### VulnerabilityScanner

**基础用法**
```typescript
import { VulnerabilityScanner } from './analyzers/vulnerabilityScanner';
import * as vscode from 'vscode';

// 获取AST
const analyzer = new PHPAnalyzer(code);
const ast = analyzer.getAST();

// 创建扫描器
const scanner = new VulnerabilityScanner(ast);

// 扫描漏洞
const results = scanner.scanVulnerabilities(document);

// 处理结果
results.forEach(result => {
    console.log(`[${result.metadata.id}] ${result.metadata.name}`);
    console.log(`Severity: ${result.severity}`);
    console.log(`Line: ${result.location.range.start.line}`);
});
```

**支持的漏洞模式**

```typescript
// 检查特定漏洞
const unsafeDeserializations = results.filter(r => 
    r.metadata?.id === 'DESER-001'
);

// 按严重性过滤
const criticalVulns = results.filter(r => 
    r.severity === 'critical'
);

// 按位置过滤
const vulnsInRange = results.filter(r => {
    const line = r.location.range.start.line;
    return line >= 10 && line <= 50;
});
```

**自定义检查**

```typescript
// 扩展VulnerabilityScanner以添加自定义检查
class CustomScanner extends VulnerabilityScanner {
    protected initializePatterns() {
        const patterns = super.initializePatterns() || [];
        
        patterns.push({
            id: 'CUSTOM-001',
            name: '自定义漏洞',
            severity: 'high',
            description: '检测自定义漏洞模式',
            remediation: '修复建议',
            check: (analyzer, document) => {
                const vulns = [];
                
                // 实现检查逻辑
                analyzer.getAllFunctionCalls().forEach(call => {
                    if (/* 检查条件 */) {
                        vulns.push({
                            id: 'CUSTOM-001',
                            name: '自定义漏洞',
                            severity: 'high',
                            description: '详细描述',
                            location: new vscode.Location(
                                document.uri,
                                new vscode.Position(call.loc?.start.line || 0, 0)
                            ),
                            remediation: '修复方法'
                        });
                    }
                });
                
                return vulns;
            }
        });
        
        return patterns;
    }
}
```

---

### POPChainDetector

**基础用法**
```typescript
import { POPChainDetector, POPChainResult } from './analyzers/popChainDetector';

const detector = new POPChainDetector();

// 检测POP链
const chains: POPChainResult[] = detector.detectPOPChains(phpCode);

// 处理结果
chains.forEach(chain => {
    console.log(`Entry Class: ${chain.entryClass}`);
    console.log(`Entry Method: ${chain.entryMethod}`);
    console.log(`Risk Level: ${chain.riskLevel}`);
    console.log(`Final Sink: ${chain.finalSink}`);
    console.log(`\nChain Steps:`);
    
    chain.steps.forEach((step, index) => {
        console.log(`${index}. ${step.className}::${step.methodName}`);
        console.log(`   Trigger: ${step.trigger}`);
        console.log(`   Line: ${step.line}`);
    });
    
    console.log(`\nPayload:\n${chain.payload}`);
});
```

**分析特定类的POP链**

```typescript
// 只分析特定类
const chains = detector.detectPOPChains(phpCode, 'VulnerableClass');

// 按风险级别过滤
const criticalChains = chains.filter(c => c.riskLevel === 'critical');

// 按汇点过滤
const codeExecutionChains = chains.filter(c => 
    ['eval', 'system', 'exec'].includes(c.finalSink)
);
```

**ChainStep 详解**

```typescript
interface ChainStep {
    className: string;              // 类名
    methodName: string;             // 方法名
    trigger: string;                // 触发方式（如 'destruct', 'wakeup'）
    description: string;            // 步骤描述
    line: number;                   // 代码行号
    propertyName?: string;          // 涉及的属性名
    propertyValue?: string;         // 属性值
    reads: string[];                // 读取的属性
    writes: string[];               // 写入的属性
    calls: string[];                // 调用的函数
    operations: string[];           // 执行的操作
    codePattern?: string;           // 代码模式
}

// 访问步骤信息
chain.steps.forEach(step => {
    if (step.reads.length > 0) {
        console.log(`Properties read: ${step.reads.join(', ')}`);
    }
    
    if (step.operations.includes('DANGEROUS')) {
        console.log(`⚠️ Dangerous operation detected!`);
    }
});
```

---

### ClassAnalyzer

**基础用法**
```typescript
import { ClassAnalyzer } from './analyzers/classAnalyzer';

const analyzer = new PHPAnalyzer(code);
const ast = analyzer.getAST();

const classAnalyzer = new ClassAnalyzer(ast);

// 分析特定类
const results = classAnalyzer.analyzeClass('MyClass', document);

// 提取类信息
const classInfo = classAnalyzer.extractClassInfo(classNode, document);

console.log(`Class: ${classInfo.name}`);
console.log(`Extends: ${classInfo.extends}`);
console.log(`Implements: ${classInfo.implements.join(', ')}`);

// 列出属性
classInfo.properties.forEach(prop => {
    console.log(`  ${prop.visibility} ${prop.name}: ${prop.type}`);
});

// 列出方法
classInfo.methods.forEach(method => {
    console.log(`  ${method.visibility} function ${method.name}(...)`);
});

// 列出魔术方法
classInfo.magicMethods.forEach(magic => {
    console.log(`  ⚠️ ${magic.name}`);
    if (magic.isDangerous) {
        magic.dangerousOperations.forEach(op => {
            console.log(`     - ${op}`);
        });
    }
});
```

---

### MagicMethodDetector

**基础用法**
```typescript
import { MagicMethodDetector } from './analyzers/magicMethodDetector';

const detector = new MagicMethodDetector(ast);

// 查找所有魔术方法
const results = detector.findMagicMethods(document);

// 按危险性过滤
const dangerousMethods = results.filter(r => 
    r.metadata?.isDangerous === true
);

// 详细信息
dangerousMethods.forEach(method => {
    console.log(`${method.metadata.className}::${method.metadata.methodName}`);
    console.log(`Dangerous operations:`);
    method.metadata.dangerousOps.forEach(op => {
        console.log(`  - ${op}`);
    });
});
```

---

### DataFlowAnalyzer

**基础用法**
```typescript
import { DataFlowAnalyzer } from './analyzers/dataFlowAnalyzer';

const analyzer = new DataFlowAnalyzer(ast);

// 追踪数据流
const flows = analyzer.analyzeDataFlow(document);

// 查找用户输入流向危险函数的路径
const riskyFlows = flows.filter(flow => 
    flow.source.type === 'user_input' &&
    flow.sink.isDangerous
);

riskyFlows.forEach(flow => {
    console.log(`\nData Flow:`);
    console.log(`Source: ${flow.source.name} (Line ${flow.source.line})`);
    console.log(`Sink: ${flow.sink.name} (Line ${flow.sink.line})`);
    console.log(`Path length: ${flow.path.length} hops`);
    
    flow.path.forEach((node, i) => {
        console.log(`  ${i + 1}. ${node.operation} (Line ${node.line})`);
    });
});
```

---

### PayloadGenerator

**基础用法**
```typescript
import { PayloadGenerator } from './utils/payloadGenerator';

const generator = new PayloadGenerator();

// 生成Payload
const payload = await generator.generatePayload(chains, document);

if (payload) {
    // 显示Payload
    console.log(payload);
    
    // 保存到文件或剪贴板
    vscode.env.clipboard.writeText(payload);
}
```

**生成特定类型的Payload**

```typescript
// 直接生成反序列化Payload
const deserPayload = generator.generateDeserializationPayload('MyClass', {
    command: 'whoami',
    filename: '/etc/passwd'
});

// 生成Phar Payload
const pharPayload = generator.generatePharPayload('GadgetClass', 'command_here');
```

---

### GraphServer

**基础用法**
```typescript
import { GraphServer } from './server/graphServer';

// 创建服务器
const graphServer = new GraphServer(3000);

// 设置高亮回调
graphServer.setHighlightCallback((filePath, line, column) => {
    vscode.window.showTextDocument(
        vscode.Uri.file(filePath),
        { selection: new vscode.Range(line, column || 0, line, column || 0) }
    );
});

// 启动服务器
await graphServer.start();

// 提交分析数据
graphServer.submitAnalysisData({
    code: codeGraphData,
    inheritance: inheritanceGraphData,
    dataflow: dataFlowGraphData,
    attackchain: attackChainGraphData
});

// 停止服务器
graphServer.stop();
```

---

## 常用代码样例

### 样例1：检测特定漏洞

```typescript
async function detectUnsafeUnserialize(document: vscode.TextDocument) {
    const code = document.getText();
    const analyzer = new PHPAnalyzer(code);
    const scanner = new VulnerabilityScanner(analyzer.getAST());
    
    const results = scanner.scanVulnerabilities(document);
    
    const unsafeDeser = results.filter(r => 
        r.metadata?.id === 'DESER-001'
    );
    
    if (unsafeDeser.length > 0) {
        vscode.window.showWarningMessage(
            `Found ${unsafeDeser.length} unsafe unserialize() calls`
        );
    }
}
```

### 样例2：分析所有类及其魔术方法

```typescript
async function analyzeClassesAndMagicMethods(document: vscode.TextDocument) {
    const code = document.getText();
    const analyzer = new PHPAnalyzer(code);
    const ast = analyzer.getAST();
    
    const classAnalyzer = new ClassAnalyzer(ast);
    const magicDetector = new MagicMethodDetector(ast);
    
    const allClasses = analyzer.getAllClasses();
    
    for (const classNode of allClasses) {
        const className = classNode.name?.name;
        
        const classResults = classAnalyzer.analyzeClass(className, document);
        const magicResults = magicDetector.findMagicMethods(document);
        
        // 过滤当前类的魔术方法
        const classMagicMethods = magicResults.filter(r => 
            r.metadata?.className === className
        );
        
        console.log(`\nClass: ${className}`);
        console.log(`  Magic Methods: ${classMagicMethods.length}`);
        
        classMagicMethods.forEach(m => {
            console.log(`    - ${m.metadata.methodName}`);
            if (m.metadata.isDangerous) {
                console.log(`      ⚠️ DANGEROUS: ${m.metadata.dangerousOps.join(', ')}`);
            }
        });
    }
}
```

### 样例3：生成POP链Payload

```typescript
async function findAndExploitPOPChain(document: vscode.TextDocument) {
    const code = document.getText();
    
    const detector = new POPChainDetector();
    const chains = detector.detectPOPChains(code);
    
    if (chains.length === 0) {
        vscode.window.showInformationMessage('No POP chains detected');
        return;
    }
    
    // 只取最危险的链
    const criticalChain = chains.find(c => c.riskLevel === 'critical');
    
    if (criticalChain) {
        // 显示链的详细信息
        const chainInfo = `
Entry: ${criticalChain.entryClass}
Sink: ${criticalChain.finalSink}
Risk: ${criticalChain.riskLevel}

Steps:
${criticalChain.steps.map((s, i) => 
    `${i + 1}. ${s.className}::${s.methodName} (line ${s.line})`
).join('\n')}

Payload:
${criticalChain.payload}
        `;
        
        // 显示在WebView中
        showAnalysisPanel(chainInfo);
    }
}
```

### 样例4：监听文件变化并增量分析

```typescript
function setupFileWatcher(extensionPath: string) {
    const cache = new AnalysisCache();
    
    vscode.workspace.onDidChangeTextDocument((event) => {
        const document = event.document;
        
        if (document.languageId !== 'php') return;
        
        // 检查缓存
        const cached = cache.getCachedAnalysis(document.fileName);
        if (cached && event.contentChanges.length === 0) {
            // 使用缓存结果
            return;
        }
        
        // 执行分析
        const code = document.getText();
        const analyzer = new PHPAnalyzer(code);
        const scanner = new VulnerabilityScanner(analyzer.getAST());
        
        const results = scanner.scanVulnerabilities(document);
        
        // 缓存结果
        cache.setCachedAnalysis(document.fileName, results);
        
        // 更新诊断
        updateDiagnostics(document, results);
    });
}
```

### 样例5：集成所有分析并生成完整报告

```typescript
async function fullSecurityAnalysis(document: vscode.TextDocument) {
    const code = document.getText();
    const analyzer = new PHPAnalyzer(code);
    const ast = analyzer.getAST();
    
    // 1. 漏洞扫描
    const vulnScanner = new VulnerabilityScanner(ast);
    const vulnerabilities = vulnScanner.scanVulnerabilities(document);
    
    // 2. 类分析
    const classAnalyzer = new ClassAnalyzer(ast);
    const classes = analyzer.getAllClasses();
    const classResults = [];
    
    for (const cls of classes) {
        const results = classAnalyzer.analyzeClass(cls.name?.name, document);
        classResults.push(...results);
    }
    
    // 3. 魔术方法检测
    const magicDetector = new MagicMethodDetector(ast);
    const magicMethods = magicDetector.findMagicMethods(document);
    
    // 4. POP链检测
    const popDetector = new POPChainDetector();
    const popChains = popDetector.detectPOPChains(code);
    
    // 5. 数据流分析
    const dataFlowAnalyzer = new DataFlowAnalyzer(ast);
    const dataFlows = dataFlowAnalyzer.analyzeDataFlow(document);
    
    // 生成报告
    const report = {
        timestamp: new Date().toISOString(),
        file: document.fileName,
        summary: {
            vulnerabilities: vulnerabilities.length,
            classes: classes.length,
            magicMethods: magicMethods.length,
            popChains: popChains.length,
            dataFlows: dataFlows.length
        },
        details: {
            vulnerabilities,
            classResults,
            magicMethods,
            popChains,
            dataFlows
        }
    };
    
    // 显示报告
    displayAnalysisReport(report);
}
```

---

## 集成指南

### 与VS Code命令集成

```typescript
// 在 extension.ts 中注册新命令

context.subscriptions.push(
    vscode.commands.registerCommand('phpAnalyzer.customAnalysis', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        
        try {
            // 执行自定义分析
            const results = await performCustomAnalysis(editor.document);
            
            // 更新结果显示
            analysisResultsProvider.updateResults('Custom Analysis', results);
            
            // 显示成功信息
            vscode.window.showInformationMessage('Analysis completed');
        } catch (error) {
            vscode.window.showErrorMessage(`Analysis failed: ${error}`);
        }
    })
);
```

### 与诊断集成

```typescript
const diagnosticCollection = vscode.languages.createDiagnosticCollection('php-analyzer');

function updateDiagnostics(document: vscode.TextDocument, results: AnalysisResult[]) {
    const diagnostics: vscode.Diagnostic[] = results.map(result => {
        const range = result.location.range;
        const severity = result.severity === 'critical' ? 
            vscode.DiagnosticSeverity.Error :
            vscode.DiagnosticSeverity.Warning;
        
        return new vscode.Diagnostic(
            range,
            result.message,
            severity
        );
    });
    
    diagnosticCollection.set(document.uri, diagnostics);
}
```

### 与TreeView集成

```typescript
// 实现TreeDataProvider
class AnalysisResultsProvider implements vscode.TreeDataProvider<ResultItem> {
    async getChildren(element?: ResultItem): Promise<ResultItem[]> {
        if (!element) {
            // 根节点
            return this.getRootItems();
        }
        
        if (element.type === 'category') {
            // 类别节点
            return this.getCategoryItems(element.category);
        }
        
        return [];
    }
    
    // 在extension.ts中使用
    // vscode.window.registerTreeDataProvider('phpAnalysisResults', provider);
}
```

---

## 故障排查

### 问题1: PHP代码无法解析

**症状**: 分析返回空结果或错误

**调试步骤**:
```typescript
// 1. 验证PHP代码
const analyzer = new PHPAnalyzer(code);
const ast = analyzer.getAST();

if (!ast || !ast.children) {
    console.error('Parse error - invalid PHP code');
    console.log('AST:', ast);
}

// 2. 检查特定的节点类型
const classes = analyzer.getAllClasses();
console.log(`Found ${classes.length} classes`);

const calls = analyzer.getAllFunctionCalls();
console.log(`Found ${calls.length} function calls`);

// 3. 手动遍历AST以查找问题
analyzer.traverse(ast, (node) => {
    if (node.kind === 'error' || node.kind === 'unknown') {
        console.warn(`Parse error at line ${node.loc?.start.line}:`, node);
    }
});
```

### 问题2: 内存泄漏或性能问题

**症状**: 分析大文件时崩溃或变慢

**优化方案**:
```typescript
// 1. 限制AST遍历深度
const MAX_DEPTH = 20;

function traverseWithDepthLimit(
    node: any,
    callback: (node: any) => void,
    depth = 0
) {
    if (depth > MAX_DEPTH) return;
    
    callback(node);
    
    // 继续遍历子节点
    // ...
}

// 2. 使用流式处理而非一次性加载
async function analyzeLargeFile(filePath: string) {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    
    for await (const chunk of stream) {
        // 逐块处理
    }
}

// 3. 释放不需要的引用
function analyzeAndCleanup(code: string) {
    const analyzer = new PHPAnalyzer(code);
    const results = performAnalysis(analyzer);
    
    // 清理
    analyzer = null as any;
    
    return results;
}
```

### 问题3: POP链检测为空

**症状**: 即使存在POP链仍未检测到

**排查方法**:
```typescript
// 1. 验证unserialize()调用是否被识别
const analyzer = new PHPAnalyzer(code);
const allCalls = analyzer.getAllFunctionCalls();
const unserializeCalls = allCalls.filter(c => 
    analyzer.getFunctionName(c) === 'unserialize'
);

console.log(`Found ${unserializeCalls.length} unserialize() calls`);

// 2. 检查魔术方法是否被识别
const allClasses = analyzer.getAllClasses();
allClasses.forEach(cls => {
    if (cls.body) {
        cls.body.forEach(member => {
            if (analyzer.isMagicMethod(member.name?.name)) {
                console.log(`Magic method: ${cls.name?.name}::${member.name?.name}`);
            }
        });
    }
});

// 3. 手动追踪POP链
const detector = new POPChainDetector();

// 添加调试输出
const originalDetect = detector.detectPOPChains.bind(detector);
detector.detectPOPChains = function(code: string, className?: string) {
    console.log(`Detecting chains for class: ${className || 'all'}`);
    const result = originalDetect(code, className);
    console.log(`Found ${result.length} chains`);
    return result;
};

const chains = detector.detectPOPChains(code);
```

### 问题4: GraphServer 无法启动

**症状**: 端口已被占用或服务器启动失败

**解决方案**:
```typescript
// 1. 检查端口是否被占用
import { createServer } from 'net';

function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}

// 使用
const defaultPort = 3000;
let port = defaultPort;

while (!await isPortAvailable(port)) {
    port++;
}

const graphServer = new GraphServer(port);

// 2. 处理启动错误
graphServer.start().catch(error => {
    console.error('Graph server failed to start:', error);
    
    // 降级处理
    vscode.window.showWarningMessage('Graph visualization unavailable');
});
```

---

## 快速参考表

### 节点类型 (AST Node Kinds)

| 节点类型 | 说明 | 示例 |
|---------|------|------|
| `class` | 类定义 | `class MyClass {}` |
| `method` | 方法 | `public function test()` |
| `function` | 函数 | `function myFunc()` |
| `call` | 函数调用 | `func()` |
| `assign` | 赋值 | `$a = 1` |
| `variable` | 变量 | `$var` |
| `propertylookup` | 属性访问 | `$obj->prop` |
| `offsetlookup` | 数组/索引访问 | `$arr['key']` |
| `bin` | 二元操作 | `$a . $b` |
| `encapsed` | 字符串插值 | `"text {$var}"` |

### 严重性级别

| 级别 | 代码 | 含义 |
|------|------|------|
| Critical | `critical` | 紧急，需要立即修复 |
| Error | `error` | 高级漏洞 |
| Warning | `warning` | 中级漏洞或可疑代码 |
| Info | `info` | 低级问题或信息 |

### 常用正则表达式

```typescript
// PHP变量模式
const phpVarPattern = /^\$[a-zA-Z_]\w*$/;

// 类名模式
const classNamePattern = /^[A-Z][a-zA-Z0-9_]*$/;

// 函数名模式
const functionNamePattern = /^[a-z_][a-z0-9_]*$/i;

// 魔术方法模式
const magicMethodPattern = /^__[a-z]+$/;

// 超级全局变量模式
const superGlobalPattern = /^\$_(GET|POST|COOKIE|REQUEST|FILES|SERVER|ENV)$/;
```

---

**文档版本**: 1.0.0  
**最后更新**: 2024年12月

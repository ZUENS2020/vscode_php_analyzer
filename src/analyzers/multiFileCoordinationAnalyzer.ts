import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PHPAnalyzer } from './phpAnalyzer';
import { ClassAnalyzer } from './classAnalyzer';
import { VulnerabilityScanner } from './vulnerabilityScanner';
import { POPChainDetector } from './popChainDetector';
import {
    PhpFileInfo,
    FunctionInfo,
    InterfaceInfo,
    ImportStatement,
    MultiFileAnalysisResult,
    FileCoordinationRelation,
    CoordinationItem,
    ClassInfo,
    Vulnerability,
    GraphNode,
    GraphEdge,
    POPChain
} from '../types';

/**
 * 多PHP文件协同关系分析器
 * 支持扫描整个文件夹，分析跨文件的类继承、调用、数据流等关系
 */
export class MultiFileCoordinationAnalyzer {
    private phpAnalyzer: PHPAnalyzer;
    private classAnalyzer: ClassAnalyzer;
    private projectPath: string;
    private fileCache: Map<string, PhpFileInfo> = new Map();
    private relationCache: Map<string, FileCoordinationRelation[]> = new Map();

    constructor(projectPath: string) {
        this.projectPath = projectPath;
        this.phpAnalyzer = new PHPAnalyzer('');
        this.classAnalyzer = new ClassAnalyzer('');
    }

    /**
     * 分析整个文件夹中的PHP文件
     */
    async analyzeFolder(
        folderPath: string,
        progressCallback?: (current: number, total: number, message: string) => void
    ): Promise<MultiFileAnalysisResult> {
        const startTime = Date.now();
        
        // 1. 递归收集所有PHP文件
        const phpFiles = this.collectPhpFiles(folderPath);
        console.log(`Found ${phpFiles.length} PHP files`);

        // 2. 分析每个文件
        const fileInfos: PhpFileInfo[] = [];
        for (let i = 0; i < phpFiles.length; i++) {
            if (progressCallback) {
                progressCallback(i + 1, phpFiles.length, `Analyzing: ${path.basename(phpFiles[i])}`);
            }
            
            const fileInfo = await this.analyzePhpFile(phpFiles[i]);
            if (fileInfo) {
                fileInfos.push(fileInfo);
                this.fileCache.set(fileInfo.path, fileInfo);
            }
        }

        // 3. 建立文件间关系
        const relations = this.buildFileRelations(fileInfos);

        // 4. 跨文件漏洞检测
        const globalVulnerabilities = this.detectGlobalVulnerabilities(fileInfos);

        // 5. 跨文件POP链检测
        const popChains = this.detectCrossFilePOPChains(fileInfos);

        // 6. 数据流分析
        const dataFlowPaths = this.analyzeDataFlow(fileInfos);

        // 7. 生成依赖图
        const { dependencyGraph, dependencyEdges } = this.generateDependencyGraph(fileInfos, relations);

        const result: MultiFileAnalysisResult = {
            projectPath: folderPath,
            files: fileInfos,
            relations,
            globalVulnerabilities,
            popChains,
            dataFlowPaths,
            dependencyGraph,
            dependencyEdges,
            analysisTime: Date.now() - startTime,
            fileCount: fileInfos.length,
            relationCount: relations.length
        };

        return result;
    }

    /**
     * 递归收集文件夹中的PHP文件
     */
    private collectPhpFiles(folderPath: string): string[] {
        const files: string[] = [];
        const excludePatterns = ['vendor', 'node_modules', '.git', 'dist', 'build'];

        const walk = (dir: string) => {
            try {
                const entries = fs.readdirSync(dir);
                for (const entry of entries) {
                    // 跳过排除目录
                    if (excludePatterns.some(p => entry.includes(p))) {
                        continue;
                    }

                    const fullPath = path.join(dir, entry);
                    const stat = fs.statSync(fullPath);

                    if (stat.isDirectory()) {
                        walk(fullPath);
                    } else if (entry.endsWith('.php')) {
                        files.push(fullPath);
                    }
                }
            } catch (error) {
                console.error(`Error walking directory ${dir}:`, error);
            }
        };

        walk(folderPath);
        return files;
    }

    /**
     * 分析单个PHP文件
     */
    private async analyzePhpFile(filePath: string): Promise<PhpFileInfo | null> {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const startTime = Date.now();

            // 解析PHP代码
            const parser = require('php-parser');
            const phpParser = new parser.PhpParser({
                php7: true,
                suppressErrors: true
            });

            let ast: any;
            try {
                ast = phpParser.parseCode('<?php ' + content);
            } catch (e) {
                console.warn(`Failed to parse ${filePath}:`, e);
                return null;
            }

            // 提取命名空间
            const namespaces = this.extractNamespaces(ast);

            // 提取类信息
            const classes = this.extractClasses(ast, content, filePath);

            // 提取函数信息
            const functions = this.extractFunctions(ast, content, filePath);

            // 提取接口信息
            const interfaces = this.extractInterfaces(ast, content, filePath);

            // 提取导入语句
            const imports = this.extractImports(ast, content, filePath);

            const fileInfo: PhpFileInfo = {
                path: filePath,
                uri: vscode.Uri.file(filePath),
                content,
                ast,
                classes,
                functions,
                interfaces,
                namespaces,
                imports,
                analysisDuration: Date.now() - startTime
            };

            return fileInfo;
        } catch (error) {
            console.error(`Error analyzing file ${filePath}:`, error);
            return null;
        }
    }

    /**
     * 提取命名空间
     */
    private extractNamespaces(ast: any): string[] {
        const namespaces: string[] = [];
        if (Array.isArray(ast)) {
            for (const node of ast) {
                if (node.kind === 'namespace') {
                    namespaces.push(node.name);
                }
            }
        }
        return namespaces;
    }

    /**
     * 提取类信息
     */
    private extractClasses(ast: any, content: string, filePath: string): ClassInfo[] {
        const classes: ClassInfo[] = [];
        if (!Array.isArray(ast)) return classes;

        for (const node of ast) {
            if (node.kind === 'class') {
                const classInfo = this.classAnalyzer.analyzeClass(node, filePath);
                if (classInfo) {
                    classes.push(classInfo);
                }
            }
        }
        return classes;
    }

    /**
     * 提取函数信息
     */
    private extractFunctions(ast: any, content: string, filePath: string): FunctionInfo[] {
        const functions: FunctionInfo[] = [];
        if (!Array.isArray(ast)) return functions;

        for (const node of ast) {
            if (node.kind === 'function') {
                const line = node.loc?.start?.line || 0;
                const column = node.loc?.start?.column || 0;

                const functionInfo: FunctionInfo = {
                    name: node.name,
                    namespace: node.namespace,
                    parameters: (node.arguments || []).map((arg: any) => ({
                        name: arg.name,
                        type: arg.type,
                        defaultValue: arg.default
                    })),
                    returnType: node.returnType,
                    location: new vscode.Location(
                        vscode.Uri.file(filePath),
                        new vscode.Position(Math.max(0, line - 1), column)
                    )
                };
                functions.push(functionInfo);
            }
        }
        return functions;
    }

    /**
     * 提取接口信息
     */
    private extractInterfaces(ast: any, content: string, filePath: string): InterfaceInfo[] {
        const interfaces: InterfaceInfo[] = [];
        if (!Array.isArray(ast)) return interfaces;

        for (const node of ast) {
            if (node.kind === 'interface') {
                const line = node.loc?.start?.line || 0;
                const column = node.loc?.start?.column || 0;

                const interfaceInfo: InterfaceInfo = {
                    name: node.name,
                    namespace: node.namespace,
                    extends: node.extends ? [node.extends] : [],
                    methods: (node.body || [])
                        .filter((m: any) => m.kind === 'method')
                        .map((m: any) => ({
                            name: m.name,
                            visibility: 'public',
                            isStatic: m.isStatic || false,
                            isAbstract: true,
                            parameters: (m.arguments || []).map((arg: any) => ({
                                name: arg.name,
                                type: arg.type
                            })),
                            returnType: m.returnType
                        })),
                    location: new vscode.Location(
                        vscode.Uri.file(filePath),
                        new vscode.Position(Math.max(0, line - 1), column)
                    )
                };
                interfaces.push(interfaceInfo);
            }
        }
        return interfaces;
    }

    /**
     * 提取导入语句
     */
    private extractImports(ast: any, content: string, filePath: string): ImportStatement[] {
        const imports: ImportStatement[] = [];
        
        if (!Array.isArray(ast)) {
            return imports;
        }

        for (const node of ast) {
            if (node.kind === 'require' || node.kind === 'include') {
                const line = node.loc?.start?.line || 0;
                const column = node.loc?.start?.column || 0;
                
                // 提取路径
                let filePath_str = '';
                if (node.what?.kind === 'string') {
                    filePath_str = node.what.value;
                } else if (node.what?.value) {
                    filePath_str = node.what.value;
                }

                if (filePath_str) {
                    imports.push({
                        type: node.kind,
                        path: filePath_str,
                        location: new vscode.Location(
                            vscode.Uri.file(filePath),
                            new vscode.Position(Math.max(0, line - 1), column)
                        )
                    });
                }
            }
        }

        return imports;
    }

    /**
     * 建立文件间关系
     */
    private buildFileRelations(fileInfos: PhpFileInfo[]): FileCoordinationRelation[] {
        const relations: FileCoordinationRelation[] = [];
        const classToFileMap = new Map<string, string>();

        // 构建类到文件的映射
        for (const fileInfo of fileInfos) {
            for (const classInfo of fileInfo.classes) {
                classToFileMap.set(classInfo.name, fileInfo.path);
                if (classInfo.namespace) {
                    classToFileMap.set(classInfo.namespace + '\\' + classInfo.name, fileInfo.path);
                }
            }
        }

        // 分析每个文件的关系
        for (const sourceFile of fileInfos) {
            // 1. 继承关系
            for (const classInfo of sourceFile.classes) {
                if (classInfo.extends) {
                    const targetFile = classToFileMap.get(classInfo.extends);
                    if (targetFile && targetFile !== sourceFile.path) {
                        relations.push({
                            source: sourceFile.path,
                            target: targetFile,
                            type: 'extends',
                            items: [{
                                sourceIdentifier: classInfo.name,
                                targetIdentifier: classInfo.extends,
                                itemType: 'class',
                                operation: 'extends',
                                location: classInfo.location,
                                riskLevel: 'medium'
                            }],
                            severity: 'medium'
                        });
                    }
                }

                // 2. 实现接口关系
                for (const iface of classInfo.implements || []) {
                    const targetFile = classToFileMap.get(iface);
                    if (targetFile && targetFile !== sourceFile.path) {
                        relations.push({
                            source: sourceFile.path,
                            target: targetFile,
                            type: 'implements',
                            items: [{
                                sourceIdentifier: classInfo.name,
                                targetIdentifier: iface,
                                itemType: 'interface',
                                operation: 'implements',
                                location: classInfo.location
                            }]
                        });
                    }
                }
            }

            // 3. 导入/包含关系
            for (const importStmt of sourceFile.imports) {
                // 解析相对路径为绝对路径
                const resolvedPath = this.resolveFilePath(sourceFile.path, importStmt.path);
                const existingFile = fileInfos.find(f => f.path === resolvedPath);
                
                if (existingFile) {
                    relations.push({
                        source: sourceFile.path,
                        target: existingFile.path,
                        type: importStmt.type as any,
                        items: [{
                            sourceIdentifier: path.basename(sourceFile.path),
                            targetIdentifier: path.basename(existingFile.path),
                            itemType: 'function',
                            operation: importStmt.type,
                            location: importStmt.location,
                            riskLevel: importStmt.type === 'include' ? 'high' : 'low'
                        }],
                        severity: importStmt.type === 'include' ? 'high' : 'low'
                    });
                }
            }
        }

        return relations;
    }

    /**
     * 解析文件路径（相对路径 -> 绝对路径）
     */
    private resolveFilePath(sourceFilePath: string, importPath: string): string {
        const sourceDir = path.dirname(sourceFilePath);
        
        // 移除引号
        const cleanPath = importPath.replace(/['"]/g, '');
        
        // 如果没有.php扩展名，添加
        const phpPath = cleanPath.endsWith('.php') ? cleanPath : cleanPath + '.php';
        
        // 相对路径解析
        const resolved = path.resolve(sourceDir, phpPath);
        
        return resolved;
    }

    /**
     * 检测全局漏洞（跨文件）
     */
    private detectGlobalVulnerabilities(fileInfos: PhpFileInfo[]): Vulnerability[] {
        const vulnerabilities: Vulnerability[] = [];
        const classToFileMap = new Map<string, string>();

        // 构建类到文件映射
        for (const fileInfo of fileInfos) {
            for (const classInfo of fileInfo.classes) {
                classToFileMap.set(classInfo.name, fileInfo.path);
            }
        }

        // 分析每个文件中的漏洞
        for (const fileInfo of fileInfos) {
            try {
                const scanner = new VulnerabilityScanner(fileInfo.ast);
                const doc = {
                    uri: fileInfo.uri,
                    getText: () => fileInfo.content
                } as any;
                
                const analysisResults = scanner.scanVulnerabilities(doc);
                
                for (const result of analysisResults) {
                    if (result.code === 'DESER' || result.code === 'FUNC') {
                        vulnerabilities.push({
                            id: `${fileInfo.path}:${result.code}`,
                            name: result.message,
                            severity: result.severity as any,
                            description: result.details || '',
                            location: result.location,
                            remediation: 'Use strict deserialization controls',
                            cwe: result.code === 'DESER' ? 'CWE-502' : 'CWE-95'
                        });
                    }
                }
            } catch (error) {
                console.warn(`Error scanning vulnerabilities in ${fileInfo.path}:`, error);
            }
        }

        return vulnerabilities;
    }

    /**
     * 检测跨文件POP链
     */
    private detectCrossFilePOPChains(fileInfos: PhpFileInfo[]): POPChain[] {
        const chains: POPChain[] = [];
        const classToFileMap = new Map<string, { fileInfo: PhpFileInfo; classInfo: ClassInfo }>();

        // 构建类到文件映射
        for (const fileInfo of fileInfos) {
            for (const classInfo of fileInfo.classes) {
                classToFileMap.set(classInfo.name, { fileInfo, classInfo });
            }
        }

        // 为每个文件分析POP链
        for (const fileInfo of fileInfos) {
            try {
                const detector = new POPChainDetector(fileInfo.ast);
                const chains_in_file = detector.detectPOPChains();
                
                for (const chain of chains_in_file) {
                    // 检查链是否跨越多个文件
                    const chainFiles = new Set<string>();
                    for (const step of chain.steps) {
                        const classInfo = classToFileMap.get(step.className);
                        if (classInfo) {
                            chainFiles.add(classInfo.fileInfo.path);
                        }
                    }

                    if (chainFiles.size > 1) {
                        chains.push(chain);
                    }
                }
            } catch (error) {
                console.warn(`Error detecting POP chains in ${fileInfo.path}:`, error);
            }
        }

        return chains;
    }

    /**
     * 分析跨文件数据流
     */
    private analyzeDataFlow(fileInfos: PhpFileInfo[]): any[] {
        // 这里可以实现跨文件数据流分析
        // 目前返回空数组，可后续扩展
        return [];
    }

    /**
     * 生成依赖图
     */
    private generateDependencyGraph(
        fileInfos: PhpFileInfo[],
        relations: FileCoordinationRelation[]
    ): { dependencyGraph: GraphNode[]; dependencyEdges: GraphEdge[] } {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const nodeMap = new Map<string, string>();

        // 为每个文件创建节点
        for (const fileInfo of fileInfos) {
            const nodeId = `file:${fileInfo.path}`;
            nodeMap.set(fileInfo.path, nodeId);

            nodes.push({
                id: nodeId,
                label: path.basename(fileInfo.path),
                type: 'function',
                metadata: {
                    filePath: fileInfo.path,
                    classCount: fileInfo.classes.length,
                    functionCount: fileInfo.functions.length,
                    interfaceCount: fileInfo.interfaces.length
                }
            });
        }

        // 为每个类创建节点
        for (const fileInfo of fileInfos) {
            for (const classInfo of fileInfo.classes) {
                const nodeId = `class:${classInfo.name}:${fileInfo.path}`;
                nodes.push({
                    id: nodeId,
                    label: classInfo.name,
                    type: 'class',
                    metadata: {
                        filePath: fileInfo.path,
                        namespace: classInfo.namespace,
                        extends: classInfo.extends
                    }
                });

                // 添加文件到类的边
                const fileNodeId = nodeMap.get(fileInfo.path);
                if (fileNodeId) {
                    edges.push({
                        source: fileNodeId,
                        target: nodeId,
                        type: 'contains',
                        label: 'contains'
                    });
                }
            }
        }

        // 为关系创建边
        for (const relation of relations) {
            const sourceNodeId = nodeMap.get(relation.source);
            const targetNodeId = nodeMap.get(relation.target);

            if (sourceNodeId && targetNodeId) {
                edges.push({
                    source: sourceNodeId,
                    target: targetNodeId,
                    type: relation.type as any,
                    label: relation.type,
                    metadata: {
                        severity: relation.severity
                    }
                });
            }
        }

        return { dependencyGraph: nodes, dependencyEdges: edges };
    }

    /**
     * 清除缓存
     */
    clearCache(): void {
        this.fileCache.clear();
        this.relationCache.clear();
    }

    /**
     * 获取文件信息缓存
     */
    getFileCache(): Map<string, PhpFileInfo> {
        return this.fileCache;
    }
}

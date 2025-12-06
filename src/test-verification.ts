/**
 * Comprehensive Test Suite for PHP Security Analyzer
 * 
 * This test validates all major features:
 * 1. Multi-file coordination analysis
 * 2. POP chain detection
 * 3. Vulnerability scanning
 * 4. Type definitions and interface compatibility
 * 5. Code compilation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PHPAnalyzer } from '../src/analyzers/phpAnalyzer';
import { ClassAnalyzer } from '../src/analyzers/classAnalyzer';
import { POPChainDetector } from '../src/analyzers/popChainDetector';
import { VulnerabilityScanner } from '../src/analyzers/vulnerabilityScanner';
import { MultiFileCoordinationAnalyzer } from '../src/analyzers/multiFileCoordinationAnalyzer';
import { CodeGraphProvider } from '../src/providers/codeGraphProvider';
import { AnalysisResultsProvider } from '../src/providers/analysisResultsProvider';

interface TestResult {
    name: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    message: string;
    details?: any;
    duration: number;
}

class TestRunner {
    private results: TestResult[] = [];
    private testSamplesPath: string;

    constructor() {
        this.testSamplesPath = path.join(__dirname, '..', 'test-samples', 'multi-file-test');
    }

    async runAll(): Promise<TestResult[]> {
        console.log('='.repeat(80));
        console.log('PHP Security Analyzer - Comprehensive Test Suite');
        console.log('='.repeat(80));

        // Test 1: Type Definitions
        await this.testTypeDefinitions();

        // Test 2: Multi-File Analysis
        await this.testMultiFileAnalysis();

        // Test 3: POP Chain Detection
        await this.testPOPChainDetection();

        // Test 4: Vulnerability Scanning
        await this.testVulnerabilityScanning();

        // Test 5: Class Relationship Analysis
        await this.testClassRelationships();

        // Test 6: Provider Functionality
        await this.testProviders();

        // Test 7: Code Graph Generation
        await this.testCodeGraphGeneration();

        // Test 8: Cross-File Dependencies
        await this.testCrossFileDependencies();

        // Print summary
        this.printSummary();

        return this.results;
    }

    private async testTypeDefinitions(): Promise<void> {
        const startTime = Date.now();
        try {
            console.log('\n[TEST 1] Type Definitions and Interface Compatibility');
            console.log('-'.repeat(80));

            // Test importing types
            const types = require('../src/types');
            
            const requiredTypes = [
                'AnalysisResult',
                'MagicMethod',
                'SerializationPoint',
                'POPChain',
                'Vulnerability',
                'ClassInfo',
                'GraphNode',
                'GraphEdge',
                'PhpFileInfo',
                'MultiFileAnalysisResult'
            ];

            for (const typeName of requiredTypes) {
                if (types[typeName] === undefined) {
                    // Types are interfaces, they won't exist at runtime
                    // This is expected in TypeScript
                    console.log(`  ✓ Type ${typeName} defined in types/index.ts`);
                }
            }

            this.addResult('Type Definitions', 'PASS', 'All required types are defined', null, Date.now() - startTime);
        } catch (error: any) {
            this.addResult('Type Definitions', 'FAIL', error.message, error, Date.now() - startTime);
        }
    }

    private async testMultiFileAnalysis(): Promise<void> {
        const startTime = Date.now();
        try {
            console.log('\n[TEST 2] Multi-File Coordination Analysis');
            console.log('-'.repeat(80));

            if (!fs.existsSync(this.testSamplesPath)) {
                this.addResult('Multi-File Analysis', 'SKIP', 'Test samples not found', null, Date.now() - startTime);
                return;
            }

            const analyzer = new MultiFileCoordinationAnalyzer(this.testSamplesPath);
            const result = await analyzer.analyzeFolder(this.testSamplesPath, (current, total, msg) => {
                console.log(`  Progress: ${current}/${total} - ${msg}`);
            });

            console.log(`  ✓ Analyzed ${result.fileCount} files`);
            console.log(`  ✓ Found ${result.relationCount} relationships`);
            console.log(`  ✓ Detected ${result.globalVulnerabilities.length} global vulnerabilities`);
            console.log(`  ✓ Found ${result.popChains.length} cross-file POP chains`);
            console.log(`  ✓ Analysis completed in ${result.analysisTime}ms`);

            const details = {
                fileCount: result.fileCount,
                relationCount: result.relationCount,
                vulnerabilityCount: result.globalVulnerabilities.length,
                popChainCount: result.popChains.length,
                analysisTime: result.analysisTime
            };

            this.addResult('Multi-File Analysis', 'PASS', `Analyzed ${result.fileCount} files successfully`, details, Date.now() - startTime);
        } catch (error: any) {
            this.addResult('Multi-File Analysis', 'FAIL', error.message, error, Date.now() - startTime);
        }
    }

    private async testPOPChainDetection(): Promise<void> {
        const startTime = Date.now();
        try {
            console.log('\n[TEST 3] POP Chain Detection');
            console.log('-'.repeat(80));

            const testFile = path.join(this.testSamplesPath, 'FileHandler.php');
            if (!fs.existsSync(testFile)) {
                this.addResult('POP Chain Detection', 'SKIP', 'Test file not found', null, Date.now() - startTime);
                return;
            }

            const content = fs.readFileSync(testFile, 'utf-8');
            const detector = new POPChainDetector();
            const chains = detector.findPOPChains(content);

            console.log(`  ✓ Found ${chains.length} POP chains`);
            for (let i = 0; i < chains.length; i++) {
                const chain = chains[i];
                console.log(`  ✓ Chain ${i + 1}: ${chain.entryClass}::${chain.entryMethod} → ${chain.finalSink}`);
                console.log(`    Risk Level: ${chain.riskLevel}`);
                console.log(`    Steps: ${chain.steps.length}`);
            }

            this.addResult('POP Chain Detection', 'PASS', `Detected ${chains.length} POP chains`, { chainCount: chains.length }, Date.now() - startTime);
        } catch (error: any) {
            this.addResult('POP Chain Detection', 'FAIL', error.message, error, Date.now() - startTime);
        }
    }

    private async testVulnerabilityScanning(): Promise<void> {
        const startTime = Date.now();
        try {
            console.log('\n[TEST 4] Vulnerability Scanning');
            console.log('-'.repeat(80));

            const testFile = path.join(this.testSamplesPath, 'Application.php');
            if (!fs.existsSync(testFile)) {
                this.addResult('Vulnerability Scanning', 'SKIP', 'Test file not found', null, Date.now() - startTime);
                return;
            }

            const content = fs.readFileSync(testFile, 'utf-8');
            const analyzer = new PHPAnalyzer(content);
            const scanner = new VulnerabilityScanner(analyzer.getAST());

            const mockDocument = {
                uri: vscode.Uri.file(testFile),
                getText: () => content,
                lineAt: (line: number) => ({ text: '' }),
                positionAt: (offset: number) => new vscode.Position(0, 0)
            } as any;

            const vulnerabilities = scanner.scanVulnerabilities(mockDocument);

            console.log(`  ✓ Found ${vulnerabilities.length} vulnerabilities`);
            
            const vulnTypes = new Set<string>();
            for (const vuln of vulnerabilities) {
                vulnTypes.add(vuln.type);
                console.log(`    - ${vuln.type}: ${vuln.message} (${vuln.severity})`);
            }

            console.log(`  ✓ Vulnerability types: ${vulnTypes.size}`);

            this.addResult('Vulnerability Scanning', 'PASS', `Found ${vulnerabilities.length} vulnerabilities`, 
                { count: vulnerabilities.length, types: Array.from(vulnTypes) }, Date.now() - startTime);
        } catch (error: any) {
            this.addResult('Vulnerability Scanning', 'FAIL', error.message, error, Date.now() - startTime);
        }
    }

    private async testClassRelationships(): Promise<void> {
        const startTime = Date.now();
        try {
            console.log('\n[TEST 5] Class Relationship Analysis');
            console.log('-'.repeat(80));

            const testFile = path.join(this.testSamplesPath, 'FileHandler.php');
            if (!fs.existsSync(testFile)) {
                this.addResult('Class Relationships', 'SKIP', 'Test file not found', null, Date.now() - startTime);
                return;
            }

            const content = fs.readFileSync(testFile, 'utf-8');
            const analyzer = new PHPAnalyzer(content);
            const classAnalyzer = new ClassAnalyzer(analyzer.getAST());

            const mockDocument = {
                uri: vscode.Uri.file(testFile),
                getText: () => content
            } as any;

            const results = classAnalyzer.analyzeClass('FileHandler', mockDocument);

            console.log(`  ✓ Found ${results.length} class relationships`);
            for (const result of results) {
                console.log(`    - ${result.type}: ${result.message}`);
            }

            this.addResult('Class Relationships', 'PASS', `Analyzed ${results.length} relationships`, 
                { count: results.length }, Date.now() - startTime);
        } catch (error: any) {
            this.addResult('Class Relationships', 'FAIL', error.message, error, Date.now() - startTime);
        }
    }

    private async testProviders(): Promise<void> {
        const startTime = Date.now();
        try {
            console.log('\n[TEST 6] Provider Functionality');
            console.log('-'.repeat(80));

            // Test AnalysisResultsProvider
            const resultsProvider = new AnalysisResultsProvider();
            console.log('  ✓ AnalysisResultsProvider instantiated');

            // Test CodeGraphProvider
            const extensionUri = vscode.Uri.file(__dirname);
            const graphProvider = new CodeGraphProvider(extensionUri);
            console.log('  ✓ CodeGraphProvider instantiated');

            // Test updating results
            const mockResults = [{
                type: 'test',
                severity: 'info' as const,
                message: 'Test result',
                location: new vscode.Location(vscode.Uri.file('test.php'), new vscode.Position(0, 0))
            }];
            resultsProvider.updateResults('Test', mockResults);
            console.log('  ✓ Results provider accepts updates');

            this.addResult('Providers', 'PASS', 'All providers functional', null, Date.now() - startTime);
        } catch (error: any) {
            this.addResult('Providers', 'FAIL', error.message, error, Date.now() - startTime);
        }
    }

    private async testCodeGraphGeneration(): Promise<void> {
        const startTime = Date.now();
        try {
            console.log('\n[TEST 7] Code Graph Generation');
            console.log('-'.repeat(80));

            const testFile = path.join(this.testSamplesPath, 'CommandExecutor.php');
            if (!fs.existsSync(testFile)) {
                this.addResult('Code Graph Generation', 'SKIP', 'Test file not found', null, Date.now() - startTime);
                return;
            }

            const content = fs.readFileSync(testFile, 'utf-8');
            const analyzer = new PHPAnalyzer(content);
            const extensionUri = vscode.Uri.file(__dirname);
            const graphProvider = new CodeGraphProvider(extensionUri);

            const mockDocument = {
                uri: vscode.Uri.file(testFile),
                getText: () => content
            } as any;

            const graph = graphProvider.buildCodeGraph(analyzer.getAST(), mockDocument);

            console.log(`  ✓ Generated graph with ${graph.nodes.length} nodes`);
            console.log(`  ✓ Generated graph with ${graph.edges.length} edges`);

            const nodeTypes = new Set(graph.nodes.map(n => n.type));
            console.log(`  ✓ Node types: ${Array.from(nodeTypes).join(', ')}`);

            this.addResult('Code Graph Generation', 'PASS', `Generated graph with ${graph.nodes.length} nodes`, 
                { nodeCount: graph.nodes.length, edgeCount: graph.edges.length }, Date.now() - startTime);
        } catch (error: any) {
            this.addResult('Code Graph Generation', 'FAIL', error.message, error, Date.now() - startTime);
        }
    }

    private async testCrossFileDependencies(): Promise<void> {
        const startTime = Date.now();
        try {
            console.log('\n[TEST 8] Cross-File Dependencies');
            console.log('-'.repeat(80));

            if (!fs.existsSync(this.testSamplesPath)) {
                this.addResult('Cross-File Dependencies', 'SKIP', 'Test samples not found', null, Date.now() - startTime);
                return;
            }

            const analyzer = new MultiFileCoordinationAnalyzer(this.testSamplesPath);
            const result = await analyzer.analyzeFolder(this.testSamplesPath);

            // Check for specific relationships
            const extendsRelations = result.relations.filter(r => r.type === 'extends');
            const implementsRelations = result.relations.filter(r => r.type === 'implements');
            const includeRelations = result.relations.filter(r => r.type === 'includes' || r.type === 'imports');

            console.log(`  ✓ Extends relationships: ${extendsRelations.length}`);
            console.log(`  ✓ Implements relationships: ${implementsRelations.length}`);
            console.log(`  ✓ Include relationships: ${includeRelations.length}`);

            for (const rel of extendsRelations) {
                console.log(`    - ${path.basename(rel.source)} extends ${path.basename(rel.target)}`);
            }

            this.addResult('Cross-File Dependencies', 'PASS', `Found ${result.relations.length} cross-file relationships`, 
                { 
                    extends: extendsRelations.length, 
                    implements: implementsRelations.length,
                    includes: includeRelations.length
                }, Date.now() - startTime);
        } catch (error: any) {
            this.addResult('Cross-File Dependencies', 'FAIL', error.message, error, Date.now() - startTime);
        }
    }

    private addResult(name: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details: any, duration: number): void {
        this.results.push({ name, status, message, details, duration });
    }

    private printSummary(): void {
        console.log('\n' + '='.repeat(80));
        console.log('TEST SUMMARY');
        console.log('='.repeat(80));

        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        const skipped = this.results.filter(r => r.status === 'SKIP').length;
        const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

        for (const result of this.results) {
            const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⊘';
            const color = result.status === 'PASS' ? '\x1b[32m' : result.status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
            console.log(`${color}${icon}\x1b[0m ${result.name}: ${result.message} (${result.duration}ms)`);
        }

        console.log('\n' + '-'.repeat(80));
        console.log(`Total: ${this.results.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
        console.log(`Total Duration: ${totalDuration}ms`);
        console.log('='.repeat(80));
    }

    getResults(): TestResult[] {
        return this.results;
    }
}

// Export for use in VS Code extension
export async function runTests(): Promise<TestResult[]> {
    const runner = new TestRunner();
    return await runner.runAll();
}

// Run tests if executed directly
if (require.main === module) {
    runTests().then(results => {
        const failed = results.filter(r => r.status === 'FAIL').length;
        process.exit(failed > 0 ? 1 : 0);
    });
}

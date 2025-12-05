// Test all challenge files
const Module = require('module');
const originalLoad = Module._load;
Module._load = function(req, parent) {
    if (req === 'vscode') return {
        workspace: { getConfiguration: () => ({}) },
        window: { showErrorMessage: () => {}, showInformationMessage: () => {} },
        Uri: { parse: u => u },
        env: { openExternal: () => {} },
        Position: function(l, c) { this.line = l; this.character = c; },
        Location: function(u, p) { this.uri = u; this.range = { start: p }; }
    };
    return originalLoad(req, parent);
};

const fs = require('fs');
const path = require('path');
const { VulnerabilityScanner } = require('./out/analyzers/vulnerabilityScanner');
const { PHPAnalyzer } = require('./out/analyzers/phpAnalyzer');
const { POPChainDetector } = require('./out/analyzers/popChainDetector');

const challenges = [
    'test_challenges/01_lfi.php',
    'test_challenges/02_variable_override.php',
    'test_challenges/03_sqli.php',
    'test_challenges/04_ssrf.php',
    'test_challenges/05_xxe.php',
    'test_challenges/06_deserialize.php',
    'ctf_example.php'
];

console.log('='.repeat(60));
console.log('PHP Security Analysis Test Suite');
console.log('='.repeat(60));

for (const file of challenges) {
    if (!fs.existsSync(file)) {
        console.log(`\n[SKIP] ${file} - not found`);
        continue;
    }
    
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`File: ${file}`);
    console.log('─'.repeat(60));
    
    const code = fs.readFileSync(file, 'utf8');
    
    // Test vulnerability scanner
    const analyzer = new PHPAnalyzer(code);
    const scanner = new VulnerabilityScanner(analyzer.getAST());
    const doc = { uri: file, getText: () => code };
    const vulns = scanner.scanVulnerabilities(doc);
    
    console.log(`\n[Vulnerabilities] Found ${vulns.length}:`);
    vulns.forEach(v => console.log(`  - ${v.message}`));
    
    // Test POP chain detector
    const popDetector = new POPChainDetector();
    const chains = popDetector.findPOPChains(code);
    
    console.log(`\n[POP Chains] Found ${chains.length}:`);
    chains.forEach(c => console.log(`  - ${c.entryClass}::${c.entryMethod} → ${c.finalSink} (${c.riskLevel})`));
}

console.log('\n' + '='.repeat(60));
console.log('Test Complete');
console.log('='.repeat(60));

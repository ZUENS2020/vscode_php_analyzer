#!/usr/bin/env node

/**
 * Test script for CTF questions
 * Tests the POP chain detector on all CTF questions
 */

const fs = require('fs');
const path = require('path');
const { POPChainDetector } = require('./out/analyzers/popChainDetector');

const questionsDir = path.join(__dirname, 'php questions - 副本');

// Questions to test
const questions = [
    { name: '02-反序列化入门', file: 'index.php' },
    { name: '06-反序列化POP链', file: 'index.php' },
    { name: '10-Session反序列化', file: 'index.php' }
];

console.log('='.repeat(80));
console.log('Testing PHP POP Chain Detector on CTF Questions');
console.log('='.repeat(80));

for (const question of questions) {
    console.log('\n' + '='.repeat(80));
    console.log(`Testing: ${question.name}`);
    console.log('='.repeat(80));
    
    const filePath = path.join(questionsDir, question.name, question.file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        continue;
    }
    
    const code = fs.readFileSync(filePath, 'utf-8');
    const detector = new POPChainDetector();
    
    console.log(`\n📄 Analyzing ${filePath}...\n`);
    
    try {
        const chains = detector.findPOPChains(code);
        
        console.log(`\n✅ Found ${chains.length} POP chains/vulnerabilities\n`);
        
        chains.forEach((chain, i) => {
            console.log(`\n${'─'.repeat(80)}`);
            console.log(`Chain #${i + 1}: ${chain.description}`);
            console.log(`${'─'.repeat(80)}`);
            console.log(`Type: ${chain.vulnType || 'pop_chain'}`);
            console.log(`Entry: ${chain.entryClass}::${chain.entryMethod}`);
            console.log(`Risk Level: ${chain.riskLevel.toUpperCase()}`);
            console.log(`\nSteps:`);
            chain.steps.forEach((step, j) => {
                console.log(`  [${j + 1}] ${step.className}::${step.methodName} (${step.trigger})`);
                if (step.operations.length > 0) {
                    console.log(`      Operations: ${step.operations.join(', ')}`);
                }
            });
            
            if (chain.regexFilters && chain.regexFilters.length > 0) {
                console.log(`\n🔒 Regex Filters Detected:`);
                chain.regexFilters.forEach(f => {
                    console.log(`  - Pattern: ${f.pattern} (line ${f.line})`);
                    if (f.bypassMethods.length > 0) {
                        console.log(`    Bypass methods:`);
                        f.bypassMethods.forEach(m => console.log(`      • ${m}`));
                    }
                });
            }
            
            if (chain.sessionHandlers && chain.sessionHandlers.length > 0) {
                console.log(`\n🔐 Session Handlers Detected:`);
                chain.sessionHandlers.forEach(h => {
                    console.log(`  - Handler: ${h.handler} (line ${h.line})`);
                });
            }
            
            if (chain.bypassHints && chain.bypassHints.length > 0) {
                console.log(`\n💡 Bypass Hints:`);
                chain.bypassHints.forEach(hint => {
                    console.log(`  ${hint}`);
                });
            }
            
            console.log(`\n📝 Payload Preview (first 500 chars):`);
            console.log(chain.payload.substring(0, 500));
            if (chain.payload.length > 500) {
                console.log(`... (${chain.payload.length - 500} more characters)`);
            }
        });
        
    } catch (error) {
        console.error(`\n❌ Error analyzing ${question.name}:`, error.message);
        console.error(error.stack);
    }
}

console.log('\n' + '='.repeat(80));
console.log('Testing Complete');
console.log('='.repeat(80));

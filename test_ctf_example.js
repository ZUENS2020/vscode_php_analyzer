const { POPChainDetector } = require('./out/analyzers/popChainDetector');
const fs = require('fs');

const code = fs.readFileSync('ctf_example.php', 'utf-8');
console.log('=== Analyzing ctf_example.php ===\n');

const detector = new POPChainDetector();
const chains = detector.findPOPChains(code);

console.log(`\n=== Found ${chains.length} POP chains ===\n`);

for (const chain of chains) {
    console.log(`Chain: ${chain.entryClass}::${chain.entryMethod}`);
    console.log(`Risk: ${chain.riskLevel}`);
    console.log(`Final Sink: ${chain.finalSink}`);
    console.log(`Description: ${chain.description}`);
    console.log('\nSteps:');
    for (const step of chain.steps) {
        console.log(`  ${step.className}::${step.methodName} - ${step.trigger}`);
        if (step.calls?.length) {
            console.log(`    Calls: ${step.calls.join(', ')}`);
        }
    }
    console.log('\nGenerated Payload:');
    console.log(chain.payload);
    console.log('\n---\n');
}

// Save to Untitled-1.php
if (chains.length > 0) {
    fs.writeFileSync('Untitled-1.php', chains[0].payload);
    console.log('✓ Payload saved to Untitled-1.php');
}

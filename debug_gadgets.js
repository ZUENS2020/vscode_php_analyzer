const { POPChainDetector } = require('./out/analyzers/popChainDetector');
const fs = require('fs');

const code = fs.readFileSync('ctf_example.php', 'utf-8');
const detector = new POPChainDetector();
const gadgets = detector.getGadgets(code);

console.log('=== All Gadgets ===\n');
for (const g of gadgets) {
    console.log(`${g.className}::${g.methodName}`);
    console.log(`  isMagic: ${g.isMagic}`);
    console.log(`  Properties:`);
    for (const p of g.properties) {
        console.log(`    - ${p.name} (${p.type})`);
        if (p.details) {
            console.log(`      details:`, JSON.stringify(p.details, null, 2));
        }
    }
    console.log(`  Dangerous Calls:`);
    for (const dc of g.dangerousCalls) {
        console.log(`    - ${dc.pattern} (${dc.riskLevel})`);
    }
    console.log(`  Triggers:`);
    for (const t of g.triggers) {
        console.log(`    - ${t.type}: ${t.description}`);
    }
    console.log('');
}

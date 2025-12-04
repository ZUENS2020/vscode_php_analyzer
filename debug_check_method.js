const { POPChainDetector } = require('./out/analyzers/popChainDetector');
const fs = require('fs');

const code = fs.readFileSync('ctf_example.php', 'utf-8');
const detector = new POPChainDetector();

// Access private methods via prototype
const chains = detector.findPOPChains(code);

// Get all classes
console.log('Classes found:');
const gadgets = detector.getGadgets(code);
console.log('\nGadgets found:');
gadgets.forEach(g => {
    console.log(`- ${g.className}::${g.methodName}`);
});

// Check for PersonC::check
const checkGadget = gadgets.find(g => g.className === 'PersonC' && g.methodName === 'check');
console.log('\nPersonC::check gadget:', checkGadget ? 'FOUND' : 'NOT FOUND');

if (checkGadget) {
    console.log('Properties:', checkGadget.properties);
    console.log('Dangerous Calls:', checkGadget.dangerousCalls);
}

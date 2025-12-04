"use strict";
// 测试 POP Chain Detector
const { POPChainDetector } = require('./out/analyzers/popChainDetector');
const fs = require('fs');
const path = require('path');
const q06Code = fs.readFileSync(path.join(__dirname, 'php questions - 副本', '06-反序列化POP链', 'index.php'), 'utf-8');
console.log('=== 分析题目6 ===\n');
const detector = new POPChainDetector();
const chains = detector.findPOPChains(q06Code);
console.log(`\n=== 发现 ${chains.length} 条POP链 ===\n`);
for (const chain of chains) {
    console.log(`链: ${chain.entryClass}::${chain.entryMethod}`);
    console.log(`风险等级: ${chain.riskLevel}`);
    console.log(`最终Sink: ${chain.finalSink}`);
    console.log(`描述: ${chain.description}`);
    console.log('\n步骤:');
    for (const step of chain.steps) {
        console.log(`  ${step.className}::${step.methodName} - ${step.trigger}`);
        if (step.calls?.length) {
            console.log(`    调用: ${step.calls.join(', ')}`);
        }
    }
    console.log('\n生成的Payload:');
    console.log(chain.payload);
    console.log('\n---\n');
}
//# sourceMappingURL=test_detector.js.map
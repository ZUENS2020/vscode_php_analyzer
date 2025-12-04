const phpParser = require('php-parser');

// Simulate the analysis of PersonC::check
const code = `<?php
class PersonC {
    public $name;
    
    public function check($age) {
        ($this->name)($age);
    }
}
`;

const parser = new phpParser.Engine({
    parser: { extractDoc: true, php7: true },
    ast: { withPositions: true, withSource: true }
});

const ast = parser.parseCode(code, 'php');
const classNode = ast.children.find(n => n.kind === 'class');
const methodNode = classNode.body.find(n => n.kind === 'method' && n.name.name === 'check');
const callNode = methodNode.body.children[0].expression;

console.log('Call node kind:', callNode.kind);
console.log('What kind:', callNode.what.kind);
console.log('What:', callNode.what);
console.log('What.parenthesizedExpression:', callNode.what.parenthesizedExpression);
console.log('What.what:', callNode.what.what);
console.log('What.what.name:', callNode.what.what.name);
console.log('What.offset:', callNode.what.offset);
console.log('What.offset.name:', callNode.what.offset.name);

// This should match the pattern for ($this->prop)($arg)
// The check in the code is: this.isThisPropertyCall(what)
// which checks if what?.kind === 'propertylookup' && this.isThisProperty(what)

console.log('\nChecking if this is a $this->prop call:');
console.log('what.kind === "propertylookup":', callNode.what.kind === 'propertylookup');
console.log('what.what.kind === "variable":', callNode.what.what.kind === 'variable');
console.log('what.what.name === "this":', callNode.what.what.name === 'this');

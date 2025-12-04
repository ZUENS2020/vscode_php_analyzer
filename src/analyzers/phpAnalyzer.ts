import * as parser from 'php-parser';

export class PHPAnalyzer {
    private ast: any;
    private parser: any;

    constructor(code: string) {
        this.parser = new parser.Engine({
            parser: {
                extractDoc: true,
                suppressErrors: true
            },
            ast: {
                withPositions: true
            }
        });

        try {
            this.ast = this.parser.parseCode(code);
        } catch (error: any) {
            console.error('Parse error:', error);
            this.ast = { children: [] };
        }
    }

    getAST(): any {
        return this.ast;
    }

    traverse(node: any, callback: (node: any, parent: any) => void, parent: any = null) {
        if (!node || typeof node !== 'object') {
            return;
        }

        callback(node, parent);

        // Handle different node structures
        if (Array.isArray(node)) {
            node.forEach(child => this.traverse(child, callback, parent));
        } else {
            // Traverse known properties
            const properties = ['children', 'body', 'arguments', 'items', 'what', 'left', 'right', 
                              'expr', 'test', 'alternate', 'consequent', 'properties', 'methods',
                              'extends', 'implements', 'adaptations', 'key', 'value'];
            
            for (const prop of properties) {
                if (node[prop]) {
                    if (Array.isArray(node[prop])) {
                        node[prop].forEach((child: any) => this.traverse(child, callback, node));
                    } else {
                        this.traverse(node[prop], callback, node);
                    }
                }
            }
        }
    }

    findNodesByType(type: string): any[] {
        const results: any[] = [];
        this.traverse(this.ast, (node) => {
            if (node.kind === type) {
                results.push(node);
            }
        });
        return results;
    }

    findClassByName(className: string): any | null {
        const classes = this.findNodesByType('class');
        return classes.find(c => c.name && c.name.name === className) || null;
    }

    findMethodInClass(className: string, methodName: string): any | null {
        const classNode = this.findClassByName(className);
        if (!classNode || !classNode.body) {
            return null;
        }

        for (const member of classNode.body) {
            if (member.kind === 'method' && member.name && member.name.name === methodName) {
                return member;
            }
        }
        return null;
    }

    getAllClasses(): any[] {
        return this.findNodesByType('class');
    }

    getAllFunctionCalls(): any[] {
        return this.findNodesByType('call');
    }

    isMagicMethod(methodName: string): boolean {
        const magicMethods = [
            '__construct', '__destruct', '__call', '__callStatic',
            '__get', '__set', '__isset', '__unset',
            '__sleep', '__wakeup', '__serialize', '__unserialize',
            '__toString', '__invoke', '__set_state', '__clone', '__debugInfo'
        ];
        return magicMethods.includes(methodName);
    }

    isDangerousFunction(functionName: string): boolean {
        const dangerousFunctions = [
            'eval', 'assert', 'system', 'exec', 'passthru', 'shell_exec',
            'popen', 'proc_open', 'pcntl_exec',
            'call_user_func', 'call_user_func_array', 'create_function',
            'unserialize', 'file_get_contents', 'file_put_contents',
            'include', 'include_once', 'require', 'require_once',
            'preg_replace', 'extract', 'parse_str', 'putenv',
            'mail', 'mb_send_mail', 'stream_socket_server'
        ];
        return dangerousFunctions.includes(functionName.toLowerCase());
    }

    isUserInputSource(varName: string): boolean {
        const sources = ['$_GET', '$_POST', '$_COOKIE', '$_REQUEST', '$_FILES', '$_SERVER', '$_ENV'];
        return sources.some(source => varName.startsWith(source));
    }

    getNodeLocation(node: any): { line: number; character: number } | null {
        if (node.loc && node.loc.start) {
            return {
                line: node.loc.start.line - 1,
                character: node.loc.start.column
            };
        }
        return null;
    }
}

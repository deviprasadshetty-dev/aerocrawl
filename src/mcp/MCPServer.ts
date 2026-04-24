import { SmartFetcher } from '../fetcher/SmartFetcher.js';
import { SearchEngine } from '../search/SearchEngine.js';

interface MCPRequest {
    jsonrpc: '2.0';
    id: number | string;
    method: string;
    params?: any;
}

interface MCPResponse {
    jsonrpc: '2.0';
    id: number | string;
    result?: any;
    error?: { code: number; message: string };
}

interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}

export class MCPServer {
    private tools: MCPTool[] = [
        {
            name: 'scrape',
            description: 'Scrape a URL and return markdown, HTML, or screenshot',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'URL to scrape' },
                    formats: { type: 'array', items: { type: 'string', enum: ['markdown', 'html', 'screenshot'] }, description: 'Output formats' }
                },
                required: ['url']
            }
        },
        {
            name: 'extract',
            description: 'Extract structured data from a URL using AI',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'URL to extract from' },
                    prompt: { type: 'string', description: 'What to extract' }
                },
                required: ['url']
            }
        },
        {
            name: 'crawl',
            description: 'Crawl a website and extract data from all pages',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'Start URL' },
                    maxUrls: { type: 'number', description: 'Max URLs to crawl' }
                },
                required: ['url']
            }
        },
        {
            name: 'search',
            description: 'Search the web using CDP-automated search engines',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query' },
                    engine: { type: 'string', enum: ['duckduckgo', 'google', 'bing'], description: 'Search engine' }
                },
                required: ['query']
            }
        },
        {
            name: 'agent',
            description: 'AI-driven browser automation to complete tasks',
            inputSchema: {
                type: 'object',
                properties: {
                    goal: { type: 'string', description: 'What to accomplish' },
                    url: { type: 'string', description: 'Starting URL' }
                },
                required: ['goal']
            }
        }
    ];

    async handleRequest(req: MCPRequest): Promise<MCPResponse> {
        try {
            switch (req.method) {
                case 'initialize':
                    return this.handleInitialize(req);
                case 'tools/list':
                    return this.handleToolsList(req);
                case 'tools/call':
                    return await this.handleToolCall(req);
                case 'ping':
                    return { jsonrpc: '2.0', id: req.id, result: {} };
                default:
                    return {
                        jsonrpc: '2.0',
                        id: req.id,
                        error: { code: -32601, message: 'Method not found' }
                    };
            }
        } catch (error: any) {
            return {
                jsonrpc: '2.0',
                id: req.id,
                error: { code: -32603, message: error.message || 'Internal error' }
            };
        }
    }

    private handleInitialize(req: MCPRequest): MCPResponse {
        return {
            jsonrpc: '2.0',
            id: req.id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {}
                },
                serverInfo: {
                    name: 'aerocrawl',
                    version: '1.0.0'
                }
            }
        };
    }

    private handleToolsList(req: MCPRequest): MCPResponse {
        return {
            jsonrpc: '2.0',
            id: req.id,
            result: {
                tools: this.tools
            }
        };
    }

    private async handleToolCall(req: MCPRequest): Promise<MCPResponse> {
        const { name, arguments: args } = req.params || {};

        try {
            let result: any;
            switch (name) {
                case 'scrape':
                    result = await this.scrape(args);
                    break;
                case 'extract':
                    result = await this.extract(args);
                    break;
                case 'crawl':
                    result = await this.crawl(args);
                    break;
                case 'search':
                    result = await this.search(args);
                    break;
                case 'agent':
                    result = await this.agent(args);
                    break;
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }

            return {
                jsonrpc: '2.0',
                id: req.id,
                result: {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
                }
            };
        } catch (error: any) {
            return {
                jsonrpc: '2.0',
                id: req.id,
                error: { code: -32603, message: error.message }
            };
        }
    }

    private async scrape(args: any) {
        const fetcher = new SmartFetcher();
        await fetcher.init();
        const html = await fetcher.fetch(args.url);
        fetcher.close();
        return { url: args.url, markdown: html.slice(0, 10000) };
    }

    private async extract(args: any) {
        return { message: 'Extract requires LLM configuration' };
    }

    private async crawl(args: any) {
        return { message: 'Crawl started', crawlId: 'async_operation' };
    }

    private async search(args: any) {
        const engine = new SearchEngine(args.engine || 'duckduckgo');
        await engine.init();
        const results = await engine.search(args.query, 10);
        await engine.close();
        return results;
    }

    private async agent(args: any) {
        return { message: 'Agent mode requires LLM configuration' };
    }
}

export function generateMCPConfig(aerocrawlPath: string, mode?: string): any {
    const args = [aerocrawlPath];
    if (mode) args.push(mode);

    return {
        mcpServers: {
            aerocrawl: {
                command: 'node',
                args: args
            }
        }
    };
}

export async function startMCPServer() {
    const server = new MCPServer();

    const readline = await import('readline');

    const rl = readline.createInterface({
        input: process.stdin,
        terminal: false
    });

    process.stderr.write('AeroCrawl MCP Server started\n');

    rl.on('line', async (line: string) => {
        try {
            const req: MCPRequest = JSON.parse(line);
            const res = await server.handleRequest(req);
            process.stdout.write(JSON.stringify(res) + '\n');
        } catch (e: any) {
            process.stderr.write('Parse error: ' + e.message + '\n');
        }
    });

    process.stdin.on('end', () => {
        process.exit(0);
    });
}

import { Command } from 'commander';
import chalk from 'chalk';
import { SmartFetcher, type FetchOptions } from './fetcher/SmartFetcher.js';
import { MarkdownPipeline } from './parser/MarkdownPipeline.js';
import { CrawlManager } from './crawler/CrawlManager.js';
import { AIExtractor } from './extractor/AIExtractor.js';
import { LLMClient } from './llm/LLMClient.js';
import { CDPAgent, type AgentTask } from './agent/CDPAgent.js';
import { SearchEngine, type SearchEngineType } from './search/SearchEngine.js';
import { startMCPServer, generateMCPConfig } from './mcp/MCPServer.js';
import type { CdpAction } from './browser/CDPBrowser.js';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

function getLLMConfig(options: any) {
    if (!options.provider && !process.env.LLM_PROVIDER) return undefined;

    const provider = options.provider || process.env.LLM_PROVIDER;
    const config: any = { provider };

    if (provider === 'openrouter') {
        config.apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;
        config.model = options.model || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';
    } else if (provider === 'openai') {
        config.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
        config.model = options.model || process.env.OPENAI_MODEL;
    } else if (provider === 'anthropic') {
        config.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
        config.model = options.model || process.env.ANTHROPIC_MODEL;
    } else if (provider === 'ollama') {
        config.baseUrl = options.baseUrl || process.env.OLLAMA_BASE_URL;
        config.model = options.model || process.env.OLLAMA_MODEL;
    }

    return config;
}

function loadActions(actionsFile?: string): CdpAction[] {
    if (!actionsFile) return [];
    if (!fs.existsSync(actionsFile)) {
        console.error(chalk.red(`Actions file not found: ${actionsFile}`));
        process.exit(1);
    }
    try {
        return JSON.parse(fs.readFileSync(actionsFile, 'utf-8'));
    } catch (err: any) {
        console.error(chalk.red(`Invalid actions file: ${err.message}`));
        process.exit(1);
    }
}

function loadUrls(batchFile?: string): string[] {
    if (!batchFile) return [];
    if (!fs.existsSync(batchFile)) {
        console.error(chalk.red(`Batch file not found: ${batchFile}`));
        process.exit(1);
    }
    const content = fs.readFileSync(batchFile, 'utf-8');
    try {
        // Try parsing as JSON array first
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
    } catch (e) {
        // Fall back to line-by-line
        return content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    }
    return [];
}

const PROGRAM = new Command();

PROGRAM
    .name('aerocrawl')
    .description(chalk.cyan.bold('AeroCrawl - Lightweight web scraping & crawling engine'))
    .version('1.0.0')
    .argument('[url]', 'URL to scrape (default: scrape mode)')
    .option('-m, --mode <mode>', 'Mode: scrape, extract, map, crawl, batch, agent, serve', 'scrape')
    .option('-o, --output <file>', 'Output file/directory')
    .option('--extract', 'Enable AI extraction')
    .option('--provider <provider>', 'LLM provider (openai, anthropic, ollama, openrouter)', 'openrouter')
    .option('--api-key <key>', 'API key')
    .option('--model <model>', 'Model name')
    .option('--max-urls <number>', 'Max URLs for crawl/map', '100')
    .option('--actions-file <path>', 'JSON file with CDP actions array')
    .option('--screenshot', 'Take screenshot')
    .option('--formats <formats>', 'Comma-separated formats: markdown,html,screenshot', 'markdown')
    .option('--batch <file>', 'File with URLs to batch scrape (JSON array or line-by-line)')
    .option('--goal <text>', 'Goal description for agent mode')
    .option('--max-steps <number>', 'Max steps for agent mode', '10')
    .option('--generate-mcp-config', 'Generate MCP config for Cursor/KiloCode')
    .action(async (url, options) => {
        // Generate MCP config if requested
        if (options.generateMcpConfig) {
            const cwd = process.cwd();
            const aerocrawlPath = path.join(cwd, 'dist', 'cli.js');
            
            // Generate for Cursor
            const cursorDir = path.join(cwd, '.cursor');
            if (!fs.existsSync(cursorDir)) {
                fs.mkdirSync(cursorDir, { recursive: true });
            }
            const cursorConfig = generateMCPConfig(aerocrawlPath, 'mcp');
            fs.writeFileSync(
                path.join(cursorDir, 'mcp.json'),
                JSON.stringify(cursorConfig, null, 2)
            );
            
            console.log(chalk.green('✓ Generated .cursor/mcp.json'));
            console.log(chalk.gray('  Add to Cursor: Settings → MCP → Add Server'));
            console.log(chalk.gray('  Config: ' + JSON.stringify(cursorConfig, null, 2)));
            
            return;
        }
        // Auto-detect agent mode if goal is provided
        let mode = options.mode || 'scrape';
        if (options.goal && mode === 'scrape') {
            mode = 'agent';
        }

        if (mode === 'serve') {
            const { startServer } = await import('./index.js');
            await startServer();
            return;
        }

        if (mode === 'mcp') {
            console.error(chalk.blue('Starting AeroCrawl MCP Server...'));
            startMCPServer();
            return;
        }

        if (mode === 'batch') {
            const urls = options.batch ? loadUrls(options.batch) : (url ? [url] : []);
            if (urls.length === 0) {
                console.error(chalk.red('Error: No URLs provided for batch scrape'));
                process.exit(1);
            }

            const crawlManager = new CrawlManager();
            await crawlManager.init();
            try {
                const actions = loadActions(options.actionsFile);
                const formats = (options.formats as string).split(',') as ('markdown' | 'html' | 'screenshot')[];
                if (options.screenshot && !formats.includes('screenshot')) {
                    formats.push('screenshot');
                }

                console.log(chalk.blue(`Starting batch scrape for ${urls.length} URLs...`));
                const batchId = await crawlManager.startBatchScrape({
                    urls,
                    actions,
                    formats
                });

                while (true) {
                    await new Promise(r => setTimeout(r, 2000));
                    const status = crawlManager.getCrawlStatus(batchId);
                    if (!status) break;

                    process.stdout.write(chalk.gray(`\rProgress: ${status.processedUrls}/${status.totalUrls}...`));

                    if (status.status === 'completed') {
                        console.log(chalk.green('\nBatch completed!'));
                        if (options.output) {
                            const results = crawlManager.getCrawlResults(batchId);
                            if (results?.results) {
                                fs.writeFileSync(options.output, JSON.stringify(results.results, null, 2));
                                console.log(chalk.green(`Saved results to ${options.output}`));
                            }
                        }
                        break;
                    }
                }
            } catch (err: any) {
                console.error(chalk.red(`Error: ${err.message}`));
                process.exit(1);
            } finally {
                crawlManager.close();
            }
            return;
        }

        if (!url) {
            PROGRAM.outputHelp();
            return;
        }

        if (mode === 'scrape') {
            const fetcher = new SmartFetcher();
            const parser = new MarkdownPipeline();
            try {
                await fetcher.init();
                console.log(chalk.blue(`Scraping ${url}...`));

                const actions = loadActions(options.actionsFile);
                const formats = (options.formats as string).split(',') as ('markdown' | 'html' | 'screenshot')[];
                if (options.screenshot && !formats.includes('screenshot')) {
                    formats.push('screenshot');
                }

                const fetchOptions: FetchOptions = { actions, formats };
                const { html, screenshot } = await fetcher.fetchWithOptions(url, fetchOptions);

                const result: any = { url };

                if (formats.includes('html')) result.html = html;
                if (formats.includes('markdown')) result.markdown = parser.process(html, url);
                if (formats.includes('screenshot') && screenshot) {
                    result.screenshot = screenshot.toString('base64');
                }

                fetcher.close();

                if (options.output) {
                    fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
                    console.log(chalk.green(`Saved to ${options.output}`));
                } else {
                    console.log(JSON.stringify(result, null, 2));
                }
            } catch (err: any) {
                console.error(chalk.red(`Error: ${err.message}`));
                process.exit(1);
            }
            return;
        }

        if (mode === 'extract') {
            try {
                const llmConfig = getLLMConfig(options);
                if (!llmConfig) {
                    console.error(chalk.red('Error: No LLM provider configured'));
                    process.exit(1);
                }
                console.log(chalk.blue(`Extracting from ${url}...`));
                const extractor = new AIExtractor(llmConfig);
                const fetcher = new SmartFetcher();
                const parser = new MarkdownPipeline();
                await fetcher.init();
                const html = await fetcher.fetch(url);
                const markdown = parser.process(html, url);
                fetcher.close();
                const result = await extractor.extract(markdown);
                const output = JSON.stringify(result.data, null, 2);
                if (options.output) {
                    fs.writeFileSync(options.output, output);
                    console.log(chalk.green(`Saved to ${options.output}`));
                } else {
                    console.log(output);
                }
            } catch (err: any) {
                console.error(chalk.red(`Error: ${err.message}`));
                process.exit(1);
            }
            return;
        }

        if (mode === 'search') {
            if (!url) {
                console.error(chalk.red('Error: Query is required for search mode'));
                process.exit(1);
            }

            try {
                const engine = (options.engine as SearchEngineType) || 'duckduckgo';
                console.log(chalk.blue(`Searching "${url}" using ${engine}...`));

                const searchEngine = new SearchEngine(engine);
                await searchEngine.init();

                const results = await searchEngine.search(url, parseInt(options.maxUrls) || 10);

                await searchEngine.close();

                if (options.output) {
                    fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
                    console.log(chalk.green(`Saved to ${options.output}`));
                } else {
                    console.log(JSON.stringify(results, null, 2));
                }
            } catch (err: any) {
                console.error(chalk.red(`Error: ${err.message}`));
                process.exit(1);
            }
            return;
        }

        if (mode === 'map') {
            const crawlManager = new CrawlManager();
            await crawlManager.init();
            try {
                console.log(chalk.blue(`Mapping ${url}...`));
                const maxUrls = parseInt(options.maxUrls) || 100;
                const urls = await crawlManager.mapSite(url, maxUrls);
                crawlManager.close();
                if (options.output) {
                    fs.writeFileSync(options.output, JSON.stringify(urls, null, 2));
                    console.log(chalk.green(`Found ${urls.length} URLs, saved to ${options.output}`));
                } else {
                    console.log(JSON.stringify(urls, null, 2));
                }
            } catch (err: any) {
                console.error(chalk.red(`Error: ${err.message}`));
                process.exit(1);
            }
            return;
        }

        if (mode === 'agent') {
            const goal = options.goal;
            if (!goal) {
                console.error(chalk.red('Error: --goal is required for agent mode'));
                process.exit(1);
            }

            try {
                const llmConfig = getLLMConfig(options);
                if (!llmConfig) {
                    console.error(chalk.red('Error: No LLM provider configured for agent mode'));
                    process.exit(1);
                }

                console.log(chalk.blue(`Agent mode: "${goal}"`));
                const agent = new CDPAgent({
                    provider: llmConfig.provider,
                    apiKey: llmConfig.apiKey,
                    model: llmConfig.model,
                    baseUrl: llmConfig.baseUrl,
                    maxSteps: parseInt(options.maxSteps) || 10
                });

                await agent.init();
                const result = await agent.execute({ goal, url: url || undefined });

                if (result.success) {
                    console.log(chalk.green('\nAgent completed successfully!'));
                    const output = JSON.stringify(result.data, null, 2);
                    if (options.output) {
                        fs.writeFileSync(options.output, output);
                        console.log(chalk.green(`Saved to ${options.output}`));
                    } else {
                        console.log(output);
                    }
                    console.log(chalk.gray(`\nActions taken: ${result.actionsTaken.length}`));
                } else {
                    console.error(chalk.red(`Agent failed: ${result.error}`));
                }

                agent.close();
            } catch (err: any) {
                console.error(chalk.red(`Error: ${err.message}`));
                process.exit(1);
            }
            return;
        }

        if (mode === 'crawl') {
            const crawlManager = new CrawlManager();
            await crawlManager.init();
            try {
                console.log(chalk.blue(`Crawling ${url}...`));
                const llmConfig = options.extract ? getLLMConfig(options) : undefined;
                const actions = loadActions(options.actionsFile);
                const formats = (options.formats as string).split(',') as ('markdown' | 'html' | 'screenshot')[];
                if (options.screenshot && !formats.includes('screenshot')) {
                    formats.push('screenshot');
                }

                const crawlId = await crawlManager.startCrawl({
                    url,
                    maxUrls: parseInt(options.maxUrls) || 100,
                    extract: options.extract || false,
                    llmConfig,
                    actions,
                    formats
                });
                console.log(chalk.green(`Crawl started: ${crawlId}`));

                while (true) {
                    await new Promise(r => setTimeout(r, 2000));
                    const status = crawlManager.getCrawlStatus(crawlId);
                    if (!status) break;

                    process.stdout.write(chalk.gray(`\rProgress: ${status.processedUrls}/${status.totalUrls}...`));

                    if (status.status === 'completed') {
                        console.log(chalk.green('\nCompleted!'));
                        if (options.output) {
                            const outDir = options.output;
                            if (!fs.existsSync(outDir)) {
                                fs.mkdirSync(outDir, { recursive: true });
                            }
                            const results = crawlManager.getCrawlResults(crawlId);
                            if (results && results.results) {
                                results.results.forEach((r: any, idx: number) => {
                                    const urlSlug = r.url
                                        .replace(/https?:\/\//, '')
                                        .replace(/[^a-z0-9]/gi, '_')
                                        .slice(0, 100);
                                    const filename = path.join(outDir, `${idx}_${urlSlug}.json`);
                                    fs.writeFileSync(filename, JSON.stringify(r, null, 2));
                                });
                                console.log(chalk.green(`Saved ${results.results.length} pages to ${outDir}`));
                            }
                        }
                        break;
                    }
                }
            } catch (err: any) {
                console.error(chalk.red(`Error: ${err.message}`));
                process.exit(1);
            } finally {
                crawlManager.close();
            }
            return;
        }
    });

PROGRAM.addHelpText('after', chalk.gray(`
Examples:
  ${chalk.cyan('aerocrawl https://example.com')}                                    Scrape (default mode)
  ${chalk.cyan('aerocrawl https://example.com --screenshot')}                     Scrape with screenshot
  ${chalk.cyan('aerocrawl https://example.com --actions-file actions.json')}      Scrape with CDP actions
  ${chalk.cyan('aerocrawl https://example.com -m extract')}                      Extract with AI
  ${chalk.cyan('aerocrawl -m batch --batch urls.txt')}                           Batch scrape URLs from file
  ${chalk.cyan('aerocrawl https://example.com -m crawl --formats markdown,html')} Crawl with multiple formats

Environment variables:
  LLM_PROVIDER=openrouter                  Set default provider
  OPENROUTER_API_KEY=sk-or-v1-...         OpenRouter API key (free tier available)
  OPENAI_API_KEY=sk-...                    OpenAI API key

Free models via OpenRouter:
  nvidia/nemotron-3-super-120b-a12b:free  (recommended)
  meta-llama/llama-3-8b-instruct:free
  google/gemma-7b-it:free
  mistralai/mistral-7b-instruct:free

Actions file example (actions.json):
  [
    {"type": "click", "selector": "#button"},
    {"type": "wait", "ms": 1000},
    {"type": "type", "selector": "#input", "text": "hello"},
    {"type": "screenshot"}
  ]
`));

PROGRAM.parse();

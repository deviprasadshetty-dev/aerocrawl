import express, { type Request, type Response, type Express } from 'express';
import { SmartFetcher, type FetchOptions } from './fetcher/SmartFetcher.js';
import { MarkdownPipeline } from './parser/MarkdownPipeline.js';
import { AIExtractor } from './extractor/AIExtractor.js';
import type { ExtractionSchema } from './llm/LLMClient.js';
import { CrawlManager } from './crawler/CrawlManager.js';
import { CDPAgent, type AgentTask } from './agent/CDPAgent.js';
import { SearchEngine, type SearchEngineType, type SearchResponse } from './search/SearchEngine.js';
import type { CdpAction } from './browser/CDPBrowser.js';

export const app: Express = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialize components
export const fetcher = new SmartFetcher();
export const parser = new MarkdownPipeline();
export const crawlManager = new CrawlManager();

app.post('/v1/scrape', async (req: Request, res: Response): Promise<void> => {
    const { url, actions, formats, screenshot } = req.body;

    if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
    }

    try {
        console.log(`[API] Scraping ${url}`);

        // Determine formats
        let finalFormats = formats as ('markdown' | 'html' | 'screenshot')[] | undefined;
        if (!finalFormats) {
            finalFormats = screenshot ? ['markdown', 'screenshot'] : ['markdown'];
        }

        const fetchOptions: FetchOptions = {
            actions: actions as CdpAction[] || [],
            formats: finalFormats
        };

        const { html, screenshot: screenshotBuffer } = await fetcher.fetchWithOptions(url, fetchOptions);

        const result: any = { url };

        if (finalFormats.includes('html')) {
            result.html = html;
        }

        if (finalFormats.includes('markdown')) {
            result.markdown = parser.process(html, url);
        }

        if (finalFormats.includes('screenshot') && screenshotBuffer) {
            result.screenshot = screenshotBuffer.toString('base64');
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        console.error(`[API] Scrape failed for ${url}:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to scrape URL'
        });
    }
});

app.post('/v1/extract', async (req: Request, res: Response): Promise<void> => {
    const { url, markdown: providedMarkdown, schema, llmConfig } = req.body;

    if (!url && !providedMarkdown) {
        res.status(400).json({ error: 'URL or markdown content is required' });
        return;
    }

    try {
        console.log(`[API] Extracting from ${url || 'provided markdown'}`);

        let markdown: string;
        if (providedMarkdown) {
            markdown = providedMarkdown;
        } else {
            const html = await fetcher.fetch(url);
            markdown = parser.process(html, url);
        }

        const provider = llmConfig?.provider || process.env.LLM_PROVIDER || 'openai';
        const extractor = new AIExtractor({
            provider,
            apiKey: llmConfig?.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`],
            model: llmConfig?.model,
            baseUrl: llmConfig?.baseUrl || process.env.OLLAMA_BASE_URL
        });

        let extractionSchema: ExtractionSchema | undefined;
        if (schema) {
            extractionSchema = typeof schema === 'string' ? JSON.parse(schema) : schema;
        }

        const result = await extractor.extract(markdown, extractionSchema);

        res.json({
            success: true,
            data: {
                url: url || null,
                extracted: result.data,
                schema: result.schema,
                usage: result.usage
            }
        });
    } catch (error: any) {
        console.error(`[API] Extract failed:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to extract data'
        });
    }
});

app.post('/v1/batch/scrape', async (req: Request, res: Response): Promise<void> => {
    const { urls, actions, formats, extract, llmConfig, webhookUrl } = req.body;

    if (!urls || !Array.isArray(urls)) {
        res.status(400).json({ error: 'URLs array is required' });
        return;
    }

    try {
        console.log(`[API] Starting batch scrape for ${urls.length} URLs`);
        const batchId = await crawlManager.startBatchScrape({
            urls,
            actions: actions as CdpAction[],
            formats: formats as ('markdown' | 'html' | 'screenshot')[],
            extract,
            llmConfig,
            webhookUrl
        });

        res.json({
            success: true,
            data: { batchId }
        });
    } catch (error: any) {
        console.error(`[API] Batch scrape failed:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start batch scrape'
        });
    }
});

app.get('/v1/batch/scrape/:batchId', async (req: Request, res: Response): Promise<void> => {
    const batchId = req.params.batchId as string;
    const results = req.query.results as string | undefined;

    try {
        const status = crawlManager.getCrawlStatus(batchId);
        if (!status) {
            res.status(404).json({ error: 'Batch session not found' });
            return;
        }

        if (results === 'true') {
            const fullResults = crawlManager.getCrawlResults(batchId);
            res.json({ success: true, data: fullResults });
        } else {
            res.json({ success: true, data: status });
        }
    } catch (error: any) {
        console.error(`[API] Failed to get batch status:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get batch status'
        });
    }
});

app.post('/v1/crawl', async (req: Request, res: Response): Promise<void> => {
    const { url, maxUrls: maxUrlsRaw, extract, llmConfig, actions, formats, webhookUrl } = req.body;
    const maxUrls = typeof maxUrlsRaw === 'string' ? parseInt(maxUrlsRaw) : maxUrlsRaw;

    if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
    }

    try {
        console.log(`[API] Starting crawl for ${url}`);
        
        const crawlId = await crawlManager.startCrawl({
            url,
            maxUrls: maxUrls || 100,
            extract: extract || false,
            llmConfig,
            actions: actions as CdpAction[],
            formats: formats as ('markdown' | 'html' | 'screenshot')[],
            webhookUrl
        });

        res.json({
            success: true,
            data: {
                crawlId,
                message: 'Crawl started successfully'
            }
        });
    } catch (error: any) {
        console.error(`[API] Crawl failed for ${url}:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start crawl'
        });
    }
});

app.get('/v1/crawl/:crawlId', async (req: Request, res: Response): Promise<void> => {
    const crawlId = req.params.crawlId as string;
    const results = req.query.results as string | undefined;

    try {
        const status = crawlManager.getCrawlStatus(crawlId);
        
        if (!status) {
            res.status(404).json({ error: 'Crawl session not found' });
            return;
        }

        if (results === 'true') {
            const fullResults = crawlManager.getCrawlResults(crawlId);
            res.json({
                success: true,
                data: fullResults
            });
        } else {
            res.json({
                success: true,
                data: status
            });
        }
    } catch (error: any) {
        console.error(`[API] Failed to get crawl status:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get crawl status'
        });
    }
});

app.post('/v1/map', async (req: Request, res: Response): Promise<void> => {
    const { url } = req.body;
    const maxUrlsRaw = req.body.maxUrls;
    const maxUrls = typeof maxUrlsRaw === 'string' ? parseInt(maxUrlsRaw) : (maxUrlsRaw as number);

    if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
    }

    try {
        console.log(`[API] Mapping site ${url}`);

        const urls = await crawlManager.mapSite(url, maxUrls || 100);

        res.json({
            success: true,
            data: {
                url,
                urls,
                count: urls.length
            }
        });
    } catch (error: any) {
        console.error(`[API] Map failed for ${url}:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to map site'
        });
    }
});

// Agent endpoint - AI-driven CDP automation
app.post('/v1/agent', async (req: Request, res: Response): Promise<void> => {
    const { goal, url, llmConfig, maxSteps } = req.body;

    if (!goal) {
        res.status(400).json({ error: 'Goal is required for agent mode' });
        return;
    }

    try {
        console.log(`[API] Agent mode: "${goal}"`);

        // Configure LLM for agent
        const provider = llmConfig?.provider || process.env.LLM_PROVIDER || 'openrouter';
        const agent = new CDPAgent({
            provider,
            apiKey: llmConfig?.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`],
            model: llmConfig?.model,
            baseUrl: llmConfig?.baseUrl || process.env.OLLAMA_BASE_URL,
            maxSteps: maxSteps || 10
        });

        await agent.init();

        const result = await agent.execute({ goal, url });

        await agent.close();

        if (result.success) {
            res.json({
                success: true,
                data: {
                    goal,
                    url: url || null,
                    result: result.data,
                    actionsTaken: result.actionsTaken
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                actionsTaken: result.actionsTaken
            });
        }
    } catch (error: any) {
        console.error(`[API] Agent failed:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Agent execution failed'
        });
    }
});

// Search endpoint - uses CDP to automate search engines
app.post('/v1/search', async (req: Request, res: Response): Promise<void> => {
    const { query, engine, maxResults } = req.body;

    if (!query) {
        res.status(400).json({ error: 'Query is required' });
        return;
    }

    try {
        const searchEngineType = (engine as SearchEngineType) || 'duckduckgo';
        console.log(`[API] Searching "${query}" using ${searchEngineType}`);

        const searchEngine = new SearchEngine(searchEngineType);
        await searchEngine.init();

        const results: SearchResponse = await searchEngine.search(
            query,
            maxResults || 10
        );

        await searchEngine.close();

        res.json({
            success: true,
            data: results
        });
    } catch (error: any) {
        console.error(`[API] Search failed:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Search failed'
        });
    }
});

export async function startServer(port?: string | number): Promise<void> {
    try {
        await fetcher.init();
        await crawlManager.init();

        const PORT = port || process.env.PORT || 3000;

        app.listen(PORT, () => {
            console.log(`AeroCrawl API is running on http://localhost:${PORT}`);
        });

        process.on('SIGINT', async () => {
            console.log('Shutting down...');
            crawlManager.close();
            process.exit(0);
        });
    } catch (error) {
        console.error('Failed to start AeroCrawl:', error);
        process.exit(1);
    }
}

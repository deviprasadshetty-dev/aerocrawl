import express, {} from 'express';
import { SmartFetcher } from './fetcher/SmartFetcher.js';
import { MarkdownPipeline } from './parser/MarkdownPipeline.js';
import { AIExtractor } from './extractor/AIExtractor.js';
import { CrawlManager } from './crawler/CrawlManager.js';
import { CDPAgent } from './agent/CDPAgent.js';
export const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
// Initialize components
export const fetcher = new SmartFetcher();
export const parser = new MarkdownPipeline();
export const crawlManager = new CrawlManager();
app.post('/v1/scrape', async (req, res) => {
    const { url, actions, formats, screenshot } = req.body;
    if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
    }
    try {
        console.log(`[API] Scraping ${url}`);
        // Determine formats
        let finalFormats = formats;
        if (!finalFormats) {
            finalFormats = screenshot ? ['markdown', 'screenshot'] : ['markdown'];
        }
        const fetchOptions = {
            actions: actions || [],
            formats: finalFormats
        };
        const { html, screenshot: screenshotBuffer } = await fetcher.fetchWithOptions(url, fetchOptions);
        const result = { url };
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
    }
    catch (error) {
        console.error(`[API] Scrape failed for ${url}:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to scrape URL'
        });
    }
});
app.post('/v1/extract', async (req, res) => {
    const { url, markdown: providedMarkdown, schema, llmConfig } = req.body;
    if (!url && !providedMarkdown) {
        res.status(400).json({ error: 'URL or markdown content is required' });
        return;
    }
    try {
        console.log(`[API] Extracting from ${url || 'provided markdown'}`);
        let markdown;
        if (providedMarkdown) {
            markdown = providedMarkdown;
        }
        else {
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
        let extractionSchema;
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
    }
    catch (error) {
        console.error(`[API] Extract failed:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to extract data'
        });
    }
});
app.post('/v1/batch/scrape', async (req, res) => {
    const { urls, actions, formats, extract, llmConfig } = req.body;
    if (!urls || !Array.isArray(urls)) {
        res.status(400).json({ error: 'URLs array is required' });
        return;
    }
    try {
        console.log(`[API] Starting batch scrape for ${urls.length} URLs`);
        const batchId = await crawlManager.startBatchScrape({
            urls,
            actions: actions,
            formats: formats,
            extract,
            llmConfig
        });
        res.json({
            success: true,
            data: { batchId }
        });
    }
    catch (error) {
        console.error(`[API] Batch scrape failed:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start batch scrape'
        });
    }
});
app.get('/v1/batch/scrape/:batchId', async (req, res) => {
    const batchId = req.params.batchId;
    const results = req.query.results;
    try {
        const status = crawlManager.getCrawlStatus(batchId);
        if (!status) {
            res.status(404).json({ error: 'Batch session not found' });
            return;
        }
        if (results === 'true') {
            const fullResults = crawlManager.getCrawlResults(batchId);
            res.json({ success: true, data: fullResults });
        }
        else {
            res.json({ success: true, data: status });
        }
    }
    catch (error) {
        console.error(`[API] Failed to get batch status:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get batch status'
        });
    }
});
app.post('/v1/crawl', async (req, res) => {
    const { url, maxUrls: maxUrlsRaw, extract, llmConfig, actions, formats } = req.body;
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
            actions: actions,
            formats: formats
        });
        res.json({
            success: true,
            data: {
                crawlId,
                message: 'Crawl started successfully'
            }
        });
    }
    catch (error) {
        console.error(`[API] Crawl failed for ${url}:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start crawl'
        });
    }
});
app.get('/v1/crawl/:crawlId', async (req, res) => {
    const crawlId = req.params.crawlId;
    const results = req.query.results;
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
        }
        else {
            res.json({
                success: true,
                data: status
            });
        }
    }
    catch (error) {
        console.error(`[API] Failed to get crawl status:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get crawl status'
        });
    }
});
app.post('/v1/map', async (req, res) => {
    const { url } = req.body;
    const maxUrlsRaw = req.body.maxUrls;
    const maxUrls = typeof maxUrlsRaw === 'string' ? parseInt(maxUrlsRaw) : maxUrlsRaw;
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
    }
    catch (error) {
        console.error(`[API] Map failed for ${url}:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to map site'
        });
    }
});
// Agent endpoint - AI-driven CDP automation
app.post('/v1/agent', async (req, res) => {
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
        }
        else {
            res.status(500).json({
                success: false,
                error: result.error,
                actionsTaken: result.actionsTaken
            });
        }
    }
    catch (error) {
        console.error(`[API] Agent failed:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Agent execution failed'
        });
    }
});
export async function startServer(port) {
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
    }
    catch (error) {
        console.error('Failed to start AeroCrawl:', error);
        process.exit(1);
    }
}
//# sourceMappingURL=index.js.map
import { SmartFetcher } from '../fetcher/SmartFetcher.js';
import { MarkdownPipeline } from '../parser/MarkdownPipeline.js';
import { JobQueue } from '../queue/JobQueue.js';
import { URLDiscovery } from './URLDiscovery.js';
import { AIExtractor } from '../extractor/AIExtractor.js';
export class CrawlManager {
    jobQueue;
    fetcher;
    parser;
    urlDiscovery;
    activeCrawls;
    constructor() {
        this.jobQueue = new JobQueue();
        this.fetcher = new SmartFetcher();
        this.parser = new MarkdownPipeline();
        this.urlDiscovery = new URLDiscovery(this.fetcher);
        this.activeCrawls = new Map();
    }
    async init() {
        await this.fetcher.init();
    }
    async startCrawl(options) {
        const { url, maxUrls = 100, extract = false, llmConfig, actions, formats } = options;
        // Create crawl session with actions and formats
        const crawlId = this.jobQueue.createCrawlSession(url, actions ? JSON.stringify(actions) : undefined, formats ? JSON.stringify(formats) : undefined);
        // Discover URLs
        console.log(`[CrawlManager] Discovering URLs for ${url}`);
        const discoveredUrls = await this.urlDiscovery.discover(url, maxUrls);
        // Add URLs to queue
        this.jobQueue.addJobs(crawlId, discoveredUrls);
        console.log(`[CrawlManager] Added ${discoveredUrls.length} URLs to queue for crawl ${crawlId}`);
        // Start processing (async)
        this.processCrawl(crawlId, extract, llmConfig).catch(err => {
            console.error(`[CrawlManager] Crawl ${crawlId} failed:`, err);
        });
        return crawlId;
    }
    async startBatchScrape(options) {
        const { urls, actions, formats, extract = false, llmConfig } = options;
        // Create batch session
        const batchId = this.jobQueue.createCrawlSession('batch', actions ? JSON.stringify(actions) : undefined, formats ? JSON.stringify(formats) : undefined);
        // Add all URLs to queue
        this.jobQueue.addJobs(batchId, urls);
        console.log(`[CrawlManager] Added ${urls.length} URLs to batch ${batchId}`);
        // Start processing
        this.processCrawl(batchId, extract, llmConfig).catch(err => {
            console.error(`[CrawlManager] Batch ${batchId} failed:`, err);
        });
        return batchId;
    }
    async processCrawl(crawlId, extract, llmConfig) {
        this.activeCrawls.set(crawlId, true);
        let extractor;
        if (extract && llmConfig) {
            extractor = new AIExtractor(llmConfig);
        }
        // Get session actions and formats
        const session = this.jobQueue.getCrawlSession(crawlId);
        const actions = session?.actions ? JSON.parse(session.actions) : [];
        const formats = session?.formats ? JSON.parse(session.formats) : ['markdown'];
        try {
            while (this.activeCrawls.get(crawlId)) {
                const job = this.jobQueue.getNextJob(crawlId);
                if (!job) {
                    const stats = this.jobQueue.getSessionStats(crawlId);
                    if (stats.pending === 0 && stats.processing === 0) {
                        this.jobQueue.completeCrawlSession(crawlId);
                        console.log(`[CrawlManager] ${crawlId} completed`);
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                try {
                    // Fetch with options
                    const fetchOptions = {
                        actions,
                        formats
                    };
                    const { html, screenshot } = await this.fetcher.fetchWithOptions(job.url, fetchOptions);
                    const result = { url: job.url };
                    // Add formats
                    if (formats.includes('html')) {
                        result.html = html;
                    }
                    if (formats.includes('markdown')) {
                        result.markdown = this.parser.process(html, job.url);
                    }
                    if (formats.includes('screenshot') && screenshot) {
                        result.screenshot = screenshot.toString('base64');
                    }
                    // Optionally extract structured data
                    if (extractor && result.markdown) {
                        try {
                            const extractionResult = await extractor.extract(result.markdown);
                            result.extracted = extractionResult.data;
                        }
                        catch (err) {
                            console.error(`[CrawlManager] Extraction failed for ${job.url}:`, err);
                        }
                    }
                    this.jobQueue.completeJob(job.id, JSON.stringify(result));
                }
                catch (error) {
                    console.error(`[CrawlManager] Failed to process ${job.url}:`, error);
                    this.jobQueue.failJob(job.id, error.message);
                }
            }
        }
        finally {
            this.activeCrawls.delete(crawlId);
        }
    }
    getCrawlStatus(crawlId) {
        const session = this.jobQueue.getCrawlSession(crawlId);
        if (!session)
            return undefined;
        const stats = this.jobQueue.getSessionStats(crawlId);
        return {
            crawlId: session.id,
            status: session.status,
            totalUrls: session.totalUrls,
            processedUrls: session.processedUrls
        };
    }
    getCrawlResults(crawlId) {
        const status = this.getCrawlStatus(crawlId);
        if (!status)
            return undefined;
        const jobs = this.jobQueue.getCrawlJobs(crawlId);
        const results = jobs
            .filter((job) => job.status === 'completed' && job.result)
            .map((job) => JSON.parse(job.result));
        return { ...status, results };
    }
    async mapSite(url, maxUrls = 100) {
        const discovery = new URLDiscovery(this.fetcher);
        return await discovery.discover(url, maxUrls);
    }
    stopCrawl(crawlId) {
        this.activeCrawls.delete(crawlId);
    }
    close() {
        this.activeCrawls.clear();
        this.jobQueue.close();
        this.fetcher.close();
    }
}
//# sourceMappingURL=CrawlManager.js.map
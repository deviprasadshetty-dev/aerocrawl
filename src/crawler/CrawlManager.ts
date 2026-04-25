import { SmartFetcher, type FetchOptions, type FetchHooks } from '../fetcher/SmartFetcher.js';
import { MarkdownPipeline } from '../parser/MarkdownPipeline.js';
import { JobQueue, type CrawlSession, type CrawlJob } from '../queue/JobQueue.js';
import { URLDiscovery } from './URLDiscovery.js';
import { AIExtractor } from '../extractor/AIExtractor.js';
import type { CdpAction } from '../browser/CDPBrowser.js';
import { isSafeUrl } from '../utils.js';
import pLimit from 'p-limit';
import fs from 'fs';

export interface CrawlHooks extends FetchHooks {
    onPageParsed?: (url: string, markdown: string) => Promise<string>;
    onCrawlComplete?: (results: CrawlResult) => Promise<void>;
}

export interface CrawlOptions {
    url: string;
    maxUrls?: number;
    extract?: boolean;
    llmConfig?: {
        provider: 'openai' | 'anthropic' | 'ollama' | 'openrouter';
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    };
    actions?: CdpAction[];
    formats?: ('markdown' | 'html' | 'screenshot')[];
    webhookUrl?: string;
    hooks?: CrawlHooks;
}

export interface BatchScrapeOptions {
    urls: string[];
    actions?: CdpAction[];
    formats?: ('markdown' | 'html' | 'screenshot')[];
    extract?: boolean;
    llmConfig?: any;
    webhookUrl?: string;
    hooks?: CrawlHooks;
}

export interface CrawlResult {
    crawlId: string;
    status: string;
    totalUrls: number;
    processedUrls: number;
    results?: Array<{
        url: string;
        markdown?: string;
        html?: string;
        screenshot?: string;
        actionResults?: Record<string, string>;
        extracted?: any;
        error?: string;
    }>;
}

export class CrawlManager {
    private jobQueue: JobQueue;
    private fetcher: SmartFetcher;
    private parser: MarkdownPipeline;
    private urlDiscovery: URLDiscovery;
    private activeCrawls: Map<string, boolean>;

    constructor() {
        this.jobQueue = new JobQueue();
        this.fetcher = new SmartFetcher();
        this.parser = new MarkdownPipeline();
        this.urlDiscovery = new URLDiscovery(this.fetcher);
        this.activeCrawls = new Map();
    }

    async init(): Promise<void> {
        // Lazy initialization - don't launch browser here
        // Browser will be launched on first CDP operation via acquirePage()
    }

    async startCrawl(options: CrawlOptions): Promise<string> {
        const { url, maxUrls = 100, extract = false, llmConfig, actions, formats, hooks } = options;

        // Create crawl session with actions and formats
        const crawlId = this.jobQueue.createCrawlSession(
            url,
            actions ? JSON.stringify(actions) : undefined,
            formats ? JSON.stringify(formats) : undefined
        );

        // Discover URLs
        console.log(`[CrawlManager] Discovering URLs for ${url}`);
        const discoveredUrls = await this.urlDiscovery.discover(url, maxUrls);

        // Add URLs to queue
        this.jobQueue.addJobs(crawlId, discoveredUrls);
        console.log(`[CrawlManager] Added ${discoveredUrls.length} URLs to queue for crawl ${crawlId}`);

        // Start processing (async)
        this.processCrawl(crawlId, extract, llmConfig, hooks).catch(err => {
            console.error(`[CrawlManager] Crawl ${crawlId} failed:`, err);
        });

        return crawlId;
    }

    async startBatchScrape(options: BatchScrapeOptions): Promise<string> {
        const { urls, actions, formats, extract = false, llmConfig, hooks } = options;

        // Create batch session
        const batchId = this.jobQueue.createCrawlSession(
            'batch',
            actions ? JSON.stringify(actions) : undefined,
            formats ? JSON.stringify(formats) : undefined
        );

        // Add all URLs to queue
        this.jobQueue.addJobs(batchId, urls);
        console.log(`[CrawlManager] Added ${urls.length} URLs to batch ${batchId}`);

        // Start processing
        this.processCrawl(batchId, extract, llmConfig, hooks).catch(err => {
            console.error(`[CrawlManager] Batch ${batchId} failed:`, err);
        });

        return batchId;
    }

    private async processCrawl(crawlId: string, extract: boolean, llmConfig?: any, hooks?: CrawlHooks): Promise<void> {
        this.activeCrawls.set(crawlId, true);
        let extractor: AIExtractor | undefined;

        if (extract && llmConfig) {
            extractor = new AIExtractor(llmConfig);
        }

        // Get session actions and formats
        const session = this.jobQueue.getCrawlSession(crawlId);
        const actions: CdpAction[] = session?.actions ? JSON.parse(session.actions) : [];
        const formats: ('markdown' | 'html' | 'screenshot')[] = session?.formats ? JSON.parse(session.formats) : ['markdown'];

        const limit = pLimit(3);
        const activePromises: Promise<void>[] = [];

        try {
            while (this.activeCrawls.get(crawlId)) {
                if (limit.activeCount >= 3) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }

                const job = this.jobQueue.getNextJob(crawlId);

                if (!job) {
                    const stats = this.jobQueue.getSessionStats(crawlId);
                    if (stats.pending === 0 && stats.processing === 0 && limit.activeCount === 0) {
                        this.jobQueue.completeCrawlSession(crawlId);
                        console.log(`[CrawlManager] ${crawlId} completed`);
                        
                        const fullResults = this.getCrawlResults(crawlId);
                        if (fullResults && hooks?.onCrawlComplete) {
                            await hooks.onCrawlComplete(fullResults);
                        }

                        // Trigger webhook if configured
                        const webhookUrl = this.jobQueue.getWebhookUrl(crawlId);
                        if (webhookUrl) {
                            this.triggerWebhook(webhookUrl, crawlId);
                        }
                        
                        break;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                const p = limit(async () => {
                    try {
                        // Fetch with options and hooks
                        const fetchOptions: FetchOptions = {
                            actions,
                            formats,
                            ...(hooks ? { hooks } : {})
                        };
                        const { html, screenshot, actionResults } = await this.fetcher.fetchWithOptions(job.url, fetchOptions);

                        const result: any = { url: job.url };

                        if (actionResults) {
                            result.actionResults = actionResults;
                        }

                        // Add formats
                        if (formats.includes('html')) {
                            result.html = html;
                        }

                        if (formats.includes('markdown')) {
                            let markdown = this.parser.process(html, job.url);
                            // Hook: onPageParsed
                            if (hooks?.onPageParsed) {
                                markdown = await hooks.onPageParsed(job.url, markdown);
                            }
                            result.markdown = markdown;
                        }

                        if (formats.includes('screenshot') && screenshot) {
                            result.screenshot = screenshot.toString('base64');
                        }

                        // Optionally extract structured data
                        if (extractor && result.markdown) {
                            try {
                                const extractionResult = await extractor.extract(result.markdown);
                                result.extracted = extractionResult.data;
                            } catch (err: any) {
                                console.error(`[CrawlManager] Extraction failed for ${job.url}:`, err);
                            }
                        }

                        this.jobQueue.completeJob(job.id, JSON.stringify(result));
                    } catch (error: any) {
                        console.error(`[CrawlManager] Failed to process ${job.url}:`, error);
                        this.jobQueue.failJob(job.id, error.message);
                    }
                });

                const pWrapper = p.finally(() => {
                    activePromises.splice(activePromises.indexOf(pWrapper), 1);
                });
                activePromises.push(pWrapper);
            }
            await Promise.all(activePromises);
        } finally {
            this.activeCrawls.delete(crawlId);
        }
    }

    getCrawlStatus(crawlId: string): CrawlResult | undefined {
        const session = this.jobQueue.getCrawlSession(crawlId);
        if (!session) return undefined;

        const stats = this.jobQueue.getSessionStats(crawlId);

        return {
            crawlId: session.id,
            status: session.status,
            totalUrls: session.totalUrls,
            processedUrls: session.processedUrls
        };
    }

    getCrawlResults(crawlId: string): CrawlResult | undefined {
        const status = this.getCrawlStatus(crawlId);
        if (!status) return undefined;

        const jobs = this.jobQueue.getCrawlJobs(crawlId);
        const results = jobs
            .filter((job: CrawlJob) => job.status === 'completed' && job.result)
            .map((job: CrawlJob) => {
                const parsed = JSON.parse(job.result!);
                if (parsed.file && fs.existsSync(parsed.file)) {
                    return JSON.parse(fs.readFileSync(parsed.file, 'utf8'));
                }
                return parsed;
            });

        return { ...status, results };
    }

    async mapSite(url: string, maxUrls: number = 100): Promise<string[]> {
        const discovery = new URLDiscovery(this.fetcher);
        return await discovery.discover(url, maxUrls);
    }

    stopCrawl(crawlId: string): void {
        this.activeCrawls.delete(crawlId);
    }

    private async triggerWebhook(webhookUrl: string, crawlId: string): Promise<void> {
        if (!isSafeUrl(webhookUrl)) {
            console.error(`[CrawlManager] SSRF Protection: Unsafe webhook URL (${webhookUrl}).`);
            return;
        }
        try {
            console.log(`[CrawlManager] Triggering webhook for ${crawlId}`);
            const payload = this.jobQueue.getCrawlResultsForWebhook(crawlId);
            
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'crawl.completed',
                    data: payload
                }),
                signal: AbortSignal.timeout(10000)
            });
            
            console.log(`[CrawlManager] Webhook sent successfully`);
        } catch (error: any) {
            console.error(`[CrawlManager] Webhook failed:`, error.message);
        }
    }

    close(): void {
        this.activeCrawls.clear();
        this.jobQueue.close();
        this.fetcher.close();
    }
}

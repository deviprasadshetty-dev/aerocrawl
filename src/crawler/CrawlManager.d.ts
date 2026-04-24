import type { CdpAction } from '../browser/CDPBrowser.js';
export interface CrawlOptions {
    url: string;
    maxUrls?: number;
    extract?: boolean;
    llmConfig?: {
        provider: 'openai' | 'anthropic' | 'ollama';
        apiKey?: string;
        model?: string;
    };
    actions?: CdpAction[];
    formats?: ('markdown' | 'html' | 'screenshot')[];
}
export interface BatchScrapeOptions {
    urls: string[];
    actions?: CdpAction[];
    formats?: ('markdown' | 'html' | 'screenshot')[];
    extract?: boolean;
    llmConfig?: any;
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
        extracted?: any;
        error?: string;
    }>;
}
export declare class CrawlManager {
    private jobQueue;
    private fetcher;
    private parser;
    private urlDiscovery;
    private activeCrawls;
    constructor();
    init(): Promise<void>;
    startCrawl(options: CrawlOptions): Promise<string>;
    startBatchScrape(options: BatchScrapeOptions): Promise<string>;
    private processCrawl;
    getCrawlStatus(crawlId: string): CrawlResult | undefined;
    getCrawlResults(crawlId: string): CrawlResult | undefined;
    mapSite(url: string, maxUrls?: number): Promise<string[]>;
    stopCrawl(crawlId: string): void;
    close(): void;
}
//# sourceMappingURL=CrawlManager.d.ts.map
import { type Express } from 'express';
import { SmartFetcher } from './fetcher/SmartFetcher.js';
import { MarkdownPipeline } from './parser/MarkdownPipeline.js';
import { CrawlManager } from './crawler/CrawlManager.js';
export declare const app: Express;
export declare const fetcher: SmartFetcher;
export declare const parser: MarkdownPipeline;
export declare const crawlManager: CrawlManager;
export declare function startServer(port?: string | number): Promise<void>;
//# sourceMappingURL=index.d.ts.map
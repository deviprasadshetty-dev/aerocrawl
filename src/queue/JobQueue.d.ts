export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface CrawlJob {
    id: number;
    crawlId: string;
    url: string;
    status: JobStatus;
    result?: string;
    error?: string;
    createdAt: string;
    updatedAt: string;
}
export interface CrawlSession {
    id: string;
    rootUrl: string;
    status: 'running' | 'completed' | 'failed';
    totalUrls: number;
    processedUrls: number;
    actions?: string;
    formats?: string;
    createdAt: string;
}
export declare class JobQueue {
    private db;
    private dbPath;
    constructor(dbPath?: string);
    private initialize;
    createCrawlSession(rootUrl: string, actions?: string, formats?: string): string;
    addJob(crawlId: string, url: string): number;
    addJobs(crawlId: string, urls: string[]): void;
    getNextJob(crawlId: string): CrawlJob | undefined;
    completeJob(jobId: number, result?: string): void;
    failJob(jobId: number, error: string): void;
    getCrawlSession(crawlId: string): CrawlSession | undefined;
    getCrawlJobs(crawlId: string): CrawlJob[];
    getSessionStats(crawlId: string): {
        total: number;
        pending: number;
        processing: number;
        completed: number;
        failed: number;
    };
    completeCrawlSession(crawlId: string): void;
    close(): void;
}
//# sourceMappingURL=JobQueue.d.ts.map
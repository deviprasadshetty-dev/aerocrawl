import { type CdpAction } from '../browser/CDPBrowser.js';
export interface FetchOptions {
    actions?: CdpAction[];
    screenshot?: boolean;
    formats?: ('markdown' | 'html' | 'screenshot')[];
}
export interface FetchResult {
    html: string;
    screenshot?: Buffer;
}
export declare class SmartFetcher {
    private cdpBrowser;
    private maxRetries;
    private retryDelay;
    constructor();
    init(): Promise<void>;
    fetch(url: string, retryCount?: number): Promise<string>;
    private fetchWithCDP;
    fetchWithOptions(url: string, options?: FetchOptions): Promise<FetchResult>;
    private needsRendering;
    close(): Promise<void>;
}
//# sourceMappingURL=SmartFetcher.d.ts.map
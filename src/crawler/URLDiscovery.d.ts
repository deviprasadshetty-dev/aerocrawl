import { SmartFetcher } from '../fetcher/SmartFetcher.js';
export interface DiscoveredURLs {
    sitemapUrls: string[];
    internalUrls: string[];
}
export declare class URLDiscovery {
    private fetcher;
    constructor(fetcher: SmartFetcher);
    discover(rootUrl: string, maxUrls?: number): Promise<string[]>;
    parseSitemap(rootUrl: string): Promise<string[]>;
    private parseXMLSitemap;
    extractLinksFromHTML(html: string, baseUrl: URL): string[];
    private isInternalUrl;
    private normalizeUrl;
    private isValidUrl;
}
//# sourceMappingURL=URLDiscovery.d.ts.map
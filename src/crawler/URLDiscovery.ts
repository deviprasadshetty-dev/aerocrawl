import { SmartFetcher } from '../fetcher/SmartFetcher.js';
import { JSDOM } from 'jsdom';

export interface DiscoveredURLs {
    sitemapUrls: string[];
    internalUrls: string[];
}

export class URLDiscovery {
    private fetcher: SmartFetcher;

    constructor(fetcher: SmartFetcher) {
        this.fetcher = fetcher;
    }

    async discover(rootUrl: string, maxUrls: number = 100): Promise<string[]> {
        const rootUrlObj = new URL(rootUrl);
        const discovered = new Set<string>();

        // Step 1: Try sitemap
        const sitemapUrls = await this.parseSitemap(rootUrl);
        
        for (const url of sitemapUrls) {
            if (this.isInternalUrl(url, rootUrlObj)) {
                discovered.add(this.normalizeUrl(url));
            }
            if (discovered.size >= maxUrls) break;
        }

        // Step 2: If sitemap didn't yield enough, crawl the root page for links
        if (discovered.size < maxUrls) {
            try {
                const html = await this.fetcher.fetch(rootUrl);
                const links = this.extractLinksFromHTML(html, rootUrlObj);
                
                for (const link of links) {
                    if (this.isInternalUrl(link, rootUrlObj)) {
                        discovered.add(this.normalizeUrl(link));
                    }
                    if (discovered.size >= maxUrls) break;
                }
            } catch (error) {
                console.error(`Failed to extract links from ${rootUrl}:`, error);
            }
        }

        // Always include the root URL
        discovered.add(this.normalizeUrl(rootUrl));

        return Array.from(discovered);
    }

    async parseSitemap(rootUrl: string): Promise<string[]> {
        const urls: string[] = [];
        const rootUrlObj = new URL(rootUrl);
        
        // Try common sitemap locations
        const sitemapLocations = [
            `${rootUrlObj.origin}/sitemap.xml`,
            `${rootUrlObj.origin}/sitemap_index.xml`,
            `${rootUrlObj.origin}/sitemap.txt`
        ];

        for (const sitemapUrl of sitemapLocations) {
            try {
                const content = await this.fetcher.fetch(sitemapUrl);
                
                if (sitemapUrl.endsWith('.txt')) {
                    // Parse text sitemap
                    const lines = content.split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed && this.isValidUrl(trimmed)) {
                            urls.push(trimmed);
                        }
                    }
                } else {
                    // Parse XML sitemap
                    const parsedUrls = this.parseXMLSitemap(content);
                    urls.push(...parsedUrls);
                }
                
                if (urls.length > 0) break;
            } catch (error) {
                // Sitemap doesn't exist at this location, continue
            }
        }

        return urls;
    }

    private parseXMLSitemap(xmlContent: string): string[] {
        const urls: string[] = [];
        
        try {
            const dom = new JSDOM(xmlContent, { contentType: 'text/xml' });
            const doc = dom.window.document;
            
            // Handle sitemap index
            const sitemapElements = doc.querySelectorAll('sitemap loc');
            if (sitemapElements.length > 0) {
                // This is a sitemap index, we'd need to fetch nested sitemaps
                // For simplicity, skip nested sitemaps for now
                return urls;
            }
            
            // Handle regular sitemap
            const urlElements = doc.querySelectorAll('url loc');
            for (const elem of urlElements) {
                const url = elem.textContent?.trim();
                if (url && this.isValidUrl(url)) {
                    urls.push(url);
                }
            }
        } catch (error) {
            console.error('Failed to parse XML sitemap:', error);
        }

        return urls;
    }

    extractLinksFromHTML(html: string, baseUrl: URL): string[] {
        const links = new Set<string>();
        
        try {
            const dom = new JSDOM(html, { url: baseUrl.toString() });
            const doc = dom.window.document;
            
            const anchorElements = doc.querySelectorAll('a[href]');
            for (const anchor of anchorElements) {
                const href = (anchor as HTMLAnchorElement).href;
                if (href) {
                    try {
                        const url = new URL(href);
                        // Remove hash and search params for deduplication
                        links.add(`${url.origin}${url.pathname}`);
                    } catch {
                        // Invalid URL, skip
                    }
                }
            }
        } catch (error) {
            console.error('Failed to extract links from HTML:', error);
        }

        return Array.from(links);
    }

    private isInternalUrl(url: string, baseUrl: URL): boolean {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname === baseUrl.hostname;
        } catch {
            return false;
        }
    }

    private normalizeUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            // Remove trailing slash and search params
            urlObj.search = '';
            return urlObj.toString().replace(/\/$/, '');
        } catch {
            return url;
        }
    }

    private isValidUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
}

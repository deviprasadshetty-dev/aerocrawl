import { CDPBrowser } from '../browser/CDPBrowser.js';
import { MarkdownPipeline } from '../parser/MarkdownPipeline.js';
import type { CdpAction } from '../browser/CDPBrowser.js';

export type SearchEngineType = 'duckduckgo' | 'google' | 'bing';

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

export interface SearchResponse {
    query: string;
    results: SearchResult[];
    engine: SearchEngineType;
    totalResults?: number;
}

interface SearchEngineConfig {
    url: string;
    searchInputSelector: string;
    resultsSelector: string;
    titleSelector: string;
    linkSelector: string;
    snippetSelector: string;
    waitForSelector: string;
}

const ENGINE_CONFIGS: Record<SearchEngineType, SearchEngineConfig> = {
    duckduckgo: {
        url: 'https://duckduckgo.com/?q=',
        searchInputSelector: 'input[name="q"]',
        resultsSelector: '.result',
        titleSelector: '.result__title a',
        linkSelector: '.result__title a',
        snippetSelector: '.result__snippet',
        waitForSelector: '.result'
    },
    google: {
        url: 'https://www.google.com/search?q=',
        searchInputSelector: 'textarea[name="q"]',
        resultsSelector: 'div.g, [data-sokoban-container] > div',
        titleSelector: 'h3',
        linkSelector: 'a[href]',
        snippetSelector: 'div.VwiC3b, div[data-sncf], span.aCOpRe',
        waitForSelector: 'div.g, [data-sokoban-container]'
    },
    bing: {
        url: 'https://www.bing.com/search?q=',
        searchInputSelector: 'input[name="q"]',
        resultsSelector: '.b_algo',
        titleSelector: 'h2 a',
        linkSelector: 'h2 a',
        snippetSelector: '.b_caption p, .b_algoSlug',
        waitForSelector: '.b_algo'
    }
};

export class SearchEngine {
    private browser: CDPBrowser;
    private parser: MarkdownPipeline;
    private engine: SearchEngineType;
    private config: SearchEngineConfig;

    constructor(engine: SearchEngineType = 'duckduckgo') {
        this.browser = new CDPBrowser();
        this.parser = new MarkdownPipeline();
        this.engine = engine;
        this.config = ENGINE_CONFIGS[engine];
    }

    async init() {
        await this.browser.init();
    }

    async search(query: string, maxResults: number = 10): Promise<SearchResponse> {
        const session = await this.browser.createPageSession();

        try {
            // Navigate to search engine with query
            const searchUrl = this.config.url + encodeURIComponent(query);
            console.log(`[SearchEngine] Navigating to: ${searchUrl}`);
            await this.browser.navigate(session, searchUrl);

            // Wait for results to load
            await this.waitForSelector(session, this.config.waitForSelector, 10000);

            // Small delay for dynamic content
            await new Promise(r => setTimeout(r, 2000));

            // Extract results using JavaScript
            const results = await this.extractResults(session, maxResults);

            return {
                query,
                results: results.slice(0, maxResults),
                engine: this.engine
            };
        } finally {
            await this.browser.closePageSession(session);
        }
    }

    private async waitForSelector(session: any, selector: string, timeout: number = 5000): Promise<boolean> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const result = await session.client.Runtime.evaluate({
                expression: `!!document.querySelector('${selector.replace(/'/g, "\\'")}')`
            });
            if (result.result.value) return true;
            await new Promise(r => setTimeout(r, 200));
        }
        return false;
    }

    private async extractResults(session: any, maxResults: number): Promise<SearchResult[]> {
        const expression = `
            (function() {
                const results = [];
                const items = document.querySelectorAll('${this.config.resultsSelector}');
                
                for (let i = 0; i < Math.min(items.length, ${maxResults}); i++) {
                    const item = items[i];
                    
                    // Extract title
                    const titleEl = item.querySelector('${this.config.titleSelector}');
                    const title = titleEl ? titleEl.textContent.trim() : '';
                    
                    // Extract URL
                    const linkEl = item.querySelector('${this.config.linkSelector}');
                    const url = linkEl ? (linkEl.href || linkEl.getAttribute('href') || '') : '';
                    
                    // Extract snippet
                    const snippetEl = item.querySelector('${this.config.snippetSelector}');
                    const snippet = snippetEl ? snippetEl.textContent.trim() : '';
                    
                    if (title && url) {
                        results.push({ title, url, snippet });
                    }
                }
                
                return results;
            })()
        `;

        const result = await session.client.Runtime.evaluate({
            expression,
            returnByValue: true
        });

        return result.result.value || [];
    }

    async searchWithScraping(query: string, maxResults: number = 10): Promise<SearchResponse> {
        const session = await this.browser.createPageSession();

        try {
            // Navigate to search engine
            const searchUrl = this.config.url + encodeURIComponent(query);
            await this.browser.navigate(session, searchUrl);

            // Wait for results
            await this.waitForSelector(session, this.config.waitForSelector, 10000);
            await new Promise(r => setTimeout(r, 2000));

            // Get full page HTML and convert to markdown
            const html = await this.browser.getDOM(session);
            const markdown = this.parser.process(html, searchUrl);

            // Use AI to extract results from markdown (if LLM configured)
            // For now, return the markdown and let user/API handle extraction
            const response: SearchResponse = {
                query,
                results: [],
                engine: this.engine
            };
            return response;
        } finally {
            await this.browser.closePageSession(session);
        }
    }

    async close() {
        await this.browser.close();
    }
}

import { CDPBrowser, type CdpAction } from '../browser/CDPBrowser.js';
import { createRequire } from 'module';
import { isSafeUrl } from '../utils.js';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

export interface FetchOptions {
    actions?: CdpAction[];
    screenshot?: boolean;
    formats?: ('markdown' | 'html' | 'screenshot')[];
}

export interface FetchResult {
    html: string;
    screenshot?: Buffer;
}

export class SmartFetcher {
    private cdpBrowser: CDPBrowser;
    private maxRetries: number = 3;
    private retryDelay: number = 1000;

    constructor() {
        this.cdpBrowser = new CDPBrowser();
    }

    async init() {
        await this.cdpBrowser.init();
    }

    async fetch(url: string, retryCount: number = 0): Promise<string> {
        if (!isSafeUrl(url)) {
            throw new Error(`SSRF Protection: Unsafe or local URL detected (${url}).`);
        }
        try {
            console.log(`[SmartFetcher] Attempting fast HTTP GET for ${url} (attempt ${retryCount + 1})`);
            const response = await globalThis.fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(30000)
            });

            if (!response.ok) {
                if (response.status === 403 || response.status === 503) {
                    console.log(`[SmartFetcher] Bot protection detected (${response.status}). Falling back to CDP.`);
                    return await this.fetchWithCDP(url);
                }
                throw new Error(`HTTP Error: ${response.status}`);
            }

            // Check if it's a PDF
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
                console.log(`[SmartFetcher] PDF detected, extracting text...`);
                const arrayBuffer = await response.arrayBuffer();
                const pdfBuffer = Buffer.from(arrayBuffer);
                const pdfData = await pdf(pdfBuffer);
                // Return PDF text as HTML-wrapped content for markdown conversion
                return `<html><body><pre>${pdfData.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
            }

            const html = await response.text();

            if (this.needsRendering(html)) {
                console.log(`[SmartFetcher] SPA detected. Falling back to CDP.`);
                return await this.fetchWithCDP(url);
            }

            return html;
        } catch (error) {
            console.error(`[SmartFetcher] Fast fetch failed (attempt ${retryCount + 1}):`, error);
            
            if (retryCount < this.maxRetries) {
                const delay = this.retryDelay * Math.pow(2, retryCount);
                console.log(`[SmartFetcher] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.fetch(url, retryCount + 1);
            }
            
            console.log(`[SmartFetcher] All retries failed, falling back to CDP.`);
            return await this.fetchWithCDP(url);
        }
    }

    private async fetchWithCDP(url: string): Promise<string> {
        const session = await this.cdpBrowser.createPageSession();
        try {
            await this.cdpBrowser.navigate(session, url);
            return await this.cdpBrowser.getDOM(session);
        } finally {
            await this.cdpBrowser.closePageSession(session);
        }
    }

    async fetchWithOptions(url: string, options?: FetchOptions): Promise<FetchResult> {
        const actions = options?.actions || [];
        const needsCDP = actions.length > 0 || options?.screenshot;

        if (!needsCDP) {
            const html = await this.fetch(url);
            return { html };
        }

        const session = await this.cdpBrowser.createPageSession();
        try {
            await this.cdpBrowser.navigate(session, url);
            
            if (actions.length > 0) {
                await this.cdpBrowser.executeActions(session, actions);
            }

            const html = await this.cdpBrowser.getDOM(session);
            const result: FetchResult = { html };

            if (options?.screenshot || options?.formats?.includes('screenshot')) {
                const screenshot = await this.cdpBrowser.takeScreenshot(session);
                if (screenshot) {
                    result.screenshot = screenshot;
                }
            }

            return result;
        } finally {
            await this.cdpBrowser.closePageSession(session);
        }
    }

    private needsRendering(html: string): boolean {
        if (html.length < 500) return true;
        if (html.includes('id="root"')) return true;
        if (html.includes('id="app"')) return true;
        if (html.includes('__NEXT_DATA__')) return false;
        return false;
    }

    async close() {
        await this.cdpBrowser.close();
    }
}

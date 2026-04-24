import CDP from 'chrome-remote-interface';
import { spawn, ChildProcess } from 'child_process';
import os from 'os';
import fs from 'fs';
import { EventEmitter } from 'events';

export type CdpAction =
    | { type: 'click'; selector: string }
    | { type: 'type'; selector: string; text: string }
    | { type: 'scroll'; x: number; y: number }
    | { type: 'press'; key: string }
    | { type: 'waitForSelector'; selector: string; timeout?: number }
    | { type: 'wait'; ms: number }
    | { type: 'executeJS'; script: string }
    | { type: 'screenshot'; format?: 'png' | 'jpeg'; quality?: number };

interface PageSession {
    client: any;
    targetId: string;
    browserClient: any;
}

export class CDPBrowser extends EventEmitter {
    private browserProcess: ChildProcess | null = null;
    private port: number = 9222;
    private browserClient: any = null;
    private isInitialized: boolean = false;

    async init() {
        if (this.isInitialized) return;

        let executablePath = '';
        if (os.platform() === 'win32') {
            executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            if (!fs.existsSync(executablePath)) {
                executablePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
            }
        } else if (os.platform() === 'darwin') {
            executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        } else {
            executablePath = '/usr/bin/google-chrome';
        }

        if (!fs.existsSync(executablePath)) {
            throw new Error(`Browser executable not found at ${executablePath}`);
        }

        console.log(`Launching browser from: ${executablePath}`);

        this.browserProcess = spawn(executablePath, [
            '--headless=new',
            '--disable-gpu',
            '--remote-debugging-port=' + this.port,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--blink-settings=imagesEnabled=false'
        ]);

        await new Promise(resolve => setTimeout(resolve, 2000));
        this.browserClient = await CDP({ port: this.port });
        this.isInitialized = true;
        console.log('Browser launched and CDP ready.');
    }

    async createPageSession(): Promise<PageSession> {
        if (!this.browserClient) throw new Error('Browser not initialized');

        const { targetId } = await this.browserClient.Target.createTarget({ url: 'about:blank' });
        const client = await CDP({ port: this.port, target: targetId });

        await Promise.all([
            client.Network.enable(),
            client.Page.enable(),
            client.DOM.enable(),
            client.Runtime.enable()
        ]);

        return { client, targetId, browserClient: this.browserClient };
    }

    async closePageSession(session: PageSession) {
        await session.client.close();
        await session.browserClient.Target.closeTarget({ targetId: session.targetId });
    }

    async navigate(session: PageSession, url: string): Promise<void> {
        await session.client.Page.navigate({ url });
        await session.client.Page.loadEventFired();
    }

    async executeActions(session: PageSession, actions: CdpAction[]): Promise<void> {
        for (const action of actions) {
            try {
                switch (action.type) {
                    case 'click':
                        await session.client.Runtime.evaluate({
                            expression: `
                                (function() {
                                    const el = document.querySelector(${JSON.stringify(action.selector)});
                                    if (el) el.click();
                                    return !!el;
                                })()
                            `
                        });
                        break;
                    case 'type':
                        await session.client.Runtime.evaluate({
                            expression: `
                                (function() {
                                    const el = document.querySelector(${JSON.stringify(action.selector)});
                                    if (el) {
                                        el.value = ${JSON.stringify(action.text)};
                                        el.dispatchEvent(new Event('input', { bubbles: true }));
                                        return true;
                                    }
                                    return false;
                                })()
                            `
                        });
                        break;
                    case 'scroll':
                        await session.client.Runtime.evaluate({
                            expression: `window.scrollTo(${action.x}, ${action.y})`
                        });
                        break;
                    case 'press':
                        await session.client.Input.dispatchKeyEvent({
                            type: 'keyDown',
                            key: action.key
                        });
                        await session.client.Input.dispatchKeyEvent({
                            type: 'keyUp',
                            key: action.key
                        });
                        break;
                    case 'waitForSelector':
                        const timeout = action.timeout || 5000;
                        const result = await session.client.Runtime.evaluate({
                            expression: `
                                new Promise((resolve, reject) => {
                                    const selector = ${JSON.stringify(action.selector)};
                                    if (document.querySelector(selector)) {
                                        return resolve(true);
                                    }
                                    const observer = new MutationObserver((mutations, obs) => {
                                        if (document.querySelector(selector)) {
                                            obs.disconnect();
                                            resolve(true);
                                        }
                                    });
                                    observer.observe(document.body, { childList: true, subtree: true });
                                    setTimeout(() => {
                                        observer.disconnect();
                                        resolve(false);
                                    }, ${timeout});
                                })
                            `,
                            awaitPromise: true
                        });
                        if (!result.result.value) {
                            throw new Error(`Selector ${action.selector} not found within ${timeout}ms`);
                        }
                        break;
                    case 'wait':
                        await new Promise(r => setTimeout(r, action.ms));
                        break;
                    case 'executeJS':
                        await session.client.Runtime.evaluate({
                            expression: action.script
                        });
                        break;
                    case 'screenshot':
                        // Handled separately
                        break;
                }
            } catch (err) {
                console.error(`Action ${action.type} failed:`, err);
                throw err;
            }
        }
    }

    async takeScreenshot(session: PageSession, options?: { format?: 'png' | 'jpeg'; quality?: number }): Promise<Buffer> {
        const { data } = await session.client.Page.captureScreenshot({
            format: options?.format || 'png',
            quality: options?.quality
        });
        return Buffer.from(data, 'base64');
    }

    async getDOM(session: PageSession): Promise<string> {
        const result = await session.client.Runtime.evaluate({
            expression: 'document.documentElement.outerHTML',
            returnByValue: true
        });
        return result.result.value;
    }

    async getHTML(session: PageSession): Promise<string> {
        return this.getDOM(session);
    }

    async close() {
        if (this.browserClient) {
            await this.browserClient.close();
        }
        if (this.browserProcess) {
            this.browserProcess.kill();
        }
        this.isInitialized = false;
    }
}

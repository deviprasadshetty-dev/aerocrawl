import { EventEmitter } from 'events';
export type CdpAction = {
    type: 'click';
    selector: string;
} | {
    type: 'type';
    selector: string;
    text: string;
} | {
    type: 'scroll';
    x: number;
    y: number;
} | {
    type: 'press';
    key: string;
} | {
    type: 'waitForSelector';
    selector: string;
    timeout?: number;
} | {
    type: 'wait';
    ms: number;
} | {
    type: 'executeJS';
    script: string;
} | {
    type: 'screenshot';
    format?: 'png' | 'jpeg';
    quality?: number;
};
interface PageSession {
    client: any;
    targetId: string;
    browserClient: any;
}
export declare class CDPBrowser extends EventEmitter {
    private browserProcess;
    private port;
    private browserClient;
    private isInitialized;
    init(): Promise<void>;
    createPageSession(): Promise<PageSession>;
    closePageSession(session: PageSession): Promise<void>;
    navigate(session: PageSession, url: string): Promise<void>;
    executeActions(session: PageSession, actions: CdpAction[]): Promise<void>;
    takeScreenshot(session: PageSession, options?: {
        format?: 'png' | 'jpeg';
        quality?: number;
    }): Promise<Buffer>;
    getDOM(session: PageSession): Promise<string>;
    getHTML(session: PageSession): Promise<string>;
    close(): Promise<void>;
}
export {};
//# sourceMappingURL=CDPBrowser.d.ts.map
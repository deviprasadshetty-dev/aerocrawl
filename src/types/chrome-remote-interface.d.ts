declare module 'chrome-remote-interface' {
    interface CDPOptions {
        port?: number;
        host?: string;
        target?: any;
    }

    interface CDPEventEmitter {
        on(event: string, callback: (...args: any[]) => void): void;
        once(event: string, callback: (...args: any[]) => void): void;
        removeListener(event: string, callback: (...args: any[]) => void): void;
    }

    interface CDPClient extends CDPEventEmitter {
        Network: any;
        Page: any;
        Runtime: any;
        DOM: any;
        close(): Promise<void>;
    }

    function CDP(options?: CDPOptions): Promise<CDPClient>;
    
    export = CDP;
}

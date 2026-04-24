import { URL } from 'url';

export function isSafeUrl(urlString: string): boolean {
    try {
        const url = new URL(urlString);
        
        // Only allow HTTP/HTTPS
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return false;
        }

        const hostname = url.hostname.toLowerCase();

        // Check for loopback and private IP space
        const isLoopback = hostname === 'localhost' || 
                           hostname === '127.0.0.1' || 
                           hostname === '::1' ||
                           hostname.startsWith('127.');
                           
        const isPrivateIP = hostname.startsWith('10.') || 
                            hostname.startsWith('192.168.') || 
                            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
                            hostname === '169.254.169.254'; // AWS metadata

        // Bypass check if explicitly allowed
        if (process.env.ALLOW_LOCAL_URLS === 'true') {
            return true;
        }

        return !isLoopback && !isPrivateIP;
    } catch {
        return false;
    }
}

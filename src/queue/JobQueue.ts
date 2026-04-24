import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

function toCamelCase(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(v => toCamelCase(v));
    }
    if (obj !== null && obj !== undefined && obj.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            result[camelKey] = toCamelCase(obj[key]);
            return result;
        }, {} as any);
    }
    return obj;
}

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

export class JobQueue {
    private db: Database.Database;
    private dbPath: string;
    private resultsDir: string;

    constructor(dbPath?: string) {
        const dataDir = path.join(process.cwd(), 'data');
        this.resultsDir = path.join(dataDir, 'results');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }

        this.dbPath = dbPath || path.join(dataDir, 'aerocrawl.db');
        this.db = new Database(this.dbPath);
        this.initialize();
    }

    private initialize(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS crawl_sessions (
                id TEXT PRIMARY KEY,
                root_url TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'running',
                total_urls INTEGER DEFAULT 0,
                processed_urls INTEGER DEFAULT 0,
                actions TEXT,
                formats TEXT,
                webhook_url TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                crawl_id TEXT NOT NULL,
                url TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                result TEXT,
                error TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (crawl_id) REFERENCES crawl_sessions(id)
            );

            CREATE INDEX IF NOT EXISTS idx_jobs_crawl_id ON jobs(crawl_id);
            CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
        `);
    }

    createCrawlSession(rootUrl: string, actions?: string, formats?: string, webhookUrl?: string): string {
        const id = `crawl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const stmt = this.db.prepare(`
            INSERT INTO crawl_sessions (id, root_url, status, actions, formats, webhook_url) 
            VALUES (?, ?, 'running', ?, ?, ?)
        `);
        stmt.run(id, rootUrl, actions || null, formats || null, webhookUrl || null);
        return id;
    }

    addJob(crawlId: string, url: string): number {
        const stmt = this.db.prepare(`
            INSERT INTO jobs (crawl_id, url, status) VALUES (?, ?, 'pending')
        `);
        const result = stmt.run(crawlId, url);
        
        // Update total URLs count
        this.db.prepare(`
            UPDATE crawl_sessions 
            SET total_urls = total_urls + 1, updated_at = datetime('now')
            WHERE id = ?
        `).run(crawlId);
        
        return result.lastInsertRowid as number;
    }

    addJobs(crawlId: string, urls: string[]): void {
        const stmt = this.db.prepare(`
            INSERT INTO jobs (crawl_id, url, status) VALUES (?, ?, 'pending')
        `);
        const transaction = this.db.transaction((urls: string[]) => {
            for (const url of urls) {
                stmt.run(crawlId, url);
            }
            this.db.prepare(`
                UPDATE crawl_sessions 
                SET total_urls = total_urls + ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(urls.length, crawlId);
        });
        transaction(urls);
    }

    getNextJob(crawlId: string): CrawlJob | undefined {
        const row = this.db.prepare(`
            SELECT * FROM jobs 
            WHERE crawl_id = ? AND status = 'pending'
            ORDER BY id ASC
            LIMIT 1
        `).get(crawlId);
        
        const job = row ? toCamelCase(row) as CrawlJob : undefined;

        if (job) {
            this.db.prepare(`
                UPDATE jobs SET status = 'processing', updated_at = datetime('now')
                WHERE id = ?
            `).run(job.id);
        }

        return job;
    }

    completeJob(jobId: number, result?: string): void {
        let dbResult = result;
        if (result) {
            const filePath = path.join(this.resultsDir, `${jobId}.json`);
            fs.writeFileSync(filePath, result, 'utf8');
            dbResult = JSON.stringify({ file: filePath });
        }

        this.db.prepare(`
            UPDATE jobs 
            SET status = 'completed', result = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(dbResult, jobId);

        // Update session processed count
        const job = this.db.prepare(`SELECT crawl_id FROM jobs WHERE id = ?`).get(jobId) as { crawl_id: string };
        if (job) {
            this.db.prepare(`
                UPDATE crawl_sessions 
                SET processed_urls = processed_urls + 1, updated_at = datetime('now')
                WHERE id = ?
            `).run(job.crawl_id);
        }
    }

    failJob(jobId: number, error: string): void {
        this.db.prepare(`
            UPDATE jobs 
            SET status = 'failed', error = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(error, jobId);
    }

    getCrawlSession(crawlId: string): CrawlSession | undefined {
        const row = this.db.prepare(`SELECT * FROM crawl_sessions WHERE id = ?`).get(crawlId);
        return row ? toCamelCase(row) as CrawlSession : undefined;
    }

    getCrawlJobs(crawlId: string): CrawlJob[] {
        const rows = this.db.prepare(`SELECT * FROM jobs WHERE crawl_id = ? ORDER BY id ASC`).all(crawlId);
        return toCamelCase(rows) as CrawlJob[];
    }

    getSessionStats(crawlId: string): { total: number; pending: number; processing: number; completed: number; failed: number } {
        const stats = this.db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM jobs WHERE crawl_id = ?
        `).get(crawlId) as any;
        
        return {
            total: stats.total || 0,
            pending: stats.pending || 0,
            processing: stats.processing || 0,
            completed: stats.completed || 0,
            failed: stats.failed || 0
        };
    }

    completeCrawlSession(crawlId: string): void {
        this.db.prepare(`
            UPDATE crawl_sessions 
            SET status = 'completed', updated_at = datetime('now')
            WHERE id = ?
        `).run(crawlId);
    }

    getWebhookUrl(crawlId: string): string | undefined {
        const row = this.db.prepare(`SELECT webhook_url FROM crawl_sessions WHERE id = ?`).get(crawlId) as { webhook_url?: string };
        return row?.webhook_url;
    }

    getCrawlResultsForWebhook(crawlId: string): any {
        const session = this.getCrawlSession(crawlId);
        const jobs = this.getCrawlJobs(crawlId);
        const results = jobs
            .filter((job: any) => job.status === 'completed' && job.result)
            .map((job: any) => {
                const parsed = JSON.parse(job.result);
                if (parsed.file && fs.existsSync(parsed.file)) {
                    return JSON.parse(fs.readFileSync(parsed.file, 'utf8'));
                }
                return parsed;
            });

        return {
            crawlId,
            status: session?.status,
            totalUrls: session?.totalUrls,
            processedUrls: session?.processedUrls,
            results
        };
    }

    close(): void {
        this.db.close();
    }
}

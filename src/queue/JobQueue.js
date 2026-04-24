import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
function toCamelCase(obj) {
    if (Array.isArray(obj)) {
        return obj.map(v => toCamelCase(v));
    }
    if (obj !== null && obj !== undefined && obj.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            result[camelKey] = toCamelCase(obj[key]);
            return result;
        }, {});
    }
    return obj;
}
export class JobQueue {
    db;
    dbPath;
    constructor(dbPath) {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        this.dbPath = dbPath || path.join(dataDir, 'aerocrawl.db');
        this.db = new Database(this.dbPath);
        this.initialize();
    }
    initialize() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS crawl_sessions (
                id TEXT PRIMARY KEY,
                root_url TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'running',
                total_urls INTEGER DEFAULT 0,
                processed_urls INTEGER DEFAULT 0,
                actions TEXT,
                formats TEXT,
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
    createCrawlSession(rootUrl, actions, formats) {
        const id = `crawl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const stmt = this.db.prepare(`
            INSERT INTO crawl_sessions (id, root_url, status, actions, formats) 
            VALUES (?, ?, 'running', ?, ?)
        `);
        stmt.run(id, rootUrl, actions || null, formats || null);
        return id;
    }
    addJob(crawlId, url) {
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
        return result.lastInsertRowid;
    }
    addJobs(crawlId, urls) {
        const stmt = this.db.prepare(`
            INSERT INTO jobs (crawl_id, url, status) VALUES (?, ?, 'pending')
        `);
        const transaction = this.db.transaction((urls) => {
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
    getNextJob(crawlId) {
        const row = this.db.prepare(`
            SELECT * FROM jobs 
            WHERE crawl_id = ? AND status = 'pending'
            ORDER BY id ASC
            LIMIT 1
        `).get(crawlId);
        const job = row ? toCamelCase(row) : undefined;
        if (job) {
            this.db.prepare(`
                UPDATE jobs SET status = 'processing', updated_at = datetime('now')
                WHERE id = ?
            `).run(job.id);
        }
        return job;
    }
    completeJob(jobId, result) {
        this.db.prepare(`
            UPDATE jobs 
            SET status = 'completed', result = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(result, jobId);
        // Update session processed count
        const job = this.db.prepare(`SELECT crawl_id FROM jobs WHERE id = ?`).get(jobId);
        if (job) {
            this.db.prepare(`
                UPDATE crawl_sessions 
                SET processed_urls = processed_urls + 1, updated_at = datetime('now')
                WHERE id = ?
            `).run(job.crawl_id);
        }
    }
    failJob(jobId, error) {
        this.db.prepare(`
            UPDATE jobs 
            SET status = 'failed', error = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(error, jobId);
    }
    getCrawlSession(crawlId) {
        const row = this.db.prepare(`SELECT * FROM crawl_sessions WHERE id = ?`).get(crawlId);
        return row ? toCamelCase(row) : undefined;
    }
    getCrawlJobs(crawlId) {
        const rows = this.db.prepare(`SELECT * FROM jobs WHERE crawl_id = ? ORDER BY id ASC`).all(crawlId);
        return toCamelCase(rows);
    }
    getSessionStats(crawlId) {
        const stats = this.db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM jobs WHERE crawl_id = ?
        `).get(crawlId);
        return {
            total: stats.total || 0,
            pending: stats.pending || 0,
            processing: stats.processing || 0,
            completed: stats.completed || 0,
            failed: stats.failed || 0
        };
    }
    completeCrawlSession(crawlId) {
        this.db.prepare(`
            UPDATE crawl_sessions 
            SET status = 'completed', updated_at = datetime('now')
            WHERE id = ?
        `).run(crawlId);
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=JobQueue.js.map
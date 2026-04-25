---
name: aerocrawl
description: lightweight web scraping and crawling engine - scrape, extract, crawl, map, search, agent mode - MCP integration ready
trigger: /aerocrawl
---

# AeroCrawl - Agent Manual

**This is the complete manual for agents to install and use AeroCrawl.** Read this entire document before using AeroCrawl.

AeroCrawl is a lightweight, high-performance web scraping and crawling engine. It converts websites to LLM-ready markdown, extracts structured data with AI, and uses Chrome DevTools Protocol (CDP) for zero-dependency browser automation. A modern alternative to Firecrawl — 70% lighter, no Playwright needed.

---

## Quick Start for Agents (Copy-Paste This)

```
Read the full AeroCrawl skill from:
https://raw.githubusercontent.com/deviprasadshetty-dev/aerocrawl/main/SKILL.md

Then execute these commands in order:

STEP 1 - Check if already installed:
  aerocrawl --help

STEP 2 - If step 1 failed, install:
  Windows (PowerShell):
    iwr https://raw.githubusercontent.com/deviprasadshetty-dev/aerocrawl/main/install.ps1 -OutFile install.ps1; .\install.ps1
  Mac/Linux:
    curl -fsSL https://raw.githubusercontent.com/deviprasadshetty-dev/aerocrawl/main/install.sh -o install.sh && bash install.sh

STEP 3 - Verify installation:
  aerocrawl --help

STEP 4 - Use it:
  aerocrawl https://example.com
```

---

## Prerequisites

Before installing, verify these are available:
- **Node.js ≥ 18** - Check with: `node --version`
- **Git** - Check with: `git --version`
- **Chrome or Edge** - CDP uses your system browser

If any prerequisite is missing, install it first before continuing.

---

## Installation

### Method 1: Automated Install Scripts (Recommended)

These scripts auto-detect issues and guide you through installation:

**Windows (PowerShell):**
```powershell
iwr https://raw.githubusercontent.com/deviprasadshetty-dev/aerocrawl/main/install.ps1 -OutFile install.ps1; .\install.ps1
```

**Mac/Linux (bash/zsh):**
```bash
curl -fsSL https://raw.githubusercontent.com/deviprasadshetty-dev/aerocrawl/main/install.sh -o install.sh && bash install.sh
```

### Method 2: Manual Installation

If the scripts don't work, follow these steps manually:

```bash
# Clone the repository
git clone https://github.com/deviprasadshetty-dev/aerocrawl.git

# Enter the directory
cd aerocrawl

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (makes 'aerocrawl' command available)
npm link
```

### Verify Installation

```bash
aerocrawl --help
```

If this shows usage information, installation was successful.

---

## Configuration (Optional)

For AI extraction and agent modes, create a `.env` file in your working directory:

```env
# LLM Provider (openai, anthropic, ollama, openrouter)
LLM_PROVIDER=openrouter

# OpenRouter (recommended - has free models)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free

# Or use OpenAI
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini

# Or use Anthropic
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-3-5-haiku-20241022

# Or use local Ollama
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=llama3.2
```

**Free models via OpenRouter:**
- `nvidia/nemotron-3-super-120b-a12b:free`
- `meta-llama/llama-3-8b-instruct:free`
- `google/gemma-7b-it:free`

---

## Usage

### Command Syntax

```
aerocrawl <url>                                      # scrape URL to markdown (default)
aerocrawl <url> -m extract                           # extract structured data with AI
aerocrawl <url> -m crawl                             # crawl entire website
aerocrawl <url> -m map                               # discover all URLs on site
aerocrawl <url> --goal "extract prices"              # AI agent mode
aerocrawl "search query" -m search                   # search the web (zero external API)
aerocrawl <url> --screenshot                         # capture screenshot
aerocrawl --batch urls.txt --output results.json     # batch scrape from file
aerocrawl -m serve                                   # start API server (port 3000)
aerocrawl -m mcp                                     # start MCP server for Cursor/AI tools
```

### Mode Selection Guide

| User Intent | Mode | Example Command |
|-------------|------|-----------------|
| "scrape", "get markdown", "fetch content" | default | `aerocrawl https://example.com` |
| "extract data", "structured data", "get JSON" | extract | `aerocrawl https://example.com -m extract` |
| "crawl site", "whole site", "all pages" | crawl | `aerocrawl https://example.com -m crawl` |
| "map site", "find URLs", "discover links" | map | `aerocrawl https://example.com -m map` |
| "search", "look up", "find online" | search | `aerocrawl "query" -m search` |
| "automate", "click", "fill form", "navigate" | agent | `aerocrawl https://example.com --goal "..."` |

---

## Step-by-Step Agent Workflow

When a user asks you to use AeroCrawl, follow these steps:

### Step 1: Check Installation

```powershell
aerocrawl --help 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "AeroCrawl not found. Installing..."
    iwr https://raw.githubusercontent.com/deviprasadshetty-dev/aerocrawl/main/install.ps1 -OutFile install.ps1; .\install.ps1
}
```

If the command succeeds, proceed to Step 2.

### Step 2: Parse User Intent

Determine which mode to use based on the user's request. Use the Mode Selection Guide above.

### Step 3: Execute Command

Run the appropriate command based on the mode:

#### Scrape Mode (Default)
```powershell
aerocrawl https://example.com
```
Output: Markdown content printed to stdout. Read it and present to user.

#### Extract Mode
```powershell
aerocrawl https://example.com -m extract
```
Output: JSON with structured data. Parse and present to user.

For custom extraction schema, create an `extract.json` file:
```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "price": { "type": "number" },
    "description": { "type": "string" }
  }
}
```
Then run: `aerocrawl https://example.com -m extract --schema extract.json`

#### Crawl Mode
```powershell
aerocrawl https://example.com -m crawl
```
Monitor progress. Output: all crawled pages in markdown. Results saved to `crawl-<id>.json`.

Options:
- `--max-urls 50` - limit pages to crawl
- `--extract` - extract structured data from each page

#### Map Mode
```powershell
aerocrawl https://example.com -m map
```
Output: JSON array of all discovered URLs.

#### Search Mode
```powershell
aerocrawl "search query" -m search
```
Output: search results with titles, URLs, and snippets.

Search engines supported: Google, DuckDuckGo, Bing (CDP-automated, no API keys).

#### Agent Mode
```powershell
aerocrawl https://example.com --goal "natural language goal"
```
Output: AI executes the goal using browser automation.

Example goals:
- "Extract all product names and prices"
- "Fill out the contact form with name=John, email=test@test.com"
- "Click the 'Load More' button 3 times, then extract all items"

### Step 4: Handle Output

After execution:
1. Read the output file if one was generated (e.g., `crawl-*.json`, `batch-*.json`)
2. Present a clean summary to the user
3. If JSON output, pretty-print it
4. If markdown, show key sections or save to file

### Step 5: Batch Operations (If Needed)

For multiple URLs, use batch mode:

Create `urls.txt`:
```
https://example.com/page1
https://example.com/page2
https://example.com/page3
```

Run:
```powershell
aerocrawl --batch urls.txt --output results.json
```

Monitor progress with:
```powershell
aerocrawl --batch-status BATCH_ID
```

---

## MCP Server Setup (For Cursor and AI Tools)

### Start MCP Server
```powershell
aerocrawl -m mcp
```

### Configure in Cursor
Create/update `C:\Users\Deviprasad Shetty\.cursor\mcp.json`:
```json
{
  "mcpServers": {
    "aerocrawl": {
      "command": "aerocrawl",
      "args": ["-m", "mcp"]
    }
  }
}
```

### Configure in Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "aerocrawl": {
      "command": "aerocrawl",
      "args": ["-m", "mcp"]
    }
  }
}
```

### Available MCP Tools
- `scrape` - scrape a URL to markdown
- `extract` - extract structured data with AI
- `crawl` - crawl an entire website
- `search` - search the web
- `agent` - AI-driven browser automation

### Usage in Cursor
```
@aerocrawl Can you scrape https://example.com and extract the main heading?
```

---

## API Server Mode

### Start the Server
```powershell
aerocrawl -m serve
```

Default port: 3000. Change with `PORT=3000 aerocrawl -m serve`

### API Endpoints

#### POST /v1/scrape
```powershell
curl -X POST http://localhost:3000/v1/scrape `
  -H "Content-Type: application/json" `
  -d '{"url": "https://example.com", "formats": ["markdown", "html", "screenshot"]}'
```

#### POST /v1/extract
```powershell
curl -X POST http://localhost:3000/v1/extract `
  -H "Content-Type: application/json" `
  -d '{"url": "https://example.com", "schema": {"type": "object", "properties": {...}}}'
```

#### POST /v1/crawl
```powershell
curl -X POST http://localhost:3000/v1/crawl `
  -H "Content-Type: application/json" `
  -d '{"url": "https://example.com", "maxUrls": 100}'
```

#### GET /v1/crawl/:crawlId
Get crawl status and results.

#### POST /v1/batch/scrape
```powershell
curl -X POST http://localhost:3000/v1/batch/scrape `
  -H "Content-Type: application/json" `
  -d '{"urls": ["https://example.com/1", "https://example.com/2"]}'
```

#### POST /v1/search
```powershell
curl -X POST http://localhost:3000/v1/search `
  -H "Content-Type: application/json" `
  -d '{"query": "best web scraping tools", "engine": "google"}'
```

#### POST /v1/agent
```powershell
curl -X POST http://localhost:3000/v1/agent `
  -H "Content-Type: application/json" `
  -d '{"url": "https://example.com", "goal": "Extract all product prices"}'
```

---

## CDP Actions (Browser Automation)

For sites that need interaction before scraping, use CDP actions via JSON file:

Create `actions.json`:
```json
[
  {"type": "click", "selector": "#accept-cookies"},
  {"type": "wait", "ms": 1000},
  {"type": "scroll", "position": "bottom"},
  {"type": "screenshot"}
]
```

Run with actions:
```powershell
aerocrawl https://example.com --actions actions.json
```

Supported actions:
- `click` - click an element
- `type` - type text into input
- `scroll` - scroll page (top/bottom)
- `wait` - wait specified milliseconds
- `screenshot` - capture screenshot
- `press` - press a key (Enter, Tab, etc.)

---

## CrawlHooks (Advanced Customization)

For advanced users, create `hooks.js` for custom processing:

```javascript
export default {
  beforeFetch: async (url) => {
    // Modify URL before fetching
    return url;
  },
  onPageFetched: async (url, html) => {
    // Modify HTML before parsing
    return html;
  },
  onPageParsed: async (url, markdown) => {
    // Modify markdown after parsing
    return markdown;
  },
  onCrawlComplete: async (results) => {
    // Post-process all crawl results
    return results;
  }
};
```

Use with: `aerocrawl https://example.com -m crawl --hooks hooks.js`

---

## Webhooks (Real-time Notifications)

Get notified when long-running crawls complete:

```powershell
curl -X POST http://localhost:3000/v1/crawl `
  -H "Content-Type: application/json" `
  -d '{"url": "https://example.com", "webhookUrl": "https://your-server.com/webhook"}'
```

Webhook payload:
```json
{
  "crawlId": "abc123",
  "status": "completed",
  "totalPages": 50,
  "results": [...]
}
```

---

## Local-First App Integration

For local-first apps, AeroCrawl provides:

### 1. Programmatic API Usage
```javascript
import { SmartFetcher } from 'aerocrawl/dist/fetcher/SmartFetcher.js';

const fetcher = new SmartFetcher();
const { markdown, html } = await fetcher.fetchWithOptions('https://example.com', {
  formats: ['markdown'],
  actions: [{ type: 'click', selector: '#button' }]
});
```

### 2. CLI Integration in Scripts
```javascript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

const { stdout } = await execAsync('aerocrawl https://example.com');
const markdown = stdout;
```

### 3. Local Storage Pattern
```javascript
// Store scraped data locally
const result = await execAsync('aerocrawl https://example.com');
localStorage.setItem('scraped:example.com', JSON.stringify({
  url: 'https://example.com',
  markdown: result.stdout,
  timestamp: Date.now()
}));
```

### 4. Offline Queue Pattern
```javascript
// Queue URLs when offline, sync when online
const queue = JSON.parse(localStorage.getItem('scrape-queue') || '[]');
queue.push('https://example.com');
localStorage.setItem('scrape-queue', JSON.stringify(queue));

// When online:
const queued = JSON.parse(localStorage.getItem('scrape-queue') || '[]');
for (const url of queued) {
  await execAsync(`aerocrawl ${url}`);
}
localStorage.setItem('scrape-queue', '[]');
```

---

## Troubleshooting

### Build Fails with TypeScript Errors
```powershell
npm run build
# If errors, check Node.js version (requires ≥18)
node --version
```

### CDP Connection Fails
- Ensure Chrome/Edge is installed
- Try: `chrome --remote-debugging-port=9222` then re-run
- Check if port 9222 is already in use

### LLM Extraction Fails
- Verify API key in `.env`
- Check `LLM_PROVIDER` is set correctly
- Try free OpenRouter model first

### MCP Server Not Connecting
- Verify `aerocrawl -m mcp` runs without errors
- Check MCP config JSON syntax
- Restart Cursor/tool after config change

---

## Supported LLM Providers

| Provider | Config | Models |
|----------|--------|--------|
| **OpenRouter** (recommended) | `LLM_PROVIDER=openrouter` | Free models available |
| **OpenAI** | `LLM_PROVIDER=openai` | GPT-4o, GPT-4o-mini |
| **Anthropic** | `LLM_PROVIDER=anthropic` | Claude 3.5 Haiku, Sonnet |
| **Ollama** (local) | `LLM_PROVIDER=ollama` | Llama 3.2, Mistral, etc. |

---

## Comparison with Firecrawl

| Feature | Firecrawl | AeroCrawl |
|---------|-----------|-----------|
| Size | ~300MB (Playwright) | ~50MB (CDP only) |
| Dependencies | Playwright | chrome-remote-interface |
| Local-first | No (Redis/Postgres) | Yes (SQLite) |
| Free AI models | No | Yes (OpenRouter) |
| PDF Support | No | Yes |
| Zero-API Search | No | Yes |

---

## Quick Reference

```powershell
# Most common commands
aerocrawl https://example.com                        # quick scrape
aerocrawl https://example.com -m extract              # structured data
aerocrawl https://example.com -m crawl               # whole site
aerocrawl "query" -m search                          # web search
aerocrawl https://example.com --goal "do something"  # AI agent
aerocrawl -m mcp                                     # MCP server
```

---

## What AeroCrawl is For

Three things it does that basic fetch cannot:
1. **SPA & bot-protected sites** - auto-fallback to CDP browser rendering when HTTP fails
2. **AI-structured extraction** - turn any webpage into typed JSON via LLM prompts
3. **Zero-dependency automation** - CDP directly, no 300MB+ Playwright dependency

Use it for:
- Scraping documentation/markdown for LLM context
- Extracting structured data from websites without APIs
- Crawling entire sites for offline reading or search indexing
- Searching the web without third-party search API keys
- AI-driven browser automation (complex multi-step tasks)

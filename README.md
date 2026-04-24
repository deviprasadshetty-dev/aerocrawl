# AeroCrawl

A next-generation web scraping and crawling engine built to be a lighter, more advanced, and highly optimized alternative to Firecrawl. Transforms websites into pristine, LLM-ready markdown and extracts structured data with AI.

## Features

### Core Capabilities
- **Lightweight**: No heavy Playwright or Puppeteer dependencies. Uses Chrome DevTools Protocol (CDP) directly.
- **Smart Fetching**: Automatically falls back to browser rendering when needed (bot protection, SPAs).
- **Clean Markdown**: Uses Mozilla Readability to extract semantic content.
- **AI Extraction**: Extract structured data from web content using LLMs (OpenAI, Anthropic, Ollama, **NVIDIA Nemotron via OpenRouter**).
- **Site Mapping**: Discover all URLs on a website via sitemaps and link discovery.
- **Crawling**: Asynchronous crawling with SQLite-backed job queue.
- **CLI Tool**: Command-line interface for quick scraping and crawling tasks.

### Advanced CDP Features (Firecrawl Competitive)
- **Browser Actions**: Click, type, scroll, press keys, wait for selectors via CDP - no Playwright needed.
- **Screenshots**: Capture full-page screenshots in PNG/JPEG format.
- **Multi-Format Output**: Get markdown, HTML, or screenshots from any scrape.
- **Batch Scraping**: Scrape multiple URLs asynchronously with `/v1/batch/scrape` endpoint.
- **AI Agent Mode**: Provide a goal, AI automatically drives CDP to complete tasks - no manual action files needed.
- **Search Endpoint**: Uses CDP to automate search engines (Google, DuckDuckGo, Bing) - zero external API needed.

## Quick Start

### Agent Mode (AI-Driven Automation)
```bash
# AI automatically navigates and extracts data
aerocrawl https://example.com --goal "Extract all product prices and features"

# Agent mode with custom LLM
aerocrawl --goal "Login and get dashboard data" https://site.com --provider openai
```

### PDF Support (Zero External API)
```bash
# Automatically detects PDF and extracts text
aerocrawl https://example.com/document.pdf

# PDF text is converted to markdown automatically
```

### Webhooks (Real-time Notifications)
```bash
# Receive webhook when crawl completes
aerocrawl https://example.com -m crawl --output ./results \
  --webhook-url "https://your-server.com/webhook"

# Webhook receives JSON with crawl results
```

### MCP Server (AI Tool Integration)
```bash
# Generate MCP config for Cursor/KiloCode (one-time setup)
aerocrawl --generate-mcp-config

# Or manually start MCP server
aerocrawl -m mcp
```

**Cursor Integration:**
1. Run: `aerocrawl --generate-mcp-config`
2. Open Cursor Settings → MCP → Add Server
3. AeroCrawl tools are now available in Cursor!

**KiloCode Integration:**
1. Use the same config: `.cursor/mcp.json`
2. Or manually add to KiloCode's MCP settings

**Available MCP Tools:**
- `scrape` - Scrape any URL with CDP
- `extract` - Extract structured data with AI
- `crawl` - Crawl entire websites
- `search` - Search web (zero external API)
- `agent` - AI-driven automation

**Example usage in Cursor:**
```
@aerocrawl Can you scrape https://example.com and extract the main heading?
```

### Scrape with Actions
```bash
# Take screenshot
aerocrawl https://example.com --screenshot

# Get multiple formats
aerocrawl https://example.com --formats markdown,html,screenshot

# Batch scrape from file
aerocrawl --batch urls.txt --output results.json
```

### Search (Zero External API)
```bash
# Search using DuckDuckGo (default)
aerocrawl "best web scraping tools" -m search

# Search with Google
aerocrawl "AI tools 2026" -m search --engine google

# Save results
aerocrawl "Node.js tutorials" -m search -o results.json
```

## Installation

```bash
npm install -g aerocrawl
# or for local use
npm install aerocrawl
```

## Quick Start

### CLI (Easiest - No server needed!)

```bash
# Scrape a URL (default mode)
aerocrawl https://example.com

# Extract structured data with AI (uses OpenRouter free models by default)
aerocrawl https://example.com -m extract

# Map all URLs on a website
aerocrawl https://example.com -m map

# Crawl an entire website
aerocrawl https://example.com -m crawl

# Crawl with AI extraction
aerocrawl https://example.com -m crawl --extract
```

### API Server (Optional)

**Setup environment variables:**
```bash
# .env or shell
OPENROUTER_API_KEY=sk-or-v1-...
LLM_PROVIDER=openrouter
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
```

Start the API server if you prefer HTTP endpoints:

```bash
aerocrawl https://example.com -m serve
# or just
npx tsx src/cli.ts serve
```

## API Endpoints

The API server is optional. Start it with:
```bash
aerocrawl https://example.com -m serve
# or just
node dist/cli.js serve
```

### POST /v1/scrape

Scrape a single URL with optional CDP actions and multiple output formats.

```bash
# Basic scrape
curl -X POST http://localhost:3000/v1/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# With screenshot and HTML
curl -X POST http://localhost:3000/v1/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "formats": ["markdown", "html", "screenshot"]}'
```

Response:
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "markdown": "# Example...",
    "html": "<!DOCTYPE html>...",
    "screenshot": "base64encoded..."
  }
}
```

### POST /v1/agent (AI-Driven Automation)

Provide a goal, AI automatically drives CDP to complete the task.

```bash
curl -X POST http://localhost:3000/v1/agent \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Extract all product prices from the pricing page",
    "url": "https://example.com/pricing",
    "llmConfig": {"provider": "openrouter"}
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "goal": "Extract all product prices",
    "result": { "products": [...] },
    "actionsTaken": [{"type": "click", "selector": "..."}, ...]
  }
}
```

### POST /v1/batch/scrape

Batch scrape multiple URLs asynchronously.

```bash
curl -X POST http://localhost:3000/v1/batch/scrape \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com/1", "https://example.com/2"]}'
```

### POST /v1/extract

Extract structured data from a URL or markdown using AI.

```bash
curl -X POST http://localhost:3000/v1/extract \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "llmConfig": {"provider": "openai", "apiKey": "sk-..."}
  }'
```

### POST /v1/crawl

Start a crawl job with optional actions and formats.

```bash
curl -X POST http://localhost:3000/v1/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "maxUrls": 100,
    "formats": ["markdown", "screenshot"]
  }'
```

### GET /v1/crawl/:crawlId

Get crawl status or results.

```bash
curl "http://localhost:3000/v1/crawl/crawl_123?results=true"
```

### POST /v1/map

Discover all URLs on a website.

```bash
curl -X POST http://localhost:3000/v1/map \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "maxUrls": 100}'
```

## Configuration

Create a `.env` file:

```env
# LLM Provider (openai, anthropic, ollama, openrouter)
LLM_PROVIDER=openrouter

# OpenRouter (recommended - free models available)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free

# OpenAI
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini

# Anthropic
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-3-5-haiku-20241022

# Ollama (local)
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=llama3.2

# Server
PORT=3000
```

## Comparison with Firecrawl

| Feature | Firecrawl | AeroCrawl | Status |
|---------|-----------|-----------|--------|
| **Core Scraping** | ✓ | ✓ | ✅ Complete |
| **JavaScript Rendering** | Playwright | CDP (lighter) | ✅ Complete |
| **Markdown Output** | ✓ | ✓ | ✅ Complete |
| **AI Extraction** | ✓ | ✓ | ✅ Complete |
| **Site Mapping** | ✓ | ✓ | ✅ Complete |
| **Crawling** | ✓ | ✓ | ✅ Complete |
| **Browser Actions** | ✓ (Playwright) | ✓ (CDP) | ✅ Complete |
| **Screenshots** | ✓ | ✓ | ✅ Complete |
| **Multi-format Output** | ✓ | ✓ | ✅ Complete |
| **Batch Scraping** | ✓ | ✓ | ✅ Complete |
| **AI Agent Mode** | ✓ | ✓ | ✅ Complete |
| **Search Endpoint** | ✓ | ✗ | 🔴 Missing |
| **Proxy Rotation** | ✓ | ✗ | 🔴 Missing |
| **MCP Server** | ✓ | ✗ | 🔴 Missing |
| **Webhooks** | ✓ | ✗ | 🔴 Missing |

### What AeroCrawl Does Better:
- **Lightweight**: No Playwright/Puppeteer (~300MB saved)
- **Local-First**: SQLite instead of Redis/Postgres
- **Free AI**: OpenRouter integration with free models
- **Zero Config**: Works out of the box with system Chrome/Edge

### What We're Missing (No CDP Solution):
- **Search**: Need to integrate search API (DuckDuckGo, Exa, etc.)
- **Proxies**: Anti-bot bypass requires paid proxy services
- **MCP**: Model Context Protocol for AI tool integration

## Architecture

AeroCrawl uses a three-layer architecture:

1. **Engine Layer**: SmartFetcher with CDPBrowser fallback
2. **Transformation Layer**: MarkdownPipeline (JSDOM + Readability + Turndown)
3. **Routing & Execution Layer**: Express API + SQLite Job Queue

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

## Supported LLM Providers

- **OpenRouter** (recommended - free models available):
  - `nvidia/nemotron-3-super-120b-a12b:free` (high quality, large context)
  - `meta-llama/llama-3-8b-instruct:free`
  - `google/gemma-7b-it:free`
  - `mistralai/mistral-7b-instruct:free`
- **OpenAI**: GPT-4o, GPT-4o-mini, etc.
- **Anthropic**: Claude 3.5 Haiku, Sonnet, Opus, etc.
- **Ollama**: Local LLMs like Llama 3.2, Mistral, etc.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Type check
npx tsc --noEmit
```

## License

ISC

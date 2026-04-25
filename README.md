# AeroCrawl

A lightweight, high-performance web scraping and crawling engine — a modern alternative to Firecrawl. Converts websites to LLM-ready markdown, extracts structured data with AI, and uses Chrome DevTools Protocol (CDP) for zero-dependency browser automation.

[![License](https://img.shields.io/badge/license-ISC-blue?style=flat-square)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/deviprasadshetty-dev/aerocrawl?style=flat-square)](https://github.com/deviprasadshetty-dev/aerocrawl)

## Table of Contents
- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Comparison with Firecrawl](#comparison-with-firecrawl)
- [Architecture](#architecture)
- [Development](#development)
- [License](#license)

## Features

### Core Capabilities
- **Lightweight**: No Playwright/Puppeteer — uses Chrome DevTools Protocol (CDP) directly
- **Smart Fetching**: Auto-fallback to CDP browser rendering for SPAs and bot-protected sites
- **Clean Markdown**: Mozilla Readability for semantic content extraction
- **AI Extraction**: Structured data extraction via LLMs (OpenAI, Anthropic, Ollama, NVIDIA Nemotron via OpenRouter)
- **Site Mapping**: Discover all URLs via sitemaps and link crawling
- **Async Crawling**: SQLite-backed job queue for scalable crawling
- **Zero External Search**: Automate search engines (Google, DuckDuckGo, Bing) via CDP — no third-party APIs
- **MCP Server**: Integrate with AI tools like Cursor and KiloCode
- **Webhooks**: Real-time crawl completion notifications
- **PDF Support**: Automatic PDF text extraction to markdown
- **Agent Mode**: AI-driven browser automation for complex tasks

### Advanced CDP Features
- **Browser Actions**: Click, type, scroll, press keys via CDP (no Playwright needed)
- **Screenshots**: Full-page PNG/JPEG captures
- **Multi-Format Output**: Markdown, HTML, or screenshots from any scrape
- **Batch Scraping**: Async multi-URL scraping via `/v1/batch/scrape`

## Quick Start

### For Agents - Quick Start

As an AI agent, you can use AeroCrawl in two ways:

**PATH A: Use Directly via CLI**
If you need to scrape something immediately in the terminal:
```bash
# 1. Install
Windows: iwr https://raw.githubusercontent.com/deviprasadshetty-dev/aerocrawl/main/install.ps1 -OutFile install.ps1; .\install.ps1
Mac/Linux: curl -fsSL https://raw.githubusercontent.com/deviprasadshetty-dev/aerocrawl/main/install.sh -o install.sh && bash install.sh

# 2. Scrape
aerocrawl https://example.com
```

**PATH B: Install as MCP Server for Yourself**
To add AeroCrawl's tools natively to your own context window (like Cursor or KiloCode):
```bash
# 1. Install (same as above)
# 2. Generate configuration
aerocrawl --generate-mcp-config
```
*(The AI editor will run the server automatically. No need to keep it running in the terminal).*

### For Humans - Quick Install

**Option 1: Use install scripts (Recommended)**
```bash
# Windows (PowerShell)
iwr https://raw.githubusercontent.com/deviprasadshetty-dev/aerocrawl/main/install.ps1 -OutFile install.ps1; .\install.ps1

# Mac/Linux
curl -fsSL https://raw.githubusercontent.com/deviprasadshetty-dev/aerocrawl/main/install.sh -o install.sh && bash install.sh
```

**Option 2: Manual install**
```powershell
# Windows (PowerShell)
git clone https://github.com/deviprasadshetty-dev/aerocrawl.git; cd aerocrawl; npm install; npm run build; npm link
```
```bash
# Mac/Linux
git clone https://github.com/deviprasadshetty-dev/aerocrawl.git && cd aerocrawl && npm install && npm run build && npm link
```

**Verify:**
```bash
aerocrawl --help
```

### CLI (Zero-Server Mode)
The easiest way to use AeroCrawl — no server setup required:

```bash
# Scrape a single URL to markdown
aerocrawl https://example.com

# Extract structured data with AI (uses OpenRouter free models by default)
aerocrawl https://example.com -m extract

# Map all URLs on a site
aerocrawl https://example.com -m map

# Crawl an entire website
aerocrawl https://example.com -m crawl

# AI Agent Mode: automate tasks with natural language
aerocrawl https://example.com --goal "Extract all product prices and features"

# Search the web (zero external API)
aerocrawl "best web scraping tools" -m search

# Capture screenshots
aerocrawl https://example.com --screenshot

# Batch scrape from file
aerocrawl --batch urls.txt --output results.json
```

### MCP Server (AI Tool Integration)
Integrate with Cursor, KiloCode, and other MCP-compatible tools. The AI assistant will run the server automatically when needed—you do not need to run it manually in your terminal.

**Auto-Generate Configuration:**
```bash
aerocrawl --generate-mcp-config
```

**Manual MCP Configuration JSON:**

Add this to your MCP settings file:

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

**Cursor:** Add to `~/.cursor/mcp.json` or `.cursor/mcp.json` in your project

**KiloCode:** Add to KiloCode's MCP settings file

**Available MCP Tools:**
- `scrape` / `extract` / `crawl` / `search` / `agent`

**Usage in Cursor:**
```
@aerocrawl Can you scrape https://example.com and extract the main heading?
```

### API Server (Optional)
Start the HTTP API server for programmatic access:

```bash
# Start server (defaults to port 3000)
aerocrawl -m serve

# Or via Node.js
node dist/cli.js serve
```

## Installation

AeroCrawl is not published to the npm registry. Install directly from GitHub:

### Prerequisites
- Node.js ≥ 18
- Git
- Chrome or Edge (CDP uses your system browser)

### Step-by-Step
1. Clone the repo:
   ```bash
   git clone https://github.com/deviprasadshetty-dev/aerocrawl.git
   ```
2. Install dependencies:
   ```bash
   cd aerocrawl && npm install
   ```
3. Build:
   ```bash
   npm run build
   ```
4. Link globally (optional):
   ```bash
   npm link
   ```

### Local Project Use
```bash
npm install github:deviprasadshetty-dev/aerocrawl
```

**Prerequisites:**
- Node.js ≥ 18
- Chrome/Edge installed (CDP uses your system browser)

## Configuration

Create a `.env` file in your working directory:

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

## API Endpoints

Base URL: `http://localhost:3000`

### POST /v1/scrape
Scrape a single URL with optional CDP actions and multi-format output:
```bash
curl -X POST http://localhost:3000/v1/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "formats": ["markdown", "html", "screenshot"]}'
```

### POST /v1/agent
AI-driven browser automation:
```bash
curl -X POST http://localhost:3000/v1/agent \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/pricing", "goal": "Extract all product prices"}'
```

### POST /v1/batch/scrape
Batch scrape multiple URLs asynchronously:
```bash
curl -X POST http://localhost:3000/v1/batch/scrape \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com/1", "https://example.com/2"]}'
```

## Comparison with Firecrawl

| Feature | Firecrawl | AeroCrawl |
|---------|-----------|-----------|
| Lightweight (No Playwright) | No | Yes |
| CDP Browser Automation | No | Yes |
| LLM-Ready Markdown | Yes | Yes |
| AI Structured Extraction | Yes | Yes |
| Site Mapping & Crawling | Yes | Yes |
| Browser Actions (Click, Type, etc.) | Yes | Yes |
| Screenshots & Multi-Format Output | Yes | Yes |
| Batch Scraping | Yes | Yes |
| AI Agent Mode | Yes | Yes |
| Zero-External-API Search | No | Yes |
| MCP Server Integration | Yes | Yes |
| Webhooks | Yes | Yes |
| PDF Support | No | Yes |
| Free AI Models (OpenRouter) | No | Yes |

### Key Advantages
- **70% lighter** than Firecrawl (no 300MB+ Playwright dependency)
- **Local-first**: SQLite instead of Redis/Postgres
- **Zero-config**: Works with your system Chrome/Edge out of the box
- **Free AI**: OpenRouter integration with free tier models

## Architecture

AeroCrawl uses a modular three-layer architecture:
1. **Engine Layer**: SmartFetcher with CDP browser fallback
2. **Transformation Layer**: MarkdownPipeline (JSDOM + Readability + Turndown)
3. **Routing Layer**: Express API + SQLite job queue

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full technical details.

## Supported LLM Providers

- **OpenRouter** (recommended - free models available):
  - `nvidia/nemotron-3-super-120b-a12b:free`
  - `meta-llama/llama-3-8b-instruct:free`
  - `google/gemma-7b-it:free`
- **OpenAI**: GPT-4o, GPT-4o-mini, etc.
- **Anthropic**: Claude 3.5 Haiku, Sonnet, Opus, etc.
- **Ollama**: Local LLMs like Llama 3.2, Mistral, etc.

## Development

```bash
# Install dependencies
npm install

# Run in development mode (hot reload)
npm run dev

# Build production bundle
npm run build

# Type check
npx tsc --noEmit
```

## License

ISC

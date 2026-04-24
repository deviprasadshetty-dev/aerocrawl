# AeroCrawl Architecture & Implementation Plan

AeroCrawl is a next-generation web scraping and crawling engine built to be a lighter, more advanced, and highly optimized alternative to Firecrawl. It transforms websites into pristine, LLM-ready markdown and extracts structured data, but with a strict focus on zero-bloat and high-performance execution.

## The Vision
- **Lighter**: No heavy Playwright or Puppeteer dependencies. We directly utilize Chrome DevTools Protocol (CDP) to interface with the system's native Chromium/Edge binaries.
- **More Advanced**: Built-in smart fallbacks, automated JSON schema inference for LLM extraction, and token-saving DOM pruning.
- **More Perfect**: 100% local-first, avoiding forced cloud dependencies like Redis or Postgres.

---

## Architecture Plan

AeroCrawl operates through a three-layer architecture:

### 1. The Engine Layer (Fetching & Rendering)
This layer is responsible for acquiring the raw HTML.
- **`SmartFetcher`**: A heuristic-driven fetcher that attempts a lightweight HTTP GET first.
- **Fallback Heuristics**: If the fetcher detects a 403/503 (bot protection) or an SPA signature (empty body, `#root` element), it transparently delegates to the CDP Browser.
- **`CDPBrowser`**: Spawns a native Chrome/Edge process via `child_process.spawn` using strict headless flags. It connects via `chrome-remote-interface` to extract the fully rendered DOM without the bloat of Puppeteer.

### 2. The Transformation Layer (Parsing & AI)
This layer converts the raw DOM into LLM-optimized tokens.
- **`MarkdownPipeline`**: 
  - Uses `JSDOM` for fast string-based DOM manipulation.
  - Applies Mozilla's `@mozilla/readability` to extract semantic main content, stripping out headers, footers, and sidebars.
  - Passes the semantic HTML through `Turndown` with custom rules to generate clean, readable Markdown.
- **AI Extractor** *(Phase 2)*: Connects to configurable LLM providers (OpenAI, Anthropic, Ollama) to extract structured JSON. Includes auto-schema discovery if no extraction schema is provided.

### 3. The Routing & Execution Layer
- **Express API**: Exposes clean, RESTful endpoints (`/v1/scrape`, `/v1/crawl`, `/v1/extract`).
- **Job Manager** *(Phase 3)*: An SQLite-backed local queue to manage asynchronous, concurrent site mapping and crawling.

---

## Tech Stack
- **Language**: Node.js / TypeScript
- **Network Interface**: Native `fetch`
- **Browser Automation**: `chrome-remote-interface` + System Chrome/Edge
- **DOM Parsing**: `jsdom`, `@mozilla/readability`, `turndown`

---

## Implementation Phases

- [x] **Phase 1: Project Setup & Core Scraper**
   - Setup TypeScript project.
   - Implement `CDPBrowser` and `SmartFetcher`.
   - Implement DOM-to-Markdown pipeline.
   - Create `/v1/scrape` API endpoint.

- [x] **Phase 2: AI Extraction**
   - Integrate LLM Client (OpenAI, Anthropic, Ollama support).
   - Implement structured JSON extraction logic from Markdown.
   - Implement Auto-Schema generation logic.
   - Create `/v1/extract` API endpoint.

- [x] **Phase 3: Crawling & Mapping**
   - Implement SQLite-based local queue system.
   - Implement URL discovery logic (Sitemap + internal link parsing).
   - Create `/v1/crawl` and `/v1/map` API endpoints.

- [x] **Phase 4: CLI & Polish**
   - Add comprehensive error handling and retries.
   - Create documentation.
   - Add CLI tool with commander.

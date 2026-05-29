# pi-serper-search

A [pi](https://pi.dev) extension that adds a `web_search` tool powered by the [Serper](https://serper.dev) Google Search API.

## Tools

### `web_search`

Search the web using Google and return a numbered list of results.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | — | Search query string |
| `results` | number | No | 10 | Number of results to return (1–50) |
| `start` | number | No | 0 | 0-based offset for pagination (0–90) |

**Example LLM usage:**

- "Search the web for the latest TypeScript release notes" → `web_search({ q: "latest TypeScript release notes" })`
- "Show me 5 results about React Server Components" → `web_search({ q: "React Server Components", results: 5 })`
- "Get the next 10 results" → `web_search({ q: "React Server Components", results: 10, start: 10 })`

## Install

### Option 1: pi install (Recommended)

```bash
pi install git:github.com/harms-haus/pi-serper-search
```

### Option 2: Manual (settings.json)

Add to `~/.pi/settings.json`:

```json
{
  "extensions": [
    "git:github.com/harms-haus/pi-serper-search"
  ]
}
```

### Option 3: Quick test

```bash
pi -e ./src/index.ts
```

## Requirements

- [pi coding agent](https://pi.dev)
- [Serper API key](https://serper.dev) (free tier available)
- Node.js 22+

## Configuration

Set the `SERPER_API_KEY` environment variable:

```bash
export SERPER_API_KEY="your-api-key-here"
```

Get your API key at [serper.dev/api-keys](https://serper.dev/api-keys).

## Architecture

```
src/
├── index.ts              # Extension entry point
├── web-search-tool.ts    # Tool definition and execute handler
├── serper-client.ts      # Serper API client (fetch + error handling)
├── pagination.ts         # PageCache: virtual offset → page mapping
└── format-results.ts     # Markdown formatting + truncation
```

**Zero runtime dependencies.** Only pi peer packages are needed.

## License

[MIT](LICENSE)

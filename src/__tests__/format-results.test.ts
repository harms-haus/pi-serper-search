import { describe, it, expect } from "vitest";
import { formatResults, MAX_OUTPUT_BYTES, MAX_OUTPUT_LINES } from "../format-results.js";
import type { SearchResult } from "../pagination.js";

const makeResult = (i: number): SearchResult => ({
  title: `Title ${String(i)}`,
  url: `https://example.com/${String(i)}`,
  snippet: `Snippet for result ${String(i)}`,
});

describe("formatResults", () => {
  it("returns a no-results message for empty input", () => {
    const result = formatResults([], "test");
    expect(result).toEqual({
      text: 'No results found for query: "test".',
      truncated: false,
    });
  });

  it("formats a single result with bold title, indented URL and snippet", () => {
    const result = formatResults(
      [{ title: "My Title", url: "https://example.com", snippet: "A snippet" }],
      "query",
    );
    expect(result.text).toContain("1. **My Title**");
    expect(result.text).toContain("   https://example.com");
    expect(result.text).toContain("   A snippet");
    expect(result.text).toMatch(/^1\. \*\*My Title\*\*/);
    expect(result.truncated).toBe(false);
  });

  it("formats multiple results with sequential numbering", () => {
    const result = formatResults(
      [
        { title: "First", url: "https://a.com", snippet: "Snip A" },
        { title: "Second", url: "https://b.com", snippet: "Snip B" },
        { title: "Third", url: "https://c.com", snippet: "Snip C" },
      ],
      "query",
    );
    expect(result.truncated).toBe(false);

    // Sequential numbering
    expect(result.text).toMatch(/^1\. \*\*First\*\*/m);
    expect(result.text).toMatch(/^2\. \*\*Second\*\*/m);
    expect(result.text).toMatch(/^3\. \*\*Third\*\*/m);

    // Titles are bold
    expect(result.text).toContain("**First**");
    expect(result.text).toContain("**Second**");
    expect(result.text).toContain("**Third**");

    // URLs and snippets are indented with 3 spaces
    expect(result.text).toContain("   https://a.com");
    expect(result.text).toContain("   Snip A");
    expect(result.text).toContain("   https://b.com");
    expect(result.text).toContain("   Snip B");
    expect(result.text).toContain("   https://c.com");
    expect(result.text).toContain("   Snip C");
  });

  it("truncates when line count exceeds MAX_OUTPUT_LINES", () => {
    // Each result produces 3 lines, so 2500 results = 7500 lines > 2000
    const results: SearchResult[] = [];
    for (let i = 0; i < 2500; i++) {
      results.push(makeResult(i));
    }
    const result = formatResults(results, "big query");

    expect(result.truncated).toBe(true);
    expect(result.text.endsWith("[Results truncated at 50KB/2000 lines]")).toBe(true);
    // Verify truncation happened specifically due to line count
    const lines = result.text.split("\n");
    expect(lines.length).toBeLessThanOrEqual(MAX_OUTPUT_LINES + 2); // +2 for trailing blank + truncation message
  });

  it("truncates when byte size exceeds MAX_OUTPUT_BYTES", () => {
    // Each result has a ~5KB snippet, 15 results ≈ 75KB > 50KB
    const results: SearchResult[] = [];
    for (let i = 0; i < 15; i++) {
      results.push({
        title: `Title ${String(i)}`,
        url: `https://example.com/${String(i)}`,
        snippet: "x".repeat(5 * 1024),
      });
    }
    const result = formatResults(results, "big query");

    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.text, "utf8")).toBeLessThanOrEqual(MAX_OUTPUT_BYTES);
  });

  it("escapes markdown special characters in titles and URLs", () => {
    const result = formatResults(
      [
        {
          title: "*asterisks* and [brackets]",
          url: "https://example.com/under_score",
          snippet: "plain snippet",
        },
      ],
      "query",
    );

    // Asterisks and brackets should be escaped with backslash
    expect(result.text).toContain("\\*asterisks\\*");
    expect(result.text).toContain("\\[brackets\\]");
    // Underscores in URL should be escaped
    expect(result.text).toContain("under\\_score");
    expect(result.truncated).toBe(false);
  });

  it("does not truncate when output is within limits", () => {
    const results = Array.from({ length: 5 }, (_, i) => makeResult(i));
    const result = formatResults(results, "normal query");

    expect(result.truncated).toBe(false);
    for (let i = 0; i < 5; i++) {
      expect(result.text).toContain(`**Title ${String(i)}**`);
    }
  });
});

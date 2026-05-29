import { describe, it, expect, vi, beforeEach } from "vitest";
import { PageCache } from "../pagination.js";
import type { SerperOrganicResult } from "../serper-client.js";

const makePageResults = (page: number): SerperOrganicResult[] =>
  Array.from({ length: 10 }, (_, i) => ({
    title: `Page${page} Result${i}`,
    link: `https://example.com/p${page}/${i}`,
    snippet: `Snippet p${page}-${i}`,
  }));

describe("PageCache.getSlice", () => {
  let fetchPage: (
    query: string,
    page: number,
    signal?: AbortSignal,
  ) => Promise<SerperOrganicResult[]>;
  let cache: PageCache;

  beforeEach(() => {
    fetchPage =
      vi.fn<
        (query: string, page: number, signal?: AbortSignal) => Promise<SerperOrganicResult[]>
      >();
    // Default: return 10 results per page
    (fetchPage as ReturnType<typeof vi.fn>).mockImplementation((_query: string, page: number) =>
      Promise.resolve(makePageResults(page)),
    );
    cache = new PageCache(fetchPage, "test query");
  });

  it("returns the first 5 results from a single page", async () => {
    const results = await cache.getSlice(0, 5);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith("test query", 1, undefined);

    expect(results).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(results[i]).toEqual({
        title: `Page1 Result${i}`,
        url: `https://example.com/p1/${i}`,
        snippet: `Snippet p1-${i}`,
      });
    }
  });

  it("spans two pages when the slice crosses a page boundary", async () => {
    // getSlice(8, 5) → indices 8–12 → page 1 (0–9) and page 2 (10–19)
    const results = await cache.getSlice(8, 5);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenCalledWith("test query", 1, undefined);
    expect(fetchPage).toHaveBeenCalledWith("test query", 2, undefined);

    expect(results).toHaveLength(5);
    // indices 8,9 from page 1; indices 10,11,12 → page 2 results 0,1,2
    expect(results[0]).toEqual({
      title: "Page1 Result8",
      url: "https://example.com/p1/8",
      snippet: "Snippet p1-8",
    });
    expect(results[1]).toEqual({
      title: "Page1 Result9",
      url: "https://example.com/p1/9",
      snippet: "Snippet p1-9",
    });
    expect(results[2]).toEqual({
      title: "Page2 Result0",
      url: "https://example.com/p2/0",
      snippet: "Snippet p2-0",
    });
    expect(results[3]).toEqual({
      title: "Page2 Result1",
      url: "https://example.com/p2/1",
      snippet: "Snippet p2-1",
    });
    expect(results[4]).toEqual({
      title: "Page2 Result2",
      url: "https://example.com/p2/2",
      snippet: "Snippet p2-2",
    });
  });

  it("does not re-fetch a cached page", async () => {
    // First call fetches page 1
    await cache.getSlice(0, 10);
    // Second call needs page 2; page 1 is already cached
    await cache.getSlice(10, 10);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenCalledWith("test query", 1, undefined);
    expect(fetchPage).toHaveBeenCalledWith("test query", 2, undefined);
  });

  it("fetches only page 2 when offset is entirely within page 2", async () => {
    // getSlice(15, 3) → indices 15,16,17 → all within page 2 (10–19)
    const results = await cache.getSlice(15, 3);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith("test query", 2, undefined);

    expect(results).toHaveLength(3);
    // Page 2 indices: 10→0, 11→1, …, 15→5, 16→6, 17→7
    expect(results[0]).toEqual({
      title: "Page2 Result5",
      url: "https://example.com/p2/5",
      snippet: "Snippet p2-5",
    });
    expect(results[1]).toEqual({
      title: "Page2 Result6",
      url: "https://example.com/p2/6",
      snippet: "Snippet p2-6",
    });
    expect(results[2]).toEqual({
      title: "Page2 Result7",
      url: "https://example.com/p2/7",
      snippet: "Snippet p2-7",
    });
  });

  it("passes the AbortSignal through to fetchPage", async () => {
    const controller = new AbortController();
    const signal = controller.signal;

    await cache.getSlice(0, 5, signal);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith("test query", 1, signal);
  });

  it("fetches all 5 pages for a large request spanning 50 results", async () => {
    const results = await cache.getSlice(0, 50);

    expect(fetchPage).toHaveBeenCalledTimes(5);
    for (let p = 1; p <= 5; p++) {
      expect(fetchPage).toHaveBeenCalledWith("test query", p, undefined);
    }

    expect(results).toHaveLength(50);
    // Verify ordering: first 10 from page 1, next 10 from page 2, etc.
    for (let p = 0; p < 5; p++) {
      for (let i = 0; i < 10; i++) {
        const idx = p * 10 + i;
        expect(results[idx]).toEqual({
          title: `Page${p + 1} Result${i}`,
          url: `https://example.com/p${p + 1}/${i}`,
          snippet: `Snippet p${p + 1}-${i}`,
        });
      }
    }
  });
});

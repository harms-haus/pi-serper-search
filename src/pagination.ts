import type { SerperOrganicResult } from "./serper-client.js";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const RESULTS_PER_PAGE = 10;

function normalizeResult(r: SerperOrganicResult): SearchResult {
  return { title: r.title, url: r.link, snippet: r.snippet };
}

/**
 * PageCache maps a virtual offset-based view onto Serper's page-based API.
 * A fresh instance should be created per tool invocation (per query).
 * Pages are fetched on demand and cached within the instance.
 */
export class PageCache {
  private readonly pages = new Map<number, SearchResult[]>();

  constructor(
    private readonly fetchPage: (
      query: string,
      page: number,
      signal?: AbortSignal,
    ) => Promise<SerperOrganicResult[]>,
    private readonly query: string,
  ) {}

  /**
   * Get a slice of results starting at `start` (0-based offset) with `count` items.
   * Fetches Serper pages on demand as needed.
   */
  async getSlice(start: number, count: number, signal?: AbortSignal): Promise<SearchResult[]> {
    const safeStart = Math.max(0, start);
    const safeCount = Math.max(1, count);

    const pageStart = Math.floor(safeStart / RESULTS_PER_PAGE) + 1;
    const pageEnd = Math.floor((safeStart + safeCount - 1) / RESULTS_PER_PAGE) + 1;

    // Fetch all uncached pages in parallel
    const pagesToFetch: number[] = [];
    for (let p = pageStart; p <= pageEnd; p++) {
      if (!this.pages.has(p)) {
        pagesToFetch.push(p);
      }
    }
    await Promise.all(
      pagesToFetch.map(async (p) => {
        const raw = await this.fetchPage(this.query, p, signal);
        this.pages.set(p, raw.map(normalizeResult));
      }),
    );

    // Extract results directly from relevant cached pages
    const result: SearchResult[] = [];
    for (let p = pageStart; p <= pageEnd; p++) {
      const pageResults = this.pages.get(p);
      if (!pageResults) continue;
      const pageOffset = (p - 1) * RESULTS_PER_PAGE;
      const localStart = Math.max(safeStart - pageOffset, 0);
      const localEnd = Math.min(safeStart + safeCount - pageOffset, RESULTS_PER_PAGE);
      for (let i = localStart; i < localEnd; i++) {
        const item = pageResults[i];
        if (item !== undefined) {
          result.push(item);
        }
      }
    }
    return result;
  }
}

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createWebSearchTool } from "../web-search-tool.js";

const makeOrganicResults = (page: number) =>
  Array.from({ length: 10 }, (_, i) => ({
    title: `Page${page} Result${i}`,
    link: `https://example.com/p${page}/${i}`,
    snippet: `Snippet p${page}-${i}`,
  }));

describe("createWebSearchTool", () => {
  let savedApiKey: string | undefined;

  beforeEach(() => {
    savedApiKey = process.env.SERPER_API_KEY;
    process.env.SERPER_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (savedApiKey === undefined) {
      delete process.env.SERPER_API_KEY;
    } else {
      process.env.SERPER_API_KEY = savedApiKey;
    }
  });

  it("returns correct tool metadata", () => {
    const tool = createWebSearchTool();

    expect(tool.name).toBe("web_search");
    expect(tool.label).toBe("Web Search");
    expect(tool.description).toContain("Serper");
    expect(tool.description.length).toBeGreaterThan(0);

    expect(tool.promptSnippet).toBeTruthy();
    expect(typeof tool.promptSnippet).toBe("string");

    expect(tool.promptGuidelines).toHaveLength(3);
    expect(tool.promptGuidelines).toEqual([
      expect.any(String),
      expect.any(String),
      expect.any(String),
    ]);

    expect(tool.parameters).toBeDefined();
    const props = tool.parameters.properties as Record<string, unknown>;
    expect(props).toHaveProperty("q");
    expect(props).toHaveProperty("results");
    expect(props).toHaveProperty("start");
  });

  it("execute returns formatted results with defaults", async () => {
    const tool = createWebSearchTool();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ organic: makeOrganicResults(1) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await tool.execute("", { q: "test query" }, undefined, undefined, undefined);

    expect(result.content[0]!.type).toBe("text");
    expect((result.content[0]! as { type: "text"; text: string }).text).toMatch(/^1\.\s/);
    expect(result.details.query).toBe("test query");
    expect(result.details.resultCount).toBe(10);
    expect(result.details.truncated).toBe(false);
    expect(result.details.offset).toBe(0);
  });

  it("execute handles pagination with start and results params", async () => {
    const tool = createWebSearchTool();

    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const page = body.page ?? 1;
        return new Response(JSON.stringify({ organic: makeOrganicResults(page) }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    // start=10 means offset 10, which is page 2 in Serper (1-based).
    // results=5 means we want 5 results.
    // PageCache: pageStart = floor(10/10)+1 = 2, pageEnd = floor((10+5-1)/10)+1 = 2.
    // So only page 2 is fetched.
    const result = await tool.execute(
      "",
      { q: "test", results: 5, start: 10 },
      undefined,
      undefined,
      undefined,
    );

    expect(result.details.offset).toBe(10);

    // Extract the numbered items from the text output
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const numberedLines = text.split("\n").filter((line: string) => /^\d+\.\s/.test(line));
    expect(numberedLines).toHaveLength(5);

    // Verify page-2 results are returned (titles contain "Page2")
    expect(text).toContain("Page2 Result0");
    expect(text).not.toContain("Page1 Result0");
  });

  it("execute throws when SERPER_API_KEY is missing", async () => {
    const tool = createWebSearchTool();

    delete process.env.SERPER_API_KEY;

    await expect(tool.execute("", { q: "test" }, undefined, undefined, undefined)).rejects.toThrow(
      "SERPER_API_KEY",
    );
  });

  it("passes AbortSignal through to fetch", async () => {
    const tool = createWebSearchTool();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ organic: makeOrganicResults(1) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const controller = new AbortController();
    const signal = controller.signal;

    await tool.execute("", { q: "signal test" }, signal, undefined, undefined);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const callInit = fetchSpy.mock.calls[0]![1] as RequestInit | undefined;
    expect(callInit?.signal).toBe(signal);
  });
});

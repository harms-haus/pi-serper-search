import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchSerperPage } from "../serper-client.js";

describe("fetchSerperPage", () => {
  const originalApiKey = process.env.SERPER_API_KEY;

  beforeEach(() => {
    process.env.SERPER_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalApiKey !== undefined) {
      process.env.SERPER_API_KEY = originalApiKey;
    } else {
      delete process.env.SERPER_API_KEY;
    }
  });

  it("throws if SERPER_API_KEY is not set", async () => {
    delete process.env.SERPER_API_KEY;

    await expect(fetchSerperPage("test", 1)).rejects.toThrow("SERPER_API_KEY");
  });

  it("returns mapped organic results on successful fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          organic: [{ title: "T", link: "https://example.com", snippet: "S" }],
        }),
        { status: 200 },
      ),
    );

    const results = await fetchSerperPage("test", 1);

    expect(results).toEqual([{ title: "T", link: "https://example.com", snippet: "S" }]);

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://google.serper.dev/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-API-KEY": "test-key" }),
        body: JSON.stringify({ q: "test", num: 10, page: 1 }),
      }),
    );
  });

  it("throws on API error response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Unauthorized", { status: 401 }));

    await expect(fetchSerperPage("test", 1)).rejects.toThrow("Serper API returned HTTP 401");
  });

  it("returns empty array when organic is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ organic: [] }), { status: 200 }),
    );

    const results = await fetchSerperPage("test", 1);

    expect(results).toEqual([]);
  });

  it("returns empty array when organic field is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const results = await fetchSerperPage("test", 1);

    expect(results).toEqual([]);
  });

  it("maps null fields to empty strings", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ organic: [{ title: null, link: null, snippet: null }] }), {
        status: 200,
      }),
    );

    const results = await fetchSerperPage("test", 1);

    expect(results).toEqual([{ title: "", link: "", snippet: "" }]);
  });
});

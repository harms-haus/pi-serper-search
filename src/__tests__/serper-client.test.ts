import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchSerperPage } from "../serper-client.js";

describe("fetchSerperPage", () => {
  const originalApiKey = process.env.SERPER_API_KEY;

  beforeEach(() => {
    process.env.SERPER_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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

  it("throws on invalid JSON response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(fetchSerperPage("test", 1)).rejects.toThrow("Serper API returned invalid JSON");
  });

  it("filters out null entries from organic array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          organic: [null, { title: "T", link: "https://example.com", snippet: "S" }, undefined],
        }),
        { status: 200 },
      ),
    );

    const results = await fetchSerperPage("test", 1);

    expect(results).toEqual([{ title: "T", link: "https://example.com", snippet: "S" }]);
  });

  it("retries on HTTP 429 and returns results", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ organic: [{ title: "R", link: "U", snippet: "S" }] }), {
          status: 200,
        }),
      );

    const promise = fetchSerperPage("test", 1);
    await vi.advanceTimersByTimeAsync(2000);
    const results = await promise;

    expect(results).toEqual([{ title: "R", link: "U", snippet: "S" }]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("retries on HTTP 503 and returns results", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("service unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ organic: [{ title: "R", link: "U", snippet: "S" }] }), {
          status: 200,
        }),
      );

    const promise = fetchSerperPage("test", 1);
    await vi.advanceTimersByTimeAsync(2000);
    const results = await promise;

    expect(results).toEqual([{ title: "R", link: "U", snippet: "S" }]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry on HTTP 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Unauthorized", { status: 401 }));

    await expect(fetchSerperPage("test", 1)).rejects.toThrow("Serper API returned HTTP 401");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("throws when retry also fails with 503", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("service unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("still down", { status: 503 }));

    const promise = fetchSerperPage("test", 1);
    const expectation = expect(promise).rejects.toThrow("Serper API returned HTTP 503");
    await vi.advanceTimersByTimeAsync(2000);
    await expectation;
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});

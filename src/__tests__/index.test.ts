import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import piExtension from "../index.js";
import { createWebSearchTool } from "../web-search-tool.js";

describe("index.ts extension entry point", () => {
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

  it("calls registerTool with the web_search tool", () => {
    const registerTool = vi.fn();
    const pi = { registerTool } as unknown as ExtensionAPI;
    piExtension(pi);
    expect(registerTool).toHaveBeenCalledOnce();
    const tool = registerTool.mock.calls[0]![0];
    expect(tool.name).toBe("web_search");
    const expected = createWebSearchTool();
    expect(tool.name).toBe(expected.name);
    expect(tool.label).toBe(expected.label);
    expect(tool.description).toBe(expected.description);
    expect(tool.promptSnippet).toBe(expected.promptSnippet);
    expect(tool.promptGuidelines).toEqual(expected.promptGuidelines);
    expect(tool.parameters).toEqual(expected.parameters);
  });
});

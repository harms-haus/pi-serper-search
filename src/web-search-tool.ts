import { Type } from "typebox";
import type { Static } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { PageCache } from "./pagination.js";
import { fetchSerperPage } from "./serper-client.js";
import { formatResults } from "./format-results.js";

const DESCRIPTION =
  "Search the web using Google via the Serper API. Returns a numbered list of results with title, URL, and snippet. Supports pagination via the 'start' (0-based offset) and 'results' (count) parameters. Results are fetched in pages of 10 on demand and cached within a single tool call.";

const PROMPT_GUIDELINES = [
  "Use web_search when you need to find information online, look up documentation, or verify facts.",
  "Use the 'results' parameter to control how many results to return (default 10, max 50).",
  "Use the 'start' parameter for pagination to get results beyond the first page (0-based offset).",
];

const PARAMETERS = Type.Object({
  q: Type.String({ description: "Search query string" }),
  results: Type.Optional(
    Type.Number({
      description: "Number of results to return (default 10)",
      minimum: 1,
      maximum: 50,
      default: 10,
    }),
  ),
  start: Type.Optional(
    Type.Number({
      description: "0-based offset into results (default 0)",
      minimum: 0,
      maximum: 90,
      default: 0,
    }),
  ),
});

type ToolParams = Static<typeof PARAMETERS>;
type SearchDetails = { query: string; resultCount: number; truncated: boolean; offset: number };

/**
 * Create the web_search tool definition for pi.
 */
export function createWebSearchTool(): ToolDefinition<typeof PARAMETERS, SearchDetails> {
  return defineTool({
    name: "web_search",
    label: "Web Search",
    description: DESCRIPTION,
    promptSnippet: "Search the web using Google",
    promptGuidelines: PROMPT_GUIDELINES,
    parameters: PARAMETERS,

    async execute(
      _toolCallId: string,
      params: ToolParams,
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<SearchDetails> | undefined,
      _ctx: ExtensionContext,
    ): Promise<AgentToolResult<SearchDetails>> {
      const { q, results = 10, start = 0 } = params;
      const cache = new PageCache(fetchSerperPage, q);
      const slice = await cache.getSlice(start, results, signal);
      const formatted = formatResults(slice, q);

      return {
        content: [{ type: "text" as const, text: formatted.text }],
        details: {
          query: q,
          resultCount: slice.length,
          truncated: formatted.truncated,
          offset: start,
        },
      };
    },
  });
}

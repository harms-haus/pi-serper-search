/**
 * pi-serper-search extension
 *
 * Provides the web_search tool for pi using the Serper Google Search API.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createWebSearchTool } from "./web-search-tool.js";

export default function (pi: ExtensionAPI): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- registerTool generic type mismatch at extension boundary
  pi.registerTool(createWebSearchTool() as any);
}

/**
 * pi-serper-search extension
 *
 * Provides the web_search tool for pi using the Serper Google Search API.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createWebSearchTool } from "./web-search-tool.js";

export default function (pi: ExtensionAPI): void {
  pi.registerTool(createWebSearchTool());
}

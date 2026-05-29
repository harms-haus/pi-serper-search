import type { SearchResult } from "./pagination.js";

export const MAX_OUTPUT_BYTES = 50 * 1024;
export const MAX_OUTPUT_LINES = 2000;

/**
 * Escape markdown special characters in a string to prevent formatting corruption.
 */
function escapeMarkdown(text: string): string {
  return text.replace(/([*[\]_#|`~])/g, "\\$1");
}

/**
 * Format search results as a markdown numbered list with truncation.
 */
export function formatResults(
  results: SearchResult[],
  query: string,
): { text: string; truncated: boolean } {
  if (results.length === 0) {
    return { text: `No results found for query: "${escapeMarkdown(query)}".`, truncated: false };
  }

  const lines: string[] = [];
  let byteCount = 0;
  let truncated = false;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r === undefined) continue;

    const candidateLines = [
      `${String(i + 1)}. **${escapeMarkdown(r.title)}**`,
      `   ${escapeMarkdown(r.url)}`,
      `   ${escapeMarkdown(r.snippet)}`,
    ];

    for (const line of candidateLines) {
      // +1 for the "\n" separator (or 0 for the very first line)
      const separatorBytes = lines.length > 0 ? 1 : 0;
      const lineBytes = Buffer.byteLength(line, "utf8");

      if (
        lines.length >= MAX_OUTPUT_LINES ||
        byteCount + separatorBytes + lineBytes > MAX_OUTPUT_BYTES
      ) {
        truncated = true;
        break;
      }

      byteCount += separatorBytes + lineBytes;
      lines.push(line);
    }

    if (truncated) break;
  }

  let text = lines.join("\n");

  if (truncated) {
    text += "\n\n[Results truncated at 50KB/2000 lines]";
  }

  return { text, truncated };
}

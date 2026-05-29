import type { SearchResult } from "./pagination.js";

/** @internal */
export const MAX_OUTPUT_BYTES = 50 * 1024;

/** @internal */
export const MAX_OUTPUT_LINES = 2000;

const MARKDOWN_SPECIAL = /([*[\]_#|`~])/g;

/**
 * Escape markdown special characters in a string to prevent formatting corruption.
 *
 * `lastIndex` reset is not needed: `String.prototype.replace` always searches
 * from the beginning of the string regardless of `lastIndex`.
 */
function escapeMarkdown(text: string): string {
  return text.replace(MARKDOWN_SPECIAL, "\\$1");
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
    text += `\n\n[Results truncated at ${String(MAX_OUTPUT_BYTES / 1024)}KB/${String(MAX_OUTPUT_LINES)} lines]`;
  }

  return { text, truncated };
}

export interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
}

const SERPER_API_URL = "https://google.serper.dev/search";

/**
 * Fetch a single page of results from the Serper API.
 * @param query - Search query string
 * @param page - 1-based page number
 * @param signal - Optional AbortSignal for cancellation
 * @returns Array of organic search results
 */
export async function fetchSerperPage(
  query: string,
  page: number,
  signal?: AbortSignal,
): Promise<SerperOrganicResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SERPER_API_KEY environment variable is not set. Please set it to your Serper API key (https://serper.dev).",
    );
  }

  const res = await fetch(SERPER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ q: query, num: 10, page }),
    signal,
  });

  if (!res.ok) {
    await res.text(); // consume the body
    throw new Error(`Serper API returned HTTP ${String(res.status)}. Check logs for details.`);
  }

  const data: { organic?: Array<{ title?: string; link?: string; snippet?: string }> } =
    (await res.json()) as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
  const organic = data.organic ?? [];

  return organic.map((item) => ({
    title: item.title ?? "",
    link: item.link ?? "",
    snippet: item.snippet ?? "",
  }));
}

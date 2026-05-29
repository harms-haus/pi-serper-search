import { RESULTS_PER_PAGE } from "./constants.js";

export interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
}

const SERPER_API_URL = "https://google.serper.dev/search";

type SerperOrganicEntry = { title?: string; link?: string; snippet?: string };

type SerperRawResponse = {
  organic?: Array<SerperOrganicEntry | null | undefined>;
};

function buildSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(30_000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function abortAwareDelay(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal?.aborted) {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  const combinedSignal = buildSignal(signal);
  const res = await fetch(url, { ...init, signal: combinedSignal });
  if (res.status === 429 || res.status === 503) {
    await res.body?.cancel().catch(() => {});
    const retryAfter = res.headers.get("Retry-After");
    const delay = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : Math.floor(Math.random() * 1000) + 1000;
    await abortAwareDelay(delay, signal);
    const retrySignal = buildSignal(signal);
    return fetch(url, { ...init, signal: retrySignal });
  }
  return res;
}

function parseSerperResponse(data: unknown): SerperOrganicResult[] {
  const organic = (data as SerperRawResponse).organic ?? [];
  const safeOrganic = organic.filter((item): item is SerperOrganicEntry => item != null);
  return safeOrganic.map((item) => ({
    title: item.title ?? "",
    link: item.link ?? "",
    snippet: item.snippet ?? "",
  }));
}

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

  const res = await fetchWithRetry(
    SERPER_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({ q: query, num: RESULTS_PER_PAGE, page }),
    },
    signal,
  );

  if (!res.ok) {
    const body = await res.text();
    console.error("Serper API error response:", body);
    throw new Error(`Serper API returned HTTP ${String(res.status)}`);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error("Serper API returned invalid JSON");
  }

  return parseSerperResponse(data);
}

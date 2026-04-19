/** Heuristic for RN `fetch` / connection failures (not HTTP 4xx/5xx from server). */
export function isLikelyNetworkFailure(err: unknown): boolean {
    const m = err instanceof Error ? err.message : String(err);
    return /network request failed|failed to fetch|network error|could not connect|connection refused|timed out|ECONNREFUSED|ENOTFOUND|ENETUNREACH/i.test(
        m,
    );
}

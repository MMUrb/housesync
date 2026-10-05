// Runs async work a few items at a time. Pure (no server-only) so it can be
// unit tested.

export type PoolOutcome<R> = {
  /** Results in input order; undefined where an item never started or threw. */
  results: (R | undefined)[];
  /** How many items were started. The rest were skipped by an error or the deadline. */
  started: number;
  /** The first error thrown, if any. No new item starts after it. */
  error: unknown;
  /** True when the deadline, not an error, stopped new items from starting. */
  outOfTime: boolean;
};

/**
 * At most `concurrency` items in flight, taken in input order. The first error
 * stops new starts (a refusal that hit one item, such as an auth or agreement
 * failure, would hit them all), and so does the deadline, so the caller always
 * gets control back with time to save what finished.
 */
export async function runPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  opts: { deadline?: number; now?: () => number } = {},
): Promise<PoolOutcome<R>> {
  const now = opts.now ?? Date.now;
  const results: (R | undefined)[] = new Array(items.length).fill(undefined);
  let next = 0;
  let failed = false;
  let error: unknown = undefined;
  let outOfTime = false;

  const worker = async () => {
    while (next < items.length && !failed) {
      if (opts.deadline !== undefined && now() >= opts.deadline) {
        outOfTime = true;
        return;
      }
      const i = next++;
      try {
        results[i] = await fn(items[i]);
      } catch (e) {
        if (!failed) {
          failed = true;
          error = e;
        }
      }
    }
  };

  const workers = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return { results, started: next, error, outOfTime };
}

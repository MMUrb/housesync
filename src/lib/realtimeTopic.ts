/**
 * A realtime channel topic unique to one mount of one component.
 *
 * supabase.channel(topic) hands back the EXISTING channel object when a
 * channel with that topic is still registered, and RealtimeChannel.subscribe()
 * is a silent no-op unless that channel is closed. A channel only leaves the
 * registry once the server acknowledges its leave, which is a network round
 * trip after unmount. So a component that remounts inside that window (React
 * swapping the chat between its live thread and a search window in one commit,
 * a quick tab round trip on a slow connection, StrictMode in development)
 * inherited a channel in the "leaving" state, attached its handler to it, and
 * never heard another event until the next full leave and return.
 *
 * A per-mount suffix means every mount joins its own channel. Filters are per
 * channel, so nothing else changes.
 */
export function uniqueTopic(base: string): string {
  return `${base}:${Math.random().toString(36).slice(2, 10)}`;
}

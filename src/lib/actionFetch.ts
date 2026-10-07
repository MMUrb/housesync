"use client";

import { describeAction, watchSaves } from "@/lib/saveWatch";
import { browserWatchEnv } from "@/lib/watchEnv";
import { reportClientError } from "@/components/ErrorReporter";

/**
 * fetch for things a person does through our own API routes (deleting their
 * account, turning on notifications, sending a reminder, sending the
 * verify-email link). Those never touch the database client, so its save watch
 * can't see them fail; this reports them the same way. Use it only for the
 * routes listed in saveWatch's ACTIONS; anything else passes straight through.
 */
export const actionFetch: typeof fetch = watchSaves(
  // Called through a closure: a bare window.fetch reference invoked without
  // its `this` throws "Illegal invocation" in Chrome.
  (input, init) => fetch(input, init),
  (message) => reportClientError(message),
  browserWatchEnv(),
  { describe: describeAction, kind: "action" },
);

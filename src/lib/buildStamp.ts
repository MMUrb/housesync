// The app-build stamp on client error reports. Pure, so it can be tested.
//
// A report says which deploy the device was running, and since 05/10/2026
// the log-error route adds the deploy that received it: "build:<device>@<server>".
// Comparing those two is what separates a stale cached copy from the current
// code. The first version compared the device with whatever is live TODAY, so
// every error from before a deploy was wrongly labelled as stale.

/** The digest a client report is stored with. */
export function stampBuild(deviceBuild: string, serverBuild: string): string {
  return `build:${deviceBuild.slice(0, 12)}@${serverBuild.slice(0, 12)}`;
}

/** The "App build" line for an error row, or null when its digest isn't a build stamp. */
export function describeBuild(digest: string | null, liveBuild: string): string | null {
  if (!digest?.startsWith("build:")) return null;
  const [device, server] = digest.slice("build:".length).split("@");
  if (!device) return null;
  if (server) {
    if (device === server || device === "dev" || server === "dev") {
      return `${device} · the live build at the time`;
    }
    return `${device} · not the live build at the time (${server}): usually a stale cached copy`;
  }
  // Stamped before the receiving build was recorded: say only what's known.
  return device === liveBuild || liveBuild === "dev"
    ? `${device} · the live build`
    : `${device} · live now: ${liveBuild}`;
}

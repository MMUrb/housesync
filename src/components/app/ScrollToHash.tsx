"use client";

import { useEffect } from "react";

/**
 * Bring the row named in the URL hash into view on arrival, and mark it.
 *
 * Next's own hash scrolling never reaches these rows. Its scroll handler sits
 * outside the route's loading boundary, so it runs while the skeleton is still
 * on screen, finds no element with that id, scrolls the skeleton instead and
 * disarms itself. The real rows arrive afterwards with nothing left to move
 * them, which left every bill and notice hit landing at the top of the page.
 * Rendering this alongside the rows puts the scroll after they exist.
 *
 * The highlight is a plain unlayered class (globals.css) rather than Tailwind
 * utilities: .dark .card is unlayered and beats any utility in dark mode, so
 * the fill vanished on bill cards. hs-target stays behind so the fade-out
 * still animates once hs-hit is removed.
 */
export function ScrollToHash({ prefix }: { prefix: string }) {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id.startsWith(`${prefix}-`)) return;
    const el = document.getElementById(id);
    if (!el) return; // deleted since, or past the page's own row limit

    el.scrollIntoView({ block: "center", behavior: "auto" });
    el.classList.add("hs-target", "hs-hit");
    const fade = setTimeout(() => el.classList.remove("hs-hit"), 2500);

    // Keeping the existing history state is what makes Next's patched
    // replaceState hand straight over to the native one: passing null would
    // dispatch a router restore and could cancel the user's next tap.
    try {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    } catch {
      /* a browser that refuses the write just keeps the hash */
    }

    return () => clearTimeout(fade);
  }, [prefix]);

  return null;
}

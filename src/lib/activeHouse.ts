"use client";

import { ACTIVE_HOUSE_COOKIE } from "@/lib/constants";

/** Remember which house the user is currently viewing (client-side cookie). */
export function setActiveHouse(houseId: string) {
  document.cookie = `${ACTIVE_HOUSE_COOKIE}=${houseId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** Forget the active house (e.g. after leaving or deleting it). */
export function clearActiveHouse() {
  document.cookie = `${ACTIVE_HOUSE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

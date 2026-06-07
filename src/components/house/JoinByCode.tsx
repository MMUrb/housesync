"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Extract an invite code from a pasted link or raw code. */
function parseCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  } catch {
    return trimmed.split("/").filter(Boolean).pop() ?? trimmed;
  }
}

export function JoinByCode() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const code = parseCode(value);
    if (code) router.push(`/house/join/${code}`);
  }

  return (
    <form onSubmit={go} className="flex items-center gap-2">
      <input
        className="input"
        placeholder="Paste your invite link or code"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="btn-secondary shrink-0">
        Join
      </button>
    </form>
  );
}

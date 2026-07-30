"use client";

import { createContext, useContext, useEffect, useId, useState } from "react";
import Link from "next/link";
import { IconChevronDown } from "@/components/icons";

// WebViews ignore <a download>, so in the native apps download rows fetch the
// file with the user's session, write it to the app's cache and hand it to the
// system share sheet (save to Files / Drive / AirDrop...). The website keeps
// the plain anchor download.
async function nativeDownload(href: string): Promise<void> {
  const res = await fetch(href, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
  const disposition = res.headers.get("content-disposition") ?? "";
  const filename =
    /filename="([^"]+)"/.exec(disposition)?.[1] ??
    href.split("?")[0].split("/").pop() ??
    "housesync-export";
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });
  const { Share } = await import("@capacitor/share");
  try {
    await Share.share({ title: filename, files: [uri] });
  } catch {
    /* user closed the share sheet — that's fine */
  }
}

// The settings hub's building blocks: a card of single-line rows where each row
// either navigates (RowLink) or expands an inline panel (RowDisclosure). One
// panel per group is open at a time so the page never becomes a wall of forms.

const GroupCtx = createContext<{
  openId: string | null;
  setOpenId: (id: string | null) => void;
} | null>(null);

export function RowGroup({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <GroupCtx.Provider value={{ openId, setOpenId }}>
      <div className="card divide-y divide-slate-100 overflow-hidden">{children}</div>
    </GroupCtx.Provider>
  );
}

/** Section heading above a RowGroup: small caps title + optional scope pill. */
export function GroupHeading({ title, scope }: { title: string; scope?: "personal" | "house" }) {
  return (
    <div className="flex items-center justify-between px-1 pb-2 pt-6">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{title}</h2>
      {scope === "personal" && (
        <span className="chip bg-slate-100 text-[10px] text-slate-500">All houses</span>
      )}
      {scope === "house" && (
        <span className="chip bg-brand-50 text-[10px] text-brand-700">This house only</span>
      )}
    </div>
  );
}

/** Squircle icon holder; house-scoped rows get the brand tint. */
export function RowIcon({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "house" | "star" }) {
  const bg =
    tone === "house"
      ? "bg-brand-50 text-brand-600"
      : tone === "star"
        ? "bg-amber-50 text-amber-600"
        : "bg-slate-100 text-slate-500";
  return <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] ${bg}`}>{children}</span>;
}

function RowShell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[54px] items-center gap-3 px-4">{children}</div>;
}

export function RowLink({
  href,
  icon,
  label,
  value,
  chip,
  external,
  download,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value?: string;
  chip?: React.ReactNode;
  external?: boolean;
  download?: boolean;
}) {
  const [isNative, setIsNative] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  useEffect(() => {
    if (!download) return;
    void import("@capacitor/core").then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) setIsNative(true);
    });
  }, [download]);

  async function onDownloadClick(e: React.MouseEvent) {
    if (!isNative || state === "busy") {
      if (state === "busy") e.preventDefault();
      return; // website: let the plain <a download> do its thing
    }
    e.preventDefault();
    setState("busy");
    try {
      await nativeDownload(href);
      setState("idle");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const shownValue =
    state === "busy" ? "Preparing…" : state === "error" ? "Couldn't download" : value;

  const inner = (
    <>
      {icon}
      {/* The label never truncates; when space runs out the VALUE gives way. */}
      <span className="shrink-0 text-sm font-semibold text-slate-800">{label}</span>
      <span className="ml-auto flex min-w-0 items-center gap-2">
        {shownValue && (
          <span
            className={`min-w-0 max-w-[180px] truncate text-xs ${
              state === "error" ? "text-red-500" : "text-slate-400"
            }`}
          >
            {shownValue}
          </span>
        )}
        {chip && <span className="shrink-0">{chip}</span>}
        <IconChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-slate-300" />
      </span>
    </>
  );
  const cls =
    "flex min-h-[54px] items-center gap-3 px-4 text-left transition touch-manipulation hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-white/[0.04] dark:active:bg-white/[0.07]";
  if (external || download || href.startsWith("mailto:")) {
    return (
      <a
        href={href}
        className={cls}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...(download ? { download: true, onClick: onDownloadClick } : {})}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

export function RowDisclosure({
  icon,
  label,
  value,
  chip,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  /** Right-hand summary; hidden while the panel is open. */
  value?: React.ReactNode;
  chip?: React.ReactNode;
  children: React.ReactNode;
}) {
  const id = useId();
  const ctx = useContext(GroupCtx);
  const [soloOpen, setSoloOpen] = useState(false);
  const open = ctx ? ctx.openId === id : soloOpen;

  function toggle() {
    if (ctx) ctx.setOpenId(open ? null : id);
    else setSoloOpen((o) => !o);
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex min-h-[54px] w-full items-center gap-3 px-4 text-left transition touch-manipulation hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-white/[0.04] dark:active:bg-white/[0.07]"
      >
        {icon}
        {/* The label never truncates; when space runs out the VALUE gives way. */}
        <span
          className={`shrink-0 text-sm font-semibold ${open ? "text-brand-600" : "text-slate-800"}`}
        >
          {label}
        </span>
        <span className="ml-auto flex min-w-0 items-center gap-2">
          {!open && value && (
            <span className="min-w-0 max-w-[180px] truncate text-xs text-slate-400">{value}</span>
          )}
          {!open && chip && <span className="shrink-0">{chip}</span>}
          <IconChevronDown
            className={`h-4 w-4 shrink-0 text-slate-300 transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </span>
      </button>
      {/* hidden (not unmounted) so a half-filled form survives opening another row */}
      <div hidden={!open} className="bg-slate-50 px-4 pb-5 pt-3 dark:bg-white/[0.03]">
        {children}
      </div>
    </div>
  );
}

/** A plain (non-interactive) row, e.g. "Follow us" with the social icons. */
export function RowStatic({
  icon,
  label,
  right,
}: {
  icon?: React.ReactNode;
  label: string;
  right: React.ReactNode;
}) {
  return (
    <RowShell>
      {icon}
      <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{label}</span>
      <span className="ml-auto flex shrink-0 items-center">{right}</span>
    </RowShell>
  );
}

// --- Row glyphs (16px stroke icons matching the app's icon style) -----------

function G({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function GlyphCard() {
  return (
    <G>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
    </G>
  );
}
export function GlyphBell() {
  return (
    <G>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.2 7.5-2.2 7.5h16.4S18 14.5 18 8.5" />
      <path d="M10.4 20a2 2 0 0 0 3.2 0" />
    </G>
  );
}
export function GlyphMoon() {
  return (
    <G>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </G>
  );
}
export function GlyphMail() {
  return (
    <G>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </G>
  );
}
export function GlyphHouse() {
  return (
    <G>
      <path d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
    </G>
  );
}
export function GlyphTag() {
  return (
    <G>
      <path d="M3 12.5V4.5h8l9.5 9.5-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.4" fill="currentColor" stroke="none" />
    </G>
  );
}
export function GlyphUsers() {
  return (
    <G>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19c.5-3.2 3-5 6.2-5s5.7 1.8 6.2 5M17 5.5a3 3 0 0 1 0 5.6M19 14.2c1.6.8 2.5 2.3 2.7 4.3" />
    </G>
  );
}
export function GlyphWarn() {
  return (
    <G>
      <path d="M12 8.5v4.5M12 16.4v.2" />
      <path d="M10.3 3.9 2.6 17.4A1.9 1.9 0 0 0 4.3 20.3h15.4a1.9 1.9 0 0 0 1.7-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0z" />
    </G>
  );
}
export function GlyphDownload() {
  return (
    <G>
      <path d="M12 3.5v11m0 0 4-4m-4 4-4-4M4 17v2.5h16V17" />
    </G>
  );
}
export function GlyphDoc() {
  return (
    <G>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </G>
  );
}
export function GlyphHelp() {
  return (
    <G>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.6v.4" />
      <circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none" />
    </G>
  );
}

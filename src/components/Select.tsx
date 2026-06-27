"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown, IconCheck } from "@/components/icons";

export type SelectOption = { value: string; label: string };

/**
 * Themed dropdown that replaces native <select> so the open list matches the
 * app's other custom dropdowns (house switcher, spending scope) in both light
 * and dark mode — native option lists are OS-drawn and can't be themed. Keeps
 * keyboard support (arrows / Home / End / Enter / Esc) so it's not a
 * regression over the native control.
 */
export function Select({
  value,
  onChange,
  options,
  id,
  ariaLabel,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIdx = options.findIndex((o) => o.value === value);
  const selected = selectedIdx >= 0 ? options[selectedIdx] : undefined;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Opening highlights the current selection; keep the highlight in view.
  useEffect(() => {
    if (open) setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    (listRef.current.children[activeIdx] as HTMLElement | undefined)?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIdx, open]);

  function choose(i: number) {
    const opt = options[i];
    if (opt) onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActiveIdx(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIdx(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(activeIdx);
        break;
    }
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder ?? ""}
        </span>
        <IconChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-50 mt-1.5 max-h-60 w-full overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-soft dark:border-white/10 dark:bg-[#15152b]"
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            const isActive = i === activeIdx;
            return (
              <li key={`${o.value}-${i}`} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => choose(i)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/[0.06] ${
                    isActive ? "bg-slate-50 dark:bg-white/[0.06]" : ""
                  } ${isSelected ? "font-medium" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate text-slate-800">{o.label}</span>
                  {isSelected && <IconCheck className="h-4 w-4 shrink-0 text-brand-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

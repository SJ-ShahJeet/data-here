"use client";
import { useEffect, useRef } from "react";
import type { PaletteEntry } from "@/lib/v2/logic";

interface PaletteProps {
  open: boolean;
  query: string;
  index: number;
  items: PaletteEntry[];
  onQuery: (q: string) => void;
  onHover: (i: number) => void;
  onRun: (entry: PaletteEntry) => void;
  onClose: () => void;
}

export function Palette({ open, query, index, items, onQuery, onHover, onRun, onClose }: PaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="mg-scrim" onClick={onClose} data-testid="mg-palette">
      <div className="mg-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="mg-palette__input"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Jump to a screen, run an action…"
          aria-label="Command palette"
        />
        <div className="mg-palette__list">
          {items.map((p, i) => (
            <div
              key={`${p.group}:${p.label}`}
              className={`mg-palette__item${i === index ? " mg-palette__item--on" : ""}`}
              onClick={() => onRun(p)}
              onMouseEnter={() => onHover(i)}
            >
              <div className="mg-palette__left">
                <span className="mg-palette__group">{p.group}</span>
                <span className="mg-palette__label">{p.label}</span>
              </div>
              <span className="mg-palette__hint">{p.hint}</span>
            </div>
          ))}
        </div>
        <div className="mg-palette__foot">
          <span>↑↓ navigate</span>
          <span>↵ run</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

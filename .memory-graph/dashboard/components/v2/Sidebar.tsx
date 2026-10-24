"use client";
import type { Screen } from "@/lib/v2/types";

export interface NavItem {
  id: Screen;
  label: string;
  badge: string;
}

interface SidebarProps {
  repo: string;
  daemon: string;
  screen: Screen;
  items: NavItem[];
  onGo: (screen: Screen) => void;
  onPalette: () => void;
}

export function Sidebar({ repo, daemon, screen, items, onGo, onPalette }: SidebarProps) {
  return (
    <aside className="mg-side">
      <div className="mg-side__brand mg-brand">
        <span className="mg-brand__dot" />
        <span className="mg-brand__name">Memory Graph</span>
      </div>

      <div className="mg-side__repo">
        <button type="button" className="mg-repo-btn">
          <span className="ellip">{repo}</span>
          <span className="mg-repo-btn__caret">▾</span>
        </button>
      </div>

      <nav className="mg-nav" aria-label="Screens">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`mg-nav__item${screen === item.id ? " mg-nav__item--on" : ""}`}
            onClick={() => onGo(item.id)}
            aria-current={screen === item.id ? "page" : undefined}
          >
            <span>{item.label}</span>
            <span className="mg-nav__badge">{item.badge}</span>
          </button>
        ))}
      </nav>

      <div className="mg-side__foot">
        <button type="button" className="mg-palette-btn" onClick={onPalette}>
          <span>Command palette</span>
          <span className="mg-kbd">⌘K</span>
        </button>
        <div className="mg-daemon">
          <span className="mg-dot" />
          {daemon}
        </div>
      </div>
    </aside>
  );
}

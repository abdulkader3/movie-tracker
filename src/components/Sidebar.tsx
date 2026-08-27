import type { ReactNode } from 'react';

interface SidebarProps {
  collapsed: boolean;
  query: string;
  activeKey: 'all' | 'movie' | 'tv' | 'settings' | null;
  onToggleCollapse(): void;
  onQueryChange(query: string): void;
  onSubmit(): void;
  onNavigate(key: 'all' | 'movie' | 'tv' | 'settings'): void;
}

type NavKey = Exclude<SidebarProps['activeKey'], null>;

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#7c6cff" />
      <path d="M9.5 7.5v9l7.5-4.5z" fill="#fff" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
    </svg>
  );
}

function TvIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 6V3l-2 2m2-2 2 2" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const NAV_ITEMS: { key: NavKey; label: string; icon: ReactNode }[] = [
  { key: 'all', label: 'All', icon: <FilmIcon /> },
  { key: 'movie', label: 'Movies', icon: <FilmIcon /> },
  { key: 'tv', label: 'TV Shows', icon: <TvIcon /> },
  { key: 'settings', label: 'Settings', icon: <SettingsIcon /> },
];

export function Sidebar({
  collapsed,
  query,
  activeKey,
  onToggleCollapse,
  onQueryChange,
  onSubmit,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-head">
        <div className="brand">
          <BrandMark />
          <span className="brand-name">Movie Tracker</span>
        </div>
        <button
          type="button"
          className="collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '\u00BB' : '\u00AB'}
        </button>
      </div>

      <div className="search-wrap">
        <input
          className="search-input"
          type="text"
          placeholder="Search TMDB…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSubmit();
            }
          }}
          spellCheck={false}
        />
        <button
          type="button"
          className="search-btn"
          onClick={onSubmit}
          title="Search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-item${activeKey === item.key ? ' active' : ''}`}
            onClick={() => onNavigate(item.key)}
            title={item.label}
          >
            {item.icon}
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <span className="nav-label">Local-first · SQLite</span>
      </div>
    </aside>
  );
}

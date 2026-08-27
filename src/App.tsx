import { useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { SyncIndicator } from './components/SyncIndicator';
import { DetailPage } from './pages/DetailPage';
import { LibraryPage } from './pages/LibraryPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { saveFromSearch } from './services/database/importer';
import type { MediaType } from './types/media';
import type { TmdbSearchHit } from './types/tmdb';
import { friendlyApiError } from './utils/errors';
import { useBackup } from './hooks/useBackup';

type ListView =
  | { name: 'library'; mediaType?: MediaType }
  | { name: 'detail'; mediaId: number }
  | { name: 'settings' };

interface Toast {
  kind: 'info' | 'error';
  text: string;
}

function useSmoothScroll() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let vel = 0;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = Math.abs(e.deltaY) > 1 ? e.deltaY : e.deltaY * 2;
      vel += dy * 0.22;
      if (!raf) tick();
    };

    const onMove = () => {
      vel *= 0.25;
    };

    function tick() {
      raf = 0;
      if (Math.abs(vel) < 0.4) {
        vel = 0;
        return;
      }
      el!.scrollTop += vel;
      vel *= 0.92;
      raf = requestAnimationFrame(tick);
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousemove', onMove);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [listView, setListView] = useState<ListView>({ name: 'library' });
  const [returnView, setReturnView] = useState<ListView>({ name: 'library' });
  const [savingTitle, setSavingTitle] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const mainRef = useSmoothScroll();
  const backup = useBackup();

  const searching = submittedQuery.trim().length >= 2;

  useEffect(() => {
    if (!toast || toast.kind === 'error') return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function navigateToList(view: ListView) {
    setQuery('');
    setSubmittedQuery('');
    setListView(view);
    if (view.name !== 'settings') setReturnView(view);
  }

  function handleSubmitSearch() {
    const trimmed = query.trim();
    if (trimmed.length >= 2) {
      setSubmittedQuery(trimmed);
    }
  }

  function openDetail(mediaId: number) {
    if (listView.name === 'library') setReturnView(listView);
    setQuery('');
    setSubmittedQuery('');
    setListView({ name: 'detail', mediaId });
  }

  async function handleSelectResult(hit: TmdbSearchHit) {
    if (savingTitle) return;
    setSavingTitle(hit.title ?? hit.name ?? 'Untitled');
    try {
      const mediaId = await saveFromSearch(hit);
      openDetail(mediaId);
    } catch (err) {
      console.error(err);
      setToast({ kind: 'error', text: friendlyApiError(err) });
    } finally {
      setSavingTitle(null);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={collapsed}
        query={query}
        activeKey={
          searching || listView.name === 'detail' || listView.name === 'settings'
            ? null
            : ((listView.mediaType ?? 'all') as 'all' | 'movie' | 'tv')
        }
        onToggleCollapse={() => setCollapsed((value) => !value)}
        onQueryChange={setQuery}
        onSubmit={handleSubmitSearch}
        onNavigate={(key) =>
          key === 'settings'
            ? navigateToList({ name: 'settings' })
            : navigateToList(
                key === 'all'
                  ? { name: 'library' }
                  : { name: 'library', mediaType: key === 'movie' ? 'movie' : 'tv' },
              )
        }
      />

      <main className="main" ref={mainRef}>
        <SyncIndicator syncStatus={backup.syncStatus} syncError={backup.syncError} />
        {searching ? (
          <SearchPage query={submittedQuery} savingTitle={savingTitle} onSelect={handleSelectResult} />
        ) : listView.name === 'detail' ? (
          <DetailPage
            key={listView.mediaId}
            mediaId={listView.mediaId}
            onBack={() => setListView(returnView)}
            onDeleted={() => setListView(returnView)}
          />
        ) : listView.name === 'settings' ? (
          <SettingsPage
            lastBackup={backup.lastBackup}
            cloudConnected={backup.cloudConnected}
            status={backup.status}
            error={backup.error}
            availableBackups={backup.availableBackups}
            progressMessage={backup.progressMessage}
            hasPassword={backup.hasPassword}
            onBackup={backup.runBackup}
            onRestore={backup.runRestore}
            onRefresh={backup.refreshBackups}
            onSaveAutoPassword={backup.saveAutoBackupPassword}
            onClearAutoPassword={backup.clearAutoBackupPassword}
          />
        ) : listView.name === 'library' ? (
          <LibraryPage mediaType={listView.mediaType} onOpen={openDetail} />
        ) : null}
      </main>

      {savingTitle && <div className="saving-bar">Saving “{savingTitle}”…</div>}

      {toast && (
        <button
          type="button"
          className={`toast ${toast.kind}`}
          role="status"
          title="Click to dismiss"
          onClick={() => setToast(null)}
        >
          {toast.text}
        </button>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { DetailPage } from './pages/DetailPage';
import { LibraryPage } from './pages/LibraryPage';
import { SearchPage } from './pages/SearchPage';
import { saveFromSearch } from './services/database/importer';
import type { MediaType } from './types/media';
import type { TmdbSearchHit } from './types/tmdb';
import { friendlyApiError } from './utils/errors';

type ListView =
  | { name: 'library'; mediaType?: MediaType }
  | { name: 'detail'; mediaId: number };

interface Toast {
  kind: 'info' | 'error';
  text: string;
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [listView, setListView] = useState<ListView>({ name: 'library' });
  const [returnView, setReturnView] = useState<ListView>({ name: 'library' });
  const [savingTitle, setSavingTitle] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

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
    setReturnView(view);
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
          searching || listView.name === 'detail'
            ? null
            : ((listView.mediaType ?? 'all') as 'all' | 'movie' | 'tv')
        }
        onToggleCollapse={() => setCollapsed((value) => !value)}
        onQueryChange={setQuery}
        onSubmit={handleSubmitSearch}
        onNavigate={(key) =>
          navigateToList(
            key === 'all'
              ? { name: 'library' }
              : { name: 'library', mediaType: key === 'movie' ? 'movie' : 'tv' },
          )
        }
      />

      <main className="main">
        {searching ? (
          <SearchPage query={submittedQuery} savingTitle={savingTitle} onSelect={handleSelectResult} />
        ) : listView.name === 'detail' ? (
          <DetailPage
            key={listView.mediaId}
            mediaId={listView.mediaId}
            onBack={() => setListView(returnView)}
            onDeleted={() => setListView(returnView)}
          />
        ) : (
          <LibraryPage mediaType={listView.mediaType} onOpen={openDetail} />
        )}
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

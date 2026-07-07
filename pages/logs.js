import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { getCached, setCached } from '../lib/pageCache';
import { SkeletonRunList } from '../components/Skeleton';
import TopBar from '../components/TopBar';

const CACHE_KEY = 'logs-list';
const POLL_MS = 6000;

export default function Logs() {
  const router = useRouter();
  const cached = getCached(CACHE_KEY);

  const [runs, setRuns] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [confirmRunId, setConfirmRunId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const pollRef = useRef(null);

  function loadRuns(silent) {
    if (!silent) setLoading(true);
    fetch('/api/log/list')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          if (!silent) setError(data.error);
          return;
        }
        const next = data.runs || [];
        setRuns(next);
        setCached(CACHE_KEY, next);
        setError(null);
      })
      .catch((err) => {
        if (!silent) setError(err.message);
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }

  useEffect(() => {
    // agar cache already hai to turant dikhao, background me silently refresh karo
    loadRuns(!!cached);
    pollRef.current = setInterval(() => loadRuns(true), POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirmDelete() {
    if (!confirmRunId) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/log/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: confirmRunId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRuns((prev) => {
        const next = prev.filter((r) => r.id !== confirmRunId);
        setCached(CACHE_KEY, next);
        return next;
      });
    } catch (err) {
      alert(`Delete nahi hua: ${err.message}`);
    } finally {
      setDeleting(false);
      setConfirmRunId(null);
    }
  }

  return (
    <div>
      <style jsx global>{`
        body {
          background: #0b0d11;
          color: #e8e9ec;
          font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
          margin: 0 auto;
          padding: 66px 16px 84px;
          max-width: 560px;
        }
      `}</style>

      <TopBar title="Send Logs" subtitle="Last 50 runs, most recent first" />

      {loading && <SkeletonRunList count={6} />}
      {error && !loading && <p style={{ color: '#e5544d' }}>Error: {error}</p>}
      {!loading && !error && runs.length === 0 && (
        <p style={{ color: '#7c8592' }}>Abhi tak koi run nahi hua.</p>
      )}

      {!loading &&
        runs.map((run) => (
            <div
              key={run.id}
              onClick={() => router.push(`/logs/${run.id}`)}
              style={{
                background: '#14171d',
                border: '1px solid #262b34',
                borderRadius: 10,
                padding: 14,
                marginBottom: 10,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {new Date(run.startedAt).toLocaleString()}
                </div>
                <div style={{ fontSize: 11.5, color: '#7c8592', marginTop: 2 }}>
                  Status: {run.status || 'unknown'} · Total: {run.total ?? '-'} · Sent:{' '}
                  <span style={{ color: '#25d366' }}>{run.sent ?? 0}</span> · Failed:{' '}
                  <span style={{ color: '#e5544d' }}>{run.failed ?? 0}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmRunId(run.id);
                  }}
                  aria-label="Delete this run"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#7c8592',
                    fontSize: 16,
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  🗑
                </button>
                <div style={{ color: '#7c8592', fontSize: 14 }}>›</div>
              </div>
            </div>
          ))}

      {confirmRunId && (
        <div
          onClick={() => !deleting && setConfirmRunId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            background: 'rgba(5, 6, 9, 0.72)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 340,
              background: '#14171d',
              border: '1px solid #262b34',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
              Delete this run?
            </div>
            <p style={{ fontSize: 12.5, color: '#7c8592', margin: '0 0 18px' }}>
              Ye run aur uski saari entries permanently delete ho jayengi. Ye undo nahi ho sakta.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmRunId(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: '1px solid #262b34',
                  background: 'transparent',
                  color: '#e8e9ec',
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#e5544d',
                  color: '#fff',
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

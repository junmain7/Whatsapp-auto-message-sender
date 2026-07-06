import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';

const STATUS_RANK = { read: 0, delivered: 1, sent: 2, failed: 3, unknown: 4, checking: 5 };

function rankOf(status) {
  return STATUS_RANK[status] ?? STATUS_RANK.unknown;
}

function Tick({ color, offset }) {
  return (
    <svg
      width="15"
      height="11"
      viewBox="0 0 16 15"
      style={offset ? { marginLeft: -8 } : undefined}
    >
      <path
        fill={color}
        d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.032L5.593 7.373a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.669-8.598a.365.365 0 0 0-.061-.514z"
      />
    </svg>
  );
}

function StatusTicks({ status }) {
  if (status === 'failed') {
    return <span style={{ color: '#e5544d', fontSize: 11.5, fontWeight: 600 }}>Failed</span>;
  }
  if (status === 'checking') {
    return <span style={{ color: '#e5c07b', fontSize: 11.5 }}>Checking…</span>;
  }

  const isRead = status === 'read';
  const isDouble = status === 'read' || status === 'delivered';
  const color = isRead ? '#53bdeb' : '#8696a0';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Tick color={color} />
      {isDouble && <Tick color={color} offset />}
    </span>
  );
}

export default function LogDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusMap, setStatusMap] = useState({});
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/log/get?runId=${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRun(data.run);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const refreshStatuses = useCallback(async () => {
    if (!run) return;
    const withIds = run.entries.filter((e) => e.messageId);
    if (withIds.length === 0) return;

    setCheckingStatus(true);
    setStatusMap((prev) => {
      const next = { ...prev };
      withIds.forEach((e) => {
        next[e.id] = 'checking';
      });
      return next;
    });

    try {
      const settingsRes = await fetch('/api/settings');
      const settingsData = await settingsRes.json().catch(() => ({}));
      const apiKey = settingsData.apiKey;
      if (!apiKey) throw new Error('API key saved nahi hai');

      await Promise.all(
        withIds.map(async (entry) => {
          try {
            const res = await fetch(
              `https://app.leminai.com/api/v1/messages/${encodeURIComponent(entry.messageId)}`,
              { headers: { Authorization: `Bearer ${apiKey}` } }
            );
            const data = await res.json().catch(() => ({}));
            const liveStatus = data?.status || data?.data?.status || 'unknown';
            setStatusMap((prev) => ({ ...prev, [entry.id]: liveStatus }));
          } catch {
            setStatusMap((prev) => ({ ...prev, [entry.id]: 'unknown' }));
          }
        })
      );
    } catch (err) {
      alert(`Status check nahi hua: ${err.message}`);
    } finally {
      setCheckingStatus(false);
    }
  }, [run]);

  useEffect(() => {
    if (run) refreshStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id]);

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch('/api/log/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      router.replace('/logs');
    } catch (err) {
      alert(`Delete nahi hua: ${err.message}`);
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  const orderedEntries = run
    ? run.entries.map((e, idx) => ({
        ...e,
        slNo: idx + 1,
        liveStatus: statusMap[e.id] || (e.status === 'failed' ? 'failed' : 'sent'),
      }))
    : [];

  const sortedEntries = [...orderedEntries].sort((a, b) => rankOf(a.liveStatus) - rankOf(b.liveStatus));

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0b0d11' }}>
      <style jsx global>{`
        body {
          background: #0b0d11;
          color: #e8e9ec;
          font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }
      `}</style>

      {/* Fixed header - does not scroll */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 12px',
          borderBottom: '1px solid #262b34',
          background: '#0b0d11',
        }}
      >
        <button
          type="button"
          onClick={() => router.push('/logs')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#e8e9ec',
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
            padding: '6px 8px',
          }}
        >
          ‹ Back
        </button>

        <div style={{ fontSize: 13, color: '#7c8592', fontWeight: 600 }}>Run Details</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={refreshStatuses}
            disabled={!run || checkingStatus}
            aria-label="Refresh delivery status"
            style={{
              background: 'transparent',
              border: 'none',
              color: run ? '#7c8592' : '#4d5560',
              fontSize: 16,
              cursor: run ? 'pointer' : 'default',
              padding: '6px 8px',
              opacity: checkingStatus ? 0.5 : 1,
            }}
          >
            {checkingStatus ? '⟳' : '↻'}
          </button>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!run}
            aria-label="Delete this run"
            style={{
              background: 'transparent',
              border: 'none',
              color: run ? '#e5544d' : '#4d5560',
              fontSize: 18,
              cursor: run ? 'pointer' : 'default',
              padding: '6px 8px',
            }}
          >
            🗑
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loading && <p style={{ color: '#7c8592' }}>Loading...</p>}
        {error && <p style={{ color: '#e5544d' }}>Error: {error}</p>}

        {run && (
          <>
            <div
              style={{
                background: '#14171d',
                border: '1px solid #262b34',
                borderRadius: 10,
                padding: 14,
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {new Date(run.startedAt).toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: '#7c8592', marginTop: 4 }}>
                Status: {run.status || 'unknown'} · Total: {run.total ?? '-'} · Sent:{' '}
                <span style={{ color: '#25d366' }}>{run.sent ?? 0}</span> · Failed:{' '}
                <span style={{ color: '#e5544d' }}>{run.failed ?? 0}</span>
              </div>
            </div>

            <div
              style={{
                background: '#14171d',
                border: '1px solid #262b34',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {orderedEntries.length === 0 && (
                <div style={{ color: '#7c8592', padding: 14, fontSize: 13 }}>
                  Koi entries nahi mili.
                </div>
              )}

              {orderedEntries.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#1a1e26' }}>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          color: '#7c8592',
                          fontSize: 11,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          width: 56,
                        }}
                      >
                        Sl No
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          color: '#7c8592',
                          fontSize: 11,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Number
                      </th>
                      <th
                        style={{
                          textAlign: 'right',
                          padding: '10px 12px',
                          color: '#7c8592',
                          fontSize: 11,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map((entry) => (
                      <tr key={entry.id} style={{ borderTop: '1px solid #232830' }}>
                        <td style={{ padding: '10px 12px', color: '#7c8592' }}>{entry.slNo}</td>
                        <td
                          style={{
                            padding: '10px 12px',
                            fontFamily: 'ui-monospace, monospace',
                            color: '#e8e9ec',
                          }}
                        >
                          {entry.number}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <StatusTicks status={entry.liveStatus} />
                          {entry.error && (
                            <div style={{ color: '#e5544d', fontSize: 10.5, marginTop: 2 }}>
                              {entry.error}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {confirmOpen && (
        <div
          onClick={() => !deleting && setConfirmOpen(false)}
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
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Delete this run?</div>
            <p style={{ fontSize: 12.5, color: '#7c8592', margin: '0 0 18px' }}>
              Ye run aur uski saari entries permanently delete ho jayengi. Ye undo nahi ho sakta.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmOpen(false)}
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

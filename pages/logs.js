import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Logs() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openRun, setOpenRun] = useState(null);

  useEffect(() => {
    fetch('/api/log/list')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRuns(data.runs || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px 60px' }}>
      <style jsx global>{`
        body {
          background: #0b0d11;
          color: #e8e9ec;
          font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
        }
      `}</style>

      <div style={{ marginBottom: 18 }}>
        <Link href="/" style={{ color: '#7c8592', fontSize: 13 }}>
          ← Back to sender
        </Link>
        <h1 style={{ fontSize: 19, margin: '8px 0 2px' }}>Send Logs</h1>
        <p style={{ color: '#7c8592', fontSize: 12.5, margin: 0 }}>
          Last 50 runs, most recent first
        </p>
      </div>

      {loading && <p style={{ color: '#7c8592' }}>Loading...</p>}
      {error && <p style={{ color: '#e5544d' }}>Error: {error}</p>}
      {!loading && !error && runs.length === 0 && (
        <p style={{ color: '#7c8592' }}>Abhi tak koi run nahi hua.</p>
      )}

      {runs.map((run) => {
        const isOpen = openRun === run.id;
        return (
          <div
            key={run.id}
            style={{
              background: '#14171d',
              border: '1px solid #262b34',
              borderRadius: 10,
              padding: 14,
              marginBottom: 10,
              cursor: 'pointer',
            }}
            onClick={() => setOpenRun(isOpen ? null : run.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              <div style={{ color: '#7c8592', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</div>
            </div>

            {isOpen && (
              <div
                style={{
                  marginTop: 10,
                  borderTop: '1px solid #262b34',
                  paddingTop: 10,
                  maxHeight: 260,
                  overflowY: 'auto',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 12,
                }}
              >
                {run.entries.length === 0 && (
                  <div style={{ color: '#7c8592' }}>Koi entries nahi mili.</div>
                )}
                {run.entries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      color: entry.status === 'sent' ? '#25d366' : '#e5544d',
                      marginBottom: 4,
                    }}
                  >
                    [{new Date(entry.timestamp).toLocaleTimeString()}] {entry.number} —{' '}
                    {entry.status}
                    {entry.error ? `: ${entry.error}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import BottomNav from '../components/BottomNav';
import TerminalPanel from '../components/TerminalPanel';

const API_URL = 'https://app.leminai.com/api/v1/messages/service';

function parseCSV(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstCols = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const looksLikeHeader = firstCols.some((c) =>
    ['number', 'phone', 'mobile', 'contact'].includes(c)
  );

  let numberIdx = 0;
  let dataLines = lines;

  if (looksLikeHeader) {
    const numIdxFound = firstCols.findIndex((c) =>
      ['number', 'phone', 'mobile', 'contact'].includes(c)
    );
    if (numIdxFound !== -1) numberIdx = numIdxFound;
    dataLines = lines.slice(1);
  }

  return dataLines
    .map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      const number = (cols[numberIdx] || '').replace(/\D/g, '');
      return { number };
    })
    .filter((c) => c.number);
}

function parseContacts(text) {
  return text
    .split('\n')
    .map((l) => l.trim().replace(/\D/g, ''))
    .filter(Boolean)
    .map((number) => ({ number }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestamp() {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

async function sendOne(apiKey, number, message) {
  const body = {
    to: number,
    type: 'text',
    text: { body: message },
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(JSON.stringify(data) || `HTTP ${res.status}`);
  }
  return data;
}

async function logRun(total) {
  try {
    const res = await fetch('/api/log/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total }),
    });
    const data = await res.json();
    return data.runId;
  } catch {
    return null;
  }
}

async function logEntry(runId, number, status, error) {
  if (!runId) return;
  try {
    await fetch('/api/log/entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, number, status, error }),
    });
  } catch {
    // logging failure shouldn't break sending
  }
}

async function logFinish(runId, sent, failed, stopped) {
  if (!runId) return;
  try {
    await fetch('/api/log/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, sent, failed, stopped }),
    });
  } catch {
    // ignore
  }
}

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [template, setTemplate] = useState('');
  const [contactsText, setContactsText] = useState('');
  const [delay, setDelay] = useState(2500);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [running, setRunning] = useState(false);
  const consoleRef = useRef(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.apiKey) {
          setApiKey(data.apiKey);
          setApiKeySaved(true);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSaveKey() {
    const key = apiKey.trim();
    if (!key) return alert('API key daalo pehle');
    setSavingKey(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });
      setApiKeySaved(true);
    } catch {
      alert('Key save nahi hui, dubara try karo');
    } finally {
      setSavingKey(false);
    }
  }

  const stopRequestedRef = useRef(false);
  const logEndRef = useRef(null);
  const fileInputRef = useRef(null);

  function appendLog(text, cls) {
    setLogs((prev) => [...prev, { text, cls, time: timestamp() }]);
    requestAnimationFrame(() => {
      logEndRef.current?.scrollIntoView({ block: 'end' });
    });
  }

  function updateLastLog(text, cls) {
    setLogs((prev) => {
      const copy = [...prev];
      if (copy.length > 0) copy[copy.length - 1] = { text, cls, time: copy[copy.length - 1].time };
      return copy;
    });
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const parsed = parseCSV(evt.target.result);
      if (parsed.length === 0) {
        alert('CSV me valid contacts nahi mile. Format check karo.');
        return;
      }
      setContactsText(parsed.map((c) => c.number).join('\n'));
      appendLog(`CSV loaded: ${parsed.length} contacts found`);
    };
    reader.readAsText(file);
  }

  async function handleStart() {
    const key = apiKey.trim();
    const msg = template;
    const delayMs = parseInt(delay, 10) || 2500;
    const contacts = parseContacts(contactsText);

    if (!key) return alert('API key daalo pehle');
    if (contacts.length === 0) return alert('Kam se kam ek contact daalo');

    setLogs([]);
    setStats({ total: contacts.length, sent: 0, failed: 0 });
    stopRequestedRef.current = false;
    setRunning(true);
    requestAnimationFrame(() => {
      consoleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const runId = await logRun(contacts.length);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < contacts.length; i++) {
      if (stopRequestedRef.current) {
        appendLog(`Stopped by user at ${i}/${contacts.length}`);
        break;
      }

      const { number } = contacts[i];
      appendLog(`[${i + 1}/${contacts.length}] Sending — ${number}...`);

      const maxRetries = 2;
      let ok = false;
      let lastErr = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          await sendOne(key, number, msg);
          ok = true;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < maxRetries) {
            updateLastLog(
              `[${i + 1}/${contacts.length}] Retry ${attempt + 1}/${maxRetries} — ${number}...`
            );
            await sleep(1500);
          }
        }
      }

      if (ok) {
        sent++;
        setStats((s) => ({ ...s, sent }));
        updateLastLog(`[${i + 1}/${contacts.length}] Sent — ${number}`, 'ok');
        await logEntry(runId, number, 'sent', null);
      } else {
        failed++;
        setStats((s) => ({ ...s, failed }));
        updateLastLog(
          `[${i + 1}/${contacts.length}] Failed — ${number}: ${lastErr.message}`,
          'err'
        );
        await logEntry(runId, number, 'failed', lastErr.message);
      }

      if (i < contacts.length - 1 && !stopRequestedRef.current) {
        await sleep(delayMs);
      }
    }

    appendLog('--- Done ---');
    await logFinish(runId, sent, failed, stopRequestedRef.current);
    setRunning(false);
  }

  function handleStop() {
    stopRequestedRef.current = true;
  }

  return (
    <>
    <div id="mainContent">
      <style jsx global>{`
        :root {
          --bg: #0b0d11;
          --panel: #14171d;
          --panel-2: #1a1e26;
          --border: #262b34;
          --text: #e8e9ec;
          --muted: #7c8592;
          --accent: #25d366;
          --accent-dim: #1a9c4a;
          --danger: #e5544d;
          --radius: 10px;
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
          background: var(--bg);
          color: var(--text);
          margin: 0 auto;
          padding: 20px 16px 60px;
          max-width: 560px;
          line-height: 1.4;
        }
        header {
          margin-bottom: 22px;
        }
        h1 {
          font-size: 19px;
          font-weight: 600;
          margin: 0 0 3px;
          letter-spacing: -0.01em;
        }
        p.sub {
          color: var(--muted);
          font-size: 12.5px;
          margin: 0;
        }
        .card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 16px;
          margin-bottom: 12px;
        }
        .card h2 {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
          font-weight: 600;
          margin: 0 0 12px;
        }
        label {
          display: block;
          font-size: 13px;
          color: var(--text);
          margin: 0 0 6px;
          font-weight: 500;
        }
        .field + .field {
          margin-top: 14px;
        }
        input[type='text'],
        input[type='password'],
        input[type='number'],
        textarea,
        input[type='file'] {
          width: 100%;
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          padding: 10px 12px;
          font-size: 14px;
          font-family: inherit;
        }
        input:focus,
        textarea:focus {
          outline: none;
          border-color: var(--accent-dim);
        }
        textarea {
          resize: vertical;
          min-height: 80px;
        }
        input[type='file'] {
          padding: 8px 10px;
          font-size: 13px;
        }
        .hint {
          font-size: 11px;
          color: var(--muted);
          margin-top: 5px;
        }
        .divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 16px 0;
          color: var(--muted);
          font-size: 11px;
        }
        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }
        button {
          width: 100%;
          padding: 13px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14.5px;
          cursor: pointer;
        }
        #startBtn {
          background: var(--accent);
          color: #05210f;
          margin-top: 4px;
        }
        #startBtn:disabled {
          background: #33383f;
          color: #7a808a;
        }
        #stopBtn {
          background: var(--danger);
          color: #fff;
          margin-top: 8px;
        }
        .stats {
          display: flex;
          justify-content: space-between;
          text-align: center;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 12px 8px;
          margin-bottom: 12px;
        }
        .stats div {
          flex: 1;
        }
        .stats b {
          display: block;
          font-size: 18px;
          font-weight: 700;
        }
        .stats span {
          font-size: 11px;
          color: var(--muted);
        }
        .stats .ok b {
          color: var(--accent);
        }
        .stats .err b {
          color: var(--danger);
        }
        #log div.ok {
          color: var(--accent);
        }
        #log div.err {
          color: var(--danger);
        }
        .viewLogsLink {
          display: block;
          text-align: center;
          margin-top: 14px;
          color: var(--muted);
          font-size: 12.5px;
          text-decoration: underline;
        }
        body {
          padding-bottom: 84px;
        }
      `}</style>


      <header>
        <h1>Bulk WhatsApp Sender</h1>
        <p className="sub">Runs in your browser, logs saved to database</p>
      </header>

      <div className="card">
        <h2>Connection</h2>
        <div className="field">
          <label>API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setApiKeySaved(false);
            }}
            placeholder="Bearer token"
          />
          <p className="hint">
            {apiKeySaved
              ? 'Saved — agli baar apne aap load ho jayegi.'
              : 'Save karo taki dubara dalne ki zaroorat na pade.'}
          </p>
          <button
            type="button"
            onClick={handleSaveKey}
            disabled={savingKey}
            style={{
              marginTop: 8,
              background: apiKeySaved ? '#1a1e26' : 'var(--accent)',
              color: apiKeySaved ? 'var(--muted)' : '#05210f',
              border: apiKeySaved ? '1px solid var(--border)' : 'none',
            }}
          >
            {savingKey ? 'Saving...' : apiKeySaved ? 'Saved ✓' : 'Save Key'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Message</h2>
        <div className="field">
          <label>Template</label>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="Namaste, ..."
          />
        </div>
      </div>

      <div className="card">
        <h2>Contacts</h2>
        <div className="field">
          <label>Upload CSV</label>
          <input
            type="file"
            accept=".csv,text/csv"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <p className="hint">One number per row — header row optional.</p>
        </div>
        <div className="divider">OR PASTE MANUALLY</div>
        <div className="field">
          <textarea
            value={contactsText}
            onChange={(e) => setContactsText(e.target.value)}
            placeholder={'919876543210\n919876543211'}
          />
          <p className="hint">One number per line, international format without +.</p>
        </div>
      </div>

      <div className="card">
        <h2>Timing</h2>
        <div className="field">
          <label>Delay between messages (ms)</label>
          <input
            type="number"
            value={delay}
            min={500}
            step={500}
            onChange={(e) => setDelay(e.target.value)}
          />
        </div>
      </div>

      {!running && (
        <button id="startBtn" onClick={handleStart}>
          Start Sending
        </button>
      )}
      {running && (
        <button id="stopBtn" onClick={handleStop}>
          Stop
        </button>
      )}

      <div className="stats">
        <div>
          <b>{stats.total}</b>
          <span>Total</span>
        </div>
        <div className="ok">
          <b>{stats.sent}</b>
          <span>Sent</span>
        </div>
        <div className="err">
          <b>{stats.failed}</b>
          <span>Failed</span>
        </div>
      </div>

      <TerminalPanel
        title="bulk-sender — send.log"
        logs={logs}
        stats={stats}
        running={running}
        panelRef={consoleRef}
        logEndRef={logEndRef}
      />

    </div>

    <BottomNav
      onConsoleClick={() =>
        consoleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    />
    </>
  );
}

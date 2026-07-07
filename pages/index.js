import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import TerminalPanel from '../components/TerminalPanel';
import { getCached, setCached } from '../lib/pageCache';

const SETTINGS_CACHE_KEY = 'settings';

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

async function logRun(total, source = 'manual') {
  try {
    const res = await fetch('/api/log/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total, source }),
    });
    const data = await res.json();
    return data.runId;
  } catch {
    return null;
  }
}

async function acquireLock(source, runId) {
  try {
    const res = await fetch('/api/lock/acquire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, runId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function releaseLock(source) {
  try {
    await fetch('/api/lock/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    });
  } catch {
    // ignore
  }
}

async function logEntry(runId, number, status, error, messageId) {
  if (!runId) return;
  try {
    await fetch('/api/log/entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, number, status, error, messageId }),
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
  const cachedSettings = getCached(SETTINGS_CACHE_KEY);
  const [apiKey, setApiKey] = useState(cachedSettings?.apiKey || '');
  const [apiKeySaved, setApiKeySaved] = useState(!!cachedSettings?.apiKey);
  const [savingKey, setSavingKey] = useState(false);
  // 'idle' | 'checking' | 'valid' | 'invalid'
  const [keyCheckStatus, setKeyCheckStatus] = useState('idle');
  const [keyCheckReason, setKeyCheckReason] = useState('');
  const keyCheckTimerRef = useRef(null);
  const keyCheckTokenRef = useRef(0);
  const [template, setTemplate] = useState('');
  const [contactsText, setContactsText] = useState('');
  const FIXED_DELAY_MS = 120000; // 2 minute — fixed, safety ke liye
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [running, setRunning] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const consoleRef = useRef(null);

  const [checkingDup, setCheckingDup] = useState(false);
  const [dupQueue, setDupQueue] = useState([]);
  const [dupIndex, setDupIndex] = useState(0);
  const pendingSendRef = useRef(null);
  const dupDecisionsRef = useRef({});
  const autoSkipRef = useRef({});

  // background cron-queue state
  const [queuing, setQueuing] = useState(false);
  const [cronStatus, setCronStatus] = useState(null); // { status, total, sent, failed, currentIndex, runId }
  const [cronLogs, setCronLogs] = useState([]);
  const [cronConsoleOpen, setCronConsoleOpen] = useState(false);
  const cronPollRef = useRef(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.apiKey) {
          setApiKey(data.apiKey);
          setApiKeySaved(true);
          setKeyCheckStatus('valid');
        }
        setCached(SETTINGS_CACHE_KEY, data);
      })
      .catch((err) => console.error('Failed to load settings:', err));
  }, []);

  // Jaise hi user type karna band kare, key ko silently validate karo —
  // bina save kiye. Result ke hisaab se Save button enable/disable hoga.
  useEffect(() => {
    const key = apiKey.trim();
    clearTimeout(keyCheckTimerRef.current);

    if (apiKeySaved) return; // already ek confirmed valid key hai, dubara check na karo

    if (!key) {
      setKeyCheckStatus('idle');
      setKeyCheckReason('');
      return;
    }

    setKeyCheckStatus('checking');
    const myToken = ++keyCheckTokenRef.current;

    keyCheckTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/settings/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: key }),
        });
        const data = await res.json().catch(() => ({}));
        if (myToken !== keyCheckTokenRef.current) return; // stale response, ignore
        if (data.valid) {
          setKeyCheckStatus('valid');
          setKeyCheckReason('');
        } else {
          setKeyCheckStatus('invalid');
          setKeyCheckReason(data.reason || 'API key invalid hai.');
        }
      } catch (err) {
        if (myToken !== keyCheckTokenRef.current) return;
        setKeyCheckStatus('invalid');
        setKeyCheckReason(`Check nahi ho paya: ${err.message}`);
      }
    }, 700);

    return () => clearTimeout(keyCheckTimerRef.current);
  }, [apiKey, apiKeySaved]);

  async function pollCronQueue() {
    try {
      const res = await fetch('/api/queue/status');
      const data = await res.json().catch(() => ({}));
      const queue = data.queue;
      if (!queue || queue.status !== 'running') {
        setCronStatus(null);
        return;
      }
      setCronStatus({
        status: queue.status,
        total: queue.total,
        sent: queue.sent,
        failed: queue.failed,
        currentIndex: queue.currentIndex,
        runId: queue.runId,
      });
      const mapped = (queue.entries || []).map((e) => ({
        text:
          e.status === 'skipped'
            ? `Auto-skipped (already sent) — ${e.number}`
            : e.status === 'sent'
            ? `Sent — ${e.number}`
            : `Failed — ${e.number}${e.error ? `: ${e.error}` : ''}`,
        cls: e.status === 'sent' ? 'ok' : e.status === 'failed' ? 'err' : undefined,
        time: e.timestamp ? e.timestamp.slice(11, 19) : '--:--:--',
      }));
      setCronLogs(mapped);
    } catch {
      // ignore — will retry on next poll
    }
  }

  useEffect(() => {
    pollCronQueue();
    cronPollRef.current = setInterval(pollCronQueue, 6000);
    return () => clearInterval(cronPollRef.current);
  }, []);

  async function handleStopQueue() {
    try {
      await fetch('/api/queue/stop', { method: 'POST' });
    } catch {
      // ignore
    }
    setCronStatus(null);
    setCronConsoleOpen(false);
  }

  async function handleQueueBackground() {
    const contacts = parseContacts(contactsText);
    if (!template.trim()) return alert('Message template khali hai');
    if (contacts.length === 0) return alert('Kam se kam ek contact daalo');

    setQueuing(true);
    try {
      const res = await fetch('/api/queue/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: contacts.map((c) => c.number), template }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCronConsoleOpen(true);
      pollCronQueue();
    } catch (err) {
      alert(`Background sending start nahi ho paya: ${err.message}`);
    } finally {
      setQueuing(false);
    }
  }

  async function handleSaveKey() {
    const key = apiKey.trim();
    if (!key) return;
    if (keyCheckStatus !== 'valid') return; // safety net, button already disabled in this case
    setSavingKey(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setApiKeySaved(true);
      setKeyCheckStatus('valid');
    } catch (err) {
      setApiKeySaved(false);
      setKeyCheckStatus('invalid');
      setKeyCheckReason(err.message || 'Kuch galat ho gaya, dobara try karo.');
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
    const contacts = parseContacts(contactsText);

    if (!key) return alert('API key daalo pehle');
    if (contacts.length === 0) return alert('Kam se kam ek contact daalo');

    if (cronStatus && cronStatus.status === 'running') {
      return alert('Background sending abhi chal rahi hai — pehle usse complete/stop karo, tabhi manual send start hoga.');
    }

    setCheckingDup(true);
    let lastSent = {};
    try {
      const res = await fetch('/api/log/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers: contacts.map((c) => c.number) }),
      });
      const data = await res.json().catch(() => ({}));
      lastSent = data.lastSent || {};
    } catch {
      // agar check fail ho jaye, sending ko block mat karo
      lastSent = {};
    } finally {
      setCheckingDup(false);
    }

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const autoSkipDecisions = {};
    const needsConfirm = [];

    contacts.forEach((c) => {
      const last = lastSent[c.number];
      if (!last) return;
      const diffMs = now - new Date(last).getTime();
      if (diffMs < ONE_DAY_MS) {
        // 24 ghante ke andar bhej chuke hain — risk nahi leni, auto-skip
        autoSkipDecisions[c.number] = 'skip';
      } else {
        needsConfirm.push({ number: c.number, lastSentAt: last });
      }
    });

    pendingSendRef.current = { contacts, key };
    dupDecisionsRef.current = { ...autoSkipDecisions };
    autoSkipRef.current = autoSkipDecisions;

    if (needsConfirm.length > 0) {
      setDupQueue(needsConfirm);
      setDupIndex(0);
    } else {
      runSending(contacts, key, dupDecisionsRef.current, autoSkipDecisions);
    }
  }

  function resolveDuplicate(decision) {
    const current = dupQueue[dupIndex];
    dupDecisionsRef.current[current.number] = decision;

    const nextIndex = dupIndex + 1;
    if (nextIndex < dupQueue.length) {
      setDupIndex(nextIndex);
    } else {
      const { contacts, key } = pendingSendRef.current || {};
      setDupQueue([]);
      setDupIndex(0);
      runSending(contacts, key, dupDecisionsRef.current, autoSkipRef.current);
    }
  }

  async function runSending(contacts, key, decisions, autoSkippedSet = {}) {
    const msg = template;
    const delayMs = FIXED_DELAY_MS;

    const lock = await acquireLock('manual', null);
    if (!lock.ok) {
      alert(`Start nahi ho paya: ${lock.error}`);
      return;
    }

    setLogs([]);
    setStats({ total: contacts.length, sent: 0, failed: 0 });
    stopRequestedRef.current = false;
    setRunning(true);
    setConsoleOpen(true);

    const runId = await logRun(contacts.length, 'manual');

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < contacts.length; i++) {
      if (stopRequestedRef.current) {
        appendLog(`Stopped by user at ${i}/${contacts.length}`);
        break;
      }

      const { number } = contacts[i];

      if (decisions[number] === 'skip') {
        const wasAutoSkip = !!autoSkippedSet[number];
        appendLog(
          wasAutoSkip
            ? `[${i + 1}/${contacts.length}] Auto-skipped (sent within 24h) — ${number}`
            : `[${i + 1}/${contacts.length}] Skipped (duplicate) — ${number}`
        );
        if (i < contacts.length - 1 && !stopRequestedRef.current) await sleep(200);
        continue;
      }

      appendLog(`[${i + 1}/${contacts.length}] Sending — ${number}...`);

      const maxRetries = 2;
      let ok = false;
      let lastErr = null;
      let messageId = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await sendOne(key, number, msg);
          messageId = result?.message_id || result?.id || result?.data?.message_id || null;
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
        await logEntry(runId, number, 'sent', null, messageId);
      } else {
        failed++;
        setStats((s) => ({ ...s, failed }));
        updateLastLog(
          `[${i + 1}/${contacts.length}] Failed — ${number}: ${lastErr.message}`,
          'err'
        );
        await logEntry(runId, number, 'failed', lastErr.message, null);
      }

      if (i < contacts.length - 1 && !stopRequestedRef.current) {
        await sleep(delayMs);
      }
    }

    appendLog('--- Done ---');
    await logFinish(runId, sent, failed, stopRequestedRef.current);
    await releaseLock('manual');
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
        #queueBtn {
          background: var(--panel-2);
          border: 1px solid var(--border);
          color: var(--text);
          margin-top: 8px;
        }
        #queueBtn:disabled {
          color: var(--muted);
        }
        .cronBanner {
          border-color: var(--accent-dim);
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
          padding-top: 66px;
        }
        header.topBar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 400;
          margin: 0;
          padding: 14px 16px;
          background: rgba(11, 13, 17, 0.98);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }
        header.topBar h1 {
          max-width: 560px;
          margin: 0 auto 3px;
        }
        header.topBar p.sub {
          max-width: 560px;
          margin: 0 auto;
        }
      `}</style>


      <header className="topBar">
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
          <p
            className="hint"
            style={{
              color:
                keyCheckStatus === 'valid' || apiKeySaved
                  ? 'var(--accent)'
                  : keyCheckStatus === 'invalid'
                  ? 'var(--danger)'
                  : 'var(--muted)',
            }}
          >
            {apiKeySaved
              ? 'Saved — agli baar apne aap load ho jayegi.'
              : keyCheckStatus === 'checking'
              ? 'Key check ho rahi hai...'
              : keyCheckStatus === 'valid'
              ? 'Key valid hai — ab save kar sakte ho.'
              : keyCheckStatus === 'invalid'
              ? keyCheckReason || 'Ye key valid nahi hai.'
              : 'Save karo taki dubara dalne ki zaroorat na pade.'}
          </p>
          <button
            type="button"
            onClick={handleSaveKey}
            disabled={savingKey || (!apiKeySaved && keyCheckStatus !== 'valid')}
            style={{
              marginTop: 8,
              background: apiKeySaved ? '#1a1e26' : 'var(--accent)',
              color: apiKeySaved ? 'var(--muted)' : '#05210f',
              border: apiKeySaved ? '1px solid var(--border)' : 'none',
            }}
          >
            {savingKey
              ? 'Saving...'
              : apiKeySaved
              ? 'Saved ✓'
              : keyCheckStatus === 'checking'
              ? 'Checking key...'
              : keyCheckStatus === 'invalid'
              ? 'Invalid key'
              : 'Save Key'}
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
          <label>Delay between messages</label>
          <p className="hint">Fixed 2 minutes — safety ke liye ye badla nahi ja sakta.</p>
        </div>
      </div>

      {cronStatus && cronStatus.status === 'running' && (
        <div className="card cronBanner">
          <h2>Sending in Background</h2>
          <p className="hint">
            Background me messages bhej raha hai — {cronStatus.currentIndex}/{cronStatus.total} done ·{' '}
            <span style={{ color: 'var(--accent)' }}>{cronStatus.sent} sent</span> ·{' '}
            <span style={{ color: 'var(--danger)' }}>{cronStatus.failed} failed</span>
          </p>
          <p className="hint">App band kar do to bhi chalta rahega, sending automatically continue hogi.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => setCronConsoleOpen(true)}
              style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              View Logs
            </button>
            <button type="button" onClick={handleStopQueue} style={{ background: 'var(--danger)', color: '#fff' }}>
              Stop Sending
            </button>
          </div>
        </div>
      )}

      {!running && (!cronStatus || cronStatus.status !== 'running') && (
        <button id="startBtn" onClick={handleStart} disabled={checkingDup || !apiKeySaved}>
          {checkingDup ? 'Checking numbers...' : !apiKeySaved ? 'Save a valid API key first' : 'Start Sending (Manual)'}
        </button>
      )}
      {running && (
        <button id="stopBtn" onClick={handleStop}>
          Stop
        </button>
      )}
      {!running && (!cronStatus || cronStatus.status !== 'running') && (
        <button
          type="button"
          id="queueBtn"
          onClick={handleQueueBackground}
          disabled={queuing || !apiKeySaved}
        >
          {queuing ? 'Starting...' : 'Send in Background'}
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

    </div>

    <TerminalPanel
      modal
      open={consoleOpen}
      onClose={() => setConsoleOpen(false)}
      title="bulk-sender — send.log"
      logs={logs}
      stats={stats}
      running={running}
      panelRef={consoleRef}
      logEndRef={logEndRef}
    />

    <TerminalPanel
      modal
      open={cronConsoleOpen}
      onClose={() => setCronConsoleOpen(false)}
      title="background — send.log"
      logs={cronLogs}
      stats={
        cronStatus
          ? { total: cronStatus.total, sent: cronStatus.sent, failed: cronStatus.failed }
          : { total: 0, sent: 0, failed: 0 }
      }
      running={!!cronStatus && cronStatus.status === 'running'}
      emptyText="Background sending abhi khali hai."
    />

    {dupQueue.length > 0 && (
      <div className="dupOverlay">
        <div className="dupCard">
          <div className="dupTitle">Already sent</div>
          <p className="dupMsg">
            <b>{dupQueue[dupIndex].number}</b> ko message pehle bhej chuke ho —{' '}
            {new Date(dupQueue[dupIndex].lastSentAt).toLocaleDateString()} ko.
          </p>
          <p className="dupSub">
            {dupIndex + 1} / {dupQueue.length}
          </p>
          <div className="dupActions">
            <button type="button" className="dupSkip" onClick={() => resolveDuplicate('skip')}>
              Skip
            </button>
            <button type="button" className="dupResend" onClick={() => resolveDuplicate('resend')}>
              Resend
            </button>
          </div>
        </div>

        <style jsx>{`
          .dupOverlay {
            position: fixed;
            inset: 0;
            z-index: 950;
            background: rgba(5, 6, 9, 0.72);
            backdrop-filter: blur(3px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .dupCard {
            width: 100%;
            max-width: 340px;
            background: #14171d;
            border: 1px solid #262b34;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
          }
          .dupTitle {
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #e8e9ec;
          }
          .dupMsg {
            font-size: 13px;
            color: #e8e9ec;
            margin: 0 0 4px;
            line-height: 1.5;
          }
          .dupSub {
            font-size: 11.5px;
            color: #7c8592;
            margin: 0 0 16px;
          }
          .dupActions {
            display: flex;
            gap: 10px;
          }
          .dupSkip,
          .dupResend {
            flex: 1;
            padding: 10px;
            border-radius: 8px;
            font-size: 13.5px;
            font-weight: 600;
            cursor: pointer;
          }
          .dupSkip {
            border: 1px solid #262b34;
            background: transparent;
            color: #e8e9ec;
          }
          .dupResend {
            border: none;
            background: #25d366;
            color: #05210f;
          }
        `}</style>
      </div>
    )}

    </>
  );
}

import { db } from '../../../lib/firebaseAdmin';

// Fixed interval — doesn't matter how often the cronjob URL is hit,
// an actual message only goes out once this much time has passed since the last send.
const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

const API_URL = 'https://app.leminai.com/api/v1/messages/service';

async function sendOne(apiKey, number, message) {
  const body = { to: number, type: 'text', text: { body: message } };
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(JSON.stringify(data) || `HTTP ${res.status}`);
  return data;
}

// Cronjob never asks — agar number ko kabhi bhi pehle 'sent' status se bheja ja chuka hai, seedha skip.
async function wasAlreadySent(number) {
  const snap = await db
    .collectionGroup('entries')
    .where('number', '==', number)
    .where('status', '==', 'sent')
    .limit(1)
    .get();
  return !snap.empty;
}

export default async function handler(req, res) {
  // Optional safety key — set CRON_SECRET env var on Vercel if you want to lock the URL down.
  if (process.env.CRON_SECRET) {
    const key = (req.query && req.query.key) || (req.body && req.body.key);
    if (key !== process.env.CRON_SECRET) {
      // Still 200 so the cron service doesn't mark this job as failing/dead.
      return res.status(200).json({ ok: false, action: 'error', error: 'Invalid cron key' });
    }
  }

  const lockRef = db.collection('whatsapp_lock').doc('default');
  const queueRef = db.collection('whatsapp_queue').doc('default');

  try {
    // Phase 1 (transaction): check mutex + interval, decide if we even need to look further.
    const phase1 = await db.runTransaction(async (t) => {
      const lockSnap = await t.get(lockRef);
      const lock = lockSnap.exists ? lockSnap.data() : { activeSource: null };

      if (lock.activeSource === 'manual') {
        return { action: 'skipped', reason: 'manual-running' };
      }

      const queueSnap = await t.get(queueRef);
      if (!queueSnap.exists || queueSnap.data().status !== 'running') {
        if (lock.activeSource === 'cron') {
          t.set(lockRef, { activeSource: null, runId: null, acquiredAt: null });
        }
        return { action: 'idle' };
      }

      const queue = queueSnap.data();
      if (queue.lastSentAt) {
        const elapsed = Date.now() - new Date(queue.lastSentAt).getTime();
        if (elapsed < INTERVAL_MS) {
          return { action: 'waiting', nextInMs: INTERVAL_MS - elapsed };
        }
      }

      return { action: 'proceed', queue };
    });

    if (phase1.action !== 'proceed') {
      return res.status(200).json(phase1);
    }

    const { queue } = phase1;
    const contacts = queue.contacts.slice();

    // Phase 2 (outside transaction — needs collectionGroup queries): walk forward,
    // auto-skipping anything already sent, find the next actually-sendable contact.
    let i = queue.currentIndex;
    let targetIndex = -1;
    const skippedNow = [];

    while (i < contacts.length) {
      const c = contacts[i];
      if (c.status !== 'pending') {
        i++;
        continue;
      }
      const dup = await wasAlreadySent(c.number);
      if (dup) {
        contacts[i] = { ...c, status: 'skipped' };
        skippedNow.push(c.number);
        i++;
        continue;
      }
      targetIndex = i;
      break;
    }

    for (const number of skippedNow) {
      await db
        .collection('whatsapp_runs')
        .doc(queue.runId)
        .collection('entries')
        .add({
          number,
          status: 'skipped',
          error: null,
          messageId: null,
          auto: true,
          timestamp: new Date().toISOString(),
        });
    }

    if (targetIndex === -1) {
      await queueRef.set({
        ...queue,
        contacts,
        currentIndex: contacts.length,
        status: 'completed',
        finishedAt: new Date().toISOString(),
      });
      await db.collection('whatsapp_runs').doc(queue.runId).update({
        status: 'completed',
        sent: queue.sent,
        failed: queue.failed,
        finishedAt: new Date().toISOString(),
      });
      await lockRef.set({ activeSource: null, runId: null, acquiredAt: null });
      return res.status(200).json({ ok: true, action: 'completed', skipped: skippedNow.length });
    }

    // Phase 3 (transaction): claim this exact slot so two overlapping cron hits can't double-send.
    const claim = await db.runTransaction(async (t) => {
      const snap = await t.get(queueRef);
      if (!snap.exists || snap.data().status !== 'running') return { ok: false };
      const q = snap.data();

      if (q.lastSentAt) {
        const elapsed = Date.now() - new Date(q.lastSentAt).getTime();
        if (elapsed < INTERVAL_MS) return { ok: false, waiting: true };
      }
      if (!q.contacts[targetIndex] || q.contacts[targetIndex].status !== 'pending') {
        return { ok: false, alreadyClaimed: true };
      }

      const freshContacts = q.contacts.slice();
      freshContacts[targetIndex] = { ...freshContacts[targetIndex], status: 'sending' };
      const claimedAt = new Date().toISOString();
      t.set(queueRef, { ...q, contacts: freshContacts, lastSentAt: claimedAt });
      return { ok: true, contacts: freshContacts, claimedAt, queueData: q };
    });

    if (!claim.ok) {
      return res.status(200).json({
        ok: true,
        action: claim.waiting ? 'waiting' : 'skipped-race',
        skipped: skippedNow.length,
      });
    }

    const number = contacts[targetIndex].number;
    const settingsSnap = await db.collection('whatsapp_settings').doc('default').get();
    const apiKey = settingsSnap.exists ? settingsSnap.data().apiKey : null;

    let ok = false;
    let lastErr = null;
    let messageId = null;

    if (!apiKey) {
      lastErr = new Error('API key set nahi hai (app me Settings se daalo)');
    } else {
      for (let attempt = 0; attempt <= 1; attempt++) {
        try {
          const result = await sendOne(apiKey, number, queue.template);
          messageId = result?.message_id || result?.id || result?.data?.message_id || null;
          ok = true;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < 1) await new Promise((r) => setTimeout(r, 1200));
        }
      }
    }

    const finalContacts = claim.contacts.slice();
    finalContacts[targetIndex] = { ...finalContacts[targetIndex], status: ok ? 'sent' : 'failed' };
    const nextIndex = targetIndex + 1;
    const isDone = nextIndex >= finalContacts.length;
    const newSent = queue.sent + (ok ? 1 : 0);
    const newFailed = queue.failed + (ok ? 0 : 1);

    await queueRef.set({
      ...claim.queueData,
      contacts: finalContacts,
      currentIndex: nextIndex,
      sent: newSent,
      failed: newFailed,
      lastSentAt: claim.claimedAt,
      status: isDone ? 'completed' : 'running',
      finishedAt: isDone ? new Date().toISOString() : null,
    });

    await db
      .collection('whatsapp_runs')
      .doc(queue.runId)
      .collection('entries')
      .add({
        number,
        status: ok ? 'sent' : 'failed',
        error: ok ? null : lastErr?.message,
        messageId,
        auto: false,
        timestamp: new Date().toISOString(),
      });

    if (isDone) {
      await db.collection('whatsapp_runs').doc(queue.runId).update({
        status: 'completed',
        sent: newSent,
        failed: newFailed,
        finishedAt: new Date().toISOString(),
      });
      await lockRef.set({ activeSource: null, runId: null, acquiredAt: null });
    }

    return res.status(200).json({
      ok: true,
      action: ok ? 'sent' : 'failed',
      number,
      skipped: skippedNow.length,
    });
  } catch (err) {
    // Cron services (cron-job.org etc.) disable/pause jobs after repeated non-2xx
    // responses, so we always return 200 here — the real error is still visible
    // in the JSON body (ok:false) for debugging, it just won't kill the cron job.
    return res.status(200).json({ ok: false, action: 'error', error: err.message });
  }
}

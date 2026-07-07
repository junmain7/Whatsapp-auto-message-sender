import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { contacts, template } = req.body || {};
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'contacts required hai' });
    }
    if (!template || !template.trim()) {
      return res.status(400).json({ error: 'message template required hai' });
    }

    const lockRef = db.collection('whatsapp_lock').doc('default');
    const queueRef = db.collection('whatsapp_queue').doc('default');

    const claim = await db.runTransaction(async (t) => {
      const lockSnap = await t.get(lockRef);
      const lock = lockSnap.exists ? lockSnap.data() : { activeSource: null };

      if (lock.activeSource) {
        return { ok: false, activeSource: lock.activeSource };
      }

      t.set(lockRef, { activeSource: 'cron', runId: null, acquiredAt: new Date().toISOString() });
      return { ok: true };
    });

    if (!claim.ok) {
      return res.status(409).json({
        error: `${claim.activeSource} service pehle se chal rahi hai — pehle usko complete/stop karo`,
      });
    }

    const runRef = await db.collection('whatsapp_runs').add({
      total: contacts.length,
      startedAt: new Date().toISOString(),
      status: 'running',
      source: 'cron',
    });

    const cleanContacts = contacts.map((number) => ({ number, status: 'pending' }));

    await queueRef.set({
      status: 'running',
      contacts: cleanContacts,
      template,
      currentIndex: 0,
      total: cleanContacts.length,
      sent: 0,
      failed: 0,
      runId: runRef.id,
      lastSentAt: null,
      createdAt: new Date().toISOString(),
      finishedAt: null,
    });

    await lockRef.set({
      activeSource: 'cron',
      runId: runRef.id,
      acquiredAt: new Date().toISOString(),
    });

    res.status(200).json({ ok: true, runId: runRef.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

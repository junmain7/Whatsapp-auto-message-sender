import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const queueRef = db.collection('whatsapp_queue').doc('default');
    const snap = await queueRef.get();
    if (!snap.exists) return res.status(200).json({ ok: true, skipped: true });

    const queue = snap.data();
    await queueRef.set({
      ...queue,
      status: 'stopped',
      finishedAt: new Date().toISOString(),
    });

    if (queue.runId) {
      await db.collection('whatsapp_runs').doc(queue.runId).update({
        status: 'stopped',
        sent: queue.sent || 0,
        failed: queue.failed || 0,
        finishedAt: new Date().toISOString(),
      });
    }

    await db.collection('whatsapp_lock').doc('default').set({
      activeSource: null,
      runId: null,
      acquiredAt: null,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

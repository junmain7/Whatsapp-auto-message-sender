import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const lockSnap = await db.collection('whatsapp_lock').doc('default').get();
    const lock = lockSnap.exists ? lockSnap.data() : { activeSource: null, runId: null };

    let queue = null;
    const queueSnap = await db.collection('whatsapp_queue').doc('default').get();
    if (queueSnap.exists) {
      const q = queueSnap.data();
      queue = {
        status: q.status,
        total: q.total,
        sent: q.sent,
        failed: q.failed,
        currentIndex: q.currentIndex,
        runId: q.runId,
        lastSentAt: q.lastSentAt || null,
      };
    }

    res.status(200).json({
      activeSource: lock.activeSource || null,
      runId: lock.runId || null,
      queue,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

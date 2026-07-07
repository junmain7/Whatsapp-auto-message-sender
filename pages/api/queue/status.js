import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const snap = await db.collection('whatsapp_queue').doc('default').get();
    if (!snap.exists) return res.status(200).json({ queue: null });

    const queue = snap.data();
    let entries = [];

    if (queue.runId) {
      const entriesSnap = await db
        .collection('whatsapp_runs')
        .doc(queue.runId)
        .collection('entries')
        .orderBy('timestamp', 'asc')
        .get();
      entries = entriesSnap.docs.map((e) => ({ id: e.id, ...e.data() }));
    }

    res.status(200).json({ queue: { ...queue, entries } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

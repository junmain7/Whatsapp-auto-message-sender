import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { runId } = req.query;
    if (!runId) return res.status(400).json({ error: 'runId required' });

    const runDoc = await db.collection('whatsapp_runs').doc(runId).get();
    if (!runDoc.exists) return res.status(404).json({ error: 'Run not found' });

    const entriesSnap = await runDoc.ref.collection('entries').orderBy('timestamp', 'asc').get();
    const entries = entriesSnap.docs.map((e) => ({ id: e.id, ...e.data() }));

    res.status(200).json({ run: { id: runDoc.id, ...runDoc.data(), entries } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { total } = req.body || {};
    const runRef = await db.collection('whatsapp_runs').add({
      total: total || 0,
      startedAt: new Date().toISOString(),
      status: 'running',
    });
    res.status(200).json({ runId: runRef.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

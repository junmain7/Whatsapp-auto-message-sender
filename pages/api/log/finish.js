import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { runId, sent, failed, stopped } = req.body || {};
    if (!runId) return res.status(400).json({ error: 'runId required hai' });
    await db.collection('whatsapp_runs').doc(runId).update({
      status: stopped ? 'stopped' : 'completed',
      sent: sent || 0,
      failed: failed || 0,
      finishedAt: new Date().toISOString(),
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

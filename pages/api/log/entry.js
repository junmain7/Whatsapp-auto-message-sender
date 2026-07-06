import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { runId, number, status, error, messageId } = req.body || {};
    if (!runId || !number) {
      return res.status(400).json({ error: 'runId aur number required hai' });
    }
    await db.collection('whatsapp_runs').doc(runId).collection('entries').add({
      number,
      status: status || 'unknown',
      error: error || null,
      messageId: messageId || null,
      timestamp: new Date().toISOString(),
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

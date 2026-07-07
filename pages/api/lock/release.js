import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { source } = req.body || {};
    const lockRef = db.collection('whatsapp_lock').doc('default');
    const snap = await lockRef.get();
    const current = snap.exists ? snap.data() : { activeSource: null };

    // agar source diya hai to sirf apna hi lock release karo, doosre ka nahi
    if (source && current.activeSource && current.activeSource !== source) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    await lockRef.set({ activeSource: null, runId: null, acquiredAt: null });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

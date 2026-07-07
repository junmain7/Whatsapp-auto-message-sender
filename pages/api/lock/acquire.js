import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { source, runId } = req.body || {};
    if (!source) return res.status(400).json({ error: 'source required hai' });

    const lockRef = db.collection('whatsapp_lock').doc('default');

    const result = await db.runTransaction(async (t) => {
      const snap = await t.get(lockRef);
      const current = snap.exists ? snap.data() : { activeSource: null };

      if (current.activeSource && current.activeSource !== source) {
        return { ok: false, activeSource: current.activeSource };
      }

      t.set(lockRef, {
        activeSource: source,
        runId: runId || current.runId || null,
        acquiredAt: new Date().toISOString(),
      });
      return { ok: true };
    });

    if (!result.ok) {
      return res.status(409).json({
        ok: false,
        error: `${result.activeSource} service pehle se chal rahi hai`,
        activeSource: result.activeSource,
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

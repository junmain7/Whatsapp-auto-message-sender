import { db } from '../../lib/firebaseAdmin';

const DOC_REF = () => db.collection('whatsapp_settings').doc('default');

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const snap = await DOC_REF().get();
      const data = snap.exists ? snap.data() : {};
      return res.status(200).json({ apiKey: data.apiKey || '' });
    }

    if (req.method === 'POST') {
      const { apiKey } = req.body || {};
      if (!apiKey) return res.status(400).json({ error: 'apiKey required' });
      await DOC_REF().set({ apiKey, updatedAt: new Date().toISOString() }, { merge: true });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

import { db } from '../../lib/firebaseAdmin';

const API_URL = 'https://app.leminai.com/api/v1/messages/service';
const DOC_REF = () => db.collection('whatsapp_settings').doc('default');

// Real message nahi bhejta — bas ek junk payload se auth check karta hai.
// 401/403 aaya matlab key hi galat hai. Koi aur error (jaise invalid number)
// matlab auth theek hai, key valid hai.
async function checkApiKeyValid(apiKey) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: '000000000000', type: 'text', text: { body: '' } }),
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, reason: 'API key invalid hai (unauthorized)' };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, reason: `Key check nahi ho paya: ${err.message}` };
  }
}

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

      const check = await checkApiKeyValid(apiKey);
      if (!check.valid) {
        return res.status(400).json({ error: check.reason });
      }

      await DOC_REF().set({ apiKey, updatedAt: new Date().toISOString() }, { merge: true });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

import { db } from '../../../lib/firebaseAdmin';

// Firestore 'in' queries support max 10 values at a time, so we chunk.
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { numbers } = req.body || {};
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'numbers array required hai' });
    }

    const unique = [...new Set(numbers.filter(Boolean))];
    const lastSentMap = {};

    for (const group of chunk(unique, 10)) {
      const snap = await db
        .collectionGroup('entries')
        .where('number', 'in', group)
        .where('status', '==', 'sent')
        .get();

      snap.forEach((doc) => {
        const data = doc.data();
        const existing = lastSentMap[data.number];
        if (!existing || new Date(data.timestamp) > new Date(existing)) {
          lastSentMap[data.number] = data.timestamp;
        }
      });
    }

    res.status(200).json({ lastSent: lastSentMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

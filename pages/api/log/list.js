import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const runsSnap = await db
      .collection('whatsapp_runs')
      .orderBy('startedAt', 'desc')
      .limit(50)
      .get();

    const runs = await Promise.all(
      runsSnap.docs.map(async (doc) => {
        const entriesSnap = await doc.ref
          .collection('entries')
          .orderBy('timestamp', 'asc')
          .get();
        const entries = entriesSnap.docs.map((e) => ({ id: e.id, ...e.data() }));
        return { id: doc.id, ...doc.data(), entries };
      })
    );

    res.status(200).json({ runs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

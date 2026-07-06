import { db } from '../../../lib/firebaseAdmin';

async function deleteRun(runDoc) {
  const entriesSnap = await runDoc.ref.collection('entries').get();
  const batch = db.batch();
  entriesSnap.docs.forEach((e) => batch.delete(e.ref));
  batch.delete(runDoc.ref);
  await batch.commit();
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { runId } = req.body || {};

    if (runId) {
      // delete a single run
      const runDoc = await db.collection('whatsapp_runs').doc(runId).get();
      if (runDoc.exists) await deleteRun(runDoc);
      return res.status(200).json({ ok: true, deleted: runId });
    }

    // delete all runs
    const runsSnap = await db.collection('whatsapp_runs').get();
    await Promise.all(runsSnap.docs.map((doc) => deleteRun(doc)));
    res.status(200).json({ ok: true, deleted: runsSnap.docs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

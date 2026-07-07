import { checkApiKeyValid } from '../../../lib/checkApiKey';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey } = req.body || {};
  if (!apiKey) return res.status(400).json({ error: 'apiKey required' });

  try {
    const check = await checkApiKeyValid(apiKey);
    return res.status(200).json(check);
  } catch (err) {
    return res.status(500).json({ valid: false, reason: err.message });
  }
}

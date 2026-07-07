const API_URL = 'https://app.leminai.com/api/v1/messages/service';

// Real message nahi bhejta — bas ek junk payload se auth check karta hai.
// 401/403 aaya matlab key hi galat hai. Koi aur error (jaise invalid number)
// matlab auth theek hai, key valid hai.
export async function checkApiKeyValid(apiKey) {
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

import dotenv from 'dotenv';
dotenv.config();

const token = process.env.WAPILOT_API_TOKEN || '';

async function testStats() {
  const campaignId = 15975;
  console.log('Using Campaign ID:', campaignId);

  try {
    const res = await fetch(`https://api.wapilot.net/api/v2/campaigns/${campaignId}/messages/stats`, {
      method: 'GET',
      headers: {
        'token': token
      }
    });

    const data = await res.json();
    console.log('Status Code:', res.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Network Error:', err);
  }
}

testStats();

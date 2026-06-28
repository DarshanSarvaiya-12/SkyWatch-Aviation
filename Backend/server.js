const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

function httpsGet(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'SkyWatch/1.0' } }, (res) => {
      console.log('Response status:', res.statusCode, 'from:', url);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`API returned ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON: ' + data.slice(0, 100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('Timed out after ' + timeoutMs + 'ms'));
    });
  });
}

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'SkyWatch backend running' });
});

// Nearby flights — radius in km, converted to nautical miles for adsb.lol
app.get('/flights', async (req, res) => {
  const { lat, lon, radius } = req.query;

  if (!lat || !lon || !radius) {
    return res.status(400).json({ error: 'lat, lon, radius are required' });
  }

  // adsb.lol takes radius in nautical miles (1 km = 0.539957 nm)
  const radiusNm = Math.round(parseFloat(radius) * 0.539957);
  const url = `https://api.adsb.lol/v2/point/${lat}/${lon}/${radiusNm}`;
  console.log('Calling adsb.lol:', url);

  try {
    const data = await httpsGet(url);
    const count = data.ac ? data.ac.length : 0;
    console.log('Success — aircraft:', count);
    res.json(data);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch flights', detail: err.message });
  }
});

// World view — adsb.lol doesn't have a global endpoint, use a large radius from center
app.get('/flights/world', async (req, res) => {
  // Use mil-world endpoint for global coverage
  const url = 'https://api.adsb.lol/v2/mil';
  console.log('World view via adsb.lol');
  try {
    const data = await httpsGet(url);
    res.json(data);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch world flights', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SkyWatch backend running on port ${PORT}`);
});

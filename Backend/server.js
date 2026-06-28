const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// OpenSky credentials from Render environment
const OPENSKY_CLIENT_ID = process.env.OPENSKY_CLIENT_ID || '';
const OPENSKY_CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET || '';

// Build Basic Auth header
function getAuthHeader() {
  if (!OPENSKY_CLIENT_ID || !OPENSKY_CLIENT_SECRET) {
    console.warn('Warning: OpenSky credentials not set');
    return {};
  }
  const credentials = Buffer.from(`${OPENSKY_CLIENT_ID}:${OPENSKY_CLIENT_SECRET}`).toString('base64');
  return { 'Authorization': `Basic ${credentials}` };
}

// Helper — wraps https.get in a Promise with timeout
function httpsGet(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'SkyWatch/1.0',
      ...getAuthHeader()
    };

    const req = https.get(url, { headers }, (res) => {
      console.log('OpenSky response status:', res.statusCode);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`OpenSky returned ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON: ' + data.slice(0, 100))); }
      });
    });

    req.on('error', reject);

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('OpenSky timed out after ' + timeoutMs + 'ms'));
    });
  });
}

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'SkyWatch backend running', auth: OPENSKY_CLIENT_ID ? 'enabled' : 'disabled' });
});

// Nearby flights
app.get('/flights', async (req, res) => {
  const { lat, lon, radius } = req.query;

  if (!lat || !lon || !radius) {
    return res.status(400).json({ error: 'lat, lon, radius are required' });
  }

  const deg   = parseFloat(radius) / 111;
  const lamin = parseFloat(lat) - deg;
  const lamax = parseFloat(lat) + deg;
  const lomin = parseFloat(lon) - deg;
  const lomax = parseFloat(lon) + deg;

  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  console.log('Calling OpenSky:', url);

  try {
    const data = await httpsGet(url);
    const count = data.states ? data.states.length : 0;
    console.log('Success — aircraft count:', count);
    res.json(data);
  } catch (err) {
    console.error('OpenSky error:', err.message);
    res.status(500).json({ error: 'Failed to reach OpenSky', detail: err.message });
  }
});

// World view
app.get('/flights/world', async (req, res) => {
  const url = 'https://opensky-network.org/api/states/all';
  console.log('World view via OpenSky');
  try {
    const data = await httpsGet(url, 20000);
    const count = data.states ? data.states.length : 0;
    console.log('World success — aircraft count:', count);
    res.json(data);
  } catch (err) {
    console.error('OpenSky error:', err.message);
    res.status(500).json({ error: 'Failed to fetch world flights', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SkyWatch backend running on port ${PORT}`);
  console.log('OpenSky auth:', OPENSKY_CLIENT_ID ? 'enabled' : 'disabled');
});

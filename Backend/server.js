const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// OpenSky credentials from Render environment
const OPENSKY_CLIENT_ID = process.env.OPENSKY_CLIENT_ID || '';
const OPENSKY_CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET || '';

console.log('OpenSky Client ID set:', OPENSKY_CLIENT_ID ? 'YES' : 'NO');
console.log('OpenSky Client Secret set:', OPENSKY_CLIENT_SECRET ? 'YES' : 'NO');

// Build Basic Auth header
function getAuthHeader() {
  if (!OPENSKY_CLIENT_ID || !OPENSKY_CLIENT_SECRET) {
    console.warn('Warning: OpenSky credentials missing');
    return {};
  }
  const credentials = Buffer.from(`${OPENSKY_CLIENT_ID}:${OPENSKY_CLIENT_SECRET}`).toString('base64');
  console.log('Auth header created:', credentials.slice(0, 10) + '...');
  return { 'Authorization': `Basic ${credentials}` };
}

// Helper — wraps https.get in a Promise with timeout
function httpsGet(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'SkyWatch/1.0',
      ...getAuthHeader()
    };

    console.log('Requesting:', url);
    console.log('Headers:', Object.keys(headers));

    const req = https.get(url, { headers }, (res) => {
      console.log('OpenSky response received:', res.statusCode);
      let data = '';
      res.on('data', chunk => {
        console.log('Chunk received:', chunk.length, 'bytes');
        data += chunk;
      });
      res.on('end', () => {
        console.log('Response complete, total data:', data.length, 'bytes');
        if (res.statusCode !== 200) {
          console.error('OpenSky HTTP error:', res.statusCode, data.slice(0, 200));
          return reject(new Error(`OpenSky returned ${res.statusCode}`));
        }
        try { 
          const parsed = JSON.parse(data);
          console.log('JSON parsed successfully');
          resolve(parsed); 
        }
        catch (e) { 
          console.error('JSON parse failed:', e.message);
          reject(new Error('Invalid JSON from OpenSky')); 
        }
      });
    });

    req.on('error', err => {
      console.error('Request error:', err.message);
      reject(err);
    });

    req.setTimeout(timeoutMs, () => {
      console.error('Request timeout after', timeoutMs, 'ms');
      req.destroy();
      reject(new Error(`OpenSky timed out after ${timeoutMs}ms`));
    });
  });
}

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'SkyWatch backend running', 
    auth: OPENSKY_CLIENT_ID ? 'enabled' : 'disabled',
    timestamp: new Date().toISOString()
  });
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
  console.log('\n=== FLIGHTS REQUEST ===');
  console.log('Lat:', lat, 'Lon:', lon, 'Radius:', radius);

  try {
    const data = await httpsGet(url, 30000);
    const count = data.states ? data.states.length : 0;
    console.log('✓ Success — aircraft count:', count);
    res.json(data);
  } catch (err) {
    console.error('✗ Error:', err.message);
    res.status(500).json({ error: 'Failed to reach OpenSky', detail: err.message });
  }
});

// World view
app.get('/flights/world', async (req, res) => {
  const url = 'https://opensky-network.org/api/states/all';
  console.log('\n=== WORLD VIEW REQUEST ===');
  try {
    const data = await httpsGet(url, 30000);
    const count = data.states ? data.states.length : 0;
    console.log('✓ Success — aircraft count:', count);
    res.json(data);
  } catch (err) {
    console.error('✗ Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch world flights', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SkyWatch backend running on port ${PORT}`);
});

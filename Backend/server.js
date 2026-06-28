const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

function httpsGet(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'SkyWatch/1.0' } }, (res) => {
      console.log('OpenSky response status:', res.statusCode);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`OpenSky returned ${res.statusCode}: ${data}`));
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

// Nearby flights
app.get('/flights', async (req, res) => {
  console.log('Query received:', req.query);

  const { lat, lon, radius } = req.query;

  if (!lat || !lon || !radius) {
    console.log('Missing params — lat:', lat, 'lon:', lon, 'radius:', radius);
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
  console.log('World view requested');
  try {
    const data = await httpsGet('https://opensky-network.org/api/states/all');
    const count = data.states ? data.states.length : 0;
    console.log('World success — aircraft count:', count);
    res.json(data);
  } catch (err) {
    console.error('OpenSky error:', err.message);
    res.status(500).json({ error: 'Failed to reach OpenSky', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SkyWatch backend running on port ${PORT}`);
});

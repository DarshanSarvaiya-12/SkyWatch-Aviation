const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Helper — wraps https.get in a Promise with timeout
function httpsGet(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'SkyWatch/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON from OpenSky')); }
      });
    });

    req.on('error', reject);

    // Kill request if OpenSky doesn't respond in time
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('OpenSky request timed out after ' + timeoutMs + 'ms'));
    });
  });
}

// Health check — for UptimeRobot
app.get('/', (req, res) => {
  res.json({ status: 'SkyWatch backend running' });
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

  try {
    const data = await httpsGet(url);
    res.json(data);
  } catch (err) {
    console.error('OpenSky error:', err.message);
    res.status(500).json({ error: 'Failed to reach OpenSky', detail: err.message });
  }
});

// World view
app.get('/flights/world', async (req, res) => {
  try {
    const data = await httpsGet('https://opensky-network.org/api/states/all');
    res.json(data);
  } catch (err) {
    console.error('OpenSky error:', err.message);
    res.status(500).json({ error: 'Failed to reach OpenSky', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SkyWatch backend running on port ${PORT}`);
});

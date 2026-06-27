const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Health check — for UptimeRobot
app.get('/', (req, res) => {
  res.json({ status: 'SkyWatch backend running' });
});

// Flights proxy route
app.get('/flights', async (req, res) => {
  const { lat, lon, radius } = req.query;

  if (!lat || !lon || !radius) {
    return res.status(400).json({ error: 'lat, lon, radius are required' });
  }

  const deg = parseFloat(radius) / 111;
  const lamin = parseFloat(lat) - deg;
  const lamax = parseFloat(lat) + deg;
  const lomin = parseFloat(lon) - deg;
  const lomax = parseFloat(lon) + deg;

  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'OpenSky error', code: response.status });
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ error: 'Failed to reach OpenSky' });
  }
});

// World view — no bounding box
app.get('/flights/world', async (req, res) => {
  try {
    const response = await fetch('https://opensky-network.org/api/states/all');

    if (!response.ok) {
      return res.status(response.status).json({ error: 'OpenSky error', code: response.status });
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ error: 'Failed to reach OpenSky' });
  }
});

app.listen(PORT, () => {
  console.log(`SkyWatch backend running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

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
    const response = await axios.get(url, { timeout: 15000 });
    res.json(response.data);
  } catch (err) {
    console.error('OpenSky error:', err.message);
    res.status(500).json({ error: 'Failed to reach OpenSky', detail: err.message });
  }
});

// World view
app.get('/flights/world', async (req, res) => {
  try {
    const response = await axios.get('https://opensky-network.org/api/states/all', { timeout: 20000 });
    res.json(response.data);
  } catch (err) {
    console.error('OpenSky error:', err.message);
    res.status(500).json({ error: 'Failed to reach OpenSky', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SkyWatch backend running on port ${PORT}`);
});

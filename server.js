jsconst express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let cache = { standings: null, scores: null, lastFetch: null };
const CACHE_MINUTES = 15;

function cacheExpired() {
  if (!cache.lastFetch) return true;
  return (Date.now() - cache.lastFetch) / 1000 / 60 > CACHE_MINUTES;
}

const API_KEY = process.env.API_KEY;
const WORLD_CUP_ID = 1;
const SEASON = 2026;

async function fetchFromAPI(endpoint) {
  const res = await fetch(`https://v3.football.api-sports.io/${endpoint}`, {
    headers: { 'x-apisports-key': API_KEY }
  });
  return res.json();
}

async function refreshData() {
  try {
    const standingsData = await fetchFromAPI(`standings?league=${WORLD_CUP_ID}&season=${SEASON}`);
    const rawGroups = standingsData?.response?.[0]?.league?.standings || [];
    const standings = [];
    for (const group of rawGroups) {
      for (const team of group) {
        standings.push({
          group: team.group?.replace('Group ', '') || '?',
          rank: team.rank,
          name: team.team.name,
          abbr: team.team.name.substring(0, 3).toUpperCase(),
          pts: team.points,
          w: team.all.win, d: team.all.draw, l: team.all.lose,
          gf: team.all.goals.for, gc: team.all.goals.against
        });
      }
    }
    const scoresData = await fetchFromAPI(`fixtures?league=${WORLD_CUP_ID}&season=${SEASON}&last=15`);
    const scores = (scoresData?.response || []).map(f => ({
      home: f.teams.home.name, away: f.teams.away.name,
      homeAbbr: f.teams.home.name.substring(0, 3).toUpperCase(),
      awayAbbr: f.teams.away.name.substring(0, 3).toUpperCase(),
      sH: f.goals.home ?? 0, sA: f.goals.away ?? 0,
      status: f.fixture.status.short === 'FT' ? 'final'
            : f.fixture.status.short === 'NS' ? 'scheduled' : 'live',
      date: new Date(f.fixture.date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
    }));
    cache.standings = standings;
    cache.scores = scores;
    cache.lastFetch = Date.now();
    console.log('Datos actualizados:', standings.length, 'equipos');
  } catch (err) {
    console.error('Error API:', err.message);
  }
}

app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

app.get('/api/standings', async (req, res) => {
  if (cacheExpired()) await refreshData();
  if (!cache.standings) return res.status(503).json({ success: false });
  res.json({ success: true, data: cache.standings, updated: new Date(cache.lastFetch).toISOString() });
});

app.get('/api/scores', async (req, res) => {
  if (cacheExpired()) await refreshData();
  if (!cache.scores) return res.status(503).json({ success: false });
  res.json({ success: true, data: cache.scores, updated: new Date(cache.lastFetch).toISOString() });
});

refreshData();
app.listen(PORT, () => console.log(`Puerto ${PORT}`));

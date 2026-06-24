const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let cache = { standings: null, scores: null, lastFetch: null };
const CACHE_MINUTES = 15;

function cacheExpired() {
  if (!cache.lastFetch) return true;
  return (Date.now() - cache.lastFetch) / 1000 / 60 > CACHE_MINUTES;
}

const FD_KEY = process.env.FD_KEY;
const WC_ID = 2000;

const NOMBRES_ES = {
  'Mexico': 'México', 'South Korea': 'Corea del Sur', 'Czechia': 'República Checa',
  'South Africa': 'Sudáfrica', 'Canada': 'Canadá', 'Switzerland': 'Suiza',
  'Bosnia-Herzegovina': 'Bosnia', 'Qatar': 'Catar', 'Brazil': 'Brasil',
  'Morocco': 'Marruecos', 'Scotland': 'Escocia', 'Haiti': 'Haití',
  'United States': 'Estados Unidos', 'Australia': 'Australia', 'Paraguay': 'Paraguay',
  'Turkey': 'Türkiye', 'Germany': 'Alemania', 'Ivory Coast': 'Costa de Marfil',
  'Ecuador': 'Ecuador', 'Curaçao': 'Curazao', 'Netherlands': 'Países Bajos',
  'Japan': 'Japón', 'Sweden': 'Suecia', 'Tunisia': 'Túnez', 'Egypt': 'Egipto',
  'Iran': 'Irán', 'Belgium': 'Bélgica', 'New Zealand': 'Nueva Zelanda',
  'Spain': 'España', 'Uruguay': 'Uruguay', 'Cape Verde Islands': 'Cabo Verde',
  'Saudi Arabia': 'Arabia Saudita', 'Norway': 'Noruega', 'France': 'Francia',
  'Senegal': 'Senegal', 'Iraq': 'Irak', 'Argentina': 'Argentina', 'Austria': 'Austria',
  'Jordan': 'Jordania', 'Algeria': 'Argelia', 'Colombia': 'Colombia',
  'Congo DR': 'Congo DR', 'Portugal': 'Portugal', 'Uzbekistan': 'Uzbekistán',
  'England': 'Inglaterra', 'Ghana': 'Ghana', 'Panama': 'Panamá', 'Croatia': 'Croacia',
};

function traducir(nombre) {
  return NOMBRES_ES[nombre] || nombre;
}

async function fetchFromAPI(endpoint) {
  const res = await fetch(`https://api.football-data.org/v4/${endpoint}`, {
    headers: { 'X-Auth-Token': FD_KEY }
  });
  return res.json();
}

async function refreshData() {
  try {
    const standingsData = await fetchFromAPI(`competitions/${WC_ID}/standings`);
    const rawGroups = standingsData?.standings || [];
    const standings = [];
    for (const groupObj of rawGroups) {
      const groupLetter = groupObj.group?.replace('Group ', '') || '?';
      for (const entry of groupObj.table) {
        standings.push({
          group: groupLetter,
          rank: entry.position,
          name: traducir(entry.team.name),
          abbr: entry.team.tla,
          pts: entry.points,
          w: entry.won,
          d: entry.draw,
          l: entry.lost,
          gf: entry.goalsFor,
          gc: entry.goalsAgainst,
          played: entry.playedGames
        });
      }
    }

    const [finishedData, scheduledData] = await Promise.all([
      fetchFromAPI(`competitions/${WC_ID}/matches?status=FINISHED`),
      fetchFromAPI(`competitions/${WC_ID}/matches?status=SCHEDULED`)
    ]);

    const finished = (finishedData?.matches || []).slice(-10);
    const scheduled = (scheduledData?.matches || []).slice(0, 10);
    const allMatches = [...finished, ...scheduled];

    const scores = allMatches.map(f => ({
      id: f.id,
      home: traducir(f.homeTeam.name),
      away: traducir(f.awayTeam.name),
      homeAbbr: f.homeTeam.tla || f.homeTeam.name.substring(0, 3).toUpperCase(),
      awayAbbr: f.awayTeam.tla || f.awayTeam.name.substring(0, 3).toUpperCase(),
      sH: f.score?.fullTime?.home ?? 0,
      sA: f.score?.fullTime?.away ?? 0,
      status: f.status === 'FINISHED' ? 'final' : f.status === 'IN_PLAY' ? 'live' : 'scheduled',
     date: new Date(f.utcDate).toLocaleString('es-MX', {
  timeZone: 'America/Mexico_City',
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
})
    }));

    cache.standings = standings;
    cache.scores = scores;
    cache.lastFetch = Date.now();
    console.log('Datos actualizados:', standings.length, 'equipos,', scores.length, 'partidos');
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

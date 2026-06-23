const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const cron = require('node-cron');

app.use(express.static('public'));

let cache = { standings: null, scores: null, lastFetch: null };
let lastPostedMatchId = null;
const CACHE_MINUTES = 15;

function cacheExpired() {
  if (!cache.lastFetch) return true;
  return (Date.now() - cache.lastFetch) / 1000 / 60 > CACHE_MINUTES;
}

const FD_KEY = process.env.FD_KEY;
const PAGE_TOKEN = process.env.PAGE_TOKEN;
const PAGE_ID = process.env.PAGE_ID;
const WC_ID = 2000;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Traducción de nombres al español
const NOMBRES_ES = {
  'Mexico': 'México',
  'South Korea': 'Corea del Sur',
  'Czechia': 'República Checa',
  'South Africa': 'Sudáfrica',
  'Canada': 'Canadá',
  'Switzerland': 'Suiza',
  'Bosnia-Herzegovina': 'Bosnia',
  'Qatar': 'Catar',
  'Brazil': 'Brasil',
  'Morocco': 'Marruecos',
  'Scotland': 'Escocia',
  'Haiti': 'Haití',
  'United States': 'Estados Unidos',
  'Australia': 'Australia',
  'Paraguay': 'Paraguay',
  'Turkey': 'Türkiye',
  'Germany': 'Alemania',
  'Ivory Coast': 'Costa de Marfil',
  'Ecuador': 'Ecuador',
  'Curaçao': 'Curazao',
  'Netherlands': 'Países Bajos',
  'Japan': 'Japón',
  'Sweden': 'Suecia',
  'Tunisia': 'Túnez',
  'Egypt': 'Egipto',
  'Iran': 'Irán',
  'Belgium': 'Bélgica',
  'New Zealand': 'Nueva Zelanda',
  'Spain': 'España',
  'Uruguay': 'Uruguay',
  'Cape Verde Islands': 'Cabo Verde',
  'Saudi Arabia': 'Arabia Saudita',
  'Norway': 'Noruega',
  'France': 'Francia',
  'Senegal': 'Senegal',
  'Iraq': 'Irak',
  'Argentina': 'Argentina',
  'Austria': 'Austria',
  'Jordan': 'Jordania',
  'Algeria': 'Argelia',
  'Colombia': 'Colombia',
  'Congo DR': 'Congo DR',
  'Portugal': 'Portugal',
  'Uzbekistan': 'Uzbekistán',
  'England': 'Inglaterra',
  'Ghana': 'Ghana',
  'Panama': 'Panamá',
  'Croatia': 'Croacia',
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

    const scoresData = await fetchFromAPI(`competitions/${WC_ID}/matches?status=FINISHED`);
    const scores = (scoresData?.matches || []).slice(-15).map(f => ({
      id: f.id,
      home: traducir(f.homeTeam.name),
      away: traducir(f.awayTeam.name),
      homeAbbr: f.homeTeam.tla || f.homeTeam.name.substring(0,3).toUpperCase(),
      awayAbbr: f.awayTeam.tla || f.awayTeam.name.substring(0,3).toUpperCase(),
      sH: f.score.fullTime.home ?? 0,
      sA: f.score.fullTime.away ?? 0,
      status: f.status === 'FINISHED' ? 'final' : f.status === 'IN_PLAY' ? 'live' : 'scheduled',
      date: new Date(f.utcDate).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
    }));

    cache.standings = standings;
    cache.scores = scores;
    cache.lastFetch = Date.now();
    console.log('Datos actualizados:', standings.length, 'equipos,', scores.length, 'partidos');
    return scores;
  } catch (err) {
    console.error('Error API:', err.message);
    return null;
  }
}

async function captureAndPost() {
  try {
    const puppeteer = require('puppeteer');
    console.log('Iniciando Puppeteer...');
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 700 });
    await page.goto(`${APP_URL}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForTimeout(2000);
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    await browser.close();
    console.log('Captura tomada, subiendo a Facebook...');

    const pageId = process.env.PAGE_ID;
    console.log('PAGE_ID:', pageId);
    console.log('TOKEN:', PAGE_TOKEN ? 'existe' : 'NO EXISTE');

    const fbRes = await fetch(`https://graph.facebook.com/v20.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '⚽ Así va el Mundial 2026 — bracket actualizado tras el último partido 🏆\n\nVe el bracket en vivo:\nhttps://mundial-tab.onrender.com\n\n#Mundial2026 #FIFA #Bracket',
        access_token: PAGE_TOKEN
      })
    });
    const fbData = await fbRes.json();
    if (fbData.id) {
      console.log('Publicado en Facebook:', fbData.id);
    } else {
      console.error('Error Facebook:', JSON.stringify(fbData));
    }
  } catch (err) {
    console.error('Error al capturar/publicar:', err.message);
  }
}

async function checkForFinishedMatch() {
  const scores = await refreshData();
  if (!scores) return;
  const recentFinal = scores.find(s => s.status === 'final' && s.id !== lastPostedMatchId);
  if (recentFinal) {
    console.log(`Partido terminado: ${recentFinal.home} ${recentFinal.sH}-${recentFinal.sA} ${recentFinal.away}`);
    lastPostedMatchId = recentFinal.id;
    await captureAndPost();
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

app.get('/api/post-now', async (req, res) => {
  await captureAndPost();
  res.json({ success: true, message: 'Publicacion enviada' });
});

cron.schedule('*/5 * * * *', () => {
  checkForFinishedMatch();
});

refreshData();
app.listen(PORT, () => console.log(`Puerto ${PORT}`));

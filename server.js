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

const API_KEY = process.env.API_KEY;
const PAGE_TOKEN = process.env.PAGE_TOKEN;
const PAGE_ID = process.env.PAGE_ID;
const WORLD_CUP_ID = 1;
const SEASON = 2026;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

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
      id: f.fixture.id,
      home: f.teams.home.name,
      away: f.teams.away.name,
      homeAbbr: f.teams.home.name.substring(0, 3).toUpperCase(),
      awayAbbr: f.teams.away.name.substring(0, 3).toUpperCase(),
      sH: f.goals.home ?? 0,
      sA: f.goals.away ?? 0,
      status: f.fixture.status.short === 'FT' ? 'final'
            : f.fixture.status.short === 'NS' ? 'scheduled' : 'live',
      date: new Date(f.fixture.date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
    }));
    cache.standings = standings;
    cache.scores = scores;
    cache.lastFetch = Date.now();
    console.log('Datos actualizados:', standings.length, 'equipos');
    return scores;
  } catch (err) {
    console.error('Error API:', err.message);
    return null;
  }
}

async function captureAndPost() {
  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 700 });
    await page.goto(`${APP_URL}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForTimeout(2000);
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    await browser.close();
    const FormData = require('form-data');
    const form = new FormData();
    form.append('source', screenshot, { filename: 'bracket.png', contentType: 'image/png' });
    form.append('caption', '⚽ Así va el Mundial 2026 — bracket actualizado tras el último partido 🏆\n\n#Mundial2026 #FIFA #Bracket');
    form.append('access_token', PAGE_TOKEN);
    const fbRes = await fetch(`https://graph.facebook.com/v20.0/${PAGE_ID}/photos`, {
      method: 'POST', body: form, headers: form.getHeaders()
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

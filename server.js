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
      homeAbbr: f.teams.home.name.substring(0,

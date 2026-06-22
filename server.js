const express = require("express");
const axios = require("axios");
const puppeteer = require("puppeteer");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// ─── ENV VARS ────────────────────────────────────────────────────────────────
const API_KEY    = process.env.API_KEY;
const PAGE_TOKEN = process.env.PAGE_TOKEN;
const PAGE_ID    = process.env.PAGE_ID;
const APP_URL    = process.env.APP_URL;
const PORT       = process.env.PORT || 3000;

// ─── CACHE ───────────────────────────────────────────────────────────────────
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos en ms
const cache = {};

function getCache(key) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    delete cache[key];
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache[key] = { data, timestamp: Date.now() };
}

// ─── API-FOOTBALL ─────────────────────────────────────────────────────────────
const FOOTBALL_API = axios.create({
  baseURL: "https://v3.football.api-sports.io",
  headers: { "x-apisports-key": API_KEY },
});

// ID del Mundial 2026 — ajusta si es necesario
const WORLD_CUP_LEAGUE = 1;
const WORLD_CUP_SEASON = 2026;

// ─── ENDPOINT: /api/standings ─────────────────────────────────────────────────
app.get("/api/standings", async (req, res) => {
  try {
    const cacheKey = "standings";
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const { data } = await FOOTBALL_API.get("/standings", {
      params: { league: WORLD_CUP_LEAGUE, season: WORLD_CUP_SEASON },
    });

    setCache(cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error("Error /api/standings:", err.message);
    res.status(500).json({ error: "Error obteniendo standings", detail: err.message });
  }
});

// ─── ENDPOINT: /api/scores ────────────────────────────────────────────────────
app.get("/api/scores", async (req, res) => {
  try {
    const cacheKey = "scores";
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const today = new Date().toISOString().split("T")[0];

    const { data } = await FOOTBALL_API.get("/fixtures", {
      params: {
        league: WORLD_CUP_LEAGUE,
        season: WORLD_CUP_SEASON,
        date: today,
      },
    });

    setCache(cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error("Error /api/scores:", err.message);
    res.status(500).json({ error: "Error obteniendo scores", detail: err.message });
  }
});

// ─── PUPPETEER: captura de pantalla ──────────────────────────────────────────
async function takeScreenshot(url) {
  const screenshotPath = path.join("/tmp", `screenshot_${Date.now()}.png`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.screenshot({ path: screenshotPath, type: "png" });
    return screenshotPath;
  } finally {
    await browser.close();
  }
}

// ─── FACEBOOK: publicar imagen ────────────────────────────────────────────────
async function postToFacebook(imagePath, message) {
  const form = new FormData();
  form.append("source", fs.createReadStream(imagePath));
  form.append("message", message);
  form.append("access_token", PAGE_TOKEN);

  const response = await axios.post(
    `https://graph.facebook.com/v19.0/${PAGE_ID}/photos`,
    form,
    { headers: form.getHeaders() }
  );

  return response.data;
}

// ─── HELPER: construir mensaje con resultados del día ─────────────────────────
async function buildMatchMessage() {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await FOOTBALL_API.get("/fixtures", {
    params: {
      league: WORLD_CUP_LEAGUE,
      season: WORLD_CUP_SEASON,
      date: today,
    },
  });

  const fixtures = data?.response || [];

  if (fixtures.length === 0) {
    return `⚽ Mundial ${WORLD_CUP_SEASON} — ${today}\nNo hubo partidos hoy.`;
  }

  const lines = fixtures.map((f) => {
    const home  = f.teams?.home?.name || "?";
    const away  = f.teams?.away?.name || "?";
    const hGoal = f.goals?.home ?? "-";
    const aGoal = f.goals?.away ?? "-";
    const status = f.fixture?.status?.short || "";
    const statusLabel = status === "FT" ? "✅ Final" : status === "NS" ? "🕐 Por jugar" : `🔴 ${status}`;
    return `${home} ${hGoal} - ${aGoal} ${away}  (${statusLabel})`;
  });

  return (
    `⚽ Mundial ${WORLD_CUP_SEASON} — Resultados del ${today}\n\n` +
    lines.join("\n") +
    "\n\n#Mundial2026 #FIFA #Fútbol"
  );
}

// ─── ENDPOINT: /api/post-now ──────────────────────────────────────────────────
app.post("/api/post-now", async (req, res) => {
  let screenshotPath = null;

  try {
    // 1. Construir mensaje
    const message = await buildMatchMessage();

    // 2. Captura de pantalla de la propia app
    const targetUrl = APP_URL || `http://localhost:${PORT}/api/scores`;
    screenshotPath = await takeScreenshot(targetUrl);

    // 3. Publicar en Facebook
    const fbResult = await postToFacebook(screenshotPath, message);

    res.json({ success: true, facebook: fbResult, message });
  } catch (err) {
    console.error("Error /api/post-now:", err.message);
    res.status(500).json({ error: "Error publicando en Facebook", detail: err.message });
  } finally {
    // Limpiar imagen temporal
    if (screenshotPath && fs.existsSync(screenshotPath)) {
      fs.unlinkSync(screenshotPath);
    }
  }
});

// ─── PUBLICACIÓN AUTOMÁTICA DESPUÉS DE CADA PARTIDO ──────────────────────────
// Revisa cada 5 minutos si algún partido acaba de terminar (estado FT)
const postedFixtures = new Set();

async function checkAndAutoPost() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await FOOTBALL_API.get("/fixtures", {
      params: {
        league: WORLD_CUP_LEAGUE,
        season: WORLD_CUP_SEASON,
        date: today,
      },
    });

    const fixtures = data?.response || [];
    const finished = fixtures.filter(
      (f) => f.fixture?.status?.short === "FT" && !postedFixtures.has(f.fixture.id)
    );

    for (const f of finished) {
      const id = f.fixture.id;
      postedFixtures.add(id);

      const home  = f.teams?.home?.name || "?";
      const away  = f.teams?.away?.name || "?";
      const hGoal = f.goals?.home ?? "-";
      const aGoal = f.goals?.away ?? "-";

      const message =
        `⚽ ¡Partido finalizado!\n\n` +
        `${home} ${hGoal} - ${aGoal} ${away}\n\n` +
        `#Mundial2026 #FIFA #Fútbol`;

      let screenshotPath = null;
      try {
        const targetUrl = APP_URL || `http://localhost:${PORT}/api/scores`;
        screenshotPath = await takeScreenshot(targetUrl);
        await postToFacebook(screenshotPath, message);
        console.log(`✅ Publicado en Facebook: partido ${id} (${home} vs ${away})`);
      } catch (err) {
        console.error(`❌ Error publicando partido ${id}:`, err.message);
        // Remover del set para reintentar en la próxima ronda
        postedFixtures.delete(id);
      } finally {
        if (screenshotPath && fs.existsSync(screenshotPath)) {
          fs.unlinkSync(screenshotPath);
        }
      }
    }
  } catch (err) {
    console.error("Error en checkAndAutoPost:", err.message);
  }
}

// Ejecutar el chequeo cada 5 minutos
setInterval(checkAndAutoPost, 5 * 60 * 1000);

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "Mundial API", time: new Date().toISOString() });
});

// ─── INICIAR SERVIDOR ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`   APP_URL  : ${APP_URL || "(no definida)"}`);
  console.log(`   PAGE_ID  : ${PAGE_ID || "(no definida)"}`);
});

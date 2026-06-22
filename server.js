const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal del Page Tab
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API proxy: jala standings de la API de deportes
// Puedes reemplazar esto con cualquier API de fútbol real (SportRadar, API-Football, etc.)
app.get('/api/standings', async (req, res) => {
  try {
    // Datos actuales del Mundial 2026 como base
    // En producción aquí harías fetch a tu API de deportes con tu API key
    const standings = getStandings();
    res.json({ success: true, data: standings, updated: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/scores', async (req, res) => {
  try {
    const scores = getRecentScores();
    res.json({ success: true, data: scores, updated: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Datos del Mundial 2026 (actualiza estos conforme avance el torneo) ---
function getStandings() {
  return [
    // Grupo A
    { group:'A', rank:1, name:'México',        abbr:'MEX', pts:6, w:2, d:0, l:0, gf:4, gc:1 },
    { group:'A', rank:2, name:'Korea',          abbr:'KOR', pts:3, w:1, d:0, l:1, gf:2, gc:2 },
    { group:'A', rank:3, name:'Chequia',        abbr:'CZE', pts:1, w:0, d:1, l:1, gf:1, gc:2 },
    { group:'A', rank:4, name:'Sudáfrica',      abbr:'RSA', pts:1, w:0, d:1, l:1, gf:1, gc:3 },
    // Grupo B
    { group:'B', rank:1, name:'Canadá',         abbr:'CAN', pts:4, w:1, d:1, l:0, gf:3, gc:1 },
    { group:'B', rank:2, name:'Suiza',          abbr:'SUI', pts:4, w:1, d:1, l:0, gf:2, gc:1 },
    { group:'B', rank:3, name:'Bosnia',         abbr:'BIH', pts:1, w:0, d:1, l:1, gf:1, gc:2 },
    { group:'B', rank:4, name:'Catar',          abbr:'QAT', pts:1, w:0, d:1, l:1, gf:1, gc:3 },
    // Grupo C
    { group:'C', rank:1, name:'Brasil',         abbr:'BRA', pts:4, w:1, d:1, l:0, gf:4, gc:1 },
    { group:'C', rank:2, name:'Marruecos',      abbr:'MAR', pts:4, w:1, d:1, l:0, gf:2, gc:0 },
    { group:'C', rank:3, name:'Escocia',        abbr:'SCO', pts:3, w:1, d:0, l:1, gf:2, gc:3 },
    { group:'C', rank:4, name:'Haití',          abbr:'HTI', pts:0, w:0, d:0, l:2, gf:0, gc:4 },
    // Grupo D
    { group:'D', rank:1, name:'USA',            abbr:'USA', pts:6, w:2, d:0, l:0, gf:5, gc:1 },
    { group:'D', rank:2, name:'Australia',      abbr:'AUS', pts:3, w:1, d:0, l:1, gf:3, gc:2 },
    { group:'D', rank:3, name:'Paraguay',       abbr:'PAR', pts:3, w:1, d:0, l:1, gf:2, gc:3 },
    { group:'D', rank:4, name:'Türkiye',        abbr:'TUR', pts:0, w:0, d:0, l:2, gf:1, gc:5 },
    // Grupo E
    { group:'E', rank:1, name:'Alemania',       abbr:'GER', pts:6, w:2, d:0, l:0, gf:5, gc:2 },
    { group:'E', rank:2, name:'Costa Marfil',   abbr:'CIV', pts:3, w:1, d:0, l:1, gf:3, gc:3 },
    { group:'E', rank:3, name:'Ecuador',        abbr:'ECU', pts:1, w:0, d:1, l:1, gf:1, gc:2 },
    { group:'E', rank:4, name:'Curazao',        abbr:'CUW', pts:1, w:0, d:1, l:1, gf:1, gc:4 },
    // Grupo F
    { group:'F', rank:1, name:'Países Bajos',   abbr:'NED', pts:4, w:1, d:1, l:0, gf:6, gc:2 },
    { group:'F', rank:2, name:'Japón',          abbr:'JPN', pts:4, w:1, d:1, l:0, gf:5, gc:1 },
    { group:'F', rank:3, name:'Suecia',         abbr:'SWE', pts:3, w:1, d:0, l:1, gf:2, gc:6 },
    { group:'F', rank:4, name:'Túnez',          abbr:'TUN', pts:0, w:0, d:0, l:2, gf:0, gc:4 },
    // Grupo G
    { group:'G', rank:1, name:'Egipto',         abbr:'EGY', pts:4, w:1, d:1, l:0, gf:3, gc:1 },
    { group:'G', rank:2, name:'Irán',           abbr:'IRN', pts:2, w:0, d:2, l:0, gf:1, gc:1 },
    { group:'G', rank:3, name:'Bélgica',        abbr:'BEL', pts:2, w:0, d:2, l:0, gf:1, gc:1 },
    { group:'G', rank:4, name:'Nueva Zelanda',  abbr:'NZL', pts:1, w:0, d:1, l:1, gf:1, gc:3 },
    // Grupo H
    { group:'H', rank:1, name:'España',         abbr:'ESP', pts:4, w:1, d:1, l:0, gf:5, gc:1 },
    { group:'H', rank:2, name:'Uruguay',        abbr:'URU', pts:2, w:0, d:2, l:0, gf:2, gc:2 },
    { group:'H', rank:3, name:'Cabo Verde',     abbr:'CPV', pts:2, w:0, d:2, l:0, gf:2, gc:2 },
    { group:'H', rank:4, name:'Arabia Saudita', abbr:'KSA', pts:1, w:0, d:1, l:1, gf:0, gc:4 },
    // Grupo I
    { group:'I', rank:1, name:'Noruega',        abbr:'NOR', pts:3, w:1, d:0, l:0, gf:2, gc:0 },
    { group:'I', rank:2, name:'Francia',        abbr:'FRA', pts:3, w:1, d:0, l:0, gf:3, gc:1 },
    { group:'I', rank:3, name:'Senegal',        abbr:'SEN', pts:0, w:0, d:0, l:1, gf:1, gc:2 },
    { group:'I', rank:4, name:'Irak',           abbr:'IRQ', pts:0, w:0, d:0, l:1, gf:0, gc:3 },
    // Grupo J
    { group:'J', rank:1, name:'Argentina',      abbr:'ARG', pts:3, w:1, d:0, l:0, gf:3, gc:1 },
    { group:'J', rank:2, name:'Austria',        abbr:'AUT', pts:3, w:1, d:0, l:0, gf:2, gc:1 },
    { group:'J', rank:3, name:'Jordania',       abbr:'JOR', pts:0, w:0, d:0, l:1, gf:0, gc:2 },
    { group:'J', rank:4, name:'Argelia',        abbr:'DZA', pts:0, w:0, d:0, l:1, gf:1, gc:3 },
    // Grupo K
    { group:'K', rank:1, name:'Colombia',       abbr:'COL', pts:3, w:1, d:0, l:0, gf:2, gc:0 },
    { group:'K', rank:2, name:'Congo DR',       abbr:'COD', pts:1, w:0, d:1, l:0, gf:1, gc:1 },
    { group:'K', rank:3, name:'Portugal',       abbr:'POR', pts:1, w:0, d:1, l:0, gf:1, gc:1 },
    { group:'K', rank:4, name:'Uzbekistán',     abbr:'UZB', pts:0, w:0, d:0, l:1, gf:0, gc:2 },
    // Grupo L
    { group:'L', rank:1, name:'Inglaterra',     abbr:'ENG', pts:3, w:1, d:0, l:0, gf:3, gc:0 },
    { group:'L', rank:2, name:'Ghana',          abbr:'GHA', pts:3, w:1, d:0, l:0, gf:2, gc:1 },
    { group:'L', rank:3, name:'Panamá',         abbr:'PAN', pts:0, w:0, d:0, l:1, gf:0, gc:2 },
    { group:'L', rank:4, name:'Croacia',        abbr:'CRO', pts:0, w:0, d:0, l:1, gf:1, gc:3 },
  ];
}

function getRecentScores() {
  return [
    { home:'Brasil',        away:'Haití',          sH:3, sA:0, status:'final', date:'Jun 19' },
    { home:'Türkiye',       away:'Paraguay',       sH:0, sA:1, status:'final', date:'Jun 19' },
    { home:'Países Bajos',  away:'Suecia',         sH:5, sA:1, status:'final', date:'Jun 20' },
    { home:'Alemania',      away:'Costa Marfil',   sH:2, sA:1, status:'final', date:'Jun 20' },
    { home:'Ecuador',       away:'Curazao',        sH:0, sA:0, status:'final', date:'Jun 20' },
    { home:'Túnez',         away:'Japón',          sH:0, sA:4, status:'final', date:'Jun 20' },
    { home:'España',        away:'Arabia Saudita', sH:4, sA:0, status:'final', date:'Jun 21' },
    { home:'Bélgica',       away:'Irán',           sH:0, sA:0, status:'final', date:'Jun 21' },
    { home:'Uruguay',       away:'Cabo Verde',     sH:2, sA:2, status:'final', date:'Jun 21' },
    { home:'Nueva Zelanda', away:'Egipto',         sH:1, sA:3, status:'final', date:'Jun 21' },
    { home:'Argentina',     away:'Austria',        sH:0, sA:0, status:'scheduled', date:'Jun 22' },
    { home:'Francia',       away:'Irak',           sH:0, sA:0, status:'scheduled', date:'Jun 22' },
    { home:'Noruega',       away:'Senegal',        sH:0, sA:0, status:'scheduled', date:'Jun 22' },
  ];
}

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

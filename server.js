const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let cache = { standings: null, scores: null, scenarios: null, lastFetch: null };
const CACHE_MINUTES = 15;

function cacheExpired() {
  if (!cache.lastFetch) return true;
  return (Date.now() - cache.lastFetch) / 1000 / 60 > CACHE_MINUTES;
}

const FD_KEY = process.env.FD_KEY;
const WC_ID = 2000;

const NOMBRES_ES = {
  'Mexico':'México','South Korea':'Corea del Sur','Czechia':'República Checa',
  'South Africa':'Sudáfrica','Canada':'Canadá','Switzerland':'Suiza',
  'Bosnia-Herzegovina':'Bosnia','Bosnia and Herzegovina':'Bosnia','Qatar':'Catar',
  'Brazil':'Brasil','Morocco':'Marruecos','Scotland':'Escocia','Haiti':'Haití',
  'United States':'Estados Unidos','Australia':'Australia','Paraguay':'Paraguay',
  'Turkey':'Türkiye','Turkiye':'Türkiye','Germany':'Alemania','Ivory Coast':'Costa de Marfil',
  'Ecuador':'Ecuador','Curaçao':'Curazao','Curacao':'Curazao','Netherlands':'Países Bajos',
  'Japan':'Japón','Sweden':'Suecia','Tunisia':'Túnez','Egypt':'Egipto',
  'IR Iran':'Irán','Iran':'Irán','Belgium':'Bélgica','New Zealand':'Nueva Zelanda',
  'Spain':'España','Uruguay':'Uruguay','Cape Verde Islands':'Cabo Verde','Cape Verde':'Cabo Verde',
  'Saudi Arabia':'Arabia Saudita','Norway':'Noruega','France':'Francia',
  'Senegal':'Senegal','Iraq':'Irak','Argentina':'Argentina','Austria':'Austria',
  'Jordan':'Jordania','Algeria':'Argelia','Colombia':'Colombia','Congo DR':'Congo DR',
  'Portugal':'Portugal','Uzbekistan':'Uzbekistán','England':'Inglaterra',
  'Ghana':'Ghana','Panama':'Panamá','Croatia':'Croacia','Korea Republic':'Corea del Sur',
};

function traducir(n) { return NOMBRES_ES[n] || n; }

async function fetchFromAPI(endpoint) {
  const res = await fetch(`https://api.football-data.org/v4/${endpoint}`, {
    headers: { 'X-Auth-Token': FD_KEY }
  });
  return res.json();
}

// Comparar dos terceros para ranking (retorna positivo si b es mejor que a)
function compareThirds(a, b) {
  if (b.pts !== a.pts) return b.pts - a.pts;
  const gdA = a.gf - a.gc, gdB = b.gf - b.gc;
  if (gdB !== gdA) return gdB - gdA;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return 0; // fair play y ranking FIFA no disponibles en API
}

// Calcular escenarios para equipos con partidos pendientes
function calcularEscenarios(standings, scheduledMatches) {
  // Agrupar standings por grupo
  const grupos = {};
  for (const t of standings) {
    if (!grupos[t.group]) grupos[t.group] = [];
    grupos[t.group].push(t);
  }

  // Identificar terceros actuales
  const terceros = [];
  for (const grp in grupos) {
    const sorted = [...grupos[grp]].sort(compareThirds);
    if (sorted[2]) terceros.push({ ...sorted[2], grp });
  }
  terceros.sort(compareThirds);

  // Grupos con partidos pendientes
  const gruposPendientes = new Set();
  for (const m of scheduledMatches) {
    // Buscar a qué grupo pertenecen los equipos
    for (const grp in grupos) {
      const equipos = grupos[grp].map(t => t.abbr);
      if (equipos.includes(m.homeAbbr) || equipos.includes(m.awayAbbr)) {
        gruposPendientes.add(grp);
      }
    }
  }

  const escenarios = [];

  for (const t of terceros) {
    // Solo calcular para equipos con partido pendiente
    if (!gruposPendientes.has(t.grp)) {
      // Grupo terminado - situación definitiva
      const pos = terceros.findIndex(x => x.abbr === t.abbr);
      escenarios.push({
        team: t.name,
        abbr: t.abbr,
        group: t.grp,
        pts: t.pts,
        gd: t.gf - t.gc,
        gf: t.gf,
        status: pos < 8 ? 'clasificado' : 'eliminado',
        posicion: pos + 1,
        mensaje: pos < 8
          ? `✅ Clasificado en posición ${pos + 1} del ranking de terceros`
          : `❌ Eliminado — posición ${pos + 1} del ranking`,
        detalle: null
      });
      continue;
    }

    // Equipo con partido pendiente - calcular escenarios
    const posActual = terceros.findIndex(x => x.abbr === t.abbr);
    
    // Escenario si GANA (suma 3pts, asumimos +1 gol GD mínimo)
    const siGana = { ...t, pts: t.pts + 3, gf: t.gf + 1 };
    const rankingGana = [...terceros.filter(x => x.abbr !== t.abbr), siGana].sort(compareThirds);
    const posGana = rankingGana.findIndex(x => x.abbr === t.abbr);

    // Escenario si EMPATA (suma 1pt)
    const siEmpata = { ...t, pts: t.pts + 1 };
    const rankingEmpata = [...terceros.filter(x => x.abbr !== t.abbr), siEmpata].sort(compareThirds);
    const posEmpata = rankingEmpata.findIndex(x => x.abbr === t.abbr);

    // Escenario si PIERDE (0pts)
    const rankingPierde = [...terceros].sort(compareThirds);
    const posPierde = rankingPierde.findIndex(x => x.abbr === t.abbr);

    // Determinar status general
    let status = 'depende';
    let mensaje = '';
    let detalle = [];

    if (posGana < 8 && posEmpata < 8 && posPierde < 8) {
      status = 'clasificado';
      mensaje = `✅ Clasificado matemáticamente — cualquier resultado lo mantiene entre los 8 mejores`;
    } else if (posGana >= 8 && posEmpata >= 8 && posPierde >= 8) {
      status = 'eliminado';
      mensaje = `❌ Eliminado matemáticamente — ningún resultado lo lleva al top 8`;
    } else {
      status = 'depende';
      
      if (posGana < 8) {
        detalle.push(`🟢 Si gana: clasifica (posición ${posGana + 1})`);
      } else {
        detalle.push(`🔴 Si gana: aún fuera (posición ${posGana + 1}) — necesita que otros terceros pierdan puntos`);
      }

      if (posEmpata < 8) {
        detalle.push(`🟡 Si empata: clasifica (posición ${posEmpata + 1})`);
      } else {
        detalle.push(`🔴 Si empata: fuera (posición ${posEmpata + 1}) — necesita ayuda de otros resultados`);
      }

      if (posPierde < 8) {
        detalle.push(`🟡 Si pierde: podría clasificar (posición ${posPierde + 1}) dependiendo de goles`);
      } else {
        detalle.push(`🔴 Si pierde: eliminado (posición ${posPierde + 1})`);
      }

      // Calcular qué necesita específicamente
      const octavoActual = terceros[7]; // el 8vo mejor actual
      if (octavoActual && t.abbr !== octavoActual.abbr) {
        const diff = compareThirds(t, octavoActual);
        if (diff > 0) {
          detalle.push(`📊 Actualmente necesita superar a ${octavoActual.name} (${octavoActual.pts}pts, GD:${octavoActual.gf-octavoActual.gc>0?'+':''}${octavoActual.gf-octavoActual.gc})`);
        }
      }

      mensaje = `🟡 Su clasificación depende del resultado de su partido`;
    }

    escenarios.push({
      team: t.name,
      abbr: t.abbr,
      group: t.grp,
      pts: t.pts,
      gd: t.gf - t.gc,
      gf: t.gf,
      status,
      posicion: posActual + 1,
      mensaje,
      detalle
    });
  }

  return escenarios;
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

    const matchesData = await fetchFromAPI(
  `competitions/${WC_ID}/matches?const matchesData = await fetchFromAPI(
  `competitions/${WC_ID}/matches?dateFrom=2026-06-11&dateTo=2026-07-01`
);
const allMatches = matchesData?.matches || [];
const allMatches = matchesData?.matches || [];

    const scores = allMatches.map(f => ({
      id: f.id,
      home: traducir(f.homeTeam.name),
      away: traducir(f.awayTeam.name),
      homeAbbr: f.homeTeam.tla || f.homeTeam.name.substring(0,3).toUpperCase(),
      awayAbbr: f.awayTeam.tla || f.awayTeam.name.substring(0,3).toUpperCase(),
      sH: f.score?.fullTime?.home ?? 0,
      sA: f.score?.fullTime?.away ?? 0,
      status: f.status === 'FINISHED' ? 'final' : f.status === 'IN_PLAY' ? 'live' : 'scheduled',
      date: new Date(f.utcDate).toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    }));

    // Calcular escenarios con partidos pendientes
    const scheduledForScenarios = scores.filter(s => s.status === 'scheduled').map(s => ({
      homeAbbr: s.homeAbbr,
      awayAbbr: s.awayAbbr
    }));

    const scenarios = calcularEscenarios(standings, scheduledForScenarios);

    cache.standings = standings;
    cache.scores = scores;
    cache.scenarios = scenarios;
    cache.lastFetch = Date.now();
    console.log('Datos actualizados:', standings.length, 'equipos,', scores.length, 'partidos,', scenarios.length, 'escenarios');
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

app.get('/api/scenarios', async (req, res) => {
  if (cacheExpired()) await refreshData();
  if (!cache.scenarios) return res.status(503).json({ success: false });
  res.json({ success: true, data: cache.scenarios, updated: new Date(cache.lastFetch).toISOString() });
});

refreshData();
app.listen(PORT, () => console.log(`Puerto ${PORT}`));

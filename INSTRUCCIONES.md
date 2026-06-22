# 🏆 Mundial 2026 — Page Tab para Facebook
## Guía de instalación paso a paso

---

## ARCHIVOS QUE TIENES
```
mundial-tab/
├── server.js          ← servidor principal
├── package.json       ← dependencias
├── INSTRUCCIONES.md   ← esta guía
└── public/
    └── index.html     ← el bracket (esto es lo que ven tus seguidores)
```

---

## PASO 1 — Subir a Railway (10-15 minutos)

1. Ve a **railway.app** y crea una cuenta (puedes entrar con Google)
2. Haz clic en **"New Project"**
3. Elige **"Deploy from local files"** o **"Empty project"**
4. Instala Railway CLI:
   - En Windows: descarga el instalador desde railway.app/cli
   - En Mac: abre Terminal y escribe: `brew install railway`
5. En tu carpeta `mundial-tab`, abre una terminal y escribe:
   ```
   railway login
   railway init
   railway up
   ```
6. Railway te dará una URL como: `https://mundial-tab-production.up.railway.app`
   **GUARDA ESA URL**, la necesitas en el paso siguiente.

> 💡 TIP: Si no sabes usar la terminal, Railway también permite subir un .zip
>    desde su panel web. Solo comprime la carpeta `mundial-tab` y súbela.

---

## PASO 2 — Configurar en Meta Developers (20-30 minutos)

1. Ve a **developers.facebook.com**
2. Entra con tu cuenta de Facebook personal
3. Haz clic en **"Mis Apps"** → **"Crear App"**
4. Elige tipo **"Business"**, dale nombre: `Mundial2026Tab`
5. En el panel de tu app, ve a **"Agregar un producto"**
6. Busca **"Facebook Login"** y haz clic en **"Configurar"**
7. En la barra izquierda verás **"Configuración"** → **"Básica"**
   - Anota tu **App ID** (lo necesitas abajo)
8. Ve a **"Herramientas"** → **"Graph API Explorer"** para verificar que todo funciona

---

## PASO 3 — Agregar el Page Tab a tu Página (10 minutos)

Abre esta URL en tu navegador (reemplaza los valores):

```
https://www.facebook.com/dialog/pagetab?
  app_id=TU_APP_ID
  &redirect_uri=https://mundial-tab-production.up.railway.app
```

Ejemplo completo:
```
https://www.facebook.com/dialog/pagetab?app_id=123456789&redirect_uri=https://mundial-tab-production.up.railway.app
```

1. Facebook te preguntará a qué Página quieres agregar la pestaña
2. Selecciona tu Página y haz clic en **"Agregar página Tab"**
3. ¡Listo! Abre tu Página de Facebook y verás una nueva pestaña

---

## PASO 4 — Actualizar los datos del Mundial

Cuando haya nuevos resultados, abre `server.js` y actualiza los números en:
- La función `getStandings()` → puntos, partidos ganados/perdidos
- La función `getRecentScores()` → marcadores de partidos

Luego vuelve a subir con: `railway up`

---

## PREGUNTAS FRECUENTES

**¿Cuánto cuesta Railway?**
El plan gratuito incluye 500 horas/mes, suficiente para el Mundial.

**¿Se actualiza automáticamente?**
El bracket se recalcula cada 90 segundos cuando alguien visita la página.
Para datos 100% automáticos necesitarías una API de fútbol de pago (API-Football ~$10/mes).

**¿Funciona en móvil?**
Sí, el diseño es responsive y funciona bien en la app de Facebook.

**¿Puedo personalizar los colores?**
Sí, abre `public/index.html` y modifica las variables CSS al inicio (`:root { ... }`).

---

## SOPORTE

Si tienes dudas, regresa a Claude y pregunta:
"Tengo este error en Railway: [pega el error]"
o
"¿Cómo actualizo los marcadores del Mundial en mi bot?"

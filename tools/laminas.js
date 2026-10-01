// Controles de las láminas en vivo de /aprende, en un navegador de verdad.
//
// Existe por el error 19 del CTX: la página marcaba una lámina como "ya vista"
// en cuanto pedía reproducirla, aunque el iframe (carga diferida) todavía no
// estuviera listo para recibir la orden. Al llegar, la lámina saltaba al
// diagrama completo con el botón de Repetir. Chromium pide los iframes
// diferidos mucho antes de que entren en pantalla y lo escondía; Safari los
// pide al entrar, y ahí se veía en todas.
//
// Por eso, por defecto, simula la carga de WebKit: cada lámina se sirve
// cuando su marco ya está en pantalla, 400 ms después. Con --rapido usa la
// carga normal de Chromium. Sobre el código anterior al arreglo da 10 FALLAS.
//
// Uso, desde web/ (necesita Playwright, así que corre en la nube de Claude):
//     node tools/laminas.js [--rapido]
// Tarda unos tres minutos, porque deja correr láminas completas.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const raiz = path.resolve(__dirname, '..');
const lento = !process.argv.includes('--rapido');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4' };
const servidor = http.createServer((req, res) => {
  let f = path.join(raiz, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(raiz)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});

let fallas = 0;
const ok = (cond, msg) => { console.log((cond ? '  OK    ' : '  FALLA ') + msg); if (!cond) fallas++; };

async function abre(b, base, opts) {
  const ctx = await b.newContext({ locale: 'es-MX', ...opts });
  const p = await ctx.newPage();
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (lento) await p.route(/laminas\/(p\d)\.html/, async r => {
    const id = r.request().url().match(/(p\d)\.html/)[1];
    for (let k = 0; k < 400; k++) {
      const dentro = await p.evaluate(id => { const b = document.querySelector('[data-lamina="' + id + '"]').getBoundingClientRect(); return b.top < innerHeight && b.bottom > 0; }, id).catch(() => true);
      if (dentro) break; await new Promise(z => setTimeout(z, 50));
    }
    await new Promise(z => setTimeout(z, 400)); r.continue().catch(() => {});
  });
  await p.goto(base + '/aprende/', { waitUntil: 'load' });
  await p.waitForTimeout(800);
  return { ctx, p, errores };
}
// Botón, su rótulo y la barra de avance de una lámina.
const est = (p, id) => p.$eval(`[data-lamina="${id}"]`, f => ({ e: f.querySelector('.ap-play').dataset.estado, a: f.querySelector('.ap-play').getAttribute('aria-label'), w: Math.round(parseFloat(f.querySelector('.ap-fill').style.width || '0')) }));
const ve = (p, id) => p.$eval(`[data-lamina="${id}"]`, f => f.scrollIntoView({ block: 'center' }));
const clic = (p, id) => p.click(`[data-lamina="${id}"] .ap-play`);
const idioma = (p, l) => p.$eval(`.lang-switch .lang-btn[data-lang="${l}"]`, x => x.click());

(async () => {
  await new Promise(z => servidor.listen(0, z));
  const base = 'http://localhost:' + servidor.address().port;
  const b = await chromium.launch();
  console.log('carga ' + (lento ? 'estilo WebKit' : 'normal de Chromium'));

  console.log('escritorio, con movimiento');
  for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
    const { ctx, p } = await abre(b, base, { viewport: { width: 1280, height: 800 } });
    await ve(p, id); await p.waitForTimeout(2000);
    const s = await est(p, id); ok(s.e === 'pause' && s.w > 2 && s.w < 40, `${id} arranca sola al entrar: ${JSON.stringify(s)}`);
    await ctx.close();
  }
  {
    const { ctx, p, errores } = await abre(b, base, { viewport: { width: 1280, height: 800 } });
    await ve(p, 'p2'); await p.waitForTimeout(2000);
    await ve(p, 'p5'); await p.waitForTimeout(1200);
    const s1 = await est(p, 'p2'); ok(s1.e === 'play', `p2 se pausa al salir: ${JSON.stringify(s1)}`);
    await p.waitForTimeout(1500);
    const s2 = await est(p, 'p2'); ok(s2.w === s1.w, `p2 no avanza fuera de pantalla (${s1.w}% y ${s2.w}%)`);
    await ve(p, 'p2'); await p.waitForTimeout(1200);
    const s3 = await est(p, 'p2'); ok(s3.e === 'pause' && s3.w > s1.w, `p2 sigue al volver: ${JSON.stringify(s3)}`);
    await p.waitForTimeout(30000);
    let s = await est(p, 'p2'); ok(s.e === 'replay' && s.w === 100 && s.a === 'Repetir', `p2 termina en Repetir: ${JSON.stringify(s)}`);
    await clic(p, 'p2'); await p.waitForTimeout(1200);
    s = await est(p, 'p2'); ok(s.e === 'pause' && s.w < 15, `Repetir la reinicia: ${JSON.stringify(s)}`);
    await clic(p, 'p2'); await p.waitForTimeout(300);
    await ve(p, 'p5'); await p.waitForTimeout(800); await ve(p, 'p2'); await p.waitForTimeout(1200);
    s = await est(p, 'p2'); ok(s.e === 'play', `pausada con el botón sigue pausada al volver: ${JSON.stringify(s)}`);
    await ve(p, 'p3'); await p.waitForTimeout(1500);
    await idioma(p, 'en'); await p.waitForTimeout(2500);
    s = await est(p, 'p3'); ok(s.e === 'pause' && s.a === 'Pause', `p3 corriendo sigue corriendo en inglés: ${JSON.stringify(s)}`);
    s = await est(p, 'p2'); ok(s.e === 'play' && s.a === 'Play', `p2 pausada queda pausada en inglés: ${JSON.stringify(s)}`);
    ok(errores.length === 0, 'sin errores de JS ' + errores.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, p } = await abre(b, base, { viewport: { width: 1280, height: 800 } });
    await ve(p, 'p1'); await p.waitForTimeout(24500);
    await ve(p, 'p6'); await idioma(p, 'en'); await ve(p, 'p1'); await p.waitForTimeout(2000);
    const s = await est(p, 'p1'); ok(s.e === 'replay' && s.w === 100 && s.a === 'Replay', `p1 vista queda completa al cambiar de idioma: ${JSON.stringify(s)}`);
    await ctx.close();
  }

  console.log('teléfono, movimiento reducido');
  {
    const { ctx, p, errores } = await abre(b, base, { viewport: { width: 390, height: 844 }, isMobile: true, reducedMotion: 'reduce' });
    await ve(p, 'p4'); await p.waitForTimeout(1500);
    let s = await est(p, 'p4'); ok(s.e === 'play' && s.w === 0 && s.a === 'Reproducir', `p4 en diagrama completo con Reproducir, sin arrancar: ${JSON.stringify(s)}`);
    const fr = p.frames().find(f => f.url().includes('p4.html'));
    ok(/fmt=m/.test(fr.url()), 'formato de teléfono: ' + fr.url().split('/').pop());
    await clic(p, 'p4'); await p.waitForTimeout(1500);
    s = await est(p, 'p4'); ok(s.e === 'pause' && s.w > 0 && s.w < 20, `el botón la corre desde el inicio: ${JSON.stringify(s)}`);
    await fr.evaluate(() => document.getElementById('stage').click()); await p.waitForTimeout(300);
    s = await est(p, 'p4'); ok(s.e === 'play', `un toque en la lámina la pausa y el botón se entera: ${JSON.stringify(s)}`);
    ok(errores.length === 0, 'sin errores de JS ' + errores.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, p } = await abre(b, base, { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await ve(p, 'p5'); await p.waitForTimeout(100); await clic(p, 'p5'); await p.waitForTimeout(1500);
    const s = await est(p, 'p5'); ok(s.e === 'pause' && s.w > 0, `botón antes de que la lámina esté lista: la orden se entrega: ${JSON.stringify(s)}`);
    await ctx.close();
  }

  await b.close(); servidor.close();
  console.log(fallas ? `\n${fallas} FALLAS` : '\nsin fallas');
  process.exit(fallas ? 1 : 0);
})();

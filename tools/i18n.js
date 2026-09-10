// Chequeo del sistema i18n de index.html. Reporta lo que se quedaria en
// espanol al cambiar a EN, sin abrir el sitio a mano.
//
// El sistema tiene cuatro piezas y cada una tiene su chequeo:
//   1. diccionario translations: toda clave ES tiene su EN y viceversa
//   2. marcado data-i18n: todo texto visible del HTML cuelga de una clave
//   3. datos que pinta el JS: cada nota del mapa (ST) tiene nota_en
//   4. (opcional) el DOM real en EN, con Playwright: recorre el mapa y el
//      diagnostico y busca texto con marcas de espanol
//
// Uso, desde web/:   node tools/i18n.js [archivo]  (1 a 3, solo node)
//                    node tools/i18n.js --dom      (ademas 4; pide playwright)
// Sale con codigo 1 si hay hallazgos, para poder encadenarlo antes del push.
const fs = require('fs');
const path = require('path');

const file = path.resolve(process.argv.find((a, i) => i >= 2 && !a.startsWith('--')) || path.join(__dirname, '..', 'index.html'));
const html = fs.readFileSync(file, 'utf8');
let hallazgos = 0;
function falla(msg) { hallazgos++; console.log('  x ' + msg); }

// ---- 1. diccionario ------------------------------------------------------
const dictStart = html.indexOf('const translations = {');
const dictEnd = html.indexOf('\n};', dictStart) + 3;
const translations = eval('(' + html.slice(dictStart, dictEnd).replace('const translations =', '').replace(/;\s*$/, '') + ')');
const es = Object.keys(translations.es), en = Object.keys(translations.en);
console.log('1. diccionario: ' + es.length + ' claves ES, ' + en.length + ' EN');
es.filter(k => !en.includes(k)).forEach(k => falla('clave sin EN: ' + k));
en.filter(k => !es.includes(k)).forEach(k => falla('clave sin ES: ' + k));

// ---- 2. marcado -----------------------------------------------------------
// Recorre el <body> con un tokenizador minimo y lleva una pila de elementos
// abiertos; un texto esta cubierto si algun ancestro trae data-i18n.
const body = html.slice(html.indexOf('<body'), html.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<noscript[\s\S]*?<\/noscript>/g, '')
  .replace(/<svg[\s\S]*?<\/svg>/g, m => m.replace(/<path[^>]*>/g, ''));
const VOID = /^(br|img|input|meta|link|hr|path|circle|rect|line|use|source)$/i;
// Texto que no se traduce por definicion: marcas, nombres propios, cifras, simbolos.
const PERMITIDO = [
  /^[\s\d.,%$+:\-·|()\/]*[MK%]?$/,        // solo cifras y simbolos (1.66M, 2.5%)
  /^&[a-z]+;$/,                           // una entidad sola (&middot;)
  /^(ES|EN|FA|Fisco|Abierto|SAT|IMSS|DOF|MXN)$/,
  /^(Mercado Libre|Amazon|Uber|DiDi|Rappi|Airbnb|YouTube|TikTok|Freelance|PayPal \/ Wise|Crypto \(Binance, Bitso\))$/,
  /^(svg-maps|V\. Cazanave,|CC BY 4\.0)$/,
];
const keysUsadas = new Set();
const ariaUsadas = new Set();
const tokens = body.split(/(<[^>]+>)/);
const pila = [];
let sinClave = 0;
for (const tok of tokens) {
  if (!tok) continue;
  if (tok[0] === '<') {
    if (tok[1] === '/') { pila.pop(); continue; }
    const tag = (tok.match(/^<([a-zA-Z0-9-]+)/) || [])[1] || '';
    // data-i18n-js marca un elemento cuyo texto lo pinta el JS leyendo
    // currentLanguage; el HTML solo trae el respaldo. Lo cubre el paso 4.
    const key = (tok.match(/data-i18n="([^"]+)"/) || [])[1] || null;
    const aria = (tok.match(/data-i18n-aria="([^"]+)"/) || [])[1] || null;
    if (key) keysUsadas.add(key);
    const cubierto = key || (/data-i18n-js/.test(tok) ? 'js' : null);
    if (aria) ariaUsadas.add(aria);
    if (/aria-label="[^"]*"/.test(tok) && !aria && !/aria-label="[^"]*: [\d.]+%"/.test(tok) && !/aria-label="(Fisco Abierto|Idioma \/ Language)"/.test(tok)) {
      falla('aria-label sin data-i18n-aria: ' + tok.slice(0, 90));
    }
    if (VOID.test(tag) || tok.endsWith('/>')) continue;
    pila.push(cubierto);
    continue;
  }
  const texto = tok.replace(/\s+/g, ' ').trim();
  if (!texto) continue;
  if (pila.some(Boolean)) continue;
  if (PERMITIDO.some(re => re.test(texto))) continue;
  sinClave++;
  falla('texto sin data-i18n: "' + texto.slice(0, 80) + '"');
}
console.log('2. marcado: ' + keysUsadas.size + ' claves en el HTML, ' + sinClave + ' textos sin clave');
[...keysUsadas].filter(k => !(k in translations.es)).forEach(k => falla('data-i18n apunta a clave inexistente: ' + k));
[...ariaUsadas].filter(k => !(k in translations.es)).forEach(k => falla('data-i18n-aria apunta a clave inexistente: ' + k));
if (!('meta.title' in translations.en)) falla('falta meta.title en EN (document.title)');

// ---- 3. datos del mapa ----------------------------------------------------
const st = html.match(/var ST = (\{.*?\});\s*$/m);
if (!st) falla('no encuentro var ST del mapa');
else {
  const ST = JSON.parse(st[1]);
  let conNota = 0;
  Object.entries(ST).forEach(([id, d]) => {
    if (d.nota) conNota++;
    if (d.nota && !d.nota_en) falla('mapa ' + id + ' (' + d.n + '): nota sin nota_en');
    if (!d.nota && d.nota_en) falla('mapa ' + id + ' (' + d.n + '): nota_en sin nota');
  });
  console.log('3. mapa: ' + Object.keys(ST).length + ' estados, ' + conNota + ' con nota, todas con nota_en: ' + (hallazgos === 0 ? 'si' : 'ver arriba'));
}

// ---- 4. DOM real en EN (opcional) -----------------------------------------
async function dom() {
  let pw;
  try { pw = require('playwright'); } catch (e) {
    console.log('4. dom: playwright no esta instalado en este node; se omite (npm i -D playwright)');
    return;
  }
  const ESPANOL = /[áéíóúñ¿¡]|\b(de la|del|que|los|las|para|con|una|por|sin|más|tus|está|son|pagan|tasa|ley|junio|corte)\b/i;
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  await p.goto('file://' + file + '?lang=en');
  await p.waitForTimeout(400);
  function textos() {
    return p.evaluate(() => {
      const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n; while (n = w.nextNode()) {
        const t = n.textContent.replace(/\s+/g, ' ').trim(); if (!t) continue;
        const el = n.parentElement; if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
        if (el.closest('#mapPanel')) continue; // el panel se revisa estado por estado
        out.push(t);
      }
      return out;
    });
  }
  const vistos = new Set();
  async function revisa(etapa) {
    for (const t of await textos()) {
      if (vistos.has(t)) continue; vistos.add(t);
      if (ESPANOL.test(t) && !/^[A-Za-zÁ-ú ]+: [\d.]+%$/.test(t)) falla(etapa + ': "' + t.slice(0, 90) + '"');
    }
  }
  await revisa('carga');
  // El nombre del estado y el nombre de la ley (f) se citan en espanol por
  // contrato; se quitan antes de buscar marcas de espanol en el panel.
  const ST = JSON.parse(st[1]);
  const ids = await p.$$eval('.mx-st', els => els.map(e => e.getAttribute('data-st')));
  for (const id of ids) {
    await p.$eval('.mx-st[data-st="' + id + '"]', e => e.dispatchEvent(new Event('click')));
    let panel = await p.$eval('#mapPanel', e => e.innerText);
    panel = panel.split(ST[id].f).join('').split(ST[id].n).join('');
    if (ESPANOL.test(panel)) falla('mapa ' + id + ': "' + panel.replace(/\n/g, ' | ').slice(0, 120) + '"');
  }
  // Un recorrido del diagnostico, para que los resultados armados en JS tambien se lean.
  await p.click('.platform-btn[data-platform="airbnb"]');
  await p.click('.platform-btn[data-platform="uber"]');
  await p.click('#btn-step1');
  await p.click('.income-btn[data-income="umbral"]');
  await p.click('#btn-step2');
  await p.click('[data-fiscal="alta_sin_declarar"]');
  await p.click('[data-factura="no"]');
  await p.click('#btn-results');
  await p.waitForTimeout(300);
  await revisa('diagnostico');
  errores.forEach(e => falla('error de pagina: ' + e));
  console.log('4. dom: ' + vistos.size + ' textos distintos leidos en EN, ' + ids.length + ' estados, 1 diagnostico');
  await b.close();
}

(async () => {
  if (process.argv.includes('--dom')) await dom();
  console.log(hallazgos ? hallazgos + ' hallazgos' : 'sin hallazgos');
  process.exit(hallazgos ? 1 : 0);
})();

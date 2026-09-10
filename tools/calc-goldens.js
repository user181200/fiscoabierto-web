// Goldens de la calculadora de retenciones. Mueve la barra y cambia de
// actividad en la pagina REAL (Playwright) y compara lo que pinta contra
// cifras calculadas aqui, por separado, con las tasas escritas a mano.
// Si las dos cuentas coinciden, el error tendria que estar en las dos.
//
// Uso, desde web/:   node tools/calc-goldens.js          (pide playwright)
// Sale con codigo 1 si alguna cifra no coincide.
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) {
  console.log('playwright no esta instalado en este node (npm i -D playwright)');
  process.exit(2);
}

// Tasas de referencia, escritas aparte del sitio a proposito.
const ISR = { venta: 0.025, transporte: 0.021, hospedaje: 0.04 }; // 113-A fr. III (LIF 2026 art. 25 fr. VI), I y II
const ISR_2025_VENTA = 0.01;
const SIN_RFC = 0.20;   // 113-C fr. IV LISR
const IVA = 0.16;       // tasa general
const IVA_RET = 0.5;    // 18-J fr. II a) LIVA
const money = n => '$' + Math.round(n).toLocaleString('es-MX');
const pct = r => { const v = r * 100; return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + '%'; };

const CASOS = [];
for (const act of ['venta', 'transporte', 'hospedaje']) {
  for (const mensual of [5000, 20000, 24000, 26000, 60000]) {
    const anual = mensual * 12;
    const rateA = act === 'venta' ? ISR_2025_VENTA : ISR[act];
    const rateB = act === 'venta' ? ISR[act] : SIN_RFC;
    CASOS.push({
      act, mensual,
      past: money(anual * rateA),
      now: money(anual * rateB),
      diff: (anual * (rateB - rateA) > 0 ? '+' : '') + money(anual * (rateB - rateA)),
      ivaRfc: money(anual * IVA * IVA_RET),
      ivaSin: money(anual * IVA),
      totalPctRfc: pct(ISR[act] + IVA * IVA_RET),
      totalRfc: money(anual * ISR[act] + anual * IVA * IVA_RET),
      totalPctSin: pct(SIN_RFC + IVA),
      totalSin: money(anual * SIN_RFC + anual * IVA),
      umbral: anual > 300000,
    });
  }
}

(async () => {
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '?lang=es');
  await p.waitForTimeout(300);
  let fallas = 0;
  for (const c of CASOS) {
    await p.click('.act-btn[data-act="' + c.act + '"]');
    await p.$eval('#calcRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, String(c.mensual));
    const got = await p.evaluate(() => ({
      past: document.getElementById('calcPast').textContent,
      now: document.getElementById('calcNow').textContent,
      diff: document.getElementById('calcDiff').textContent,
      ivaRfc: document.getElementById('calcIvaRfc').textContent,
      ivaSin: document.getElementById('calcIvaSin').textContent,
      total: document.getElementById('calcIvaTotal').textContent,
      umbral: document.getElementById('calcVerdict').classList.contains('is-advance'),
    }));
    const esperadoTotal = [c.totalPctRfc, c.totalRfc, c.totalPctSin, c.totalSin];
    const errs = [];
    for (const k of ['past', 'now', 'diff', 'ivaRfc', 'ivaSin']) if (got[k] !== c[k]) errs.push(k + ' esperado ' + c[k] + ' pintado ' + got[k]);
    for (const e of esperadoTotal) if (!got.total.includes(e)) errs.push('total no contiene ' + e);
    if (got.umbral !== c.umbral) errs.push('umbral esperado ' + c.umbral + ' pintado ' + got.umbral);
    if (errs.length) { fallas++; console.log('  x ' + c.act + ' ' + money(c.mensual) + '/mes: ' + errs.join('; ')); }
  }
  errores.forEach(e => { fallas++; console.log('  x error de pagina: ' + e); });
  console.log(CASOS.length + ' casos, ' + fallas + ' fallas');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

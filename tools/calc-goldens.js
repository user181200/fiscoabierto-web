// Goldens de la calculadora de retenciones. Mueve la barra, cambia de
// actividad y de "tiene RFC" en la pagina REAL (Playwright) y compara el
// recibo que pinta contra cifras calculadas aqui, por separado, con las tasas
// escritas a mano. Si las dos cuentas coinciden, el error tendria que estar
// en las dos.
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
const IVA_RET = 0.5;    // 18-J fr. II a) LIVA; 100% sin RFC
const money = n => '$' + Math.round(n).toLocaleString('es-MX');
const menos = n => '−' + money(n);

function recibo(act, base, rfc) {
  const iva = base * IVA;
  const isr = base * (rfc ? ISR[act] : SIN_RFC);
  const ivaR = iva * (rfc ? IVA_RET : 1);
  return { cobra: base + iva, isr, ivaR, dep: base + iva - isr - ivaR };
}

const CASOS = [];
for (const act of ['venta', 'transporte', 'hospedaje']) {
  for (const rfc of [true, false]) {
    for (const mensual of [5000, 20000, 24000, 26000, 60000]) {
      const r = recibo(act, mensual, rfc);
      const ctx = [];
      if (!rfc) { const c = recibo(act, mensual, true); ctx.push(money(c.dep), money(c.dep - r.dep)); }
      else if (act === 'venta') ctx.push(money(mensual * ISR_2025_VENTA), money(mensual * ISR.venta));
      CASOS.push({
        act, rfc, mensual,
        cobra: money(r.cobra), isr: menos(r.isr), ivaR: menos(r.ivaR), dep: money(r.dep),
        anual: [money(r.isr * 12), money(r.ivaR * 12)], ctx,
        umbral: mensual * 12 > 300000,
      });
    }
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
    await p.click('.rfc-btn[data-rfc="' + (c.rfc ? 'si' : 'no') + '"]');
    await p.$eval('#calcRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, String(c.mensual));
    const got = await p.evaluate(() => ({
      cobra: document.getElementById('calcCobra').textContent,
      isr: document.getElementById('calcIsr').textContent,
      ivaR: document.getElementById('calcIvaR').textContent,
      dep: document.getElementById('calcDeposito').textContent,
      anual: document.getElementById('calcAnual').textContent,
      ctx: document.getElementById('calcContexto').textContent,
      umbral: document.getElementById('calcVerdict').classList.contains('is-advance'),
      barra: ['rbDep', 'rbIsr', 'rbIva'].reduce((a, id) => a + parseFloat(document.getElementById(id).style.width), 0),
    }));
    const errs = [];
    for (const k of ['cobra', 'isr', 'ivaR', 'dep']) if (got[k] !== c[k]) errs.push(k + ' esperado ' + c[k] + ' pintado ' + got[k]);
    for (const e of c.anual) if (!got.anual.includes(e)) errs.push('anual no contiene ' + e);
    for (const e of c.ctx) if (!got.ctx.includes(e)) errs.push('contexto no contiene ' + e);
    if (got.umbral !== c.umbral) errs.push('umbral esperado ' + c.umbral + ' pintado ' + got.umbral);
    if (Math.abs(got.barra - 100) > 0.05) errs.push('la barra suma ' + got.barra.toFixed(2) + '%');
    if (errs.length) { fallas++; console.log('  x ' + c.act + (c.rfc ? ' con RFC ' : ' sin RFC ') + money(c.mensual) + '/mes: ' + errs.join('; ')); }
  }
  errores.forEach(e => { fallas++; console.log('  x error de pagina: ' + e); });
  console.log(CASOS.length + ' casos, ' + fallas + ' fallas');
  await b.close();
  process.exit(fallas ? 1 : 0);
})();

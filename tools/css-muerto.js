// Selectores del <style> de index.html cuyas clases o ids no aparecen en el
// HTML ni en el JS del mismo archivo. Un selector asi no puede aplicar nunca:
// es CSS muerto y se puede podar sin cambiar el comportamiento.
//
// Estatico a proposito: no ejecuta nada. Una clase que el JS arma pegando
// cadenas ('mx-st b' + d.b) no se ve entera en el codigo, asi que las clases
// compuestas conocidas van en COMPUESTAS. Si aparece una nueva y el chequeo
// la reporta, se agrega ahi con su razon.
//
// Uso, desde web/:   node tools/css-muerto.js [archivo]
// Sale con codigo 1 si hay selectores muertos.
const fs = require('fs');
const path = require('path');
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const html = fs.readFileSync(file, 'utf8');

const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const sinStyle = html.replace(/<style>[\s\S]*?<\/style>/g, '');

// Clases y ids presentes en el HTML.
const enHtml = new Set();
for (const m of sinStyle.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).filter(Boolean).forEach(c => enHtml.add('.' + c));
for (const m of sinStyle.matchAll(/id="([^"]*)"/g)) enHtml.add('#' + m[1]);
// Cadenas del JS: cualquier literal es candidato a nombre de clase o id.
const js = [...sinStyle.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const enJs = new Set();
for (const m of js.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)) {
  const lit = m[1] !== undefined ? m[1] : m[2];
  lit.split(/[\s"'<>=]+/).forEach(tok => {
    tok.replace(/^[.#]/, '').split(/[.#]/).forEach(t => { if (t) enJs.add(t); });
  });
}
// Clases que el JS compone en tiempo de ejecucion y no existen enteras en el codigo.
const COMPUESTAS = {
  '.b1': 'mapa: "mx-st b" + d.b', '.b2': 'idem', '.b3': 'idem', '.b4': 'idem', '.b5': 'idem',
  '.risk-alto': 'resultados: "risk-" + nivel', '.risk-medio': 'idem', '.risk-bajo': 'idem',
};

function presente(tok) {
  if (enHtml.has(tok)) return true;
  if (tok in COMPUESTAS) return true;
  return enJs.has(tok.slice(1));
}

// Recorre las reglas (fuera y dentro de @media) y saca los selectores.
const reglas = [];
const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
const re = /([^{}]+)\{[^{}]*\}/g;
let m;
while ((m = re.exec(limpio))) {
  const sel = m[1].trim();
  if (!sel || sel.startsWith('@') || sel.startsWith('from') || sel.startsWith('to') || /^\d+%$/.test(sel)) continue;
  reglas.push(sel);
}
let muertos = 0;
const vistos = new Set();
for (const grupo of reglas) {
  for (const sel of grupo.split(',').map(x => x.trim()).filter(Boolean)) {
    if (vistos.has(sel)) continue; vistos.add(sel);
    // Solo clases e ids; se ignoran pseudo-clases, atributos y etiquetas.
    const toks = sel.replace(/::?[\w-]+(\([^)]*\))?/g, '').replace(/\[[^\]]*\]/g, '').match(/[.#][\w-]+/g) || [];
    const faltan = toks.filter(t => !presente(t));
    if (faltan.length) { muertos++; console.log('  x ' + sel + '   (sin uso: ' + faltan.join(' ') + ')'); }
  }
}
console.log(vistos.size + ' selectores, ' + muertos + ' muertos');
process.exit(muertos ? 1 : 0);

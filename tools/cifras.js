// Inventario de cifras del sitio con su fuente legal, leido de index.html.
// No valida nada: enumera. Sirve como lista de trabajo cuando cambia una ley
// (Paquete Economico, RMF, LIF) y como contrato de lo que un monitor vigila.
// Si una cifra no aparece aqui, el sitio la afirma sin fuente rastreable, y
// eso tambien es un hallazgo.
//
// Uso, desde web/:   node tools/cifras.js > ../CLAUDE_CTX/cifras-vigentes.md
const fs = require('fs');
const path = require('path');

const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const lines = html.split('\n');

// Cita legal: articulo, ley, DOF, RMF, anexo. Lo que un cambio normativo puede mover.
const CITA = /(Art(?:í|i)culo|Art\.|art\.)\s*\d+[\w-]*(?:\s*(?:BIS|Bis|TER|Ter))?(?:[^.;·]*?(?:LISR|LIVA|CFF|LIF(?:\s*\d{4})?|Ley de Hacienda|Ley de Ingresos))?|LIF\s*\d{4}|RMF\s*\d{4}|Anexo\s*\d+|DOF\s*\d{2}-[a-z]{3}-\d{4}|Regla\s*[\d.]+/g;
// Cifra: dinero, porcentaje, umbral, conteo con sufijo.
const CIFRA = /\$\s?[\d,]+(?:\.\d+)?(?:\s?(?:MXN|USD))?|\d+(?:\.\d+)?\s?%|\b\d{1,3}(?:,\d{3})+\b/g;

function seccionDe(i) {
  // La seccion es el <section> o el rotulo de script mas cercano hacia arriba.
  for (let k = i; k >= 0; k--) {
    const m = lines[k].match(/^<section[^>]*(?:id="([^"]+)"|class="([^"]+)")/);
    if (m) return m[1] || m[2];
    const s = lines[k].match(/^\/\/ =+ (.+?) =+$/);
    if (s) return s[1].trim();
  }
  return '?';
}

function limpiar(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/^\s*['"]?[\w.]+['"]?\s*:\s*['"]?/, '').trim();
}

const out = [];
const hoy = new Date().toISOString().slice(0, 10);
out.push(`# Cifras vigentes en fiscoabierto.org`);
out.push(``);
out.push(`Generado ${hoy} por web/tools/cifras.js sobre ${path.basename(file)} (${lines.length} lineas). No editar a mano: regenerar.`);
out.push(``);

// 0. Fecha de verificacion de cada bloque, leida de data-verificado. El sitio
// la muestra; aqui se mide su edad. Pasados 90 dias sin re-verificar, el bloque
// se lista como vencido: es el selector de la rutina de mantenimiento.
out.push(`## Fecha de verificacion por bloque`);
out.push(``);
out.push(`| Bloque | Verificado | Dias | Estado |`);
out.push(`|---|---|---|---|`);
let vencidos = 0;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/data-verificado="(\d{4}-\d{2}-\d{2})"/);
  if (!m) continue;
  const dias = Math.floor((Date.parse(hoy) - Date.parse(m[1])) / 86400000);
  const vencido = dias > 90;
  if (vencido) vencidos++;
  out.push(`| ${seccionDe(i)} | ${m[1]} | ${dias} | ${vencido ? 'VENCIDO (mas de 90 dias)' : 'vigente'} |`);
}
out.push(``);
out.push(vencidos ? `${vencidos} bloque(s) con verificacion vencida: re-verificar antes del siguiente push de contenido.` : `Ningun bloque pasa de 90 dias.`);
out.push(``);

// 1. Banda de cifras: numero + etiqueta + fuente, tal como se publican.
out.push(`## Banda de cifras (stats-section)`);
out.push(``);
out.push(`| # | Cifra | Etiqueta (ES) | Fuente | Linea |`);
out.push(`|---|---|---|---|---|`);
let n = 0;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/class="stat-number" data-count="([^"]+)" data-prefix="([^"]*)" data-suffix="([^"]*)"/);
  if (!m) continue;
  const label = limpiar((lines[i + 1] || '').replace(/.*data-i18n="[^"]+">/, ''));
  const src = limpiar((lines[i + 2] || '').replace(/.*class="stat-source"[^>]*>/, ''));
  out.push(`| ${++n} | ${m[2]}${m[1]}${m[3]} | ${label} | ${src} | ${i + 1} |`);
}
out.push(``);

// 2. Calculadora: las constantes que producen los pesos.
out.push(`## Calculadora de retencion (constantes JS)`);
out.push(``);
out.push(`| Constante | Valor | Comentario en codigo | Linea |`);
out.push(`|---|---|---|---|`);
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const act = l.match(/^\s*(venta|transporte|hospedaje):\s*\{\s*past:\s*([\d.]+),\s*now:\s*([\d.]+),\s*frac:\s*'([^']+)'/);
  if (act) { out.push(`| ACTS.${act[1]} | 2025 ${(act[2]*100).toFixed(1)}% / 2026 ${(act[3]*100).toFixed(1)}% | Art. 113-A parrafo tercero, fr. ${act[4]} | ${i + 1} |`); continue; }
  const c = l.match(/^\s*var (THRESHOLD|SIN_RFC|IVA|IVA_RET)\s*=\s*([\d.]+);\s*\/\/\s*(.*)$/);
  if (c) out.push(`| ${c[1]} | ${c[2]} | ${c[3].trim()} | ${i + 1} |`);
}
out.push(``);

// 3. Mapa de hospedaje: 32 tasas estatales con su fuente y su grado de confirmacion.
const st = html.match(/var ST = (\{.*?\});\s*$/m);
if (st) {
  const ST = JSON.parse(st[1]);
  const R = { si: 'confirmada', nv: 'no verificada en fuente vigente', par: 'confirmacion parcial' };
  out.push(`## Mapa del impuesto al hospedaje (${Object.keys(ST).length} estados)`);
  out.push(``);
  out.push(`| Estado | Tasa | Fuente | Confirmacion | Nota |`);
  out.push(`|---|---|---|---|---|`);
  Object.values(ST).sort((a, b) => a.n.localeCompare(b.n, 'es')).forEach(e => {
    out.push(`| ${e.n} | ${e.t}% | ${e.f} | ${R[e.r] || e.r} | ${(e.nota || '').replace(/\|/g, '/')} |`);
  });
  const conteo = {};
  Object.values(ST).forEach(e => { conteo[e.r] = (conteo[e.r] || 0) + 1; });
  out.push(``);
  out.push(`Confirmacion: ${Object.entries(conteo).map(([k, v]) => `${R[k] || k} ${v}`).join(' · ')}.`);
  out.push(``);
}

// 4. Toda linea del archivo que afirma algo con cita legal (textos ES, JS del
// diagnostico, pies de seccion). Es la red de seguridad: lo que 1-3 no cubren.
out.push(`## Afirmaciones con cita legal en el resto del archivo`);
out.push(``);
out.push(`Una fila por linea del index que contiene una cita. Se omiten las lineas en ingles (el dict en empieza en la linea ${lines.findIndex(l => /^\s*en: \{/.test(l)) + 1}) y las ya listadas arriba.`);
out.push(``);
out.push(`| Linea | Seccion | Citas | Cifras en la misma linea | Fragmento |`);
out.push(`|---|---|---|---|---|`);
const enStart = lines.findIndex(l => /^\s*en: \{/.test(l));
const enEnd = lines.findIndex((l, i) => i > enStart && /^\s*\}\s*,?\s*$/.test(l));
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (i >= enStart && i <= enEnd) continue;
  if (/^\s*\?\s*'/.test(l)) continue;                 // rama inglesa de un ternario
  if (/class="stat-source"|^\s*var (THRESHOLD|SIN_RFC|IVA|IVA_RET)|^\s*(venta|transporte|hospedaje):\s*\{|var ST = /.test(l)) continue;
  const citas = l.match(CITA);
  if (!citas) continue;
  const cifras = l.match(CIFRA) || [];
  const texto = limpiar(l);
  const frag = texto.length > 140 ? texto.slice(0, 140) + '...' : texto;
  out.push(`| ${i + 1} | ${seccionDe(i)} | ${[...new Set(citas.map(c => c.trim()))].join('; ')} | ${[...new Set(cifras)].join(', ') || '(ninguna)'} | ${frag.replace(/\|/g, '/')} |`);
}
out.push(``);

// 5. Cifras huerfanas: dinero o porcentaje en texto ES sin cita en la misma linea.
// Excluye CSS, comentarios y las ramas en ingles del diagnostico.
out.push(`## Cifras sin cita en la misma linea (revisar a mano)`);
out.push(``);
out.push(`| Linea | Seccion | Cifras | Fragmento |`);
out.push(`|---|---|---|---|`);
let enComentario = false, enStyle = false;
for (let i = 0; i < lines.length; i++) {
  let l = lines[i];
  if (/^\s*<style/.test(l)) { enStyle = true; continue; }
  if (/^\s*<\/style>/.test(l)) { enStyle = false; continue; }
  if (enStyle) continue;                                          // todo el bloque CSS
  l = l.replace(/rgba?\([^)]*\)/g, '').replace(/style="[^"]*"/g, ''); // colores y estilos en linea
  if (/<!--/.test(l) && !/-->/.test(l)) { enComentario = true; continue; }
  if (enComentario) { if (/-->/.test(l)) enComentario = false; continue; }
  if (/<!--.*-->/.test(l)) continue;
  if (i >= enStart && i <= enEnd) continue;
  if (/^\s*\?\s*'/.test(l)) continue;
  if (/\/\//.test(l)) continue;                                   // comentario JS en la linea
  if (/^\s*[.@#a-z-]+[^'"]*\{|^\s*[a-z-]+\s*:\s*[^'"]*;\s*$/.test(l)) continue; // CSS
  if (/\b(per month|than|between|less|more)\b/.test(l)) continue;    // rama inglesa sin '?'
  if (CITA.test(l)) { CITA.lastIndex = 0; continue; }
  CITA.lastIndex = 0;
  const cifras = (l.match(CIFRA) || []).filter(c => /\$|%/.test(c) || /,/.test(c));
  if (!cifras.length) continue;
  const texto = limpiar(l);
  if (texto.length < 12) continue;
  out.push(`| ${i + 1} | ${seccionDe(i)} | ${[...new Set(cifras)].join(', ')} | ${(texto.length > 120 ? texto.slice(0, 120) + '...' : texto).replace(/\|/g, '/')} |`);
}
out.push(``);

// 6. El mismo texto ES vive dos veces: en el HTML (respaldo sin JS) y en
// translations.es (lo que pinta el i18n). Si divergen, el visitante sin JS y
// el visitante con JS leen cifras distintas. Solo compara elementos de una linea.
out.push(`## Divergencias entre el HTML y translations.es`);
out.push(``);
const esStart = lines.findIndex(l => /^\s*es: \{/.test(l));
const dict = {};
for (let i = esStart + 1; i < enStart; i++) {
  const m = lines[i].match(/^\s*'([\w.]+)':\s*'((?:[^'\\]|\\.)*)'/);
  if (m) dict[m[1]] = m[2].replace(/\\'/g, "'");
}
const ENT = { '&copy;': '©', '&trade;': '™', '&nbsp;': ' ', '&amp;': '&', '&middot;': '·', '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&oacute;': 'ó', '&uacute;': 'ú', '&ntilde;': 'ñ' };
const norm = t => t.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, e => ENT[e] || e).replace(/\s+/g, ' ').trim();
let divergencias = 0, comparados = 0;
const filas = [];
// Contenido de un elemento de una linea hasta su propio cierre, contando las
// etiquetas del mismo nombre anidadas: un <a> dentro de un <p> no lo corta.
function interior(linea) {
  const ab = linea.match(/<(\w+)\b[^>]*\sdata-i18n="([\w.]+)"[^>]*>/);
  if (!ab) return null;
  const tag = ab[1], desde = ab.index + ab[0].length;
  const re = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'g'); re.lastIndex = desde;
  let prof = 1, t;
  while ((t = re.exec(linea))) { prof += t[1] ? -1 : 1; if (!prof) return [ab[2], linea.slice(desde, t.index)]; }
  return null;
}
for (let i = 0; i < lines.length; i++) {
  if (i >= esStart) break;
  const m = interior(lines[i]);
  if (!m || !(m[0] in dict)) continue;
  comparados++;
  const a = norm(m[1]), b = norm(dict[m[0]]);
  if (a !== b) { divergencias++; filas.push(`| ${m[0]} | ${i + 1} | ${a.slice(0, 90).replace(/\|/g, '/')} | ${b.slice(0, 90).replace(/\|/g, '/')} |`); }
}
out.push(`Comparados ${comparados} elementos de una linea; divergencias: ${divergencias}.`);
if (filas.length) {
  out.push(``);
  out.push(`| Clave | Linea HTML | HTML | Dict |`);
  out.push(`|---|---|---|---|`);
  filas.forEach(f => out.push(f));
}
out.push(``);
process.stdout.write(out.join('\n'));

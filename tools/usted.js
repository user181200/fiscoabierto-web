// Tuteo en el texto en español de Fisco Abierto. Desde el 30 de septiembre de
// 2026 el proyecto habla de usted (decisión de José). Este chequeo busca lo que
// delata el tú en lo que el lector ve: pronombres y posesivos (tú, tu, tus, te,
// ti, contigo, tuyo) y una lista de verbos en segunda persona que el sitio usó.
//
// Revisa texto, no código: en los .html lee los nodos de texto, los atributos
// que se muestran o indexan (title, alt, aria-label, content, placeholder) y
// los literales de cadena de los <script>. El inglés no dispara nada, porque
// ninguna marca de la lista existe en inglés.
//
// Uso, desde web/:
//   node tools/usted.js                        index.html, aprende/index.html, aprende/laminas/p*.html y const.js
//   node tools/usted.js archivo.html otro.md   esos archivos (.html, .md o .js: newsletter, videos, generadores)
// Sale con código 1 si encuentra algo.
const fs = require('fs');
const path = require('path');

const L = '\\p{L}';
const PRONOMBRES = ['tú', 'tu', 'tus', 'te', 'ti', 'contigo', 'tuyo', 'tuya', 'tuyos', 'tuyas'];
// Formas que el sitio tuvo en tú. Se excluyen las que también son sustantivo
// (facturas, causas, sumas) o tercera persona (toma, elige, revisa, toca).
const VERBOS = ['generas', 'vendes', 'vendas', 'vendiste', 'cobras', 'cobraste', 'declaras', 'declaraste', 'puedes', 'puedas',
  'tienes', 'tengas', 'tenías', 'estás', 'estés', 'eres', 'ganas', 'ganaste', 'rebasas', 'rebasaste', 'diste', 'das', 'tuviste',
  'pasaste', 'optas', 'acreditas', 'sabes', 'sepas', 'emites', 'recibes', 'recibas', 'usas', 'necesitas', 'quieres', 'quieras',
  'pierdes', 'presentas', 'inscribes', 'vas', 'ves', 'haces', 'haz', 'supón', 'pagas', 'pagaste', 'debes', 'hayas', 'calculas',
  'trasladas', 'ejerces', 'transportas', 'repartes', 'hospedas', 'llevas', 'optaste', 'presentaste', 'cierras', 'cumpliste', 'obtuviste',
  'inscríbete', 'suscríbete', 'asegúrate', 'darte', 'inscribirte', 'obligarte', 'depositarte', 'pagarte', 'cobrarte', 'respetarte',
  'informarte', 'devolverte', 'escucharte', 'asesorarte', 'representarte'];
const RE = new RegExp(`(?<![${L}])(${[...PRONOMBRES, ...VERBOS].join('|')})(?![${L}])`, 'giu');

const ENT = { '&nbsp;': ' ', '&amp;': '&', '&middot;': '·', '&copy;': '©', '&trade;': '™', '&laquo;': '«', '&raquo;': '»', '&minus;': '−' };
const deco = t => t.replace(/&[a-z]+;/g, e => ENT[e] || ' ');

function trozos(archivo) {
  let src = fs.readFileSync(archivo, 'utf8');
  if (/\.md$/i.test(archivo)) return [src.replace(/```[\s\S]*?```/g, ' ')];
  // Un .js se lee como un solo script (generadores de gráficos y portadas).
  if (/\.js$/i.test(archivo)) src = '<script>' + src + '</script>';
  const out = [];
  // Literales de los scripts
  src.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (m, js) => {
    js.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ')
      .replace(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g, (mm, a, b, c) => { out.push(a || b || c || ''); return ''; });
    return '';
  });
  const html = src.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  // Atributos visibles o indexados
  html.replace(/\s(?:title|alt|aria-label|content|placeholder)="([^"]*)"/g, (m, v) => { out.push(v); return ''; });
  // Nodos de texto
  out.push(deco(html.replace(/<[^>]+>/g, '\n')));
  return out;
}

const args = process.argv.slice(2);
const raiz = path.join(__dirname, '..');
const archivos = args.length ? args : [
  path.join(raiz, 'index.html'),
  path.join(raiz, 'aprende', 'index.html'),
  ...fs.readdirSync(path.join(raiz, 'aprende', 'laminas')).filter(f => /^p\d+\.html$|^const\.js$/.test(f)).sort().map(f => path.join(raiz, 'aprende', 'laminas', f)),
];

let total = 0;
for (const a of archivos) {
  const hallados = [];
  for (const t of trozos(a)) {
    for (const linea of t.split('\n')) {
      RE.lastIndex = 0;
      const m = linea.match(RE);
      if (m) hallados.push(`    [${[...new Set(m.map(x => x.toLowerCase()))].join(', ')}] ${linea.replace(/\s+/g, ' ').trim().slice(0, 110)}`);
    }
  }
  console.log((hallados.length ? '  x ' : '  ok ') + path.relative(process.cwd(), a) + (hallados.length ? ': ' + hallados.length + ' líneas con tuteo' : ''));
  hallados.forEach(h => console.log(h));
  total += hallados.length;
}
console.log(total ? total + ' líneas con tuteo' : 'sin tuteo');
process.exit(total ? 1 : 0);

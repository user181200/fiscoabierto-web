// Corre los scripts del sitio contra un DOM de mentiras. No valida diseño:
// valida que el camino de arranque no truene. Es el chequeo que node --check
// no puede hacer, porque un identificador libre es sintaxis valida.
//
// Uso, desde web/:
//   node tools/smoke.js              todos los <script> de index.html, uno por uno
//   node tools/smoke.js otro.html    lo mismo sobre otro archivo html
//   node tools/smoke.js archivo.js   un script suelto (extraido a mano)
// Un bloque vacio cuenta como FALLA: un sed con el rotulo equivocado no debe
// pasar en silencio.
const fs = require('fs');
const path = require('path');
function el(cls) {
  return {
    className: cls || '', classList: { add(){}, remove(){}, toggle(){return false}, contains(){return false} },
    style: {}, children: [], firstChild: null, textContent: '', innerHTML: '',
    // dataset devuelve '' para cualquier data-* que el script pida: el DOM real
    // solo entrega elementos que SI traen el atributo, el stub no discrimina.
    dataset: new Proxy({}, { get: (o, k) => (k in o ? o[k] : '') }),
    offsetHeight: 700, offsetWidth: 900, clientWidth: 900, clientHeight: 700, width: 900, height: 700,
    getBoundingClientRect: () => ({top:100,bottom:400,left:0,right:900,width:900,height:300}),
    querySelector: () => el(), querySelectorAll: () => [el(),el(),el()],
    appendChild(c){ this.children.push(c); return c; }, removeChild(){}, insertBefore(){}, setAttribute(){}, removeAttribute(){},
    addEventListener(){}, removeEventListener(){}, closest: () => el(), focus(){}, blur(){},
    getContext: () => ({ clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, arc(){}, fill(){}, setTransform(){} }),
    getAttribute(){return null},
    get parentNode(){ return el('padre-de-mentiras'); },
    get parentElement(){ return el('padre-de-mentiras'); },
    get nextSibling(){ return null; },
    scrollWidth: 900, scrollLeft: 0
  };
}
const doc = {
  documentElement: el('html'), head: el('head'), body: el('body'), title: '',
  getElementById: () => el('trust-chain'),
  querySelector: () => el(), querySelectorAll: () => [el(),el(),el(),el(),el(),el()],
  createElement: () => el(), createElementNS: () => el(),
  addEventListener(){}, dispatchEvent(){}, fonts: { ready: { then(){} } }
};
const win = {
  innerHeight: 900, innerWidth: 1440, scrollY: 0, devicePixelRatio: 2,
  location: { search: '', hash: '', pathname: '/', href: 'https://fiscoabierto.org/' },
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  navigator: { language: 'es-MX', languages: ['es-MX'], userAgent: 'humo' },
  matchMedia: () => ({ matches:false, addEventListener(){}, addListener(){} }),
  getComputedStyle: () => ({ getPropertyValue: () => '0.93', position: 'sticky', alignItems: 'center' }),
  // Corre el primer frame en el acto (es el que revienta si algo falta) y
  // deja de encolar despues de unos cuantos: un loop de dibujo real se
  // re-encola solo y aqui no hay reloj que lo corte.
  requestAnimationFrame: cb => { if (win._frames++ < 4) cb(win._frames * 16); return 1; }, cancelAnimationFrame(){},
  _frames: 0,
  addEventListener(){}, ResizeObserver: function(){ this.observe = function(){}; },
  IntersectionObserver: function(){ this.observe = function(){}; },
  MutationObserver: function(){ this.observe = function(){}; this.disconnect = function(){}; }
};
win.window = win; win.document = doc;

function corre(nombre, src) {
  win._frames = 0;
  if (!src.trim()) {
    console.log('  FALLA ' + nombre + ': bloque vacio (rotulo mal escrito o script borrado)');
    process.exitCode = 1;
    return;
  }
  try {
    new Function('window','document','navigator','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','setTimeout','IntersectionObserver','ResizeObserver','MutationObserver',src)
      (win, doc, win.navigator, win.getComputedStyle, win.requestAnimationFrame, win.cancelAnimationFrame, (f)=>0, win.IntersectionObserver, win.ResizeObserver, win.MutationObserver);
    console.log('  OK   ' + nombre + ': el arranque corre sin reventar');
  } catch (e) {
    console.log('  FALLA ' + nombre + ': ' + e.constructor.name + ' -> ' + e.message);
    process.exitCode = 1;
  }
}

const arg = process.argv[2];
if (arg && !/\.html?$/.test(arg)) {
  corre(arg.split('/').pop(), fs.readFileSync(arg, 'utf8'));
} else {
  // Cada <script> del index, con el rotulo <!-- ... --> que lo antecede si lo hay.
  const html = fs.readFileSync(arg || path.join(__dirname, '..', 'index.html'), 'utf8');
  const re = /(?:<!-- ([^\n]*?) -->\s*)?<script>\n([\s\S]*?)\n<\/script>/g;
  let m, n = 0;
  while ((m = re.exec(html))) { n++; corre(m[1] || 'script ' + n + ' (sin rotulo)', m[2]); }
  if (!n) { console.log('  FALLA no encontre ningun <script> en index.html'); process.exitCode = 1; }
}

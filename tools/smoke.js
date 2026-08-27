// Corre un script del sitio contra un DOM de mentiras. No valida diseño:
// valida que el camino de arranque no truene. Es el chequeo que node --check
// no puede hacer, porque un identificador libre es sintaxis valida.
const fs = require('fs');
function el(cls) {
  return {
    className: cls || '', classList: { add(){}, contains(){return false} },
    style: {}, children: [], firstChild: null,
    offsetHeight: 700, offsetWidth: 900, clientWidth: 900, clientHeight: 700, width: 900, height: 700,
    getBoundingClientRect: () => ({top:100,bottom:400,left:0,right:900,width:900,height:300}),
    querySelector: () => el(), querySelectorAll: () => [el(),el(),el()],
    appendChild(){}, removeChild(){}, insertBefore(){}, setAttribute(){}, removeAttribute(){},
    addEventListener(){}, removeEventListener(){}, closest: () => el(), focus(){}, blur(){},
    getContext: () => ({ clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, arc(){}, fill(){}, setTransform(){} }),
    getAttribute(){return null},
    get parentNode(){ return el('padre-de-mentiras'); },
    get nextSibling(){ return null; },
    scrollWidth: 900, clientWidth: 900, scrollLeft: 0
  };
}
const doc = {
  documentElement: el('html'), head: el('head'), body: el('body'),
  getElementById: () => el('trust-chain'),
  querySelector: () => el(), querySelectorAll: () => [el(),el(),el(),el(),el(),el()],
  createElement: () => el(), createElementNS: () => el(),
  addEventListener(){}, fonts: { ready: { then(){} } }
};
const win = {
  innerHeight: 900, innerWidth: 1440, scrollY: 0, devicePixelRatio: 2,
  matchMedia: () => ({ matches:false, addEventListener(){}, addListener(){} }),
  getComputedStyle: () => ({ getPropertyValue: () => '0.93', position: 'sticky', alignItems: 'center' }),
  requestAnimationFrame: cb => { cb(0); return 1; }, cancelAnimationFrame(){},
  addEventListener(){}, ResizeObserver: function(){ this.observe = function(){}; },
  IntersectionObserver: function(){ this.observe = function(){}; }
};
win.window = win; win.document = doc;
const src = fs.readFileSync(process.argv[2], 'utf8');
try {
  new Function('window','document','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','setTimeout','IntersectionObserver','ResizeObserver',src)
    (win, doc, win.getComputedStyle, win.requestAnimationFrame, win.cancelAnimationFrame, (f)=>0, win.IntersectionObserver, win.ResizeObserver);
  console.log('  OK   ' + process.argv[2].split('/').pop() + ': el arranque corre sin reventar');
} catch (e) {
  console.log('  FALLA ' + process.argv[2].split('/').pop() + ': ' + e.constructor.name + ' -> ' + e.message);
  process.exitCode = 1;
}

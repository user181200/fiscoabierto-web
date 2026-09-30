// Motor de las láminas de /aprende.
//
// Parte del motor de videos/engine.js y conserva su contrato: seek(t) pinta el
// cuadro del segundo t y nada se mueve solo. Agrega dos cosas.
//   1. Propiedades CSS propias (claves que empiezan con --), para efectos que
//      no son opacidad ni posición, como el subrayado que avanza por un texto.
//   2. Dos modos para la misma lámina.
//      ?modo=video  la maneja render.js cuadro por cuadro, con marca arriba y
//                   tarjeta final con fuentes y aviso legal. Sale a MP4.
//      sin modo     corre en vivo dentro de /aprende: se escala a su marco,
//                   avanza con el reloj, termina en el diagrama completo y
//                   habla con la página por postMessage.
(function () {
  const tracks = [];
  const E = {
    io: x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    out: x => 1 - Math.pow(1 - x, 3),
    in: x => x * x * x,
    lin: x => x,
  };
  const Q = new URLSearchParams(location.search);

  // at(selector|elemento, inicio, duración, desde, hasta, curva)
  window.at = function (target, t0, dur, from, to, ease) {
    const els = typeof target === 'string' ? Array.from(document.querySelectorAll(target)) : [target];
    if (!els.length) throw new Error('at(): no existe ' + target);
    // Copia por elemento: finalize() resuelve el `from` en null de cada uno por separado.
    els.forEach(el => tracks.push({ el, t0, dur: Math.max(dur, 0.0001), from: { ...from }, to: { ...to }, ease: E[ease || 'io'] }));
  };
  // Entrada estándar: sube 14 px y aparece.
  window.enter = (t, t0, d = 0.6, dy = 14) => at(t, t0, d, { o: 0, dy: dy }, { o: 1, dy: 0 }, 'out');
  // Salida desde la opacidad que el elemento tenga en t0 (error 15 del CTX).
  window.leave = (t, t0, d = 0.4) => at(t, t0, d, { o: null }, { o: 0 }, 'in');
  window.place = (target, x, y) => at(target, -1, 0.0001, { x, y }, { x, y }, 'lin');
  window.draw = (target, t0, d) => at(target, t0, d, { draw: 0 }, { draw: 1 }, 'io');
  // Barrido de 0 a 1 en la propiedad --p del elemento (subrayados, rellenos).
  window.sweep = (target, t0, d) => at(target, t0, d, { '--p': 0 }, { '--p': 1 }, 'io');

  window.seek = function (t) {
    if (!window.__listo) throw new Error('seek() antes de finalize()');
    const state = new Map();
    for (const tr of tracks) {
      let st = state.get(tr.el); if (!st) { st = {}; state.set(tr.el, st); }
      for (const k in tr.to) {
        if (!(k in st)) st[k] = tr.from[k];
        if (t >= tr.t0) {
          const p = Math.min(1, (t - tr.t0) / tr.dur), e = tr.ease(p);
          st[k] = tr.from[k] + (tr.to[k] - tr.from[k]) * e;
        }
      }
    }
    for (const [el, st] of state) {
      if ('o' in st) el.style.opacity = st.o;
      if ('draw' in st) {
        const L = el.__len || (el.__len = el.getTotalLength());
        el.style.strokeDasharray = L; el.style.strokeDashoffset = L * (1 - st.draw);
        // La punta de flecha no obedece al dasharray: entra cuando el trazo llegó al final.
        if (el.hasAttribute('marker-end') || el.__marker) {
          el.__marker = el.__marker || el.getAttribute('marker-end');
          if (st.draw >= 0.97) el.setAttribute('marker-end', el.__marker); else el.removeAttribute('marker-end');
        }
      }
      if ('w' in st) el.style.width = st.w + 'px';
      if ('h' in st) el.style.height = st.h + 'px';
      for (const k in st) if (k.startsWith('--')) el.style.setProperty(k, st[k]);
      if ('x' in st || 'y' in st || 's' in st || 'dy' in st || 'dx' in st) {
        const x = (st.x || 0) + (st.dx || 0), y = (st.y || 0) + (st.dy || 0), s = ('s' in st) ? st.s : 1;
        const center = el.classList.contains('c');
        el.style.transform = (center ? `translate(${x}px, ${y}px) translate(-50%, -50%)` : `translate(${x}px, ${y}px)`) + ` scale(${s})`;
      }
    }
  };
  function valor(el, k, time, hasta) {
    let v;
    for (let i = 0; i < hasta; i++) {
      const tr = tracks[i];
      if (tr.el !== el || !(k in tr.to)) continue;
      if (v === undefined) v = tr.from[k];
      if (time >= tr.t0) v = tr.from[k] + (tr.to[k] - tr.from[k]) * tr.ease(Math.min(1, (time - tr.t0) / tr.dur));
    }
    return v;
  }
  window.finalize = function () {
    tracks.sort((a, b) => a.t0 - b.t0);
    tracks.forEach((tr, i) => {
      for (const k in tr.from) if (tr.from[k] === null) {
        const v = valor(tr.el, k, tr.t0, i);
        tr.from[k] = v === undefined ? (k === 'o' || k === 's' ? 1 : 0) : v;
      }
    });
    window.__listo = true;
  };

  window.LANG = Q.get('lang') === 'en' ? 'en' : 'es';
  // Formato: d = 16:9 (1280x720), m = 4:5 para teléfono (720x900).
  window.FMT = Q.get('fmt') === 'm' ? 'm' : 'd';
  window.M = window.FMT === 'm';
  window.VIDEO = Q.get('modo') === 'video';
  const root = document.documentElement;
  if (window.M) root.classList.add('m');
  root.classList.add(window.VIDEO ? 'modo-video' : 'modo-vivo');
  if (window.M) document.querySelectorAll('svg.wires').forEach(v => v.setAttribute('viewBox', '0 0 720 900'));
  window.wire = (id, d, m) => document.getElementById(id).setAttribute('d', window.M ? m : d);
  window.pos = (id, d, m) => { const e = document.getElementById(id), v = window.M ? m : d; if (v[0] != null) e.style.left = v[0] + 'px'; if (v[1] != null) e.style.top = v[1] + 'px'; };
  // Oculta para siempre en un formato, por visibility, que seek() no toca.
  window.hideIn = (fmt, sel) => { if (window.FMT === fmt) document.querySelectorAll(sel).forEach(e => { e.style.visibility = 'hidden'; }); };
  window.mx = n => '$' + Math.round(n).toLocaleString('en-US');
  window.fill = function (T) {
    const d = T[LANG];
    root.lang = LANG;
    document.querySelectorAll('[data-t]').forEach(el => {
      const k = el.getAttribute('data-t');
      if (!(k in d)) throw new Error('falta texto ' + LANG + ': ' + k);
      el.innerHTML = d[k];
    });
  };

  // terminar(fin): fin es el segundo en que el diagrama queda completo.
  // En video, el diagrama sale y entra la tarjeta de cierre; en vivo, la
  // lámina se detiene en el diagrama completo, que es también su estado con
  // movimiento reducido.
  window.terminar = function (fin) {
    window.FIN = fin;
    if (window.VIDEO) {
      leave('#stage > :not(.brand):not(.kicker):not(#end)', fin + 2.2, 0.6);
      enter('#end', fin + 3.0, 0.8, 16);
      window.DURATION = fin + 11.5;
      window.POSTER = fin + 1.0;
    } else {
      window.DURATION = fin;
      window.POSTER = fin;
    }
    finalize();
    seek(0);
    if (!window.VIDEO) vivo();
  };

  // ---- Modo en vivo ---------------------------------------------------------
  function vivo() {
    const stage = document.getElementById('stage');
    const W = window.M ? 720 : 1280;
    const escala = () => { stage.style.transform = 'scale(' + (window.innerWidth / W) + ')'; };
    escala(); window.addEventListener('resize', escala);

    let t = 0, corre = false, antes = 0, raf = 0;
    const avisa = tipo => { if (window.parent !== window) window.parent.postMessage({ faLamina: 1, tipo, t, fin: window.FIN, corre }, '*'); };
    // Avanza por reloj con dt acotado: un cuadro lento no salta la animación
    // (error 3 del CTX) y una pestaña en segundo plano no la adelanta.
    const paso = ahora => {
      t = Math.min(t + Math.min((ahora - antes) / 1000, 1 / 15), window.FIN); antes = ahora;
      seek(t); avisa('t');
      if (t >= window.FIN) { corre = false; avisa('fin'); return; }
      raf = requestAnimationFrame(paso);
    };
    const ctl = {
      play() { if (t >= window.FIN) t = 0; corre = true; antes = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(paso); avisa('estado'); },
      pausa() { corre = false; cancelAnimationFrame(raf); avisa('estado'); },
      final() { corre = false; cancelAnimationFrame(raf); t = window.FIN; seek(t); avisa('fin'); },
    };
    window.addEventListener('message', e => { const d = e.data; if (d && d.faControl && ctl[d.faControl]) ctl[d.faControl](); });
    // Tocar la lámina pausa o reanuda; tocar un nodo con data-baja lleva al
    // peldaño que lo explica.
    stage.addEventListener('click', e => {
      const n = e.target.closest('[data-baja]');
      if (n) { if (window.parent !== window) window.parent.postMessage({ faLamina: 1, tipo: 'baja', a: n.getAttribute('data-baja') }, '*'); return; }
      if (corre) ctl.pausa(); else ctl.play();
    });
    // Con movimiento reducido, o abierta sola fuera de la página, queda en el
    // diagrama completo. Dentro de la página avisa que está lista para recibir
    // órdenes; el botón de la página puede reproducirla aunque no arranque sola.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.parent === window) ctl.final();
    avisa('listo');
  }
})();

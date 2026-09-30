# fiscoabierto.org

Sitio de Fisco Abierto: herramienta fiscal gratuita de utilidad pública para la economía digital mexicana. Informa; no asesora, no vende, no pide datos.

## Stack
- HTML / CSS / JS puro, ES y EN: la página principal (`index.html`) y la página Aprende (`aprende/index.html`)
- Hosting: GitHub Pages desde la rama `main`
- Dominio: fiscoabierto.org (Namecheap), apuntado con `CNAME`

## Estructura
```
web/
├── index.html            # Página principal
├── aprende/
│   ├── index.html        # Aprende: seis pasos de principios fiscales, con láminas en vivo
│   ├── laminas/          # p1 a p6.html, motor.js, lamina.css, const.js (generado), fuentes/, img/
│   └── videos/           # Las mismas láminas en MP4 para descargar (ver ../videos/README.md)
├── CNAME                 # Dominio para GitHub Pages
├── favicon.svg, favicon-512.png
├── tools/
│   ├── smoke.js          # Corre cada <script> contra un DOM de mentiras: detecta arranques rotos
│   ├── cifras.js         # Inventario de cifras con su fuente legal y chequeo HTML vs translations.es
│   ├── i18n.js           # Lo que se quedaría en español al cambiar a EN (diccionario, marcado, mapa, DOM)
│   ├── calc-goldens.js   # 15 casos de la calculadora contra una cuenta independiente (pide playwright)
│   ├── css-muerto.js     # Selectores del <style> sin clase ni id en el HTML/JS
│   ├── usted.js          # Tuteo en el texto en español (el sitio habla de usted)
│   └── README.md         # Uso de las herramientas
├── .htmlvalidate.json    # Configuración de html-validate (npm i -g html-validate)
├── rebuild-preview.html  # Histórico (iteración de abril 2026), no se sirve como página principal
└── v5-preview.html       # Histórico (junio 2026)
```

## Deploy
Cada push a `main` publica en GitHub Pages. Antes de un push que toque JS, correr `node tools/smoke.js` (recorre todos los scripts); antes de un push que toque contenido, correr `node tools/cifras.js` y dejar las divergencias en 0, y `node tools/i18n.js` sin hallazgos; si el cambio toca la calculadora, además `node tools/calc-goldens.js` con 0 fallas. Antes de un push que toque HTML o CSS: `html-validate index.html` limpio y `node tools/css-muerto.js` en 0. Antes de un push que toque texto en español: `node tools/usted.js` sin tuteo (revisa las dos páginas y las láminas).

Si el cambio toca Aprende, las mismas herramientas corren sobre su archivo: `node tools/smoke.js aprende/index.html`, `node tools/cifras.js aprende/index.html` (divergencias en 0), `node tools/i18n.js aprende/index.html --dom` (revisa también las seis láminas en EN), `node tools/css-muerto.js aprende/index.html` y `html-validate aprende/index.html aprende/laminas/p*.html`. Las láminas se revisan cuadro por cuadro con `node revisar.js --serie aprende` desde `../videos/`.

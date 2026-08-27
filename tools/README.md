# tools

## smoke.js

Corre un `<script>` de `index.html` contra un DOM de mentiras y reporta si el
camino de arranque revienta.

Existe porque `node --check` valida sintaxis y nada más. Un identificador que
quedó libre, por ejemplo una función que se borró por accidente, es JavaScript
perfectamente válido: solo truena al ejecutarse. Ese error se publicó una vez
(commit 676d161) y dejó el diagrama de la sección de confianza en opacidad cero
en escritorio, porque el script moría después de haber puesto la clase que
apaga el respaldo de "si no hay JS, muestra todo".

Uso, desde `web/`:

    sed -n '/CADENA DE VERIFICACION (TRUST)/,/^<\/script>/p' index.html \
      | sed '1d;2d;$d' > /tmp/t.js && node tools/smoke.js /tmp/t.js

Vale la pena correrlo sobre estos cuatro antes de cada push que toque JS:
CADENA DE VERIFICACION (TRUST), SCROLL FADE (CIFRAS), TRUST PANEL GROW y
TRUST CANVAS AMBIENTAL.

El stub es deliberadamente tonto: si un script empieza a usar una API del DOM
que no está simulada, se agrega al stub. Un fallo por API faltante se distingue
de uno real por el mensaje (TypeError sobre un método del stub contra
ReferenceError sobre una función del propio script).

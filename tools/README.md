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

    node tools/smoke.js

Sin argumentos recorre todos los `<script>` de `index.html`, cada uno con el
rotulo `<!-- ... -->` que lo antecede, y un bloque vacio cuenta como FALLA
(antes se extraia cada script con `sed` por rotulo, y un rotulo mal escrito
daba 0 lineas y un OK vacio). Con un `.js` como argumento corre ese script
suelto; con un `.html`, hace el recorrido sobre ese archivo.

Sobre `aprende/index.html` corre sus cuatro scripts (idioma, nav, escalera y láminas). Los scripts se hablan por `window.faIdioma`, no por variables sueltas, porque el stub corre cada uno por separado.

El stub es deliberadamente tonto: si un script empieza a usar una API del DOM
que no está simulada, se agrega al stub. Un fallo por API faltante se distingue
de uno real por el mensaje (TypeError sobre un método del stub contra
ReferenceError sobre una función del propio script). `requestAnimationFrame`
corre el primer frame en el acto y deja de encolar después de cuatro, para que
un loop de dibujo no se coma la pila.

## cifras.js

Enumera cada cifra que el sitio publica junto con la fuente legal que la
respalda: la banda de cifras, las constantes de la calculadora, las 32 tasas
del mapa de hospedaje, toda línea con cita legal y toda cifra que aparece sin
cita en su misma línea. Al final compara el texto ES del HTML (respaldo sin
JS) contra `translations.es` y reporta divergencias: el mismo texto vive dos
veces en el archivo y ya divergió una vez (el pie de la calculadora perdió la
cita del 113-C en la copia HTML).

Arranca con la fecha de verificación de cada bloque (`data-verificado` en
banda, calculadora y mapa; el sitio la muestra como "Verificado contra la ley
el ...") y marca VENCIDO el que pase de 90 días: ese es el selector de la
rutina de mantenimiento, no la memoria de nadie.

La comparación toma el contenido de cada elemento hasta su propio cierre, contando las etiquetas anidadas del mismo nombre; antes se cortaba en el primer cierre de cualquier etiqueta, y un `<a>` dentro de un `<p>` daba divergencias falsas. Con `node tools/cifras.js aprende/index.html` hace lo mismo sobre la página Aprende.

No valida contra la ley: enumera. Es la lista de trabajo cuando cambia una
norma (Paquete Económico, LIF, RMF) y el contrato de lo que un monitor tiene
que vigilar.

Uso, desde `web/`:

    node tools/cifras.js > ../CLAUDE_CTX/cifras-vigentes.md

Correrlo después de cualquier cambio de contenido y antes de cada pasada de
verificación. Divergencias distintas de 0 se corrigen antes del push. Al
terminar una pasada de verificación, actualizar el `data-verificado` del
bloque revisado: la fecha vive solo ahí.

## i18n.js

Reporta lo que se quedaría en español al cambiar a EN. El sistema de idioma
tiene cuatro piezas y el chequeo revisa una por una: el diccionario
`translations` (toda clave ES tiene su EN), el marcado (todo texto visible del
HTML cuelga de un `data-i18n`, o de un `data-i18n-js` si lo pinta el JS), los
datos del mapa (cada `nota` tiene `nota_en`) y, con `--dom`, el DOM real en EN
con Playwright: recorre los 32 estados y un diagnóstico completo buscando
marcas de español.

Existe porque el bug de septiembre de 2026 vivía en la cuarta pieza: el panel
del mapa inyectaba `f` y `nota` en español en los 32 estados, y ningún chequeo
lo veía porque el diccionario estaba completo.

Uso, desde `web/`:

    node tools/i18n.js          # piezas 1 a 3, solo node
    node tools/i18n.js --dom    # además la 4; pide playwright instalado

Con `node tools/i18n.js aprende/index.html --dom` revisa la página Aprende: el paso 3 no aplica (no tiene mapa) y el 4 abre en EN la página y cada una de sus seis láminas, que tienen su propio diccionario.

Sale con código 1 si hay hallazgos. Los nombres de las leyes estatales (`f`)
se citan en español en los dos idiomas por contrato: son el documento que el
lector va a buscar.

## calc-goldens.js

Mueve la barra de la calculadora y cambia de actividad en la página real
(Playwright) y compara cada cifra pintada (ISR 2025/2026 o con/sin RFC, IVA
retenido con y sin RFC, totales y umbral) contra una cuenta hecha aparte, con
las tasas escritas a mano en el propio script. 15 casos: 3 actividades por 5
montos, con dos a cada lado del umbral de $300,000.

Uso, desde `web/`:

    node tools/calc-goldens.js

Sale con código 1 si una cifra no coincide. Probado contra una copia con
IVA_RET cambiado a 0.40: falla en los 15 casos. Correrlo antes de cualquier
push que toque la calculadora o sus constantes.

## css-muerto.js

Selectores del `<style>` cuyas clases o ids no aparecen ni en el HTML ni en
ninguna cadena del JS del mismo archivo: no pueden aplicar nunca. Estático,
sin navegador. Las clases que el JS arma pegando cadenas (`b1` a `b5` del
mapa, `risk-alto` y compañía) van en la lista COMPUESTAS con su razón.

Uso, desde `web/`:

    node tools/css-muerto.js

Sale con código 1 si hay selectores muertos. Primera corrida (10 sep 2026):
5 muertos, todos `.newsletter-form`, podados. El 42% de "CSS sin usar" que
reporta Lighthouse es otra cosa: reglas que no aplican al cargar, pero sí en
otros estados (idioma, diagnóstico, mapa, móvil).

## html-validate

No es nuestro: `npm i -g html-validate`, y desde `web/`:

    html-validate index.html

La configuración vive en `.htmlvalidate.json`. La única excepción declarada
es `style="width:..."` en las dos barras de la calculadora: es estado
inicial que el JS reescribe, no estilo. Primera corrida (10 sep 2026): 53
errores (38 botones sin `type`, 11 estilos en línea, iframe sin `title` y con
atributos obsoletos); ahora 0.

## usted.js

Busca tuteo en el texto en español. Desde el 30 de septiembre de 2026 Fisco
Abierto habla de usted (decisión de José): "su", "le", "lo" e imperativos como
"Consulte". El chequeo lee lo que el lector ve o lo que se indexa: nodos de
texto, los atributos `title`, `alt`, `aria-label`, `content` y `placeholder`, y
los literales de cadena de los `<script>`. Marca pronombres y posesivos (tú, tu,
tus, te, ti, contigo, tuyo) y una lista de verbos en segunda persona que el
sitio usó. El inglés no dispara nada.

Uso, desde `web/`:

    node tools/usted.js                        # index.html, aprende/index.html, láminas y const.js
    node tools/usted.js ../videos/v1.html ../newsletters/02-retencion-por-venta.md

Acepta `.html`, `.md` y `.js`. Sale con código 1 si encuentra algo. Primera
corrida sobre el sitio convertido (30 sep 2026): sin tuteo. Una clase o una
variable que se llame como una marca (`.tu`, `tuyo`) también dispara; se
renombra, porque el chequeo no distingue código de texto dentro de un literal.
El medidor de la newsletter (`medir_estilo.py`) trae la misma lista.

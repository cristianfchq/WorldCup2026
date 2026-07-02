# Pronósticos Mundial 2026

Web para que un grupo cerrado (~15 personas) registre sus pronósticos de los partidos eliminatorios del Mundial 2026, sin necesidad de cuenta de Google ni login. 100% estática, pensada para GitHub Pages + Firebase (ambos gratuitos).

## Estructura de carpetas

```
gameProject/
├── index.html              # Página pública: elegir nombre, pronosticar, ver tabla de posiciones
├── admin.html               # Panel admin: importar datos y cargar resultados reales
├── firestore.rules          # Reglas de seguridad de Firestore
├── css/
│   ├── variables.css        # Paleta de colores + variables de tema claro/oscuro
│   ├── base.css              # Reset y layout general
│   ├── components.css        # Botones, tabs, tarjetas de partido, tabla, toasts
│   ├── animations.css        # Keyframes y transiciones
│   └── admin.css              # Estilos exclusivos del panel admin
├── js/
│   ├── config/
│   │   ├── firebase-config.js  # Credenciales de tu proyecto Firebase
│   │   ├── app-config.js        # Fases del torneo (tabs)
│   │   ├── admin-config.js      # PIN del panel admin
│   │   └── scoring-config.js    # Puntos por acierto exacto / solo ganador
│   ├── models/                # Clases de dominio (POO): Participant, Match, Prediction
│   ├── services/               # Acceso a datos (repositorios) y lógica de negocio (SOLID)
│   ├── ui/                      # Componentes visuales reutilizables
│   ├── utils/                   # Fechas y localStorage
│   ├── app.js                   # Orquesta la página pública
│   └── admin.js                  # Orquesta el panel admin
├── data/
│   ├── participants.example.json  # Ejemplo para importar participantes
│   └── matches.example.json        # Ejemplo para importar partidos
└── docs/
    └── UML.md                # Diagramas de clases y de flujo
```

## Cómo funciona

1. **Sin login**: cualquiera que entra a `index.html` ve un combobox ("Selecciona tu nombre") con la lista de participantes, y tabs por fase (16vos, 8vos, Cuartos, Semis, Final). Los partidos de cada fase están agrupados por fecha.
2. **Redirección automática al día de hoy**: al cargar la página, se calcula qué partido es "el más relevante" (si hay partidos hoy, esos; si no, el próximo) y se abre esa fase con scroll automático a esa fecha (`findMostRelevantMatch` en `js/utils/DateUtils.js`).
3. **Pronosticar**: al elegir tu nombre, se habilitan los campos de marcador de cada partido. Al presionar "Guardar pronóstico" se crea un documento en Firestore con `locked: true`.
4. **Bloqueo real, no solo visual**: una vez guardado, el campo se deshabilita en pantalla, **y además** `firestore.rules` rechaza cualquier intento de modificar ese documento (`allow update: if resource.data.locked == false`). Aunque alguien intente llamar directamente a la API de Firestore sin pasar por la web, no podrá editar un pronóstico ya bloqueado.
5. **Panel admin** (`admin.html`, protegido por PIN): permite importar participantes y partidos desde archivos JSON, y cargar el resultado real de cada partido. Al guardar un resultado, se recalculan automáticamente los puntos de todos los pronósticos de ese partido (`ScoringService`) y la tabla de posiciones se actualiza sola.

## Por qué esta solución

- **Costo $0**: GitHub Pages (hosting) + Firestore en el plan gratuito Spark cubren de sobra a 15 usuarios.
- **Sin build ni frameworks pesados**: HTML/CSS/JS con módulos ES6 nativos — se publica tal cual, sin `npm run build`, 100% compatible con GitHub Pages.
- **Datos separados del código**: agregar o corregir partidos/participantes no requiere tocar código ni volver a publicar, se hace desde el panel admin.
- **Bloqueo de pronósticos robusto**: se resuelve con reglas de Firestore, no solo con JavaScript del navegador (que cualquiera podría inspeccionar y saltarse).
- **Arquitectura SOLID**: cada clase tiene una sola responsabilidad (un repositorio por colección, un servicio por regla de negocio, un componente por pieza de UI), así que agregar una fase nueva o cambiar el puntaje es tocar un solo archivo pequeño, no todo el proyecto.

## ⚠️ Advertencia de seguridad (léela)

Este proyecto **no usa Firebase Authentication** (se decidió así porque no todos los participantes tienen cuenta de Google). Eso tiene dos consecuencias que debes conocer:

- El PIN del panel admin (`js/config/admin-config.js`) viaja en el código fuente público. Cualquiera que abra las herramientas de desarrollador del navegador puede leerlo. Es una barrera contra curiosos, no seguridad real.
- Las reglas de Firestore no pueden distinguir "admin" de "cualquier visitante" sin autenticación. Sí pueden (y lo hacen) impedir que se edite un pronóstico ya bloqueado, porque esa regla no depende de quién escribe, solo del estado del dato.

Para un grupo cerrado de ~15 amigos/familia esto es un riesgo aceptado. Si más adelante quieres cerrar del todo el acceso de escritura a `matches`/`participants` solo al admin real, el siguiente paso sería agregar Firebase Authentication (aunque sea anónima) + Cloud Functions, lo cual requiere el plan Blaze (sigue siendo gratis para este volumen de uso, pero es más complejo de mantener).

## Cómo cargar la página (desarrollo local)

Como usa módulos ES6 (`type="module"`), no puedes abrir `index.html` con doble clic (los navegadores bloquean `import` sobre `file://`). Necesitas un servidor local simple:

```powershell
# Opción 1: con Python ya instalado
python -m http.server 5500

# Opción 2: con la extensión "Live Server" de VS Code
# Clic derecho sobre index.html > "Open with Live Server"
```

Luego abre `http://localhost:5500` en el navegador.

## Configurar Firebase (una sola vez)

1. Ve a [Firebase Console](https://console.firebase.google.com/) y crea un proyecto nuevo (gratis, plan Spark).
2. Dentro del proyecto: **Compilación → Firestore Database → Crear base de datos** (modo producción, la región más cercana a tus participantes).
3. Ve a **Configuración del proyecto → Tus apps → Agregar app → Web** y copia el objeto de configuración.
4. Pega esos valores en `js/config/firebase-config.js`.
5. Publica las reglas: en Firestore Database → Reglas, pega el contenido de `firestore.rules` de este proyecto y publica.
6. Cambia el PIN por defecto en `js/config/admin-config.js`.

## Pasos exactos para agregar participantes y partidos

1. Edita (o crea una copia de) `data/participants.example.json` / `data/matches.example.json` con los datos reales. El formato de cada campo está comentado dentro de esos mismos archivos.
2. Abre `admin.html`, ingresa el PIN.
3. En la sección correspondiente, elige el archivo `.json` y presiona "Importar". Se puede repetir tantas veces como haga falta (por ejemplo, importar primero solo 16vos, y semanas después importar cuartos).
4. Cuando termine un partido real, vuelve a `admin.html`, sección "3. Cargar resultados reales", escribe el marcador real y presiona "Guardar" — los puntos de todos se recalculan solos.

## Cómo publicar el sitio (GitHub Pages)

```bash
git init
git add .
git commit -m "Primera versión de la web de pronósticos"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

Luego en GitHub: **Settings → Pages → Source: "Deploy from a branch" → Branch: `main` / `root`**. En un par de minutos la web queda disponible en `https://TU-USUARIO.github.io/TU-REPO/`.

Comparte esa URL para la página pública, y `https://TU-USUARIO.github.io/TU-REPO/admin.html` solo contigo (o quien administre los resultados).

## Diagrama UML

Ver [docs/UML.md](docs/UML.md) (diagramas Mermaid, se ven directamente en GitHub).

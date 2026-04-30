# TrashIQ - Sistema inteligente de residuos

TrashIQ registra residuos detectados por un ESP32, almacena los datos reales en Firestore y los presenta en un dashboard web protegido con Firebase Auth. La IA no clasifica residuos: Gemini se usa solo para generar analisis e insights bajo demanda a partir de datos ya registrados.

## Arquitectura

```text
ESP32 + TensorFlow
  -> Firebase Functions: recibirResiduo
  -> Firestore: waste_logs
  -> Firebase Hosting: dashboard
  -> Firebase Functions + Gemini: analisis y preguntas del dashboard
```

## Datos en Firestore

La coleccion principal es `waste_logs`. Cada documento debe contener:

```json
{
  "objeto": "botella",
  "categoria": "plastico",
  "peso_g": 120,
  "gas_level": 0.35,
  "timestamp": "Firestore Timestamp"
}
```

Categorias soportadas:

- `plastico`
- `papel`
- `organico`
- `otros`

## Frontend

Firebase Hosting sirve la carpeta `public/`.

Elementos principales:

- `public/index.html`: dashboard principal.
- `public/login.html`: acceso con Firebase Auth.
- `public/css/`: estilos del layout, sidebar, cards, graficas y chat.
- `public/js/app.js`: orquestador del dashboard.
- `public/js/auth.js`: proteccion de rutas, login y logout.
- `public/js/firebase.js`: inicializacion de Firebase Web SDK.
- `public/js/data.js`: lectura real de Firestore, sin datos simulados.
- `public/js/charts.js`: graficas Chart.js.
- `public/js/ui.js`: navegacion, tema, tarjetas KPI y alertas.
- `public/js/chat.js`: integracion con `preguntarDashboard`.

Tambien existe una copia de trabajo en la raiz (`index.html`, `css/`, `js/`). Para despliegue, mantener sincronizada la version de `public/`.

## Dashboard

El dashboard usa exclusivamente datos reales de Firestore.

Funciones visibles:

- KPI por categoria.
- Comparacion de ultimos 7 dias contra los 7 dias anteriores.
- Grafica semanal o mensual.
- Distribucion por categoria.
- Alertas desde la coleccion `insights`.
- Preguntas en lenguaje natural con la card "Consultar a la IA".
- Preferencia de vista por peso o por cantidad de items.
- Tema claro/oscuro persistido en `localStorage`.

No existe modo dev ni archivos de datos simulados.

## Firebase Functions

El codigo vive en `functions/index.js`.

Funciones HTTP:

- `recibirResiduo`: ingesta desde el ESP32. Valida `objeto`, `categoria`, `peso_g`, `gas_level` y `timestamp`, y guarda en `waste_logs`.
- `analizarDashboard`: consulta metricas agregadas de `waste_logs` y pide a Gemini un analisis para el dashboard.
- `preguntarDashboard`: recibe `{ pregunta: string }`, usa Gemini function calling para decidir si debe consultar Firestore o responder sin datos, y devuelve:

```json
{
  "respuesta": "texto en espanol",
  "total_peso_g": 120,
  "total_registros": 3
}
```

Para saludos o preguntas generales, `total_peso_g` y `total_registros` pueden ser `null`.

## Variables de entorno

Crear `functions/.env`:

```env
GEMINI_API_KEY=YOUR_API_KEY_HERE
```

`functions/.env` y `functions/.env.production` estan ignorados por Git.

## Instalacion

```bash
cd functions
npm install
```

Dependencias principales de Functions:

- `firebase-admin`
- `firebase-functions`
- `@google/generative-ai`
- `dotenv`
- `cors`

## Desarrollo local

```bash
firebase emulators:start
```

O solo Functions:

```bash
cd functions
npm run serve
```

## Deploy

Hosting:

```bash
firebase deploy --only hosting
```

Functions:

```bash
firebase deploy --only functions
```

Solo la funcion de preguntas:

```bash
firebase deploy --only functions:preguntarDashboard
```

Si Firebase CLI pide reautenticacion:

```bash
firebase login --reauth
```

## Notas de seguridad

- La API key de Gemini se lee desde variables de entorno.
- El archivo `.env` no debe subirse al repositorio.
- Las restricciones de API key se gestionan en Google Cloud Console.
- Revisar y endurecer `firestore.rules` antes de produccion.

## Estado actual

- Dashboard conectado a Firestore real.
- Modo dev y datos simulados eliminados.
- IA integrada bajo demanda para analisis y preguntas.
- ESP32 envia datos procesados, incluyendo `objeto`.
- Gemini no clasifica residuos ni modifica documentos automaticamente.

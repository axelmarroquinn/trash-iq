# ♻️ TRASHIQ — SISTEMA INTELIGENTE DE RESIDUOS

## 🧠 DESCRIPCIÓN
- Sistema embebido + cloud que convierte basura en datos
- Registra tipo, peso y demás información importante
- Genera alertas sobre hábitos de consumo
- Integra ESP32 + Firebase + Dashboard + IA

## ⚙️ ARQUITECTURA

Dashboard (Frontend)
↓
Firebase Hosting
↓
Firestore (DB)
↓
ESP32 (sensores + edge AI)
↓
IA Cloud (chat + recomendaciones)

## 📊 DASHBOARD
- Categorías fijas:
  - Plástico (rojo)
  - Papel (gris)
  - Orgánico (verde)
  - Otros (marrón)
- Componentes:
  - KPI cards con animación + variaciones
  - Gráfica de barras (semana / mes)
  - Gráfica de pastel (distribución total)
  - Panel de alertas dinámico
  - Módulo “Consultar a la IA” (mock listo)
- Alertas:
  - 🔴 Rojo → crítico
  - 🟡 Amarillo → advertencias
  - 🟢 Verde → informativo

## ⚙️ CONFIGURACIÓN
- Vista por:
  - Peso (g / kg)
  - Cantidad de ítems
- Persistencia en localStorage para testing

## 🧱 ESTRUCTURA DEL PROYECTO

trash-iq/
├── index.html

├── css/

│ ├── base.css -- reset, layout, topbar

│ ├── cards.css -- vista de tarjetas

│ ├── charts.css -- gráficos

│ ├── chat.css -- panel de IA

│ ├── sidebar.css -- barra lateral + estado ESP32

│ └── variables.css -- paleta de colores

└── js/

├── app.js -- orquestador principal

├── charts.js -- gráficos

├── chat.js -- panel de IA

├── data.js -- capa de datos para Firebase

├── mockData.js -- capa de datos de prueba (dev)

├── state.js -- estados (tema o configuración) en localStorage

└── ui.js -- animaciones, nav, updates en tarjetas



## 🔌 ESP32
- Lectura de sensores
- Clasificación por imagen (edge AI)
- Construcción JSON
- Envío a Firebase
- Conexión no bloqueante + auto-reconnect

## 🚧 ESTADO
- ✅ Dashboard funcional (mock)
- ✅ Arquitectura modular
- ✅ Persistencia local
- ⚙️ Firebase en integración
- ⚙️ ESP32 → cloud en progreso
- ⚙️ IA real en progreso

# Stadio Backend

Backend en Node.js + Express para manejar reservas con Cal.com.

## Endpoints

- `GET /health` → prueba de vida
- `GET /availability?date=YYYY-MM-DD` → devuelve horarios disponibles
- `POST /reserve` → crea una reserva

## Variables de entorno

Configurar en Render:

PORT=10000
CALCOM_API_KEY=cal_live_5867fc115e4283045292fb763048b3c2
EVENT_TYPE_ID=3220000
DEFAULT_TZ=America/Santiago

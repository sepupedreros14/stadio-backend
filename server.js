import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
// ⚠️ Normalizamos y recortamos espacios en blanco
const CALCOM_API_KEY = (process.env.CALCOM_API_KEY || "").trim();
const EVENT_TYPE_ID = String(process.env.EVENT_TYPE_ID || "").trim();
const DEFAULT_TZ = (process.env.DEFAULT_TZ || "America/Santiago").trim();

const CAL_BASE = "https://api.cal.com/v1";

// Ruta raíz para probar que el server vive
app.get("/", (_req, res) => {
  res.send("🚀 Stadio Backend is running");
});

// Debug rápido de variables
app.get("/debug-env", (_req, res) => {
  res.json({
    CALCOM_API_KEY: CALCOM_API_KEY ? `✅ length ${CALCOM_API_KEY.length}` : "❌ missing",
    EVENT_TYPE_ID,
    DEFAULT_TZ,
  });
});

// Helper para llamar a Cal.com (con logs controlados)
async function calFetch(path, init = {}) {
  const headers = {
    Authorization: `Bearer ${CALCOM_API_KEY}`,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };

  // Logs de diagnóstico (no imprimimos la clave completa)
  console.log("CAL FETCH →", `${CAL_BASE}${path}`);
  console.log("Auth header starts with:", headers.Authorization?.slice(0, 16));

  const res = await fetch(`${CAL_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

  if (!res.ok) {
    const msg = json?.message || json?.error || `Cal.com error ${res.status}`;
    console.error("Cal.com error payload:", json);
    throw new Error(msg);
  }
  return json;
}

// Healthcheck
app.get("/health", (_req, res) => res.send("ok"));

// 🔎 Diagnóstico: prueba directa a Cal.com para validar la API Key
app.get("/diag", async (_req, res) => {
  try {
    const eventTypes = await calFetch(`/event-types`);
    res.json({
      apiKeyOk: Array.isArray(eventTypes),
      count: Array.isArray(eventTypes) ? eventTypes.length : undefined,
      sample: Array.isArray(eventTypes) ? eventTypes[0] : eventTypes,
      env: {
        CALCOM_API_KEY: CALCOM_API_KEY ? "✅" : "❌",
        EVENT_TYPE_ID,
        DEFAULT_TZ,
      },
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Disponibilidad (cuando diag pase, seguimos aquí)
app.get("/availability", async (req, res) => {
  try {
    const date = String(req.query.date || "").trim();
    const tz = String(req.query.tz || DEFAULT_TZ);
    if (!date) return res.status(400).json({ error: "Falta ?date=YYYY-MM-DD" });

    const q = new URLSearchParams({
      eventTypeId: EVENT_TYPE_ID,
      date,
      timezone: tz,
    });

    const api = await calFetch(`/availability?${q.toString()}`);

    const slots = [];
    const raw = api.slots || api.availableSlots || api.data?.slots || [];
    for (const s of raw) {
      const start = s.start || s.startTime || s.startUtc || s;
      const end = s.end || s.endTime || s.endUtc || null;
      if (!start) continue;
      const label = new Date(start).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
      slots.push({ start, end, label });
    }

    res.json({ eventTypeId: EVENT_TYPE_ID, date, timezone: tz, slots });
  } catch (err) {
    console.error("availability error:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Crear reserva
app.post("/reserve", async (req, res) => {
  try {
    const { name, email, start, end, notes } = req.body || {};
    if (!name || !email || !start || !end) {
      return res.status(400).json({ error: "Faltan name, email, start o end" });
    }
    const payload = { eventTypeId: Number(EVENT_TYPE_ID), name, email, start, end, notes: notes || undefined };
    const booking = await calFetch(`/bookings`, { method: "POST", body: JSON.stringify(payload) });
    res.json({ status: "ok", booking });
  } catch (err) {
    console.error("reserve error:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend listening on http://localhost:${PORT}`);
});

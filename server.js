import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const CALCOM_API_KEY = process.env.CALCOM_API_KEY;
const EVENT_TYPE_ID = process.env.EVENT_TYPE_ID;
const DEFAULT_TZ = process.env.DEFAULT_TZ || "America/Santiago";
const CAL_BASE = "https://api.cal.com/v1";

// Helper para llamar a Cal.com
async function calFetch(path, init = {}) {
  const headers = {
    Authorization: `Bearer ${CALCOM_API_KEY}`,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };

  // 🔎 Debug extra para confirmar qué enviamos
  console.log("DEBUG fetch →", `${CAL_BASE}${path}`);
  console.log("DEBUG headers →", headers);

  const res = await fetch(`${CAL_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message || json?.error || `Cal.com error ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// Healthcheck
app.get("/health", (_req, res) => {
  res.send("ok");
});

// Debug de variables de entorno
app.get("/debug-env", (_req, res) => {
  res.json({
    CALCOM_API_KEY: CALCOM_API_KEY
      ? `✅ length ${CALCOM_API_KEY.length}`
      : "❌ missing",
    EVENT_TYPE_ID,
    DEFAULT_TZ,
  });
});

// Endpoint de disponibilidad
app.get("/availability", async (req, res) => {
  try {
    const date = String(req.query.date || "").trim();
    const tz = String(req.query.tz || DEFAULT_TZ);
    if (!date) return res.status(400).json({ error: "Falta ?date=YYYY-MM-DD" });

    const q = new URLSearchParams({
      eventTypeId: String(EVENT_TYPE_ID),
      date,
      timezone: tz,
    });

const api = await calFetch(`/event-types/${EVENT_TYPE_ID}/slots?date=${date}&timezone=${tz}`);

    const slots = [];
    const rawSlots = api.slots || api.availableSlots || api.data?.slots || [];
    for (const s of rawSlots) {
      const start = s.start || s.startTime || s.startUtc || s;
      const end = s.end || s.endTime || s.endUtc || null;
      if (!start) continue;
      const startDate = new Date(start);
      const label = startDate.toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      slots.push({ start, end, label });
    }

    return res.json({ eventTypeId: EVENT_TYPE_ID, date, timezone: tz, slots });
  } catch (err) {
    console.error("availability error:", err);
    return res
      .status(500)
      .json({ error: String(err.message || err) });
  }
});

// Endpoint para crear reserva
app.post("/reserve", async (req, res) => {
  try {
    const { name, email, start, end, notes } = req.body || {};
    if (!name || !email || !start || !end) {
      return res
        .status(400)
        .json({ error: "Faltan name, email, start o end" });
    }

    const payload = {
      eventTypeId: Number(EVENT_TYPE_ID),
      name,
      email,
      start,
      end,
      notes: notes || undefined,
    };

    const booking = await calFetch(`/bookings`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return res.json({ status: "ok", booking });
  } catch (err) {
    console.error("reserve error:", err);
    return res
      .status(500)
      .json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend listening on http://localhost:${PORT}`);
});

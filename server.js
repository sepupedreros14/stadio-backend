import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Config desde .env
const CAL_USERNAME = process.env.CAL_USERNAME;   // ej: "stadio"
const EVENT_SLUG = process.env.EVENT_SLUG;       // ej: "salon-verdi"
const DEFAULT_TZ = process.env.DEFAULT_TZ || "America/Santiago";

// Disponibilidad pública
app.get("/availability", async (req, res) => {
  try {
    const date = String(req.query.date || "").trim();
    if (!date) return res.status(400).json({ error: "Falta ?date=YYYY-MM-DD" });

    const url = `https://cal.com/api/embed/availability?username=${CAL_USERNAME}&eventSlug=${EVENT_SLUG}&date=${date}&timezone=${DEFAULT_TZ}`;
    const api = await fetch(url).then(r => r.json());

    // Normalizar slots
    const slots = (api.slots || []).map((s) => {
      const startDate = new Date(s.start);
      return {
        start: s.start,
        end: s.end,
        label: startDate.toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      };
    });

    return res.json({ date, timezone: DEFAULT_TZ, slots });
  } catch (err) {
    console.error("availability error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

// Reserva pública (redirige al link oficial de Cal.com)
app.post("/reserve", async (req, res) => {
  try {
    const { name, email, start } = req.body || {};
    if (!name || !email || !start) {
      return res.status(400).json({ error: "Faltan name, email o start" });
    }

    // Nota: en modo embed público, la reserva no se hace vía API,
    // sino redirigiendo al link de Cal.com.
    // Te devolvemos el link para que lo abras en un WebView o browser.

    const bookingUrl = `https://cal.com/${CAL_USERNAME}/${EVENT_SLUG}?date=${start}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`;

    return res.json({ status: "redirect", bookingUrl });
  } catch (err) {
    console.error("reserve error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend listening on http://localhost:${PORT}`);
});

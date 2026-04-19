const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

// Anthropic API kalitingiz — Render.com da Environment Variable sifatida kiriting
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_KEY) {
  console.warn("⚠️  ANTHROPIC_API_KEY environment variable topilmadi!");
}

// CORS — barcha manzildan ruxsat (kerak bo'lsa domenni cheklang)
app.use(cors());
app.use(express.json({ limit: "20mb" })); // rasmlar uchun limit katta

// Sog'liq tekshiruvi
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Son-QR Proxy Server ishlayapti ✅" });
});

// Asosiy proxy endpoint
app.post("/analyze", async (req, res) => {
  try {
    const { base64, mediaType } = req.body;

    if (!base64) {
      return res.status(400).json({ error: "base64 rasm talab qilinadi" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: `You are an expert OCR number extractor. Find ALL numbers and numeric codes in the image.

RULES:
- Extract ANY sequence containing digits: IDs, codes, cell codes like "02-23", barcodes, dates, times, prices, measurements
- Long digit strings like "146004940107018755" are valid
- If multiple numbers exist, pick the most prominent one as primary
- NEVER return null if any digit is visible
- Ignore surrounding text/language, extract the number/code

Return ONLY this JSON (no markdown):
{"number":"primary_value","raw":"exact text seen","all":["all","numbers","found"]}`,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: base64,
                },
              },
              {
                type: "text",
                text: "Extract ALL numbers and codes from this image. JSON only.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errData?.error?.message || `Anthropic xatosi: ${response.status}`,
      });
    }

    const data = await response.json();
    const txt = data.content?.map((b) => b.text || "").join("") || "{}";
    const match = txt.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/);

    if (!match) {
      return res.status(500).json({ error: "JSON tahlil qilishda xato" });
    }

    res.json(JSON.parse(match[0]));
  } catch (err) {
    console.error("Server xatosi:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server port ${PORT} da ishlayapti`);
});

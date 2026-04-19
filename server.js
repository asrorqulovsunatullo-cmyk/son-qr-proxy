const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.warn("⚠️  GEMINI_API_KEY environment variable topilmadi!");
}

app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Son-QR Proxy Server ishlayapti ✅" });
});

app.post("/analyze", async (req, res) => {
  try {
    const { base64, mediaType } = req.body;
    if (!base64) return res.status(400).json({ error: "base64 rasm kerak" });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mediaType || "image/jpeg",
                  data: base64
                }
              },
              {
                text: `You are an expert OCR number extractor. Find ALL numbers and numeric codes in the image.
RULES:
- Extract ANY sequence with digits: IDs, codes like "02-23", barcodes, dates, prices, measurements
- Long numbers like "146004940107018755" are valid
- Pick the most prominent number as primary
- NEVER return null if any digit is visible

Return ONLY raw JSON, no markdown:
{"number":"primary_value","raw":"exact text seen","all":["all","numbers","found"]}`
              }
            ]
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 300 }
        })
      }
    );

    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: e?.error?.message || `Gemini xatosi: ${response.status}`
      });
    }

    const data = await response.json();
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const match = txt.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "JSON tahlil qilishda xato" });

    res.json(JSON.parse(match[0]));

  } catch (err) {
    console.error("Xato:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server port ${PORT} da ishlayapti`);
});

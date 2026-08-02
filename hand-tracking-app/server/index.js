import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { inspectPiece, listPieces } from "./audioPipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 8787;
const AUDIO_ROOT = process.env.AUDIO_ROOT
  ? path.resolve(process.env.AUDIO_ROOT)
  : path.join(__dirname, "audio");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/audio", express.static(AUDIO_ROOT, { fallthrough: false }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "conducting-coach-audio" });
});

app.get("/api/pieces", async (_request, response, next) => {
  try {
    response.json({ pieces: await listPieces({ audioRoot: AUDIO_ROOT }) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/pieces/:pieceId", async (request, response, next) => {
  try {
    const piece = await inspectPiece({
      pieceId: request.params.pieceId,
      audioRoot: AUDIO_ROOT,
    });
    response.status(piece.status === "missing" ? 404 : 200).json(piece);
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  const status = error?.status ?? (error?.message?.includes("pieceId") ? 400 : 500);
  response.status(status).json({
    error: status === 500 ? "Internal server error" : error.message,
  });
  if (status === 500) console.error(error);
});

app.listen(PORT, () => {
  console.log(`Conducting Coach audio API listening on http://localhost:${PORT}`);
  console.log(`Serving stems from ${AUDIO_ROOT}`);
});

import { access, readdir } from "node:fs/promises";
import path from "node:path";

export const STEM_NAMES = Object.freeze([
  "strings",
  "brass",
  "woodwinds",
  "percussion",
]);

const AUDIO_EXTENSIONS = Object.freeze([".wav", ".mp3", ".m4a", ".ogg", ".flac"]);

export function sanitizePieceId(value) {
  const pieceId = String(value ?? "").trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(pieceId)) {
    throw new Error("pieceId may contain only letters, numbers, dashes, and underscores");
  }
  return pieceId;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findStemFile(pieceDirectory, stem) {
  for (const extension of AUDIO_EXTENSIONS) {
    const filename = `${stem}${extension}`;
    if (await fileExists(path.join(pieceDirectory, filename))) return filename;
  }
  return null;
}

/**
 * Inspects pre-separated stems. This intentionally does not pretend to perform
 * source separation. A Demucs/Spleeter worker can later write files into the
 * same directory and this API will expose them without changing the frontend.
 */
export async function inspectPiece({ pieceId, audioRoot, publicBaseUrl = "/audio" }) {
  const safePieceId = sanitizePieceId(pieceId);
  const pieceDirectory = path.join(audioRoot, safePieceId);

  const entries = await Promise.all(
    STEM_NAMES.map(async (stem) => [stem, await findStemFile(pieceDirectory, stem)]),
  );

  const stems = {};
  const missingStems = [];
  for (const [stem, filename] of entries) {
    if (filename) {
      stems[stem] = `${publicBaseUrl}/${encodeURIComponent(safePieceId)}/${encodeURIComponent(filename)}`;
    } else {
      missingStems.push(stem);
    }
  }

  return {
    pieceId: safePieceId,
    status: missingStems.length ? (Object.keys(stems).length ? "partial" : "missing") : "ready",
    stems,
    missingStems,
  };
}

export async function listPieces({ audioRoot, publicBaseUrl = "/audio" }) {
  let entries;
  try {
    entries = await readdir(audioRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const pieceIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  return Promise.all(
    pieceIds.map((pieceId) => inspectPiece({ pieceId, audioRoot, publicBaseUrl })),
  );
}

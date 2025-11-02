const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");
const validator = require("validator");

// Binary dibundel oleh paket NPM (cocok dengan lingkungan Linux Vercel)
const { path: YTDLP_BIN } = require("yt-dlp-exec");
const FFMPEG_BIN = require("ffmpeg-static"); // file biner ffmpeg

const ALLOWED_HOSTS = [
  "youtube.com", "youtu.be",
  "x.com", "twitter.com",
  "tiktok.com",
  "instagram.com", "instagr.am"
];

function isAllowedUrl(inputUrl) {
  if (!validator.isURL(inputUrl, { require_protocol: true })) return false;
  try {
    const u = new URL(inputUrl);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return ALLOWED_HOSTS.some(h => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("youtube")) return "youtube";
    if (host.includes("x.") || host.includes("twitter")) return "x";
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("instagram") || host.includes("instagr")) return "instagram";
  } catch {}
  return "unknown";
}

function ytdlpArgsBase() {
  const args = ["--no-playlist"];
  if (FFMPEG_BIN) {
    // yt-dlp mengharapkan folder, bukan file
    args.push("--ffmpeg-location", path.dirname(FFMPEG_BIN));
  }
  return args;
}

function tmpOutputTemplate() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vd-"));
  const outFile = path.join(tmpDir, "%(title).200s.%(ext)s");
  return { tmpDir, outFile };
}

module.exports = {
  YTDLP_BIN,
  FFMPEG_BIN,
  isAllowedUrl,
  detectPlatform,
  ytdlpArgsBase,
  tmpOutputTemplate
};
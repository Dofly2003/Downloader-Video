const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { YTDLP_BIN, isAllowedUrl, ytdlpArgsBase, tmpOutputTemplate } = require("./_shared");

async function handle(req, res, url) {
  if (!url || typeof url !== "string") {
    res.statusCode = 400;
    return res.end("Missing url");
  }
  if (!isAllowedUrl(url)) {
    res.statusCode = 400;
    return res.end("URL tidak diizinkan atau tidak valid");
  }

  const { tmpDir, outFile } = tmpOutputTemplate();

  const args = [
    ...ytdlpArgsBase(),
    "--merge-output-format", "mp4",
    "-o", outFile,
    url
  ];

  const cp = spawn(YTDLP_BIN, args);
  let sent = false;

  cp.on("close", (code) => {
    try {
      if (code !== 0) {
        res.statusCode = 500;
        if (!sent) res.end("Download gagal (code " + code + ")");
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return;
      }

      const files = fs.readdirSync(tmpDir);
      const media = files.find(f => /\.(mp4|mkv|webm|mp3|m4a)$/i.test(f));
      if (!media) {
        res.statusCode = 500;
        if (!sent) res.end("File tidak ditemukan setelah download");
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return;
      }
      const filePath = path.join(tmpDir, media);
      const stat = fs.statSync(filePath);
      const safeName = media.replace(/[^a-zA-Z0-9 _.\-()]/g, "_").slice(0, 200);

      res.setHeader("Content-Length", stat.size);
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
      const stream = fs.createReadStream(filePath);
      sent = true;
      stream.pipe(res);

      stream.on("close", () => fs.rmSync(tmpDir, { recursive: true, force: true }));
      stream.on("error", () => fs.rmSync(tmpDir, { recursive: true, force: true }));
    } catch {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      if (!sent) {
        res.statusCode = 500;
        res.end("Server error");
      }
    }
  });

  cp.on("error", () => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    res.statusCode = 500;
    if (!sent) res.end("Gagal menjalankan yt-dlp");
  });

  req.on("close", () => {
    try { cp.kill("SIGKILL"); } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });
}

module.exports = async (req, res) => {
  if (req.method === "POST") {
    return handle(req, res, req.body?.url);
  }
  if (req.method === "GET") {
    const url = req.query?.url || (new URL(req.url, "http://x").searchParams.get("url"));
    return handle(req, res, url);
  }
  res.statusCode = 405;
  res.end("Method Not Allowed");
};  
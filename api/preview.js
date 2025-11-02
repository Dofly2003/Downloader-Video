const { spawn } = require("child_process");
const { YTDLP_BIN, isAllowedUrl, ytdlpArgsBase } = require("./_shared");

// Stream preview MP4 ke client (tanpa dukungan Range)
module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }
  const url = req.query?.url || (new URL(req.url, "http://x").searchParams.get("url"));

  if (!url || typeof url !== "string") {
    res.statusCode = 400;
    return res.end("Missing url");
  }
  if (!isAllowedUrl(url)) {
    res.statusCode = 400;
    return res.end("URL tidak diizinkan atau tidak valid");
  }

  const args = [
    ...ytdlpArgsBase(),
    "--merge-output-format", "mp4",
    "-f", "best[ext=mp4]/best",
    "-o", "-",
    url
  ];

  res.setHeader("Content-Type", "video/mp4");

  const cp = spawn(YTDLP_BIN, args);
  cp.stdout.pipe(res);

  cp.stderr.on("data", d => process.stderr.write(d));
  cp.on("error", () => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Gagal memulai preview");
    }
  });
  cp.on("close", (code) => {
    if (code !== 0 && !res.headersSent) {
      res.statusCode = 500;
      res.end("Preview gagal (code " + code + ")");
    }
  });

  req.on("close", () => {
    try { cp.kill("SIGKILL"); } catch {}
  });
};
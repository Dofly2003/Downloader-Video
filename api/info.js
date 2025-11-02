const { spawn } = require("child_process");
const { YTDLP_BIN, isAllowedUrl, ytdlpArgsBase } = require("./_shared");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }

  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      res.statusCode = 400;
      return res.end("Missing url");
    }
    if (!isAllowedUrl(url)) {
      res.statusCode = 400;
      return res.end("URL tidak diizinkan atau tidak valid");
    }

    const args = [...ytdlpArgsBase(), "-J", url];
    const cp = spawn(YTDLP_BIN, args);

    let out = "", errOut = "";
    cp.stdout.on("data", d => out += d.toString());
    cp.stderr.on("data", d => errOut += d.toString());

    cp.on("close", (code) => {
      if (code !== 0) {
        console.error("yt-dlp -J failed", code, errOut);
        res.statusCode = 500;
        return res.end("Gagal mengambil info");
      }
      try {
        const meta = JSON.parse(out);
        const info = meta.entries?.[0] || meta;
        const payload = {
          title: info.title,
          uploader: info.uploader || info.channel || "",
          thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || "",
          duration: info.duration || null
        };
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(payload));
      } catch (e) {
        console.error("Parse info error:", e);
        res.statusCode = 500;
        res.end("Gagal parse info");
      }
    });
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end("Server error");
  }
};
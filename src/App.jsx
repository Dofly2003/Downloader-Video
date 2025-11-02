import React, { useState, useMemo } from "react";

// Deteksi platform
function detectPlatform(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
    if (host.includes("x.com") || host.includes("twitter.com")) return "x";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("instagram.com") || host.includes("instagr.am")) return "instagram";
    return "unknown";
  } catch {
    return "invalid";
  }
}

// Komponen preview dengan thumbnail -> klik untuk memutar
function LazyVideoPreview({ previewSrc, thumbnail }) {
  const [showVideo, setShowVideo] = useState(false);

  if (!showVideo) {
    return (
      <div
        className="position-relative rounded-3 overflow-hidden"
        role="button"
        onClick={() => setShowVideo(true)}
      >
        {thumbnail && (
          <img src={thumbnail} alt="thumbnail" className="img-fluid w-100 d-block" />
        )}
        <div className="position-absolute top-50 start-50 translate-middle">
          <span className="btn btn-light rounded-circle shadow px-3 py-2 fs-4">
            <i className="bi bi-play-fill" />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="ratio ratio-16x9 rounded-3 bg-black">
      <video src={previewSrc} controls playsInline className="w-100 h-100 rounded-3" />
    </div>
  );
}

// Helper format durasi
function formatDuration(d) {
  if (d == null) return "-";
  const sec = Math.round(Number(d));
  if (!Number.isFinite(sec)) return "-";
  if (sec < 60) return `${sec} detik`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} menit ${s} detik` : `${m} menit`;
}

function platformBadgeVariant(p) {
  switch (p) {
    case "youtube":
      return "danger";
    case "x":
      return "dark";
    case "tiktok":
      return "secondary";
    case "instagram":
      return "warning";
    case "invalid":
      return "danger";
    case "unknown":
      return "secondary";
    default:
      return "secondary";
  }
}

function statusAlertVariant(text) {
  if (!text) return "secondary";
  if (text.startsWith("✅")) return "success";
  if (text.startsWith("⚠️")) return "warning";
  if (text.startsWith("❌")) return "danger";
  return "secondary";
}

// Format ukuran bytes
function fmtBytes(b) {
  if (!b) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0,
    n = b;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${units[i]}`;
}

export default function App() {
  const [link, setLink] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("");
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ pct: 0, received: 0, total: 0, speed: 0 });

  const previewSrc = useMemo(() => {
    if (!link) return "";
    try {
      new URL(link);
      return `http://localhost:4000/api/preview?url=${encodeURIComponent(link)}`;
    } catch {
      return "";
    }
  }, [link]);

  const getInfo = async (e) => {
    e.preventDefault();
    setStatus("");
    setInfo(null);

    const p = detectPlatform(link);
    setPlatform(p);
    if (p === "invalid") return setStatus("❌ URL tidak valid");
    if (p === "unknown") return setStatus("❓ Platform tidak dikenali");

    setLoading(true);
    setStatus("🔍 Mengambil info video...");

    try {
      const resp = await fetch("http://localhost:4000/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setInfo(data);
      setStatus("✅ Info video ditemukan");
    } catch (err) {
      console.error(err);
      setStatus("⚠️ Gagal mengambil info: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    setStatus("⬇️ Mengunduh video...");
    setProgress({ pct: 0, received: 0, total: 0, speed: 0 });

    try {
      const resp = await fetch(
        `http://localhost:4000/api/download?url=${encodeURIComponent(link)}`
      );
      if (!resp.ok) throw new Error(await resp.text());

      const contentLength = Number(resp.headers.get("content-length") || 0);
      const disposition = resp.headers.get("content-disposition");
      let filename = (info?.title || "video") + ".mp4";
      if (disposition && /filename="?([^"]+)"?/.test(disposition)) {
        filename = disposition.match(/filename="?([^"]+)"?/)[1];
      }

      const reader = resp.body.getReader();
      const chunks = [];
      let received = 0;
      const start = performance.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;

        const elapsed = (performance.now() - start) / 1000;
        const speed = received / (elapsed || 1);
        const pct = contentLength ? Math.round((received / contentLength) * 100) : 0;

        setProgress({ pct, received, total: contentLength, speed });
      }

      const blob = new Blob(chunks, { type: "video/mp4" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setStatus("✅ Selesai diunduh");
    } catch (err) {
      console.error(err);
      setStatus("⚠️ Gagal download: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="min-vh-100"
      style={{
        background:
          "linear-gradient(135deg, #6f42c1 0%, #0d6efd 45%, #20c997 100%)",
        paddingBottom: "3rem",
      }}
    >
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-transparent">
        <div className="container">
          <a className="navbar-brand fw-semibold" href="#">
            <i className="bi bi-cloud-arrow-down me-2" />
            Video Downloader
          </a>
        </div>
      </nav>

      <div className="container">
        <div className="row g-4">
          {/* Sidebar ringan */}
          <aside className="col-lg-3">
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <div className="d-flex align-items-center mb-3">
                  <div className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center me-2"
                       style={{ width: 40, height: 40 }}>
                    <i className="bi bi-person" />
                  </div>
                  <div>
                    <div className="fw-semibold">Guest</div>
                    <div className="text-muted small">Welcome</div>
                  </div>
                </div>
                <ul className="list-group list-group-flush">
                  <li className="list-group-item d-flex align-items-center">
                    <i className="bi bi-link-45deg me-2" /> Input Link
                  </li>
                  <li className="list-group-item d-flex align-items-center">
                    <i className="bi bi-camera-video me-2" /> Preview
                  </li>
                  <li className="list-group-item d-flex align-items-center">
                    <i className="bi bi-download me-2" /> Download
                  </li>
                </ul>
              </div>
            </div>
          </aside>

          {/* Konten utama */}
          <main className="col-lg-9">
            {/* Kartu input */}
            <div className="card shadow border-0">
              <div className="card-body p-4">
                <h1 className="h4 mb-3 text-body-emphasis">
                  Masukkan link video atau foto
                </h1>

                <form onSubmit={getInfo} className="row gy-2 gx-2">
                  <div className="col-12 col-md">
                    <input
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://..."
                      className="form-control form-control-lg"
                    />
                  </div>
                  <div className="col-12 col-md-auto">
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg w-100"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-eye me-2" />
                          Tampilkan Preview
                        </>
                      )}
                    </button>
                  </div>
                </form>

                <div className="d-flex align-items-center gap-2 mt-3">
                  <span className="fw-semibold">Platform:</span>
                  {platform ? (
                    <span
                      className={`badge text-bg-${platformBadgeVariant(
                        platform
                      )} text-uppercase`}
                    >
                      {platform}
                    </span>
                  ) : (
                    <span className="text-light">-</span>
                  )}
                </div>

                {status && (
                  <div
                    className={`alert alert-${statusAlertVariant(status)} mt-3 mb-0`}
                    role="alert"
                  >
                    {status}
                  </div>
                )}
              </div>
            </div>

            {/* Kartu preview + detail */}
            {info && (
              <div className="row g-4 mt-1">
                <div className="col-lg-7">
                  <div className="card shadow-sm border-0">
                    <div className="card-body">
                      <h2 className="h5 mb-3">{info.title}</h2>
                      {info.thumbnail && (
                        <LazyVideoPreview
                          previewSrc={previewSrc}
                          thumbnail={info.thumbnail}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-lg-5">
                  <div className="card shadow-sm border-0">
                    <div className="card-body">
                      <h3 className="h6 text-muted mb-3">Detail</h3>
                      <dl className="row small mb-0">
                        <dt className="col-4">Uploader</dt>
                        <dd className="col-8">{info.uploader || "-"}</dd>
                        {info.duration != null && (
                          <>
                            <dt className="col-4">Durasi</dt>
                            <dd className="col-8">{formatDuration(info.duration)}</dd>
                          </>
                        )}
                      </dl>

                      <div className="d-grid mt-3">
                        <button
                          onClick={download}
                          disabled={downloading}
                          className="btn btn-success btn-lg"
                        >
                          {downloading ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" />
                              Mengunduh...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-download me-2" />
                              Download Video
                            </>
                          )}
                        </button>
                      </div>

                      {downloading && (
                        <div className="mt-3">
                          <div
                            className="progress"
                            role="progressbar"
                            aria-valuenow={progress.pct}
                            aria-valuemin="0"
                            aria-valuemax="100"
                          >
                            <div
                              className="progress-bar bg-success"
                              style={{ width: `${progress.pct}%` }}
                            >
                              {progress.pct ? `${progress.pct}%` : ""}
                            </div>
                          </div>
                          <div className="d-flex justify-content-between small text-muted mt-2">
                            <span>
                              {progress.total
                                ? `${fmtBytes(progress.received)} / ${fmtBytes(
                                    progress.total
                                  )}`
                                : `${fmtBytes(progress.received)} terunduh`}
                            </span>
                            <span>
                              {progress.speed ? `${fmtBytes(progress.speed)}/s` : ""}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <p className="small text-light mt-4 mb-0">
              Gunakan hanya untuk konten yang kamu miliki haknya. Pengunduhan konten
              berhak cipta tanpa izin bisa melanggar hukum.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
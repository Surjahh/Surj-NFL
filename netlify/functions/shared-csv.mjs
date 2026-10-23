import { getStore } from "@netlify/blobs";

const STORE_NAME = "surj-intel-shared-csv";
const STORE_KEY = "published-player-stats";
const MAX_CSV_BYTES = 5 * 1024 * 1024;
const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff"
};
const response = (status, payload) => new Response(JSON.stringify(payload), { status, headers: jsonHeaders });

export default async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...jsonHeaders, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, authorization" } });
  if (!( ["GET", "POST"].includes(request.method) )) return response(405, { error: "Method not allowed." });

  try {
    const store = getStore(STORE_NAME);
    // Remove any legacy v15 shared sportsbook-line payload; only player statistics persist now.
    await store.delete("published-csvs");
    if (request.method === "GET") {
      const saved = await store.get(STORE_KEY, { type: "json" }) || {};
      return response(200, {
        playerStatsCsv: typeof saved.playerStatsCsv === "string" ? saved.playerStatsCsv : "",
        snapCountsCsv: typeof saved.snapCountsCsv === "string" ? saved.snapCountsCsv : "",
        updatedAt: saved.updatedAt || null,
        autoSync: saved.autoSync || null
      });
    }

    const uploadToken = Netlify.env.get("SURJ_CSV_UPLOAD_TOKEN");
    if (!uploadToken) return response(503, { error: "Shared player-stat uploads are not configured. Add SURJ_CSV_UPLOAD_TOKEN in Netlify environment variables and redeploy." });
    const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!supplied || supplied !== uploadToken) return response(401, { error: "Upload token is missing or incorrect." });

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_CSV_BYTES) return response(413, { error: "CSV exceeds the 5 MB upload limit." });
    const body = await request.json();
    const kind = body?.kind;
    const csv = body?.csv;
    if (!["playerStats", "snapCounts"].includes(kind)) return response(400, { error: "kind must be 'playerStats' or 'snapCounts'. Sportsbook lines are not saved." });
    if (typeof csv !== "string" || !csv.trim()) return response(400, { error: "CSV content is empty." });
    if (new TextEncoder().encode(csv).byteLength > MAX_CSV_BYTES) return response(413, { error: "CSV exceeds the 5 MB upload limit." });
    const rows = csv.split(/\r?\n/).filter(line => line.trim()).length;
    if (rows < 2) return response(400, { error: "CSV must contain a header and at least one data row." });

    const saved = await store.get(STORE_KEY, { type: "json" }) || {};
    const next = {
      playerStatsCsv: typeof saved.playerStatsCsv === "string" ? saved.playerStatsCsv : "",
      snapCountsCsv: typeof saved.snapCountsCsv === "string" ? saved.snapCountsCsv : "",
      updatedAt: new Date().toISOString(),
      autoSync: saved.autoSync || null
    };
    if (kind === "playerStats") next.playerStatsCsv = csv;
    if (kind === "snapCounts") next.snapCountsCsv = csv;
    await store.setJSON(STORE_KEY, next);
    return response(200, { ok: true, kind, updatedAt: next.updatedAt, rows: rows - 1 });
  } catch (error) {
    console.error("Shared player-stat storage error:", error);
    return response(500, { error: "Could not access shared player-stat storage. Confirm the site is deployed on Netlify and try again." });
  }
};

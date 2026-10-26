import { writeFile } from "node:fs/promises";

const baseUrl = "https://minglemart-eb6da.web.app/";
const projectId = "minglemart-eb6da";
const apiKey = "AIzaSyA0NvHmjGmvWdM5O576HHE9_3_we7JaxGs";
const urls = new Map([[baseUrl, new Date().toISOString().slice(0, 10)]]);
let pageToken = "";

function fieldValue(value) {
  if (!value || typeof value !== "object") return "";
  return value.stringValue ?? value.integerValue ?? value.doubleValue ?? "";
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

try {
  do {
    const query = new URLSearchParams({ pageSize: "1000", key: apiKey });
    if (pageToken) query.set("pageToken", pageToken);
    const endpoint = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/items?${query}`;
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Firestore returned HTTP ${response.status}: ${(await response.text()).slice(0, 250)}`);
    const payload = await response.json();

    for (const document of payload.documents ?? []) {
      const id = document.name?.split("/").pop();
      const fields = document.fields ?? {};
      // Only publish complete, active-looking listings with a stable document ID.
      if (!id || !fieldValue(fields.title) || !fieldValue(fields.category)) continue;
      const productUrl = `${baseUrl}?item=${encodeURIComponent(id)}`;
      const rawUpdated = fields.updatedAt?.timestampValue ?? fields.createdAt?.timestampValue;
      const lastmod = rawUpdated && !Number.isNaN(Date.parse(rawUpdated))
        ? new Date(rawUpdated).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      urls.set(productUrl, lastmod);
    }
    pageToken = payload.nextPageToken ?? "";
  } while (pageToken);

  console.log(`Sitemap: found ${urls.size - 1} public product listings.`);
} catch (error) {
  // Keep production deploys healthy if Firestore temporarily blocks or limits sitemap reads.
  console.warn("Sitemap warning: could not fetch public Firestore listings; publishing homepage only.", error.message);
}

const entries = [...urls.entries()].map(([loc, lastmod]) =>
  `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
).join("\n");
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
await writeFile("public/sitemap.xml", xml, "utf8");

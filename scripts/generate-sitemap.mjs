import { writeFile } from "node:fs/promises";

const baseUrl = "https://minglemart-eb6da.web.app/";
const projectId = "minglemart-eb6da";
// Firebase web API key (public client configuration) is required by the
// unauthenticated Firestore REST endpoint used during the static SEO build.
const apiKey = "AIzaSyA0NvHmjGmvWdM5O576HHE9_3_we7JaxGs";
const urls = new Map([[baseUrl, new Date().toISOString().slice(0, 10)]]);
const products = [];
let pageToken = "";

function fieldValue(value) {
  if (!value || typeof value !== "object") return "";
  return value.stringValue ?? value.integerValue ?? value.doubleValue ??
    value.booleanValue ?? value.timestampValue ?? "";
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
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
      const title = fieldValue(fields.title);
      const category = fieldValue(fields.category);
      const listingStatus = String(fieldValue(fields.listingStatus) || "available").toLowerCase();

      // Expired and archived listings are hidden; sold listings remain public.
      if (!id || !title || !category || !/^[A-Za-z0-9_-]+$/.test(id)) continue;
      if (listingStatus === "expired" || listingStatus === "archived") continue;

      const productUrl = `${baseUrl}item/${encodeURIComponent(id)}`;
      const rawUpdated = fields.updatedAt?.timestampValue ??
        fields.statusUpdatedAt?.timestampValue ?? fields.createdAt?.timestampValue;
      const lastmod = rawUpdated && !Number.isNaN(Date.parse(rawUpdated))
        ? new Date(rawUpdated).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      urls.set(productUrl, lastmod);
      products.push({
        id, url: productUrl, title: String(title), category: String(category),
        price: String(fieldValue(fields.price) ?? ""),
        location: String(fieldValue(fields.location) ?? ""),
        description: String(fieldValue(fields.description) ?? ""),
        image: String(fieldValue(fields.image) ?? ""),
        listingStatus, lastmod,
      });
    }
    pageToken = payload.nextPageToken ?? "";
  } while (pageToken);

  console.log(`Sitemap: found ${products.length} public product listings.`);
} catch (error) {
  console.error("SEO build failed: could not fetch public Firestore listings.", error);
  throw error;
}

if (products.length === 0) {
  throw new Error("SEO build failed: Firestore returned zero public product listings; refusing to deploy a homepage-only sitemap.");
}

const entries = [...urls.entries()].map(([loc, lastmod]) =>
  `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
).join("\n");
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;

await writeFile("public/sitemap.xml", xml, "utf8");
await writeFile("scripts/.products-seo.json", JSON.stringify(products), "utf8");

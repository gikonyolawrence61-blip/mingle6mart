import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const manifestPath = "scripts/.products-seo.json";
const indexPath = "dist/index.html";

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function setMeta(html, attribute, key, content) {
  const escaped = escapeHtml(content);
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${key}["'])[^>]*>`, "i");
  const replacement = `<meta ${attribute}="${key}" content="${escaped}" />`;
  return matcher.test(html) ? html.replace(matcher, replacement) : html.replace("</head>", `  ${replacement}\n  </head>`);
}

function setCanonical(html, url) {
  const replacement = `<link rel="canonical" href="${escapeHtml(url)}" />`;
  const matcher = /<link[^>]*rel=["']canonical["'][^>]*>/i;
  return matcher.test(html) ? html.replace(matcher, replacement) : html.replace("</head>", `  ${replacement}\n  </head>`);
}

let products = [];
try {
  products = JSON.parse(await readFile(manifestPath, "utf8"));
} catch {
  console.warn("Product SEO manifest was unavailable; no product HTML pages were generated.");
}

if (products.length) {
  const baseHtml = await readFile(indexPath, "utf8");
  for (const product of products) {
    if (!/^[A-Za-z0-9_-]+$/.test(product.id)) continue;

    const title = `${product.title} for sale in ${product.location || "Kenya"} | MingleMart`;
    const description = `${product.title} for KSh ${product.price}. ${product.category} in ${product.location}. ${product.description}`
      .replaceAll("\n", " ").replaceAll("\r", " ").replaceAll("\t", " ")
      .split(" ").filter(Boolean).join(" ").slice(0, 300);

    let html = baseHtml.replace(/<title>[^<]*<\\/title>/i, `<title>${escapeHtml(title)}</title>`);
    html = setMeta(html, "name", "description", description);
    html = setMeta(html, "property", "og:title", title);
    html = setMeta(html, "property", "og:description", description);
    html = setMeta(html, "property", "og:url", product.url);
    html = setMeta(html, "property", "og:type", "product");
    html = setCanonical(html, product.url);

    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description,
      category: product.category,
      ...(product.image ? { image: [product.image] } : {}),
      offers: {
        "@type": "Offer",
        price: String(product.price).replace(/[^0-9.]/g, ""),
        priceCurrency: "KES",
        availability: product.listingStatus === "sold"
          ? "https://schema.org/OutOfStock"
          : product.listingStatus === "reserved"
            ? "https://schema.org/LimitedAvailability"
            : "https://schema.org/InStock",
        url: product.url,
      },
      areaServed: { "@type": "Country", name: "Kenya" },
    };
    const jsonLd = JSON.stringify(schema).replace(/</g, "\\u003c");
    html = html.replace("</head>", `  <script type="application/ld+json">${jsonLd}</script>\n  </head>`);

    const outputDirectory = path.join("dist", "item", product.id);
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(path.join(outputDirectory, "index.html"), html, "utf8");
  }
  console.log(`Generated ${products.length} pre-rendered product pages.`);
}

await rm(manifestPath, { force: true });

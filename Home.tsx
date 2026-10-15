import { useEffect, useMemo, useState } from "react";
import PostSocial from "./src/PostSocial";
import PromotionRequest from "./src/PromotionRequest";

export type Item = {
  id?: string;
  sellerId?: string;
  title: string;
  category: string;
  price: string;
  location: string;
  description: string;
  image?: string;
  createdAt?: unknown;
  isFeatured?: boolean;
  promotionStatus?: string;
  featuredUntil?: unknown;
};


function formatTimeAgo(value: unknown, now: number): string {
  if (!value) return "Just now";

  let postedAt: Date | null = null;

  if (value instanceof Date) {
    postedAt = value;
  } else if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) postedAt = parsed;
  } else if (typeof value === "object" && value !== null) {
    const timestamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof timestamp.toDate === "function") {
      try {
        postedAt = timestamp.toDate();
      } catch {
        postedAt = null;
      }
    } else if (typeof timestamp.seconds === "number") {
      postedAt = new Date(timestamp.seconds * 1000);
    }
  }

  if (!postedAt || Number.isNaN(postedAt.getTime())) return "Recently posted";

  const elapsedSeconds = Math.max(0, Math.floor((now - postedAt.getTime()) / 1000));
  if (elapsedSeconds < 60) return "Just now";

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;

  return postedAt.toLocaleDateString();
}

type HomeProps = {
  items: Item[];
  currentUserId: string;
  onPostItem: () => void;
  onViewItem: (item: Item) => void;
  onOpenSellerInbox: () => void;
  unreadMessages: number;
  onDeleteItem: (item: Item) => void;
  isAdmin: boolean;
  onToggleFeatured: (item: Item) => void;
  onOpenAdmin: () => void;
};

export default function Home({
  items,
  currentUserId,
  onPostItem,
  onViewItem,
  onOpenSellerInbox,
  unreadMessages,
  onDeleteItem,
  isAdmin,
  onToggleFeatured,
  onOpenAdmin,
}: HomeProps) {
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All categories");
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Refresh relative timestamps once a minute so "5 minutes ago" stays current.
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Build a category list from the existing listings.
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        items
          .map((item) => item.category.trim())
          .filter((category) => category.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));

    return ["All categories", ...uniqueCategories];
  }, [items]);

  // A listing is featured manually by the admin, or while a paid promotion is active.
  const isCurrentlyFeatured = (item: Item) => {
    if (item.isFeatured) return true;
    if (item.promotionStatus !== "active" || !item.featuredUntil) return false;
    const expiry = item.featuredUntil as { toDate?: () => Date } | Date | string | number;
    let expiryDate: Date | null = null;
    if (expiry instanceof Date) expiryDate = expiry;
    else if (typeof expiry === "string" || typeof expiry === "number") expiryDate = new Date(expiry);
    else if (expiry && typeof expiry === "object" && typeof expiry.toDate === "function") expiryDate = expiry.toDate();
    return !!expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() > Date.now();
  };

  const featuredItems = useMemo(() => items.filter(isCurrentlyFeatured), [items, currentTime]);

  // Search and category filtering work together.
  const filteredItems = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return items.filter((item) => {
      const searchableText = [
        item.title,
        item.category,
        item.location,
        item.description,
        item.price,
      ];

      const matchesSearch =
        search === "" ||
        searchableText.some((value) =>
          String(value ?? "").toLowerCase().includes(search)
        );

      const matchesCategory =
        selectedCategory === "All categories" ||
        item.category.trim() === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [items, searchText, selectedCategory]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f7fb",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <header className="mingle-brand" aria-label="MingleMart: Connect, Buy, Sell, Meet">
          <h1 className="mingle-brand__wordmark">
            <span className="mingle-brand__word mingle-brand__word--mingle" aria-label="Mingle">
              {"Mingle".split("").map((letter, index) => (
                <span
                  className="mingle-brand__letter"
                  key={`mingle-${letter}-${index}`}
                  style={{ animationDelay: `${index * 90}ms` }}
                  aria-hidden="true"
                >
                  {letter}
                </span>
              ))}
            </span>
            <span className="mingle-brand__word mingle-brand__word--mart">
              {"Mart".split("").map((letter, index) => (
                <span
                  className="mingle-brand__letter mingle-brand__letter--mart"
                  key={`mart-${letter}-${index}`}
                  style={{ animationDelay: `${620 + index * 90}ms` }}
                  aria-hidden="true"
                >
                  {letter}
                </span>
              ))}
            </span>
            <span className="mingle-brand__connections" aria-hidden="true">
              <span className="mingle-brand__dot mingle-brand__dot--one" />
              <span className="mingle-brand__dot mingle-brand__dot--two" />
              <span className="mingle-brand__dot mingle-brand__dot--three" />
            </span>
          </h1>
          <p className="mingle-brand__tagline">CONNECT <span>•</span> BUY <span>•</span> SELL <span>•</span> MEET</p>
        </header>

        <button
          onClick={onOpenSellerInbox}
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "15px",
            background: "#087f5b",
            color: "white",
            border: "none",
            borderRadius: "10px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            💬 Messages
            {unreadMessages > 0 && <span aria-label={`${unreadMessages} unread messages`} style={{ background: "#dc2626", color: "white", borderRadius: "999px", minWidth: "24px", padding: "3px 7px", fontSize: "13px", fontWeight: "bold" }}>{unreadMessages > 99 ? "99+" : unreadMessages}</span>}
          </span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={onOpenAdmin}
            style={{ width: "100%", padding: "12px", marginBottom: "15px", background: "#10243a", color: "white", border: "none", borderRadius: "10px", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}
          >
            🛡️ Admin area · Promotion requests
          </button>
        )}

        <button
          onClick={onPostItem}
          style={{
            width: "100%",
            padding: "15px",
            marginBottom: "20px",
            background: "#1565c0",
            color: "white",
            border: "none",
            borderRadius: "10px",
            fontSize: "18px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          ➕ Sell an Item
        </button>

        {/* SEARCH */}
        <label
          htmlFor="minglemart-search"
          style={{
            display: "block",
            fontWeight: "bold",
            marginBottom: "6px",
          }}
        >
          Search products
        </label>

        <input
          id="minglemart-search"
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="🔍 Search title, location, price..."
          style={{
            width: "100%",
            padding: "14px",
            boxSizing: "border-box",
            borderRadius: "10px",
            border: "1px solid #ccc",
            fontSize: "16px",
            background: "white",
            marginBottom: "15px",
          }}
        />

        {/* CATEGORY FILTER */}
        <label
          htmlFor="minglemart-category"
          style={{
            display: "block",
            fontWeight: "bold",
            marginBottom: "6px",
          }}
        >
          Filter by category
        </label>

        <select
          id="minglemart-category"
          value={selectedCategory}
          onChange={(event) =>
            setSelectedCategory(event.target.value)
          }
          style={{
            width: "100%",
            padding: "13px",
            boxSizing: "border-box",
            borderRadius: "10px",
            border: "1px solid #ccc",
            fontSize: "16px",
            background: "white",
            marginBottom: "18px",
          }}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        {featuredItems.length > 0 && (
          <section aria-label="Featured Listings" style={{ marginTop: "18px", marginBottom: "24px", padding: "16px", background: "#fff7df", border: "1px solid #f4c65e", borderRadius: "14px" }}>
            <h2 style={{ marginTop: 0, color: "#92400e" }}>🔥 Featured Listings</h2>
            <p style={{ marginTop: 0, color: "#78350f" }}>Products featured by MingleMart or currently on paid promotion.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: "12px" }}>
              {featuredItems.map((item) => (
                <button key={item.id ?? `${item.title}-${item.location}`} type="button" onClick={() => onViewItem(item)} style={{ textAlign: "left", background: "white", border: "1px solid #f4c65e", borderRadius: "10px", padding: "10px", cursor: "pointer", color: "#172033" }}>
                  {item.image && <img src={item.image} alt={item.title} loading="lazy" style={{ width: "100%", height: "110px", objectFit: "cover", borderRadius: "7px" }} />}
                  <span style={{ display: "inline-block", marginTop: "6px", padding: "3px 6px", background: "#fef3c7", color: "#92400e", borderRadius: "5px", fontSize: "11px", fontWeight: 800 }}>🔥 FEATURED</span>
                  <strong style={{ display: "block", marginTop: "5px" }}>{item.title}</strong>
                  <strong style={{ display: "block", color: "#1565c0", marginTop: "4px" }}>KSh {item.price}</strong>
                  <span style={{ display: "block", fontSize: "12px", color: "#526174", marginTop: "4px" }}>📍 {item.location}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <h2>🛍️ All Listings</h2>

        <p style={{ color: "#526174" }}>
          Showing {filteredItems.length} of {items.length} listings
        </p>

        {items.length === 0 ? (
          <p>No items posted yet.</p>
        ) : filteredItems.length === 0 ? (
          <div
            style={{
              background: "white",
              padding: "18px",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <p>No listings match your search.</p>

            <button
              onClick={() => {
                setSearchText("");
                setSelectedCategory("All categories");
              }}
              style={{
                padding: "10px 14px",
                border: "none",
                borderRadius: "8px",
                background: "#1565c0",
                color: "white",
                cursor: "pointer",
              }}
            >
              Clear search and filters
            </button>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={
                item.id ??
                `${item.title}-${item.location}`
              }
              onClick={() => onViewItem(item)}
              style={{
                background: "white",
                padding: "15px",
                marginTop: "15px",
                borderRadius: "12px",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                overflowWrap: "anywhere",
              }}
            >
              {/* PRODUCT IMAGE */}
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                  style={{
                    width: "100%",
                    maxHeight: "250px",
                    objectFit: "cover",
                    borderRadius: "10px",
                    marginBottom: "10px",
                  }}
                />
              ) : null}

              <h3 style={{ margin: "5px 0" }}>
                {item.title}
              </h3>

              <p
                style={{
                  color: "#64748b",
                  fontSize: "13px",
                  margin: "4px 0 10px",
                }}
                title={(() => {
                  const value = item.createdAt as { toDate?: () => Date } | Date | string | number | null | undefined;
                  let date: Date | null = null;
                  if (value instanceof Date) date = value;
                  else if (typeof value === "string" || typeof value === "number") date = new Date(value);
                  else if (value && typeof value === "object" && typeof value.toDate === "function") date = value.toDate();
                  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "Posting time";
                })()}
              >
                🕒 {formatTimeAgo(item.createdAt, currentTime)}
              </p>

              <p
                style={{
                  color: "#1565c0",
                  fontSize: "18px",
                  fontWeight: "bold",
                }}
              >
                KSh {item.price}
              </p>

              <p>
                <strong>Category:</strong> {item.category}
              </p>

              <p>📍 {item.location}</p>

              <p>{item.description}</p>

              {/* LIVE LIKES AND COMMENTS */}
              <PostSocial itemId={item.id} />

              {isAdmin && item.id && (
                <button type="button" onClick={(event) => { event.stopPropagation(); onToggleFeatured(item); }} style={{ width: "100%", marginBottom: "8px", padding: "11px", background: item.isFeatured ? "#475569" : "#f59e0b", color: item.isFeatured ? "white" : "#422006", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}>
                  {item.isFeatured ? "⭐ Remove from Featured Listings" : "⭐ Feature Listing (Admin)"}
                </button>
              )}

              {/* VIEW PRODUCT */}
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onViewItem(item);
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#1565c0",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                View Item
              </button>

              {/* SELLER PROMOTION REQUEST */}
              {currentUserId !== "" && item.sellerId === currentUserId && (
                <PromotionRequest itemId={item.id} itemTitle={item.title} />
              )}

              {/* SELLER-OWNED LISTING DELETION */}
              {currentUserId !== "" &&
                item.sellerId === currentUserId && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteItem(item);
                    }}
                    style={{
                      width: "100%",
                      marginTop: "8px",
                      padding: "12px",
                      background: "#dc2626",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "16px",
                      cursor: "pointer",
                    }}
                  >
                    🗑️ Delete My Listing
                  </button>
                )}
            </div>
          ))
        )}

        <footer
          style={{
            marginTop: "30px",
            padding: "24px 15px",
            background: "#10243a",
            color: "white",
            textAlign: "center",
            borderRadius: "12px",
          }}
        >
          <p>
            Created with ❤️ by{" "}
            <strong>Lawrence Gikonyo</strong>
          </p>

          <p>
            <strong>Founder &amp; Developer</strong>
          </p>

          <div style={{ margin: "18px auto", padding: "15px", maxWidth: "420px", background: "#17344f", border: "1px solid #36536d", borderRadius: "10px", textAlign: "left" }}>
            <h3 style={{ margin: "0 0 12px", textAlign: "center" }}>📞 Contact MingleMart</h3>
            <p style={{ margin: "10px 0" }}>
              💬 WhatsApp:{" "}
              <a href="https://wa.me/254790972269" target="_blank" rel="noopener noreferrer" style={{ color: "#86efac", fontWeight: 700 }}>
                Chat with us
              </a>
            </p>
            <p style={{ margin: "10px 0" }}>
              📱 Call:{" "}
              <a href="tel:+254790972269" style={{ color: "#bfdbfe", fontWeight: 700 }}>
                0790 972 269
              </a>
            </p>
            <p style={{ margin: "10px 0", overflowWrap: "anywhere" }}>
              ✉️ Email:{" "}
              <a href="mailto:gikonyolawrence61@gmail.com" style={{ color: "#bfdbfe", fontWeight: 700 }}>
                gikonyolawrence61@gmail.com
              </a>
            </p>
          </div>

          <p
            style={{
              fontSize: "12px",
              color: "#cbd5e1",
            }}
          >
            © 2026 MingleMart. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
    }

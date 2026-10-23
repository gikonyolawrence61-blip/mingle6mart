import { useEffect, useMemo, useState } from "react";
import type React from "react";
import PostSocial from "./src/PostSocial";
import PromotionRequest from "./src/PromotionRequest";

const profileMenuButtonStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "10px",
  textAlign: "left",
  border: "none",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#10243a",
  fontSize: "14px",
  cursor: "pointer",
};

export type Item = {
  id?: string;
  sellerId?: string;
  title: string;
  category: string;
  price: string;
  location: string;
  description: string;
  image?: string;
  totalViews?: number;
  uniqueVisitors?: number;
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
  userName: string;
  onSignOut: () => void;
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
  userName,
  onSignOut,
  isAdmin,
  onToggleFeatured,
  onOpenAdmin,
}: HomeProps) {
  const [searchText, setSearchText] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
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
  const [featuredIndex, setFeaturedIndex] = useState(0);

  // Rotate the featured showcase every four seconds. Reset safely when listings change.
  useEffect(() => {
    if (featuredItems.length < 2) {
      setFeaturedIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setFeaturedIndex((index) => (index + 1) % featuredItems.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [featuredItems.length]);

  useEffect(() => {
    setFeaturedIndex((index) => featuredItems.length ? index % featuredItems.length : 0);
  }, [featuredItems.length]);

  const activeFeaturedItem = featuredItems[featuredIndex];

  // Share a specific listing through WhatsApp with a link that can reopen that item.
  const shareListingOnWhatsApp = (item: Item) => {
    const shareUrl = new URL(window.location.href);
    if (item.id) shareUrl.searchParams.set("item", item.id);
    const message = [
      "🛍️ Check out this item on MingleMart Kenya!",
      "",
      `📦 ${item.title}`,
      `💰 Price: KSh ${item.price}`,
      `📍 Location: ${item.location}`,
      item.category ? `🏷️ Category: ${item.category}` : "",
      "",
      "Connect • Buy • Sell • Meet",
      shareUrl.toString(),
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

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

        {/* Personalised greeting and account dropdown */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            margin: "16px 0 20px",
            padding: "16px",
            borderRadius: "14px",
            background: "linear-gradient(120deg, #e0f2fe, #dcfce7)",
            border: "1px solid #bfdbfe",
          }}
        >
          <div>
            <h2 style={{ margin: "0 0 6px", color: "#10243a" }}>
              👋 Welcome back{userName ? `, ${userName}` : ""}!
            </h2>
            <p style={{ margin: 0, color: "#334155" }}>
              Ready to discover something amazing today?
            </p>
          </div>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-expanded={profileOpen}
              aria-label="Open account menu"
              style={{
                padding: "10px 13px",
                border: "1px solid #cbd5e1",
                borderRadius: "999px",
                background: "#ffffff",
                color: "#10243a",
                fontWeight: 700,
                fontSize: "15px",
                cursor: "pointer",
                maxWidth: "100%",
                overflowWrap: "anywhere",
              }}
            >
              👤 {userName || "My Account"} ▼
            </button>
            {profileOpen && (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  zIndex: 50,
                  width: "220px",
                  maxWidth: "calc(100vw - 56px)",
                  padding: "8px",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
                }}
              >
                <p style={{ padding: "8px 10px", margin: 0, color: "#526174", overflowWrap: "anywhere" }}>
                  Signed in as <strong style={{ color: "#10243a" }}>{userName || "MingleMart member"}</strong>
                </p>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    onOpenSellerInbox();
                  }}
                  style={profileMenuButtonStyle}
                >
                  💬 My Messages
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenAdmin();
                    }}
                    style={profileMenuButtonStyle}
                  >
                    🛡️ Admin area
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    onSignOut();
                  }}
                  style={{ ...profileMenuButtonStyle, color: "#b91c1c" }}
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

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

        {featuredItems.length > 0 && activeFeaturedItem && (
          <section aria-label="Featured Listings" style={{ marginTop: "18px", marginBottom: "24px", padding: "16px", background: "#fff7df", border: "1px solid #f4c65e", borderRadius: "14px", overflow: "hidden" }}>
            <style>{`
              @keyframes mingleFeaturedZoom {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.06); }
              }
              @keyframes mingleFeaturedDetails {
                0%, 12% { opacity: 0; transform: translateY(12px); }
                22%, 78% { opacity: 1; transform: translateY(0); }
                90%, 100% { opacity: 0; transform: translateY(-6px); }
              }
              @media (prefers-reduced-motion: reduce) {
                .mingle-featured-image { animation: none !important; }
                .mingle-featured-details { animation: none !important; opacity: 1 !important; transform: none !important; }
              }
            `}</style>
            <h2 style={{ marginTop: 0, color: "#92400e" }}>🔥 Featured Listings</h2>
            <p style={{ marginTop: 0, color: "#78350f" }}>Discover featured products on MingleMart.</p>
            <button
              key={activeFeaturedItem.id ?? `${activeFeaturedItem.title}-${featuredIndex}`}
              type="button"
              onClick={() => onViewItem(activeFeaturedItem)}
              aria-label={`View featured listing: ${activeFeaturedItem.title}`}
              style={{ position: "relative", display: "block", width: "100%", maxWidth: "620px", minHeight: "250px", margin: "0 auto", padding: 0, overflow: "hidden", textAlign: "left", background: "#172033", border: "1px solid #f4c65e", borderRadius: "14px", cursor: "pointer", color: "white", boxShadow: "0 8px 22px rgba(120, 53, 15, 0.18)" }}
            >
              {activeFeaturedItem.image ? (
                <img className="mingle-featured-image" src={activeFeaturedItem.image} alt={activeFeaturedItem.title} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", minHeight: "250px", objectFit: "cover", animation: "mingleFeaturedZoom 3s ease-in-out infinite" }} />
              ) : (
                <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #1565c0, #0f766e)" }} />
              )}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.08) 15%, rgba(0,0,0,0.82) 100%)" }} />
              <div className="mingle-featured-details" style={{ position: "relative", zIndex: 1, display: "flex", minHeight: "250px", boxSizing: "border-box", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-start", padding: "20px", animation: "mingleFeaturedDetails 4s ease-in-out infinite" }}>
                <span style={{ display: "inline-block", marginBottom: "8px", padding: "5px 8px", background: "#fef3c7", color: "#92400e", borderRadius: "6px", fontSize: "12px", fontWeight: 800 }}>🔥 FEATURED</span>
                <strong style={{ display: "block", fontSize: "clamp(20px, 5vw, 28px)", lineHeight: 1.2, textShadow: "0 2px 5px rgba(0,0,0,0.65)" }}>{activeFeaturedItem.title}</strong>
                <strong style={{ display: "block", color: "#fde68a", fontSize: "22px", marginTop: "8px", textShadow: "0 2px 5px rgba(0,0,0,0.65)" }}>KSh {activeFeaturedItem.price}</strong>
                <span style={{ display: "block", fontSize: "14px", marginTop: "6px", textShadow: "0 2px 5px rgba(0,0,0,0.65)" }}>📍 {activeFeaturedItem.location}</span>
                <span style={{ display: "block", fontSize: "12px", marginTop: "10px", opacity: 0.9 }}>Tap to view listing</span>
              </div>
            </button>
            {featuredItems.length > 1 && (
              <div aria-label="Featured listing navigation" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginTop: "12px" }}>
                {featuredItems.map((item, index) => (
                  <button key={item.id ?? `${item.title}-${index}`} type="button" onClick={() => setFeaturedIndex(index)} aria-label={`Show featured listing ${index + 1}`} aria-pressed={index === featuredIndex} style={{ width: index === featuredIndex ? "24px" : "9px", height: "9px", padding: 0, border: "none", borderRadius: "999px", background: index === featuredIndex ? "#92400e" : "#d6b979", cursor: "pointer", transition: "all 180ms ease" }} />
                ))}
              </div>
            )}
            <p aria-live="polite" style={{ textAlign: "center", margin: "8px 0 0", color: "#78350f", fontSize: "12px" }}>
              {featuredIndex + 1} of {featuredItems.length} featured listings · changes every 4 seconds
            </p>
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

              <div
                aria-label={`Listing statistics: ${Number(item.totalViews ?? 0)} total views and ${Number(item.uniqueVisitors ?? 0)} unique visitors`}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px 14px",
                  alignItems: "center",
                  color: "#475569",
                  fontSize: "14px",
                  margin: "8px 0",
                }}
              >
                <span>👁️ {Number(item.totalViews ?? 0)} views</span>
                <span>👥 {Number(item.uniqueVisitors ?? 0)} visitors</span>
              </div>

              <p>{item.description}</p>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  shareListingOnWhatsApp(item);
                }}
                aria-label={`Share ${item.title} on WhatsApp`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "11px 14px",
                  margin: "4px 0 12px",
                  border: "none",
                  borderRadius: "9px",
                  background: "#25D366",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Share on WhatsApp
              </button>

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
        ><div style={{ margin: "18px auto", padding: "15px", maxWidth: "420px", background: "#17344f", border: "1px solid #36536d", borderRadius: "10px", textAlign: "left" }}>
            <h3 style={{ margin: "0 0 12px", textAlign: "center" }}>📞 Contact MingleMart</h3>
            <p style={{ margin: "10px 0" }}>
              💬 WhatsApp:{" "}
              <a href="https://wa.me/254790961269" target="_blank" rel="noopener noreferrer" style={{ color: "#86efac", fontWeight: 700 }}>
                Chat with us
              </a>
            </p>
            <p style={{ margin: "10px 0" }}>
              📱 Call:{" "}
              <a href="tel:+254790961269" style={{ color: "#bfdbfe", fontWeight: 700 }}>
                0790 961 269
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

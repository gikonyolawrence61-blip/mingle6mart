import PostSocial from "./PostSocial";
import PromotionRequest from "./PromotionRequest";
import { useEffect, useMemo, useRef, useState } from "react";

export type Item = {
  id?: string;
  sellerId?: string;
  title: string;
  category: string;
  price: string;
  location: string;
  description: string;
  image?: string;
};

type HomeProps = {
  items: Item[];
  currentUserId: string;
  onPostItem: () => void;
  onViewItem: (item: Item) => void;
  onOpenSellerInbox: () => void;
  unreadMessages?: number;
  onDeleteItem: (item: Item) => void;
};

export default function Home({
  items,
  currentUserId,
  onPostItem,
  onViewItem,
  onOpenSellerInbox,
  unreadMessages = 0,
  onDeleteItem,
}: HomeProps) {
  const taglineTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = taglineTrackRef.current;
    if (!track) return;

    let position = 0;
    let previousTime = 0;
    let frameId = 0;
    const speed = 45; // pixels per second, moving left-to-right

    const animate = (time: number) => {
      if (previousTime) {
        const elapsed = Math.min((time - previousTime) / 1000, 0.05);
        const halfWidth = track.scrollWidth / 2;
        position -= speed * elapsed;
        if (halfWidth > 0 && position <= -halfWidth) position += halfWidth;
        track.style.transform = `translate3d(${position}px, 0, 0)`;
      }
      previousTime = time;
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All categories");

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
        <h1 style={{ color: "#1565c0" }}>MingleMart</h1>

        <style>{`
          .mingle-tagline-window {
            width: 100%;
            overflow: hidden;
            margin: 8px 0 18px;
            padding: 10px 0;
            border-radius: 12px;
            background: linear-gradient(90deg, #e8f5e9, #e3f2fd, #fff3e0, #f3e5f5);
          }
          .mingle-tagline-track {
            display: flex;
            width: max-content;
            transform: translate3d(0, 0, 0);
            will-change: transform;
          }
          .mingle-tagline-group {
            display: inline-flex;
            flex: 0 0 auto;
          }
          .mingle-tagline-group {
            display: inline-flex;
            align-items: center;
            white-space: nowrap;
            gap: 22px;
            padding-right: 22px;
            font-size: clamp(16px, 3.5vw, 21px);
            font-weight: 900;
            letter-spacing: .5px;
          }
          .mingle-tagline-group span:nth-child(1) { color: #16803d; }
          .mingle-tagline-group span:nth-child(2) { color: #1565c0; }
          .mingle-tagline-group span:nth-child(3) { color: #e77800; }
          .mingle-tagline-group span:nth-child(4) { color: #7b2cbf; }
          .mingle-tagline-group b { color: #94a3b8; }
        `}</style>
        <div className="mingle-tagline-window" aria-label="Connect, Buy, Sell, Meet">
          <div className="mingle-tagline-track" ref={taglineTrackRef}>
            {[0, 1].map((copy) => (
              <span className="mingle-tagline-group" key={copy} aria-hidden={copy === 1}>
                <span>● CONNECT</span><b>•</b>
                <span>🛒 BUY</span><b>•</b>
                <span>🏷️ SELL</span><b>•</b>
                <span>🤝 MEET</span><b>✦</b>
              </span>
            ))}
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
          💬 Messages{unreadMessages > 0 ? ` 🔔 ${unreadMessages}` : ""}
        </button>

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
            background: "#ffffff",
color: "#111827",
colorScheme: "light",
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
                        background: "#ffffff",
            color: "#111827",
            colorScheme: "light",
            marginBottom: "18px",
          
          }}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <h2>Items near you</h2>

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

              <PostSocial itemId={item.id} />

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

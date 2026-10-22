import PostSocial from "./PostSocial";
import PromotionRequest from "./PromotionRequest";
import { useMemo, useState } from "react";
import type React from "react";

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
};

type HomeProps = {
  items: Item[];
  currentUserId: string;
  onPostItem: () => void;
  onViewItem: (item: Item) => void;
  onOpenSellerInbox: () => void;
  unreadMessages?: number;
  onDeleteItem: (item: Item) => void;
  userName?: string;
  onSignOut?: () => void;
  isAdmin?: boolean;
  onToggleFeatured?: (item: Item) => void;
  onOpenAdmin?: () => void;
};

export default function Home({
  items,
  currentUserId,
  onPostItem,
  onViewItem,
  onOpenSellerInbox,
  unreadMessages = 0,
  onDeleteItem,
  userName = "",
  onSignOut,
  isAdmin = false,
  onOpenAdmin,
}: HomeProps) {
  const [searchText, setSearchText] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
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
        {/* BRAND AND SIGNED-IN PROFILE */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "12px",
          }}
        >
          <div>
            <h1 style={{ color: "#1565c0", margin: "0 0 5px" }}>MingleMart</h1>
            <p style={{ margin: 0 }}>Connect • Buy • Sell • Meet</p>
          </div>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-expanded={profileOpen}
              aria-label="Open account menu"
              style={{
                padding: "10px 13px",
                border: "1px solid #d1d5db",
                borderRadius: "999px",
                background: "#ffffff",
                color: "#10243a",
                fontWeight: 700,
                fontSize: "15px",
                cursor: "pointer",
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
                  zIndex: 20,
                  width: "210px",
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
                {isAdmin && onOpenAdmin && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenAdmin();
                    }}
                    style={profileMenuButtonStyle}
                  >
                    🛠️ Admin promotions
                  </button>
                )}
                <button
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    onOpenSellerInbox();
                  }}
                  style={profileMenuButtonStyle}
                >
                  💬 My Messages
                </button>
                {onSignOut && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      onSignOut();
                    }}
                    style={{ ...profileMenuButtonStyle, color: "#b91c1c" }}
                  >
                    🚪 Sign Out
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        <section
          style={{
            margin: "16px 0 20px",
            padding: "18px",
            borderRadius: "14px",
            background: "linear-gradient(120deg, #e0f2fe, #dcfce7)",
            border: "1px solid #bfdbfe",
          }}
        >
          <h2 style={{ margin: "0 0 6px", color: "#10243a" }}>
            👋 Welcome back{userName ? `, ${userName}` : ""}!
          </h2>
          <p style={{ margin: 0, color: "#334155" }}>
            Ready to discover something amazing today?
          </p>
        </section>

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
          <p>
            Created with ❤️ by{" "}
            <strong>Lawrence Gikonyo</strong>
          </p>

          <p>
            <strong>Founder &amp; Developer</strong>
          </p>

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

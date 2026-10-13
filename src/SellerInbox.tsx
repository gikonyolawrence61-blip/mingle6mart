import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export type Conversation = {
  id: string;
  itemId: string;
  itemTitle: string;
  buyerId: string;
  sellerId: string;
  sellerUnreadCount: number;
  buyerUnreadCount: number;
  role: "buyer" | "seller" | "both";
};

type SellerInboxProps = {
  onBack: () => void;
  onOpenConversation: (conversation: Conversation) => void;
};

export default function SellerInbox({
  onBack,
  onOpenConversation,
}: SellerInboxProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setError("Please sign in to view your messages.");
      setLoading(false);
      return;
    }

    let sellerConversations: Conversation[] = [];
    let buyerConversations: Conversation[] = [];

    const mergeConversations = () => {
      const merged = new Map<string, Conversation>();
      [...sellerConversations, ...buyerConversations].forEach((conversation) => {
        const existing = merged.get(conversation.id);
        merged.set(conversation.id, existing
          ? {
              ...existing,
              role: existing.role === conversation.role ? existing.role : "both",
              sellerUnreadCount: Math.max(existing.sellerUnreadCount, conversation.sellerUnreadCount),
              buyerUnreadCount: Math.max(existing.buyerUnreadCount, conversation.buyerUnreadCount),
            }
          : conversation
        );
      });

      setConversations(
        Array.from(merged.values()).sort((a, b) => a.itemTitle.localeCompare(b.itemTitle))
      );
      setLoading(false);
      setError("");
    };

    const mapSnapshot = (snapshot: import("firebase/firestore").QuerySnapshot) =>
      snapshot.docs.map((conversationDoc) => {
        const data = conversationDoc.data();
        const buyerId = String(data.buyerId ?? "");
        const sellerId = String(data.sellerId ?? "");
        const isBuyer = buyerId === user.uid;
        const isSeller = sellerId === user.uid;

        return {
          id: conversationDoc.id,
          itemId: String(data.itemId ?? ""),
          itemTitle: String(data.itemTitle ?? "Marketplace item"),
          buyerId,
          sellerId,
          sellerUnreadCount: Math.max(0, Number(data.sellerUnreadCount ?? 0)),
          buyerUnreadCount: Math.max(0, Number(data.buyerUnreadCount ?? 0)),
          role: isBuyer && isSeller ? "both" as const : isBuyer ? "buyer" as const : "seller" as const,
        };
      });

    const sellerQuery = query(
      collection(db, "conversations"),
      where("sellerId", "==", user.uid)
    );
    const buyerQuery = query(
      collection(db, "conversations"),
      where("buyerId", "==", user.uid)
    );

    const unsubscribeSeller = onSnapshot(
      sellerQuery,
      (snapshot) => {
        sellerConversations = mapSnapshot(snapshot);
        mergeConversations();
      },
      (err) => {
        console.error("SELLER MESSAGES ERROR:", err);
        setError("Could not load seller messages. Check Firestore rules.");
        setLoading(false);
      }
    );

    const unsubscribeBuyer = onSnapshot(
      buyerQuery,
      (snapshot) => {
        buyerConversations = mapSnapshot(snapshot);
        mergeConversations();
      },
      (err) => {
        console.error("BUYER MESSAGES ERROR:", err);
        setError("Could not load buyer messages. Check Firestore rules.");
        setLoading(false);
      }
    );

    return () => {
      unsubscribeSeller();
      unsubscribeBuyer();
    };
  }, []);

  const unreadTotal = conversations.reduce(
    (total, conversation) =>
      total +
      (conversation.role === "seller" || conversation.role === "both"
        ? conversation.sellerUnreadCount
        : 0) +
      (conversation.role === "buyer" || conversation.role === "both"
        ? conversation.buyerUnreadCount
        : 0),
    0
  );

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <button
        onClick={onBack}
        style={{
          padding: "10px 16px",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      <h2 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        💬 My Messages
        {unreadTotal > 0 && (
          <span style={{ background: "#dc2626", color: "white", borderRadius: "999px", padding: "3px 9px", fontSize: "14px" }}>
            {unreadTotal} new
          </span>
        )}
      </h2>

      <p>All your conversations with buyers and sellers appear here.</p>

      {loading && <p>Loading conversations...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && conversations.length === 0 && (
        <p>No messages yet. Contact a seller or wait for a buyer to message you.</p>
      )}

      {!loading && !error && conversations.map((conversation) => {
        const unread = conversation.role === "seller"
          ? conversation.sellerUnreadCount
          : conversation.role === "buyer"
            ? conversation.buyerUnreadCount
            : conversation.sellerUnreadCount + conversation.buyerUnreadCount;

        return (
          <button
            key={conversation.id}
            onClick={() => onOpenConversation(conversation)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "16px",
              marginTop: "12px",
              border: "1px solid #ddd",
              borderRadius: "10px",
              background: unread > 0 ? "#ecfdf5" : "#fff",
              fontFamily: "Arial, sans-serif",
              fontSize: "16px",
              fontWeight: 500,
              color: "#1f2937",
              cursor: "pointer",
            }}
          >
            <strong>{conversation.itemTitle}</strong>
            <span style={{ display: "inline-block", marginLeft: "8px", color: "#526174", fontSize: "12px" }}>
              {conversation.role === "buyer" ? "Buyer" : conversation.role === "seller" ? "Seller" : "Both"}
            </span>
            {unread > 0 && (
              <span style={{ display: "inline-block", marginLeft: "8px", background: "#dc2626", color: "white", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" }}>
                {unread} new
              </span>
            )}
            <p style={{ marginBottom: 0 }}>Open conversation →</p>
          </button>
        );
      })}
    </div>
  );
}

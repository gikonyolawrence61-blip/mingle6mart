import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";

type PromotionRequest = {
  id: string;
  itemId: string;
  itemTitle: string;
  sellerId: string;
  packageAmount: number;
  durationDays: number;
  status: string;
  paymentStatus: string;
  createdAt?: { toDate?: () => Date } | null;
};

type AdminPromotionsProps = {
  onBack: () => void;
};

const ADMIN_UID = "cxdj2L9iUSPw4Z6EPrarWGdYp5r2";

function formatDate(value: PromotionRequest["createdAt"]) {
  if (!value || typeof value.toDate !== "function") return "Recently submitted";
  try { return value.toDate().toLocaleString(); } catch { return "Recently submitted"; }
}

export default function AdminPromotions({ onBack }: AdminPromotionsProps) {
  const [requests, setRequests] = useState<PromotionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const isAdmin = auth.currentUser?.uid === ADMIN_UID;

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    const requestsQuery = query(collection(db, "promotionRequests"), orderBy("createdAt", "desc"));
    return onSnapshot(requestsQuery, (snapshot) => {
      setRequests(snapshot.docs.map((entry) => {
        const data = entry.data();
        return {
          id: entry.id,
          itemId: String(data.itemId ?? ""),
          itemTitle: String(data.itemTitle ?? "Untitled listing"),
          sellerId: String(data.sellerId ?? ""),
          packageAmount: Number(data.packageAmount ?? 0),
          durationDays: Number(data.durationDays ?? 1),
          status: String(data.status ?? "pending"),
          paymentStatus: String(data.paymentStatus ?? "not_paid"),
          createdAt: data.createdAt ?? null,
        };
      }));
      setError("");
      setLoading(false);
    }, (err) => {
      console.error("LOAD PROMOTION REQUESTS ERROR:", err);
      setError("Could not load requests. Firestore rules must allow the administrator to read promotionRequests.");
      setLoading(false);
    });
  }, [isAdmin]);

  const rejectRequest = async (request: PromotionRequest) => {
    if (!isAdmin || request.status !== "pending") return;
    if (!window.confirm(`Reject the promotion request for "${request.itemTitle}"?`)) return;
    setBusyId(request.id);
    setError("");
    try {
      await updateDoc(doc(db, "promotionRequests", request.id), {
        status: "rejected",
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid ?? "",
      });
    } catch (err) {
      console.error("REJECT PROMOTION ERROR:", err);
      setError("Could not reject this request. Check Firestore security rules.");
    } finally {
      setBusyId("");
    }
  };

  const confirmPaymentAndActivate = async (request: PromotionRequest) => {
    if (!isAdmin || request.status !== "pending") return;
    const confirmed = window.confirm(
      `Only continue after you have independently confirmed receipt of KSh ${request.packageAmount} for "${request.itemTitle}" in M-Pesa. Confirm payment and activate for ${request.durationDays} day(s)?`
    );
    if (!confirmed) return;
    setBusyId(request.id);
    setError("");
    try {
      const expires = new Date(Date.now() + Math.max(1, request.durationDays) * 24 * 60 * 60 * 1000);
      const batch = writeBatch(db);
      batch.update(doc(db, "items", request.itemId), {
        isFeatured: true,
        promotionStatus: "active",
        featuredUntil: Timestamp.fromDate(expires),
        featuredUpdatedAt: serverTimestamp(),
      });
      batch.update(doc(db, "promotionRequests", request.id), {
        status: "approved",
        paymentStatus: "paid",
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid ?? "",
        activatedUntil: Timestamp.fromDate(expires),
      });
      await batch.commit();
    } catch (err) {
      console.error("ACTIVATE PROMOTION ERROR:", err);
      setError("Could not activate this promotion. Confirm the listing exists and that Firestore security rules allow only the admin to update promotion records and featured fields.");
    } finally {
      setBusyId("");
    }
  };

  const pageStyle: React.CSSProperties = {
    maxWidth: 900, margin: "0 auto", padding: 18, minHeight: "100vh",
    background: "#f4f7fb", boxSizing: "border-box", color: "#10243a",
  };

  if (!isAdmin) {
    return (
      <main style={pageStyle}>
        <h1>Admin area</h1>
        <p role="alert">Access denied. This page is only available to the MingleMart administrator account.</p>
        <button onClick={onBack} style={{ padding: 12, border: 0, borderRadius: 8, background: "#1565c0", color: "white" }}>Back to MingleMart</button>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <button onClick={onBack} style={{ padding: "10px 14px", border: 0, borderRadius: 8, background: "#1565c0", color: "white", fontWeight: 700 }}>← Back to marketplace</button>
      <h1 style={{ marginBottom: 4 }}>🛡️ MingleMart Admin</h1>
      <h2 style={{ marginTop: 18 }}>Promotion requests</h2>
      <p style={{ color: "#475569" }}>Check M-Pesa independently before selecting “Confirm payment & activate”. A request alone is not proof of payment.</p>
      {error && <p role="alert" style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8 }}>{error}</p>}
      {loading ? <p>Loading promotion requests…</p> : requests.length === 0 ? (
        <div style={{ padding: 18, background: "white", borderRadius: 12 }}>No promotion requests yet.</div>
      ) : requests.map((request) => (
        <article key={request.id} style={{ marginTop: 12, padding: 16, borderRadius: 12, background: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflowWrap: "anywhere" }}>
          <h3 style={{ margin: "0 0 8px" }}>{request.itemTitle}</h3>
          <p style={{ margin: "5px 0" }}><strong>Amount:</strong> KSh {request.packageAmount}</p>
          <p style={{ margin: "5px 0" }}><strong>Duration:</strong> {request.durationDays} day(s)</p>
          <p style={{ margin: "5px 0" }}><strong>Seller UID:</strong> {request.sellerId}</p>
          <p style={{ margin: "5px 0" }}><strong>Submitted:</strong> {formatDate(request.createdAt)}</p>
          <p style={{ margin: "5px 0" }}><strong>Status:</strong> {request.status} · <strong>Payment:</strong> {request.paymentStatus}</p>
          {request.status === "pending" ? (
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <button disabled={busyId === request.id} onClick={() => void confirmPaymentAndActivate(request)} style={{ padding: 12, border: 0, borderRadius: 8, background: "#087f5b", color: "white", fontWeight: 700, cursor: busyId === request.id ? "wait" : "pointer" }}>
                {busyId === request.id ? "Processing…" : "✓ Confirm payment & activate"}
              </button>
              <button disabled={busyId === request.id} onClick={() => void rejectRequest(request)} style={{ padding: 12, border: "1px solid #fecaca", borderRadius: 8, background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
                Reject request
              </button>
            </div>
          ) : <p style={{ fontWeight: 700, color: request.status === "approved" ? "#087f5b" : "#b91c1c" }}>Reviewed: {request.status}</p>}
        </article>
      ))}
      <p style={{ marginTop: 22, color: "#64748b", fontSize: 13 }}>M-Pesa automation is not connected. This page records your manual confirmation; it does not verify payments with Safaricom.</p>
    </main>
  );
}

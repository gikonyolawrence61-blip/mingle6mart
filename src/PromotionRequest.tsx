import { useState, type MouseEvent } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

type PromotionRequestProps = {
  itemId?: string;
  itemTitle: string;
};

const packages = [
  { label: "24-hour boost", amount: 50 },
  { label: "3-day feature", amount: 100 },
  { label: "7-day feature", amount: 200 },
];

export default function PromotionRequest({ itemId, itemTitle }: PromotionRequestProps) {
  const [open, setOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const requestPromotion = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const user = auth.currentUser;
    if (!user) {
      setMessage("Please log in to request a promotion.");
      return;
    }
    if (!itemId) {
      setMessage("This listing must be saved before it can be promoted.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await addDoc(collection(db, "promotionRequests"), {
        itemId,
        itemTitle,
        sellerId: user.uid,
        packageAmount: selectedAmount,
        durationDays: selectedAmount === 50 ? 1 : selectedAmount === 100 ? 3 : 7,
        status: "pending",
        paymentStatus: "not_paid",
        createdAt: serverTimestamp(),
      });
      setMessage("Request submitted. MingleMart will confirm payment setup before any promotion is activated.");
      setOpen(false);
    } catch (error) {
      console.error("PROMOTION REQUEST ERROR:", error);
      setMessage("Could not submit the request. Firestore security rules may need updating.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: "8px" }} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => { setOpen((value) => !value); setMessage(""); }}
        style={{ width: "100%", padding: "11px", border: "1px solid #b45309", borderRadius: "8px", background: "#fffbeb", color: "#92400e", fontWeight: 700, cursor: "pointer" }}
      >
        🚀 Promote listing
      </button>
      {open && (
        <div style={{ marginTop: "8px", padding: "12px", border: "1px solid #fde68a", borderRadius: "10px", background: "#fffbeb" }}>
          <strong>Choose a promotion</strong>
          <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
            {packages.map((item) => (
              <label key={item.amount} style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "14px" }}>
                <input type="radio" name={"promotion-" + itemId} checked={selectedAmount === item.amount} onChange={() => setSelectedAmount(item.amount)} />
                {item.label} — KSh {item.amount}
              </label>
            ))}
          </div>
          <p style={{ fontSize: "12px", color: "#92400e" }}>
            This submits a request only. M-Pesa payment is not connected yet, and no money will be charged.
          </p>
          <button type="button" disabled={busy} onClick={requestPromotion} style={{ width: "100%", padding: "10px", border: "none", borderRadius: "8px", background: "#b45309", color: "white", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Submitting..." : "Submit promotion request"}
          </button>
        </div>
      )}
      {message && <p role="status" style={{ fontSize: "12px", color: message.startsWith("Could not") ? "#b91c1c" : "#166534", overflowWrap: "anywhere" }}>{message}</p>}
    </div>
  );
}

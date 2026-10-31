import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, updateDoc, doc, where } from "firebase/firestore";
import { db } from "./firebase";

type ListingAlert = {
  id: string;
  sellerId: string;
  itemId: string;
  itemTitle: string;
  message: string;
  type: string;
  read: boolean;
  createdAt?: { toDate?: () => Date } | Date | string | number | null;
};

function timestampMillis(value: ListingAlert["createdAt"]): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") return new Date(value).getTime() || 0;
  if (typeof value === "object" && typeof value.toDate === "function") {
    try { return value.toDate().getTime(); } catch { return 0; }
  }
  return 0;
}

export default function ListingAlerts({ userId }: { userId: string }) {
  const [alerts, setAlerts] = useState<ListingAlert[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!userId) { setAlerts([]); return; }
    const alertsQuery = query(collection(db, "notifications"), where("sellerId", "==", userId));
    return onSnapshot(alertsQuery, (snapshot) => {
      const ownAlerts = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() } as ListingAlert))
        .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
        .slice(0, 20);
      setAlerts(ownAlerts);
    }, (error) => console.error("LISTING ALERTS ERROR:", error));
  }, [userId]);

  const unreadCount = useMemo(() => alerts.filter((alert) => !alert.read).length, [alerts]);
  if (!userId || alerts.length === 0) return null;

  const markRead = async (alert: ListingAlert) => {
    try {
      await updateDoc(doc(db, "notifications", alert.id), { read: true });
    } catch (error) {
      console.error("Could not mark listing alert as read:", error);
    }
  };

  return (
    <section aria-label="Listing reminders" style={{ margin: "12px 0 16px", padding: "12px", border: "1px solid #bfdbfe", borderRadius: "12px", background: "#eff6ff" }}>
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", border: 0, background: "transparent", color: "#1e3a8a", fontWeight: 800, fontSize: "15px", cursor: "pointer", padding: "4px" }}>
        <span>🔔 Listing reminders</span>
        <span>{unreadCount ? `${unreadCount} new` : "View alerts"} {expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && <div style={{ marginTop: "8px" }}>
        {alerts.map((alert) => (
          <article key={alert.id} style={{ padding: "10px", marginTop: "7px", borderRadius: "8px", background: alert.read ? "#ffffff" : "#dbeafe", border: "1px solid #bfdbfe" }}>
            <strong style={{ display: "block", color: "#1e3a8a", fontSize: "13px" }}>{alert.itemTitle || "Your listing"}</strong>
            <p style={{ margin: "5px 0", color: "#334155", fontSize: "13px" }}>{alert.message}</p>
            {!alert.read && <button type="button" onClick={() => void markRead(alert)} style={{ border: 0, background: "transparent", color: "#1d4ed8", padding: "3px 0", fontWeight: 700, cursor: "pointer" }}>Mark as read</button>}
          </article>
        ))}
      </div>}
    </section>
  );
}

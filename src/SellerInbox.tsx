import { useEffect, useState } from "react";
import {
collection,
onSnapshot,
orderBy,
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
setError("Please sign in to view your inbox.");
setLoading(false);
return;
}

const inboxQuery = query(
collection(db, "conversations"),
where("sellerId", "==", user.uid),
orderBy("updatedAt", "desc")
);

const unsubscribe = onSnapshot(
inboxQuery,
(snapshot) => {
const results: Conversation[] = snapshot.docs.map((doc) => {
const data = doc.data();

return {
id: doc.id,
itemId: String(data.itemId ?? ""),
itemTitle: String(
data.itemTitle ?? "Marketplace item"
),
buyerId: String(data.buyerId ?? ""),
sellerId: String(data.sellerId ?? ""),
sellerUnreadCount: Math.max(0, Number(data.sellerUnreadCount ?? 0)),
};
});

setConversations(results);
setLoading(false);
setError("");
},
(err) => {
console.error("SELLER INBOX ERROR:", err);

setError(
"Could not load your inbox. Check your Firestore rules and indexes."
);

setLoading(false);
}
);

return unsubscribe;
}, []);

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
🔔 Seller Inbox
{conversations.reduce((total, conversation) => total + conversation.sellerUnreadCount, 0) > 0 && <span style={{ background: "#dc2626", color: "white", borderRadius: "999px", padding: "3px 9px", fontSize: "14px" }}>{conversations.reduce((total, conversation) => total + conversation.sellerUnreadCount, 0)} new</span>}
</h2>

<p>Messages from people interested in your items.</p>

{loading && <p>Loading conversations...</p>}

{error && (
<p style={{ color: "red" }}>
{error}
</p>
)}

{!loading && !error && conversations.length === 0 && (
<p>
No conversations yet. When buyers contact you about your
items, their conversations will appear here.
</p>
)}

{!loading &&
!error &&
conversations.map((conversation) => (
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
background: "#fff",
fontFamily: "Arial, sans-serif",
fontSize: "16px",
fontWeight: 500,
color: "#1f2937",                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  cursor: "pointer",
}}
>
<strong>{conversation.itemTitle}</strong>
{conversation.sellerUnreadCount > 0 && <span style={{ display: "inline-block", marginLeft: "8px", background: "#dc2626", color: "white", borderRadius: "999px", padding: "3px 8px", fontSize: "12px" }}>{conversation.sellerUnreadCount} new</span>}
<p style={{ marginBottom: 0 }}>
Open conversation →
</p>
</button>
))}
</div>
);
}
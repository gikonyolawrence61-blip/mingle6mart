import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";

type NewsStory = {
  id: string;
  title: string;
  body: string;
  authorId: string;
  status: "pending" | "published" | "rejected";
  pinned: boolean;
  createdAt?: { toDate?: () => Date } | null;
  publishedAt?: { toDate?: () => Date } | null;
};

const ADMIN_UID = "cxdj2L9iUSPw4Z6EPrarWGdYp5r2";

function timeLabel(value?: NewsStory["publishedAt"] | NewsStory["createdAt"]) {
  const date = value?.toDate?.();
  if (!date) return "Just now";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function HotNewsTicker() {
  const user = auth.currentUser;
  const isAdmin = user?.uid === ADMIN_UID;
  const [published, setPublished] = useState<NewsStory[]>([]);
  const [allStories, setAllStories] = useState<NewsStory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedStory, setSelectedStory] = useState<NewsStory | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const publicQuery = query(
      collection(db, "hotNews"),
      where("status", "==", "published")
    );
    const unsubscribePublic = onSnapshot(
      publicQuery,
      (snapshot) => {
        const stories = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as NewsStory[];
        stories.sort((a, b) => {
          if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
          const aTime = a.publishedAt?.toDate?.()?.getTime() ?? 0;
          const bTime = b.publishedAt?.toDate?.()?.getTime() ?? 0;
          return bTime - aTime;
        });
        setPublished(stories);
      },
      (error) => {
        console.error("HOT NEWS public listener:", error);
        setNotice("HOT NEWS is temporarily unavailable.");
      }
    );

    if (!isAdmin) {
      setAllStories([]);
      return unsubscribePublic;
    }

    const unsubscribeAdmin = onSnapshot(
      collection(db, "hotNews"),
      (snapshot) => {
        setAllStories(snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as NewsStory[]);
      },
      (error) => {
        console.error("HOT NEWS admin listener:", error);
        setNotice("Admin news list could not load. Check Firestore rules.");
      }
    );

    return () => {
      unsubscribePublic();
      unsubscribeAdmin();
    };
  }, [isAdmin]);

  const pendingStories = useMemo(
    () => allStories.filter((story) => story.status === "pending"),
    [allStories]
  );

  async function submitNews(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.currentUser) {
      setNotice("Please log in before submitting news.");
      return;
    }
    if (title.trim().length < 5 || body.trim().length < 10) {
      setNotice("Use a headline of at least 5 characters and a story of at least 10.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      await addDoc(collection(db, "hotNews"), {
        title: title.trim().slice(0, 120),
        body: body.trim().slice(0, 5000),
        authorId: auth.currentUser.uid,
        status: "pending",
        pinned: false,
        createdAt: serverTimestamp(),
        publishedAt: null,
      });
      setTitle("");
      setBody("");
      setShowForm(false);
      setNotice("Submitted for review. It will appear after Lawrence approves it.");
    } catch (error) {
      console.error("HOT NEWS submission failed:", error);
      setNotice("Could not submit news. Check your connection and Firestore rules.");
    } finally {
      setBusy(false);
    }
  }

  async function moderate(story: NewsStory, action: "publish" | "reject" | "pin" | "unpin" | "delete") {
    if (auth.currentUser?.uid !== ADMIN_UID) {
      setNotice("Only the MingleMart administrator can moderate news.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      if (action === "delete") {
        if (!window.confirm(`Delete “${story.title}” permanently?`)) return;
        await deleteDoc(doc(db, "hotNews", story.id));
      } else if (action === "publish") {
        await updateDoc(doc(db, "hotNews", story.id), {
          status: "published",
          publishedAt: serverTimestamp(),
        });
      } else if (action === "reject") {
        await updateDoc(doc(db, "hotNews", story.id), { status: "rejected" });
      } else {
        await updateDoc(doc(db, "hotNews", story.id), {
          pinned: action === "pin",
        });
      }
      setNotice(action === "publish" ? "News approved and published." : "News updated.");
      if (selectedStory?.id === story.id && action === "delete") setSelectedStory(null);
    } catch (error) {
      console.error("HOT NEWS moderation failed:", error);
      setNotice("Could not update news. Firestore security rules must authorize the admin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ margin: "12px 0 20px", borderRadius: 12, overflow: "hidden", border: "1px solid #fca5a5", background: "#fff7f7" }}>
      <style>{`
        @keyframes hotNewsScroll { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .hot-news-track { display: inline-block; white-space: nowrap; min-width: max-content; animation: hotNewsScroll 28s linear infinite; }
        .hot-news-track:hover, .hot-news-track:focus-within { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .hot-news-track { animation: none; white-space: normal; } }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#b91c1c", color: "white" }}>
        <strong style={{ flexShrink: 0 }}>🔥 HOT NEWS</strong>
        <div aria-label="Latest approved news headlines" style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          {published.length ? (
            <div className="hot-news-track">
              {published.map((story) => (
                <button key={story.id} onClick={() => setSelectedStory(story)} style={{ border: 0, background: "transparent", color: "white", fontWeight: 700, cursor: "pointer", padding: "0 18px" }}>
                  {story.pinned ? "📌 " : "• "}{story.title}
                </button>
              ))}
            </div>
          ) : <span style={{ fontSize: 13 }}>Community headlines will appear here after approval.</span>}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 10 }}>
        {published.slice(0, 3).map((story) => (
          <button key={story.id} onClick={() => setSelectedStory(story)} style={{ flex: "1 1 180px", textAlign: "left", padding: 10, border: "1px solid #fecaca", borderRadius: 8, background: "white", color: "#7f1d1d", cursor: "pointer" }}>
            <strong>{story.pinned ? "📌 " : ""}{story.title}</strong>
            <small style={{ display: "block", marginTop: 4, color: "#6b7280" }}>{timeLabel(story.publishedAt)}</small>
          </button>
        ))}
        <button onClick={() => { setShowForm((value) => !value); setNotice(""); }} style={{ padding: "10px 12px", border: 0, borderRadius: 8, background: "#991b1b", color: "white", fontWeight: 700, cursor: "pointer" }}>
          📝 Submit News
        </button>
        {isAdmin && (
          <button onClick={() => setShowAdmin((value) => !value)} style={{ padding: "10px 12px", border: "1px solid #991b1b", borderRadius: 8, background: "white", color: "#991b1b", fontWeight: 700, cursor: "pointer" }}>
            👑 Admin ({pendingStories.length} pending)
          </button>
        )}
      </div>

      {notice && <p role="status" style={{ margin: "0 12px 12px", color: "#7f1d1d", fontSize: 14 }}>{notice}</p>}

      {showForm && (
        <form onSubmit={submitNews} style={{ padding: 12, borderTop: "1px solid #fecaca", display: "grid", gap: 10 }}>
          <strong>Submit a story for approval</strong>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="News headline" style={{ padding: 12, border: "1px solid #d1d5db", borderRadius: 8, fontSize: 16 }} />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} required rows={4} placeholder="Write the story. Share accurate information and avoid private details." style={{ padding: 12, border: "1px solid #d1d5db", borderRadius: 8, fontSize: 16, resize: "vertical" }} />
          <button disabled={busy} type="submit" style={{ padding: 12, border: 0, borderRadius: 8, background: "#087f5b", color: "white", fontWeight: 700 }}>{busy ? "Submitting..." : "Send for approval"}</button>
          <small>Submissions are private to the moderation process until approved.</small>
        </form>
      )}

      {showAdmin && isAdmin && (
        <div style={{ padding: 12, borderTop: "1px solid #fecaca", display: "grid", gap: 12 }}>
          <strong>Admin moderation</strong>
          {allStories.length === 0 ? <p>No news submissions yet.</p> : allStories.sort((a, b) => (b.createdAt?.toDate?.()?.getTime() ?? 0) - (a.createdAt?.toDate?.()?.getTime() ?? 0)).map((story) => (
            <div key={story.id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
              <strong>{story.title}</strong>
              <p style={{ margin: "6px 0", color: "#6b7280", fontSize: 13 }}>Status: {story.status} · {timeLabel(story.createdAt)}</p>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{story.body}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {story.status !== "published" && <button disabled={busy} onClick={() => void moderate(story, "publish")}>✅ Approve</button>}
                {story.status === "pending" && <button disabled={busy} onClick={() => void moderate(story, "reject")}>❌ Reject</button>}
                {story.status === "published" && <button disabled={busy} onClick={() => void moderate(story, story.pinned ? "unpin" : "pin")}>{story.pinned ? "Unpin" : "📌 Pin"}</button>}
                <button disabled={busy} onClick={() => void moderate(story, "delete")} style={{ color: "#b91c1c" }}>🗑️ Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedStory && (
        <div role="dialog" aria-modal="true" aria-labelledby="hot-news-title" onClick={() => setSelectedStory(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.55)", display: "grid", placeItems: "center", padding: 16 }}>
          <article onClick={(event) => event.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto", background: "white", borderRadius: 14, padding: 18, boxSizing: "border-box" }}>
            <p style={{ color: "#b91c1c", fontWeight: 800 }}>🔥 MINGLEMART HOT NEWS</p>
            <h2 id="hot-news-title">{selectedStory.title}</h2>
            <small style={{ color: "#6b7280" }}>{timeLabel(selectedStory.publishedAt)}</small>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.6 }}>{selectedStory.body}</p>
            <button onClick={() => setSelectedStory(null)} style={{ padding: "10px 14px", border: 0, borderRadius: 8, background: "#1565c0", color: "white" }}>Close</button>
          </article>
        </div>
      )}
    </section>
  );
}

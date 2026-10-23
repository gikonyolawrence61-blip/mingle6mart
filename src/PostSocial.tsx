import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

type Comment = {
  id: string;
  userId: string;
  author: string;
  text: string;
  createdAt?: { toDate?: () => Date } | Date | null;
};

type PostSocialProps = {
  itemId?: string;
};

export default function PostSocial({ itemId }: PostSocialProps) {
  const user = auth.currentUser;
  const [likedByMe, setLikedByMe] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!itemId) return;
    const likesRef = collection(db, "items", itemId, "likes");
    const unsubscribeLikes = onSnapshot(
      likesRef,
      (snapshot) => {
        setLikeCount(snapshot.size);
        setLikedByMe(Boolean(auth.currentUser && snapshot.docs.some((d) => d.id === auth.currentUser?.uid)));
      },
      (err) => {
        console.error("LOAD POST LIKES ERROR:", err);
        setError("Likes could not load. Check Firestore permissions.");
      }
    );

    const commentsQuery = query(
      collection(db, "items", itemId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsubscribeComments = onSnapshot(
      commentsQuery,
      (snapshot) => {
        setComments(snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId ?? ""),
            author: String(data.author ?? "MingleMart user"),
            text: String(data.text ?? ""),
            createdAt: data.createdAt ?? null,
          };
        }));
      },
      (err) => {
        console.error("LOAD POST COMMENTS ERROR:", err);
        setError("Comments could not load. Check Firestore permissions.");
      }
    );

    return () => {
      unsubscribeLikes();
      unsubscribeComments();
    };
  }, [itemId]);

  const toggleLike = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!user?.emailVerified) {
      setError("Please log in to like a post.");
      return;
    }
    if (!itemId) {
      setError("This listing has no saved ID yet, so it cannot receive likes.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const likeRef = doc(db, "items", itemId, "likes", user.uid);
      if (likedByMe) await deleteDoc(likeRef);
      else await setDoc(likeRef, { userId: user.uid, createdAt: serverTimestamp() });
    } catch (err) {
      console.error("SAVE POST LIKE ERROR:", err);
      setError("Your like could not be saved. Check Firestore permissions.");
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const text = commentText.trim();
    if (!user) {
      setError("Please log in to comment.");
      return;
    }
    if (!itemId) {
      setError("This listing has no saved ID yet, so it cannot receive comments.");
      return;
    }
    if (!text) return;
    setError("");
    setBusy(true);
    try {
      const author = user.displayName || user.email?.split("@")[0] || "MingleMart user";
      await addDoc(collection(db, "items", itemId, "comments"), {
        userId: user.uid,
        author,
        text,
        createdAt: serverTimestamp(),
      });
      setCommentText("");
      setExpanded(true);
    } catch (err) {
      console.error("SAVE POST COMMENT ERROR:", err);
      setError("Your comment could not be saved. Check Firestore permissions.");
    } finally {
      setBusy(false);
    }
  };

  const formatCommentTime = (value: Comment["createdAt"]) => {
    if (!value) return "Just now";
    let date: Date | null = value instanceof Date ? value : null;
    if (!date && value && typeof value === "object") {
      const timestamp = value as { toDate?: () => Date };
      if (typeof timestamp.toDate === "function") {
        try { date = timestamp.toDate(); } catch { date = null; }
      }
    }
    if (!date || Number.isNaN(date.getTime())) return "";
    const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return minutes + (minutes === 1 ? " minute ago" : " minutes ago");
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
    return date.toLocaleDateString();
  };

  return (
    <section
      onClick={(event) => event.stopPropagation()}
      style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #e2e8f0" }}
    >
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={toggleLike}
          disabled={busy}
          aria-pressed={likedByMe}
          style={{
            border: "1px solid " + (likedByMe ? "#fecaca" : "#cbd5e1"),
            borderRadius: "999px",
            padding: "8px 13px",
            background: likedByMe ? "#fff1f2" : "white",
            color: likedByMe ? "#be123c" : "#334155",
            fontWeight: 700,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {likedByMe ? "❤️ Liked" : "🤍 Like"} · {likeCount}
        </button>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); setExpanded((value) => !value); }}
          style={{ border: "1px solid #cbd5e1", borderRadius: "999px", padding: "8px 13px", background: "white", color: "#334155", cursor: "pointer" }}
        >
          {expanded ? "Hide comments" : "View comments"} · {comments.length} {expanded ? "▲" : "▼"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: "12px" }}>
          {comments.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "14px" }}>No comments yet. Start the conversation!</p>
          ) : comments.map((comment) => (
            <div key={comment.id} style={{ padding: "9px 10px", marginBottom: "8px", borderRadius: "9px", background: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "14px" }}>{comment.author}</strong>
                <span style={{ color: "#64748b", fontSize: "12px" }}>{formatCommentTime(comment.createdAt)}</span>
              </div>
              <p style={{ margin: "5px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{comment.text}</p>
              {user?.uid === comment.userId && (
                <button
                  type="button"
                  onClick={async (event) => {
                    event.stopPropagation();
                    if (!itemId || !window.confirm("Delete your comment?")) return;
                    try {
                      await deleteDoc(doc(db, "items", itemId, "comments", comment.id));
                    } catch (err) {
                      console.error("DELETE COMMENT ERROR:", err);
                      setError("Could not delete this comment. Check Firestore permissions.");
                    }
                  }}
                  style={{ marginTop: "6px", padding: "4px 8px", border: "none", background: "transparent", color: "#b91c1c", cursor: "pointer" }}
                >Delete</button>
              )}
            </div>
          ))}

          <form onSubmit={submitComment} style={{ display: "flex", gap: "8px", marginTop: "10px", alignItems: "stretch" }}>
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              maxLength={1000}
              placeholder={user ? "Write a comment..." : "Log in to comment"}
              aria-label="Write a comment"
              style={{ flex: 1, minWidth: 0, padding: "11px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px" }}
            />
            <button type="submit" disabled={busy || !commentText.trim()} style={{ padding: "10px 12px", border: "none", borderRadius: "8px", background: "#1565c0", color: "white", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>Post</button>
          </form>
        </div>
      )}
      {error && <p role="alert" style={{ color: "#b91c1c", fontSize: "13px", marginTop: "8px" }}>{error}</p>}
    </section>
  );
}

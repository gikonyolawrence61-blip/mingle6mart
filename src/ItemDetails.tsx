import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { doc, collection, onSnapshot, orderBy, query, serverTimestamp, setDoc, runTransaction } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Item } from "../Home";

type ItemDetailsProps = {
  item: Item;
  onBack: () => void;
  onContactSeller: () => void;
};

type ListingReview = {
  id: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt?: { toDate?: () => Date } | Date | string | number | null;
};

function reviewDate(value: ListingReview["createdAt"]): string {
  if (!value) return "Recently";
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (typeof value === "string" || typeof value === "number") date = new Date(value);
  else if (typeof value === "object" && typeof value.toDate === "function") {
    try { date = value.toDate(); } catch { date = null; }
  }
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString()
    : "Recently";
}

export default function ItemDetails({ item, onBack, onContactSeller }: ItemDetailsProps) {
  const [reviews, setReviews] = useState<ListingReview[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Scam or suspected fraud");
  const [reportDetails, setReportDetails] = useState("");
  const [savingReport, setSavingReport] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [liveTotalViews, setLiveTotalViews] = useState(Number((item as Item & { totalViews?: number }).totalViews ?? 0));
  const [liveUniqueVisitors, setLiveUniqueVisitors] = useState(Number((item as Item & { uniqueVisitors?: number }).uniqueVisitors ?? 0));
  // Keep the displayed view counts in sync with Firestore.
  useEffect(() => {
    if (!item.id) return;
    return onSnapshot(doc(db, "items", item.id), (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      setLiveTotalViews(Math.max(0, Number(data.totalViews ?? 0)));
      setLiveUniqueVisitors(Math.max(0, Number(data.uniqueVisitors ?? 0)));
    }, (error) => console.error("Could not listen for listing view counts:", error));
  }, [item.id]);

  // Count a view when the item details open. A persistent anonymous browser ID
  // lets us estimate unique visitors without exposing personal information.
  useEffect(() => {
    if (!item.id) return;

    const user = auth.currentUser;
    // Do not count the seller viewing their own listing.
    if (user?.uid && item.sellerId && user.uid === item.sellerId) return;

    let visitorId = "";
    try {
      const storageKey = "minglemart-viewer-id";
      visitorId = window.localStorage.getItem(storageKey) || "";
      if (!visitorId) {
        visitorId = typeof window.crypto?.randomUUID === "function"
          ? window.crypto.randomUUID()
          : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.localStorage.setItem(storageKey, visitorId);
      }
    } catch {
      // If browser storage is unavailable, use a temporary ID for this tab.
      visitorId = `temporary-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    const itemRef = doc(db, "items", item.id);
    const visitorRef = doc(db, "items", item.id, "viewers", visitorId);

    runTransaction(db, async (transaction) => {
      const itemSnapshot = await transaction.get(itemRef);
      if (!itemSnapshot.exists()) return;
      const visitorSnapshot = await transaction.get(visitorRef);
      const data = itemSnapshot.data();
      transaction.update(itemRef, {
        totalViews: Math.max(0, Number(data.totalViews ?? 0)) + 1,
        uniqueVisitors: Math.max(0, Number(data.uniqueVisitors ?? 0)) + (visitorSnapshot.exists() ? 0 : 1),
        viewsUpdatedAt: serverTimestamp(),
      });
      if (!visitorSnapshot.exists()) {
        transaction.set(visitorRef, { firstViewedAt: serverTimestamp() });
      }
    }).catch((error) => {
      console.error("Could not record listing view. Firestore rules may need to allow view-counter updates:", error);
    });
  }, [item.id, item.sellerId]);

  const currentUser = auth.currentUser?.emailVerified ? auth.currentUser : null;
  const currentReview = reviews.find((review) => review.reviewerId === currentUser?.uid);
  const isSeller = Boolean(currentUser?.uid && item.sellerId && currentUser.uid === item.sellerId);

  useEffect(() => {
    if (!item.id) {
      setReviews([]);
      return;
    }
    const reviewsQuery = query(
      collection(db, "items", item.id, "reviews"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        const loadedReviews: ListingReview[] = snapshot.docs.map((reviewDoc) => {
          const data = reviewDoc.data();
          return {
            id: reviewDoc.id,
            reviewerId: String(data.reviewerId ?? reviewDoc.id),
            reviewerName: String(data.reviewerName ?? "MingleMart user"),
            rating: Math.min(5, Math.max(1, Number(data.rating ?? 5))),
            comment: String(data.comment ?? ""),
            createdAt: data.createdAt ?? null,
          };
        });
        setReviews(loadedReviews);
        const mine = loadedReviews.find((review) => review.reviewerId === auth.currentUser?.uid);
        if (mine) {
          setRating(mine.rating);
          setComment(mine.comment);
        }
      },
      (error) => {
        console.error("Could not load listing reviews:", error);
        setReviewMessage("Reviews could not load. Please check Firestore review permissions.");
      }
    );
    return unsubscribe;
  }, [item.id]);

  const averageRating = useMemo(
    () => reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0,
    [reviews]
  );

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user?.emailVerified) {
      setReportMessage("Please sign in before reporting a listing.");
      return;
    }
    if (!item.id) {
      setReportMessage("This listing is missing its ID, so it cannot be reported.");
      return;
    }
    if (isSeller) {
      setReportMessage("You cannot report your own listing.");
      return;
    }
    setSavingReport(true);
    setReportMessage("");
    try {
      // One report per account per listing prevents accidental duplicate submissions.
      const reportId = `${item.id}_${user.uid}`;
      await setDoc(doc(db, "reports", reportId), {
        listingId: item.id,
        listingTitle: item.title,
        listingSellerId: item.sellerId ?? "",
        reporterId: user.uid,
        reporterEmail: user.email ?? "",
        reason: reportReason,
        details: reportDetails.trim().slice(0, 500),
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setReportMessage("Thank you. Your report has been submitted for admin review.");
      setReportDetails("");
      setReportOpen(false);
    } catch (error) {
      console.error("Could not submit listing report:", error);
      setReportMessage("Your report could not be saved. Firestore security rules must allow signed-in users to submit reports safely.");
    } finally {
      setSavingReport(false);
    }
  };

  const saveReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      setReviewMessage("Please sign in before leaving a review.");
      return;
    }
    if (!item.id) {
      setReviewMessage("This listing is missing its ID, so it cannot be reviewed.");
      return;
    }
    if (isSeller) {
      setReviewMessage("You cannot rate your own listing.");
      return;
    }
    setSavingReview(true);
    setReviewMessage("");
    try {
      const reviewerName = user.displayName?.trim() || user.email?.split("@")[0] || "MingleMart user";
      await setDoc(doc(db, "items", item.id, "reviews", user.uid), {
        reviewerId: user.uid,
        reviewerName,
        rating,
        comment: comment.trim().slice(0, 500),
        createdAt: serverTimestamp(),
      });
      setReviewMessage(currentReview ? "Your review has been updated." : "Thank you! Your rating has been submitted.");
    } catch (error) {
      console.error("Could not save listing review:", error);
      setReviewMessage("Your review could not be saved. Firestore rules must allow a signed-in user to create or update only their own review.");
    } finally {
      setSavingReview(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f7fb", padding: "20px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", background: "white", padding: "20px", borderRadius: "15px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <button onClick={onBack} style={{ padding: "10px 15px", border: "none", borderRadius: "8px", cursor: "pointer" }}>← Back</button>

        {item.image && (
          <img src={item.image} alt={item.title} style={{ width: "100%", maxHeight: "350px", objectFit: "contain", marginTop: "15px", borderRadius: "12px" }} />
        )}

        <h1>{item.title}</h1>
        <p style={{ display: "inline-block", padding: "5px 9px", borderRadius: "7px", background: item.listingStatus === "sold" ? "#fee2e2" : item.listingStatus === "reserved" ? "#fef3c7" : item.listingStatus === "expired" || item.listingStatus === "archived" ? "#e2e8f0" : "#dcfce7", color: item.listingStatus === "sold" ? "#991b1b" : item.listingStatus === "reserved" ? "#92400e" : item.listingStatus === "expired" || item.listingStatus === "archived" ? "#334155" : "#166534", fontWeight: 800, fontSize: "12px" }}>
          {String(item.listingStatus ?? "available").toUpperCase()}
        </p>
        <h2 style={{ color: "#1565c0" }}>KSh {item.price}</h2>
        <p><strong>Category:</strong> {item.category}</p>
        <p><strong>📍 Location:</strong> {item.location}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", margin: "12px 0", color: "#475569" }}>
          <span>👁️ {liveTotalViews} total views</span>
          <span>👥 {liveUniqueVisitors} unique visitors</span>
        </div>
        <p><strong>Description:</strong></p>
        <p>{item.description || "No description provided."}</p>

        <div style={{ marginTop: "22px", padding: "16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
          <h2 style={{ marginTop: 0, marginBottom: "8px" }}>⭐ Ratings &amp; Reviews</h2>
          {reviews.length > 0 ? (
            <div aria-label={`Average rating ${averageRating.toFixed(1)} out of 5`} style={{ marginBottom: "14px" }}>
              <strong style={{ fontSize: "24px", color: "#92400e" }}>★ {averageRating.toFixed(1)} / 5</strong>
              <span style={{ color: "#526174", marginLeft: "8px" }}>({reviews.length} {reviews.length === 1 ? "review" : "reviews"})</span>
            </div>
          ) : <p style={{ color: "#526174" }}>No reviews yet. Be the first to rate this listing.</p>}

          {!isSeller && currentUser && (
            <form onSubmit={saveReview} style={{ padding: "12px", background: "white", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <h3 style={{ marginTop: 0 }}>{currentReview ? "Update your review" : "Leave a rating"}</h3>
              <label htmlFor="listing-rating" style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Your rating</label>
              <select id="listing-rating" value={rating} onChange={(event) => setRating(Number(event.target.value))} style={{ width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", marginBottom: "12px" }}>
                <option value={5}>★★★★★ — Excellent (5)</option>
                <option value={4}>★★★★☆ — Very good (4)</option>
                <option value={3}>★★★☆☆ — Good (3)</option>
                <option value={2}>★★☆☆☆ — Fair (2)</option>
                <option value={1}>★☆☆☆☆ — Poor (1)</option>
              </select>
              <label htmlFor="listing-review" style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Review (optional)</label>
              <textarea id="listing-review" value={comment} onChange={(event) => setComment(event.target.value.slice(0, 500))} placeholder="Share your experience with this listing..." rows={3} maxLength={500} style={{ width: "100%", boxSizing: "border-box", padding: "11px", borderRadius: "8px", border: "1px solid #cbd5e1", resize: "vertical" }} />
              <div style={{ textAlign: "right", fontSize: "12px", color: "#64748b", marginTop: "4px" }}>{comment.length}/500</div>
              <button type="submit" disabled={savingReview} style={{ width: "100%", padding: "12px", marginTop: "10px", background: savingReview ? "#94a3b8" : "#1565c0", color: "white", border: "none", borderRadius: "8px", fontWeight: 700, cursor: savingReview ? "wait" : "pointer" }}>
                {savingReview ? "Saving..." : currentReview ? "Update my review" : "Submit rating"}
              </button>
            </form>
          )}
          {isSeller && <p style={{ color: "#64748b" }}>You cannot review your own listing.</p>}
          {!currentUser && <p>Please sign in to leave a rating.</p>}
          {reviewMessage && <p role="status" style={{ padding: "9px", borderRadius: "8px", background: "#eff6ff", color: "#1e40af" }}>{reviewMessage}</p>}

          <div style={{ marginTop: "14px" }}>
            {reviews.map((review) => (
              <article key={review.id} style={{ padding: "12px 0", borderTop: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                  <strong>{review.reviewerName}</strong>
                  <span style={{ color: "#b45309", letterSpacing: "1px" }} aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                </div>
                <small style={{ color: "#64748b" }}>{reviewDate(review.createdAt)}</small>
                {review.comment && <p style={{ marginBottom: 0, overflowWrap: "anywhere" }}>{review.comment}</p>}
              </article>
            ))}
          </div>
        </div>

        {item.listingStatus === "sold" ? (
          <p role="status" style={{ marginTop: "20px", padding: "14px", borderRadius: "10px", background: "#fee2e2", color: "#991b1b", fontWeight: 700, textAlign: "center" }}>This item has been marked as SOLD. New enquiries are closed.</p>
        ) : (
          <button onClick={onContactSeller} style={{ width: "100%", padding: "16px", marginTop: "20px", background: "#1565c0", color: "white", border: "none", borderRadius: "10px", fontSize: "18px", fontWeight: "bold", cursor: "pointer" }}>
            💬 Contact Seller
          </button>
        )}

        {!isSeller && currentUser && (
          <div style={{ marginTop: "14px", padding: "14px", border: "1px solid #fecaca", borderRadius: "12px", background: "#fff7f7" }}>
            <button
              type="button"
              onClick={() => { setReportOpen((open) => !open); setReportMessage(""); }}
              aria-expanded={reportOpen}
              style={{ width: "100%", padding: "12px", background: "#fff", color: "#b91c1c", border: "1px solid #fca5a5", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}
            >
              🚩 Report suspicious listing
            </button>
            {reportOpen && (
              <form onSubmit={submitReport} style={{ marginTop: "14px" }}>
                <p style={{ marginTop: 0, color: "#7f1d1d" }}>Tell us what looks wrong. Reports are sent to MingleMart for review.</p>
                <label htmlFor="report-reason" style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Reason for report</label>
                <select id="report-reason" value={reportReason} onChange={(event) => setReportReason(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "11px", marginBottom: "12px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}>
                  <option>Scam or suspected fraud</option>
                  <option>Fake or counterfeit product</option>
                  <option>Misleading description or price</option>
                  <option>Prohibited or illegal item</option>
                  <option>Inappropriate content</option>
                  <option>Duplicate listing</option>
                  <option>Other concern</option>
                </select>
                <label htmlFor="report-details" style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Additional details (optional)</label>
                <textarea id="report-details" value={reportDetails} onChange={(event) => setReportDetails(event.target.value.slice(0, 500))} maxLength={500} rows={3} placeholder="Explain what concerns you..." style={{ width: "100%", boxSizing: "border-box", padding: "11px", border: "1px solid #cbd5e1", borderRadius: "8px", resize: "vertical" }} />
                <div style={{ textAlign: "right", fontSize: "12px", color: "#64748b" }}>{reportDetails.length}/500</div>
                <button type="submit" disabled={savingReport} style={{ width: "100%", padding: "12px", marginTop: "10px", background: savingReport ? "#94a3b8" : "#b91c1c", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, cursor: savingReport ? "wait" : "pointer" }}>
                  {savingReport ? "Submitting..." : "Submit report"}
                </button>
              </form>
            )}
            {reportMessage && <p role="status" style={{ marginBottom: 0, color: reportMessage.startsWith("Thank you") ? "#166534" : "#991b1b" }}>{reportMessage}</p>}
          </div>
        )}
        {!currentUser && <p style={{ marginTop: "14px", color: "#64748b" }}>Sign in to report a suspicious listing.</p>}
      </div>
    </div>
  );
}

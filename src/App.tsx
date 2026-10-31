 import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "./firebase";

import Login from "./Login";
import Registration from "./Registration";
import Verification from "./Verification";
import Confirmation from "./Confirmation";

// FIXED: Home.tsx is in the repository root.
import Home from "../Home";
import type { Item } from "../Home";

import PostItem from "./PostItem";
import ItemDetails from "./ItemDetails";
import Chat from "./Chat";
import SellerInbox from "./SellerInbox";
import AdminPromotions from "./AdminPromotions";
import PWAInstall from "./PWAInstall";

type Step =
  | "login"
  | "registration"
  | "verification"
  | "confirmation"
  | "home"
  | "postItem"
  | "itemDetails"
  | "chat"
  | "sellerInbox"
  | "adminPromotions";

export default function App() {
  const [step, setStep] = useState<Step>("home");

  const [registeredEmail, setRegisteredEmail] = useState("");

  const [items, setItems] = useState<Item[]>([]);

  const [itemsLoading, setItemsLoading] = useState(true);

  const [itemsError, setItemsError] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [activeConversation, setActiveConversation] = useState<import("./SellerInbox").Conversation | null>(null);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const [chatItem, setChatItem] = useState<Item | null>(null);

  // Keep each open product's browser title, description and structured data relevant.
  // Search engines can then associate a shared product URL with its listing details.
  useEffect(() => {
    const baseUrl = "https://minglemart-eb6da.web.app/";
    const product = step === "itemDetails" && selectedItem?.id ? selectedItem : null;
    const productIsOpen = Boolean(product);
    const title = productIsOpen
      ? `${product!.title} for sale in Kenya | MingleMart`
      : "MingleMart Kenya | Buy & Sell New and Second-Hand Items";
    const description = productIsOpen
      ? `${product!.title} for KSh ${product!.price}. ${product!.category} in ${product!.location}. ${product!.description}`.replace(/\s+/g, " ").slice(0, 300)
      : "Discover affordable new and second-hand phones, electronics, furniture, household items, fashion and more on MingleMart Kenya. Buy and sell products and connect with buyers and sellers across Kenya.";
    const pageUrl = productIsOpen
      ? `${baseUrl}?item=${encodeURIComponent(String(product!.id ?? ""))}`
      : baseUrl;

    document.title = title;
    const setMeta = (selector: string, attribute: "content" | "href", value: string) => {
      let element = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      if (!element) {
        element = document.createElement(selector.startsWith("link") ? "link" : "meta") as HTMLMetaElement | HTMLLinkElement;
        if (selector.includes("description")) element.setAttribute("name", "description");
        if (selector.includes("og:title")) element.setAttribute("property", "og:title");
        if (selector.includes("og:description")) element.setAttribute("property", "og:description");
        if (selector.includes("og:url")) element.setAttribute("property", "og:url");
        if (selector.includes("canonical")) element.setAttribute("rel", "canonical");
        document.head.appendChild(element);
      }
      element.setAttribute(attribute, value);
    };
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", pageUrl);
    setMeta('link[rel="canonical"]', "href", pageUrl);

    const schemaId = "minglemart-product-schema";
    document.getElementById(schemaId)?.remove();
    if (productIsOpen) {
      const schema = document.createElement("script");
      schema.id = schemaId;
      schema.type = "application/ld+json";
      schema.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: product!.title,
        description,
        category: product!.category,
        image: product!.image ? [product!.image] : undefined,
        offers: {
          "@type": "Offer",
          price: String(product!.price).replace(/[^0-9.]/g, ""),
          priceCurrency: "KES",
          availability: product!.listingStatus === "sold"
            ? "https://schema.org/OutOfStock"
            : product!.listingStatus === "reserved"
              ? "https://schema.org/LimitedAvailability"
              : "https://schema.org/InStock",
          url: pageUrl,
        },
        areaServed: { "@type": "Country", name: "Kenya" }
      });
      document.head.appendChild(schema);
    }
    return () => { document.getElementById(schemaId)?.remove(); };
  }, [step, selectedItem]);

  // Restore an already verified session after a page refresh.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.emailVerified) {
        setStep((currentStep) => currentStep === "login" ? "home" : currentStep);
        // Keep a basic profile for the admin's registered-user directory.
        // Existing accounts are added the next time they sign in after this update.
        void setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          displayName: user.displayName ?? "",
          email: user.email ?? "",
          emailVerified: user.emailVerified,
          createdAt: Timestamp.fromDate(
            user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date()
          ),
          lastSeenAt: serverTimestamp(),
        }, { merge: true }).catch((error) => {
          console.error("Could not update user profile:", error);
        });
      }
    });
    return unsubscribe;
  }, []);

  // LOAD SAVED LISTINGS FROM FIRESTORE
  useEffect(() => {
    // Read all listing documents without ordering. Firestore excludes older
    // documents from ordered queries when they do not contain createdAt.
    const unsubscribe = onSnapshot(
      collection(db, "items"),
      (snapshot) => {
        const savedItems: Item[] = snapshot.docs.map((document) => {
          const data = document.data();

          return {
            id: document.id,
            sellerId: String(data.sellerId ?? ""),
            title: String(data.title ?? ""),
            category: String(data.category ?? ""),
            price: String(data.price ?? ""),
            location: String(data.location ?? ""),
            description: String(data.description ?? ""),
            image: String(data.image ?? ""),
            totalViews: Math.max(0, Number(data.totalViews ?? 0)),
            uniqueVisitors: Math.max(0, Number(data.uniqueVisitors ?? 0)),
            createdAt: data.createdAt ?? null,
            isFeatured: data.isFeatured === true,
            promotionStatus: String(data.promotionStatus ?? ""),
            featuredUntil: data.featuredUntil ?? null,
            listingStatus: String(data.listingStatus ?? "available"),
            lastConfirmedAt: data.lastConfirmedAt ?? data.createdAt ?? null,
          };
        });

        setItems(savedItems);
        setItemsError("");
        setItemsLoading(false);
      },
      (error) => {
        console.error("Error loading listings:", error);

        setItemsError(
          "Could not load listings. Check your Firestore database and security rules."
        );

        setItemsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // Live unread-message count for both buyer and seller conversations.
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !["home", "sellerInbox", "chat", "itemDetails", "postItem"].includes(step)) {
      setUnreadMessages(0);
      return;
    }

    let sellerUnread = 0;
    let buyerUnread = 0;
    const updateTotal = () => setUnreadMessages(sellerUnread + buyerUnread);

    const sellerQuery = query(
      collection(db, "conversations"),
      where("sellerId", "==", user.uid)
    );
    const buyerQuery = query(
      collection(db, "conversations"),
      where("buyerId", "==", user.uid)
    );

    const unsubscribeSeller = onSnapshot(sellerQuery, (snapshot) => {
      sellerUnread = snapshot.docs.reduce(
        (sum, conversationDoc) =>
          sum + Math.max(0, Number(conversationDoc.data().sellerUnreadCount ?? 0)),
        0
      );
      updateTotal();
    }, (error) => console.error("SELLER UNREAD COUNT ERROR:", error));

    const unsubscribeBuyer = onSnapshot(buyerQuery, (snapshot) => {
      buyerUnread = snapshot.docs.reduce(
        (sum, conversationDoc) =>
          sum + Math.max(0, Number(conversationDoc.data().buyerUnreadCount ?? 0)),
        0
      );
      updateTotal();
    }, (error) => console.error("BUYER UNREAD COUNT ERROR:", error));

    return () => {
      unsubscribeSeller();
      unsubscribeBuyer();
    };
  }, [step]);

  // LOGIN
  const handleLogin = () => {
    // The pending-item effect below returns members to the product they wanted.
    setStep("home");
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUnreadMessages(0);
      setStep("home");
    } catch (error) {
      console.error("SIGN OUT ERROR:", error);
      alert("Could not sign out. Please try again.");
    }
  };

  // REGISTRATION
  const handleRegistered = (email: string) => {
    setRegisteredEmail(email);
    setStep("verification");
  };

  // EMAIL VERIFIED
  const handleVerified = () => {
    setStep("confirmation");
  };

  // CONFIRMATION
  const handleConfirmed = () => {
    // After email verification, return to the requested product when applicable.
    setStep("home");
  };

  // OPEN POSTING FORM
  const handlePostItem = () => {
    setItemsError("");
    if (!auth.currentUser?.emailVerified) {
      setStep("login");
      return;
    }
    setStep("postItem");
  };

  // SAVE A NEW LISTING
  const handleItemPosted = async (newItem: Item) => {
    try {
      setItemsError("");

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setItemsError("Please log in before posting an item.");
        return;
      }

      await addDoc(collection(db, "items"), {
        title: newItem.title,
        category: newItem.category,
        price: newItem.price,
        location: newItem.location,
        description: newItem.description,
        image: newItem.image ?? "",
        sellerId: currentUser.uid,
        createdAt: serverTimestamp(),
        listingStatus: "available",
        lastConfirmedAt: serverTimestamp(),
        reminder30SentAt: null,
        reminder45SentAt: null,
      });

      // Firestore's live listener refreshes the listings.
      setStep("home");
    } catch (error) {
      console.error("Error saving item:", error);

      setItemsError(
        "Your item could not be saved. Check your internet connection and Firestore security rules."
      );
    }
  };

  const ADMIN_UID = "cxdj2L9iUSPw4Z6EPrarWGdYp5r2";
  const isAdmin = auth.currentUser?.emailVerified === true && auth.currentUser.uid === ADMIN_UID;

  // Admin can feature a listing or remove its featured/paid-promotion status.
  const handleToggleFeatured = async (item: Item) => {
    if (!isAdmin || !item.id) {
      alert("Only the MingleMart administrator can manage featured listings.");
      return;
    }
    const expiryValue = item.featuredUntil as { toDate?: () => Date } | Date | string | number | null | undefined;
    let expiryDate: Date | null = null;
    if (expiryValue instanceof Date) expiryDate = expiryValue;
    else if (typeof expiryValue === "string" || typeof expiryValue === "number") expiryDate = new Date(expiryValue);
    else if (expiryValue && typeof expiryValue === "object" && typeof expiryValue.toDate === "function") {
      try { expiryDate = expiryValue.toDate(); } catch { expiryDate = null; }
    }
    const paidPromotionActive = item.promotionStatus === "active" && !!expiryDate &&
      !Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() > Date.now();
    const currentlyFeatured = item.isFeatured === true || paidPromotionActive;

    try {
      await updateDoc(doc(db, "items", item.id), currentlyFeatured
        ? {
            isFeatured: false,
            promotionStatus: "expired",
            featuredUntil: null,
            featuredUpdatedAt: serverTimestamp(),
          }
        : {
            isFeatured: true,
            featuredUpdatedAt: serverTimestamp(),
          });
      alert(currentlyFeatured ? "Promotion/featured status removed." : "Listing featured successfully.");
    } catch (error) {
      console.error("FEATURE LISTING ERROR:", error);
      alert("Could not update this listing. Check Firestore security rules allow the admin to update isFeatured, promotionStatus and featuredUntil.");
    }
  };

  // DELETE A LISTING OWNED BY THE CURRENT USER
   const handleDeleteItem = async (item: Item) => {
   if (!auth.currentUser) {
  alert("Please log in before deleting a listing.");
  return;
}

  if (!item.id) {
    alert("Cannot delete this listing because its ID is missing.");
    return;
  }

   const ADMIN_UID = "cxdj2L9iUSPw4Z6EPrarWGdYp5r2";

const isAdmin = auth.currentUser?.uid === ADMIN_UID;

if (!isAdmin && (!item.sellerId || item.sellerId !== auth.currentUser?.uid)) {
  alert("You can only delete listings you posted.");
  return;
}
  const confirmed = window.confirm(
    `Delete "${item.title}"? This cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  try {
    setItemsError("");

    await deleteDoc(doc(db, "items", item.id));

    // Firestore's live listener removes the deleted listing.
  } catch (error) {
    console.error("Delete failed:", error);

    setItemsError(
      "Could not delete the listing. Check your Firestore security rules."
    );
  }
};

  // Resume a product visit after sign-in or email verification. sessionStorage
  // keeps the intended product while the visitor moves between auth screens.
  useEffect(() => {
    if (step !== "home" || itemsLoading) return;

    const url = new URL(window.location.href);
    const sharedItemId = url.searchParams.get("item");
    const pendingItemId = sessionStorage.getItem("minglemart.pendingItemId");
    const targetItemId = sharedItemId || pendingItemId;
    if (!targetItemId) return;

    const targetItem = items.find((item) => item.id === targetItemId);
    if (!targetItem) return;

    // Product details are public so shoppers and search engines can view shared listings.
    setSelectedItem(targetItem);
    sessionStorage.removeItem("minglemart.pendingItemId");
    setStep("itemDetails");
  }, [step, itemsLoading, items]);

  // OPEN PRODUCT DETAILS. Keep the requested item while the visitor signs in/registers.
  const handleViewItem = (item: Item) => {
    // Let anyone open product details; login is still required for interactions.
    setSelectedItem(item);
    if (item.id) {
      const url = new URL(window.location.href);
      url.searchParams.set("item", item.id);
      window.history.pushState({}, "", url.toString());
    }
    setStep("itemDetails");
  };

  // RETURN HOME
  const handleBack = () => {
    setItemsError("");
    const url = new URL(window.location.href);
    url.searchParams.delete("item");
    window.history.replaceState({}, "", url.toString());
    setStep("home");
  };

  // OPEN CHAT WITH SELLER
  const handleChat = () => {
    if (!auth.currentUser?.emailVerified) {
      setStep("login");
      return;
    }
    if (selectedItem) {
      setChatItem(selectedItem);
      setActiveConversation(null);
      setStep("chat");
    }
  };

  return (
    <div>
      <PWAInstall />
      {/* LOGIN */}
      {step === "login" && (
        <Login
          onLoggedIn={handleLogin}
          onCreateAccount={() => setStep("registration")}
        />
      )}

      {/* REGISTRATION */}
      {step === "registration" && (
        <Registration
          onRegistered={handleRegistered}
          onLogin={() => setStep("login")}
        />
      )}

      {/* EMAIL VERIFICATION */}
      {step === "verification" && (
        <Verification
          email={registeredEmail}
          onVerified={handleVerified}
        />
      )}

      {/* CONFIRMATION */}
      {step === "confirmation" && (
        <Confirmation onContinue={handleConfirmed} />
      )}

      {/* HOME */}
      {step === "home" && (
        <div>
          {itemsLoading && (
            <p
              style={{
                textAlign: "center",
                padding: "15px",
              }}
            >
              Loading listings...
            </p>
          )}

          {itemsError && (
            <p
              role="alert"
              style={{
                color: "#b91c1c",
                background: "#ffebee",
                padding: "12px",
                margin: "10px",
                borderRadius: "8px",
              }}
            >
              {itemsError}
            </p>
          )}

          <Home
            items={items}
            currentUserId={auth.currentUser?.emailVerified ? auth.currentUser.uid : ""}
            userName={
              (auth.currentUser?.emailVerified ? auth.currentUser.displayName?.trim() : "") ||
              (auth.currentUser?.emailVerified ? auth.currentUser.email?.split("@")[0] : "") ||
              ""
            }
            onSignOut={handleSignOut}
            isAdmin={isAdmin}
            onToggleFeatured={handleToggleFeatured}
            onPostItem={handlePostItem}
            onViewItem={handleViewItem}
            onOpenSellerInbox={() => setStep("sellerInbox")}
            unreadMessages={unreadMessages}
            onDeleteItem={handleDeleteItem}
            onUpdateListingStatus={async (item, status) => {
              if (!auth.currentUser?.emailVerified || !item.id || item.sellerId !== auth.currentUser.uid) {
                alert("Only the owner of this listing can update its status.");
                return;
              }
              try {
                const updates: Record<string, unknown> = {
                  listingStatus: status,
                  statusUpdatedAt: serverTimestamp(),
                };
                if (status === "available") {
                  updates.lastConfirmedAt = serverTimestamp();
                  updates.reminder30SentAt = null;
                  updates.reminder45SentAt = null;
                }
                await updateDoc(doc(db, "items", item.id), updates);
              } catch (error) {
                console.error("LISTING STATUS UPDATE ERROR:", error);
                alert("Could not update listing status. Please check Firestore permissions and try again.");
              }
            }}
            onOpenAdmin={() => setStep("adminPromotions")}
            onSignIn={(item) => {
              if (item?.id) sessionStorage.setItem("minglemart.pendingItemId", item.id);
              setStep("login");
            }}
            onCreateAccount={() => setStep("registration")}
          />
        </div>
      )}

      {/* POST AN ITEM */}
      {step === "postItem" && (
        <PostItem
          onBack={handleBack}
          onItemPosted={handleItemPosted}
        />
      )}

      {/* ITEM DETAILS */}
      {step === "itemDetails" && selectedItem && auth.currentUser?.emailVerified && (
        <ItemDetails
          item={selectedItem}
          onBack={handleBack}
          onContactSeller={handleChat}
        />
      )}

      {/* CHAT */}
      {step === "chat" && chatItem && (
        <Chat
          item={chatItem}
          conversation={activeConversation}
          onBack={() => setStep(activeConversation ? "sellerInbox" : "itemDetails")}
        />
      )}

      {/* SELLER INBOX */}
      {step === "sellerInbox" && (
        <SellerInbox
          onBack={() => setStep("home")}
          onOpenConversation={(conversation) => {
            const relatedItem = items.find(
              (item) => item.id === conversation.itemId
            );

            if (!relatedItem) {
              alert(
                "The item for this conversation could not be found."
              );
              return;
            }

            setChatItem(relatedItem);
            setActiveConversation(conversation);
            setStep("chat");
          }}
        />
      )}

      {/* ADMIN PROMOTION REQUESTS */}
      {step === "adminPromotions" && (
        <AdminPromotions onBack={() => setStep("home")} />
      )}

      {/* Keep public contact off the sign-in screen, but show it elsewhere. */}
      {step !== "login" && (
        <footer
          style={{
            margin: "24px 12px",
            padding: "22px 15px",
            background: "#10243a",
            color: "white",
            textAlign: "center",
            borderRadius: "12px",
          }}
        >
          <h3 style={{ margin: "0 0 12px" }}>📞 Contact MingleMart</h3>
          <p style={{ margin: "10px 0" }}>
            💬 WhatsApp:{" "}
            <a href="https://wa.me/254140410035" target="_blank" rel="noopener noreferrer" style={{ color: "#86efac", fontWeight: 700 }}>
              Chat with us
            </a>
          </p>
          <p style={{ margin: "10px 0" }}>
            📱 Alternative number:{" "}
            <a href="tel:+254140410035" style={{ color: "#bfdbfe", fontWeight: 700 }}>
              0140 410 035
            </a>
          </p>
          <p style={{ fontSize: "12px", color: "#cbd5e1", marginBottom: 0 }}>
            © 2026 MingleMart. All rights reserved.
          </p>
        </footer>
      )}
    </div>
  );
                                 }

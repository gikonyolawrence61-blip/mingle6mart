 import { useEffect, useState } from "react";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
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

type Step =
  | "login"
  | "registration"
  | "verification"
  | "confirmation"
  | "home"
  | "postItem"
  | "itemDetails"
  | "chat"
  | "sellerInbox";

export default function App() {
  const [step, setStep] = useState<Step>("login");

  const [registeredEmail, setRegisteredEmail] = useState("");

  const [items, setItems] = useState<Item[]>([]);

  const [itemsLoading, setItemsLoading] = useState(true);

  const [itemsError, setItemsError] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [activeConversation, setActiveConversation] = useState<import("./SellerInbox").Conversation | null>(null);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const [chatItem, setChatItem] = useState<Item | null>(null);

  // LOAD SAVED LISTINGS FROM FIRESTORE
  useEffect(() => {
    const itemsQuery = query(
      collection(db, "items"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      itemsQuery,
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
            createdAt: data.createdAt ?? null,
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
    setStep("home");
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
    setStep("home");
  };

  // OPEN POSTING FORM
  const handlePostItem = () => {
    setItemsError("");
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

  // OPEN PRODUCT DETAILS
  const handleViewItem = (item: Item) => {
    setSelectedItem(item);
    setStep("itemDetails");
  };

  // RETURN HOME
  const handleBack = () => {
    setItemsError("");
    setStep("home");
  };

  // OPEN CHAT WITH SELLER
  const handleChat = () => {
    if (selectedItem) {
      setChatItem(selectedItem);
      setActiveConversation(null);
      setStep("chat");
    }
  };

  return (
    <div>
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
            currentUserId={auth.currentUser?.uid ?? ""}
            onPostItem={handlePostItem}
            onViewItem={handleViewItem}
            onOpenSellerInbox={() => setStep("sellerInbox")}
            unreadMessages={unreadMessages}
            onDeleteItem={handleDeleteItem}
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
      {step === "itemDetails" && selectedItem && (
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
    </div>
  );
                                 }

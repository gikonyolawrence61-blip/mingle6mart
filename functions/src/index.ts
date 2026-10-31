import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";

initializeApp();

const db = getFirestore();
const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    try { return (value as { toDate: () => Date }).toDate(); } catch { return null; }
  }
  return null;
}

async function createReminder(itemId: string, sellerId: string, title: string, type: string, message: string) {
  const notificationId = `listing_${itemId}_${type}`;
  await db.collection("notifications").doc(notificationId).set({
    sellerId,
    itemId,
    itemTitle: title,
    type,
    message,
    read: false,
    createdAt: Timestamp.now(),
  }, { merge: true });
}

export const manageListingExpiry = onSchedule(
  { schedule: "every day 08:00", timeZone: "Africa/Nairobi", region: "africa-south1" },
  async () => {
    const snapshot = await db.collection("items").get();
    const now = Date.now();
    let remindersSent = 0;
    let listingsExpired = 0;

    for (const itemDoc of snapshot.docs) {
      const item = itemDoc.data();
      const status = String(item.listingStatus ?? "available").toLowerCase();
      if (!item.sellerId || status === "sold" || status === "archived" || status === "expired") continue;

      const baseDate = toDate(item.lastConfirmedAt) ?? toDate(item.createdAt);
      if (!baseDate) {
        logger.warn("Skipping listing without a usable createdAt timestamp", { itemId: itemDoc.id });
        continue;
      }

      const ageDays = Math.floor((now - baseDate.getTime()) / DAY_MS);
      const sellerId = String(item.sellerId);
      const title = String(item.title ?? "Your listing");

      if (ageDays >= 60) {
        await itemDoc.ref.update({
          listingStatus: "expired",
          expiredAt: Timestamp.now(),
          statusUpdatedAt: Timestamp.now(),
        });
        await createReminder(itemDoc.id, sellerId, title, "expired", "Your listing has been hidden because availability was not confirmed within 60 days. Choose Available / Renew to publish it again.");
        listingsExpired++;
        continue;
      }

      if (ageDays >= 45 && !item.reminder45SentAt) {
        await createReminder(itemDoc.id, sellerId, title, "day45", "Your listing is 45 days old. Please confirm availability or mark it Reserved or Sold.");
        await itemDoc.ref.update({ reminder45SentAt: Timestamp.now() });
        remindersSent++;
      } else if (ageDays >= 30 && !item.reminder30SentAt) {
        await createReminder(itemDoc.id, sellerId, title, "day30", "Is this item still available? Confirm availability to keep your listing up to date.");
        await itemDoc.ref.update({ reminder30SentAt: Timestamp.now() });
        remindersSent++;
      }
    }

    logger.info("Listing maintenance completed", { remindersSent, listingsExpired, scanned: snapshot.size });
  }
);

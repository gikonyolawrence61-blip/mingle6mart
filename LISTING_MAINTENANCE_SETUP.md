# MingleMart listing status and automatic reminders

## Listing status behaviour

- `available`: visible to shoppers.
- `reserved`: visible with a Reserved label.
- `sold`: remains visible with a Sold label and is not expired automatically.
- `expired`: hidden from shoppers after 60 days without confirmation; visible to its owner for renewal.
- `archived`: hidden from shoppers after the seller archives it; visible to its owner for restoration.

The seller's **Available / Renew** action resets `lastConfirmedAt` and clears the 30/45-day reminder markers.

## Reminder schedule

A scheduled Firebase Function checks listings daily at 08:00 East Africa Time:

- Day 30: in-app availability reminder.
- Day 45: in-app reminder to confirm availability or update status.
- Day 60: listing is marked expired and hidden; an in-app expiry notice is created.

Notifications are stored in `notifications` and displayed in the seller's Listing reminders panel. These are in-app reminders, not email or push notifications.

## Deployment requirements

1. Firebase Cloud Functions with Cloud Scheduler require the Firebase project to be on the **Blaze (pay-as-you-go)** plan. Review Google Cloud billing before enabling it; scheduled invocations and function usage may incur charges.
2. Merge the feature branch into `main` to deploy the web UI through the existing Hosting workflow.
3. Merge the Firestore permission additions described in `FIRESTORE_LISTING_RULES.md` into the existing Firestore rules in Firebase Console. Do not replace the existing rules with only the snippet.
4. In GitHub, open **Actions → Deploy MingleMart scheduled functions → Run workflow** to deploy the scheduled function.
5. Confirm the first scheduled run in Firebase/Google Cloud logs.

Existing listings without `listingStatus` are treated as available. Their age is calculated from `lastConfirmedAt` when present, otherwise from `createdAt`.

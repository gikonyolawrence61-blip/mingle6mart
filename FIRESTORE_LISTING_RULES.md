# Firestore rules additions required for listing status and alerts

The existing Firestore rules are managed outside this repository, so do not replace them wholesale. Merge the following permissions into the existing ruleset.

Within the existing `match /items/{itemId}` block, allow the authenticated owner to update only the listing-maintenance fields (in addition to any existing owner update permissions):

```rules
allow update: if request.auth != null
  && resource.data.sellerId == request.auth.uid
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
    'listingStatus',
    'lastConfirmedAt',
    'statusUpdatedAt',
    'reminder30SentAt',
    'reminder45SentAt'
  ]);
```

Add a notifications match block. Scheduled Cloud Functions use the Admin SDK and bypass these client rules:

```rules
match /notifications/{notificationId} {
  allow read: if request.auth != null
    && resource.data.sellerId == request.auth.uid;
  allow update: if request.auth != null
    && resource.data.sellerId == request.auth.uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read'])
    && request.resource.data.read == true;
  allow create, delete: if false;
}
```

Important: merge these conditions with existing item-owner update permissions rather than adding a second conflicting `allow update` expression. Firestore combines matching allow expressions with OR, so a permissive existing rule can still grant broader access.

# Inventory Transfers (POS – Shop to Shop)

Admins can transfer inventory from one shop to another. One admin **sends** a transfer; the other admin **confirms** and receives. Identification is by **uid** or **email**.

## Firestore collection: `inventoryTransfers`

| Field          | Type     | Description |
|----------------|----------|-------------|
| `fromUid`      | string   | Sender admin’s Firebase Auth UID |
| `fromStoreId`  | string   | Sender’s store ID (under `users/{fromUid}/stores/{fromStoreId}`) |
| `toUid`        | string   | Receiver admin’s UID (resolve from email in POS before creating) |
| `toEmail`      | string?  | Receiver’s email (optional; used for display and rule matching) |
| `toStoreId`    | string   | Receiver’s store ID |
| `items`        | array    | `[{ inventoryDocId, name, quantity, imageUrl?, price? }]` – items to transfer (include image and price for display and when adding to receiver’s inventory) |
| `status`       | string   | `'pending'` \| `'accepted'` \| `'rejected'` |
| `createdAt`    | timestamp| When the transfer was created |
| `respondedAt`  | timestamp? | When the receiver accepted/rejected |
| `respondedBy`  | string?  | UID of the user who accepted/rejected |

**Security (Firestore rules):**

- **Create:** Only an admin; `fromUid` must equal the current user; `status` must be `'pending'`.
- **Read/List:** Only admins who are either sender (`fromUid`), receiver by `toUid`, or receiver by `toEmail` (matched to `request.auth.token.email`).
- **Update:** Only the receiver (by `toUid` or `toEmail`); only when `status` is `'pending'`; only `status`, `respondedAt`, and `respondedBy` may change; new `status` must be `'accepted'` or `'rejected'`.

## Flow in the POS

### 1. Sender (admin A)

- Choose **from** store (own store), **to** admin by **uid or email**, and **to** store.
- If user enters email, look up the user (e.g. `users` collection or Admin SDK) to get `toUid`; set both `toUid` and `toEmail` when creating the transfer.
- Select items and quantities from `users/{fromUid}/stores/{fromStoreId}/inventory`.
- Create a document in `inventoryTransfers` with `status: 'pending'`, `fromUid`, `fromStoreId`, `toUid`, `toEmail` (optional), `toStoreId`, `items`, `createdAt`.

### 2. Receiver (admin B)

- List **incoming** transfers:  
  `inventoryTransfers` where `toUid == currentUser.uid` (and optionally `status == 'pending'`).  
  If you use email-based matching, also query where `toEmail == request.auth.token.email`.
- To **accept:**  
  - In a **transaction**:  
    - Update the transfer: set `status: 'accepted'`, `respondedAt`, `respondedBy`.  
    - For each item: **add** (or merge) into `users/{toUid}/stores/{toStoreId}/inventory` (receiver’s store).  
  - Then the **sender** must decrement their inventory (see below).
- To **reject:**  
  Update the transfer: set `status: 'rejected'`, `respondedAt`, `respondedBy`. No inventory changes.

### 3. Moving stock (sender side)

After the receiver sets `status` to `'accepted'`:

- **Option A (recommended):** In the POS, when the sender loads “Sent transfers” or opens the app, run a job that finds transfers with `fromUid == currentUser.uid` and `status == 'accepted'` that have not yet been applied. For each such transfer, decrement the corresponding items in `users/{fromUid}/stores/{fromStoreId}/inventory` (and optionally mark the transfer as “applied” in a custom field if you add one).
- **Option B:** Use a **Cloud Function** triggered when a transfer is updated to `accepted`: in one transaction, decrement sender’s inventory and increment (or merge) receiver’s inventory. Then the POS only creates/updates the transfer doc; no client-side inventory move needed.

## Query indexes

Use the composite indexes defined in `firestore.indexes.json` for:

- Incoming: `toUid` + `status` + `createdAt` (and similarly for `toEmail` if you query by email).
- Sent: `fromUid` + `createdAt`.

Deploy indexes with:

```bash
firebase deploy --only firestore:indexes
```

## Summary

| Step   | Who    | Action |
|--------|--------|--------|
| Send   | Admin A | Create `inventoryTransfers` doc with `toUid`/`toEmail`, `toStoreId`, `items`, `status: 'pending'`. |
| Confirm| Admin B | Update doc to `status: 'accepted'` (or `'rejected'`), set `respondedAt`, `respondedBy`; add items to receiver’s inventory. |
| Receive| Admin B | Items are added to `users/{toUid}/stores/{toStoreId}/inventory` when they accept. |
| Deduct | Admin A | When POS sees `status == 'accepted'`, decrement items in sender’s store (or use a Cloud Function to do both sides in one go). |

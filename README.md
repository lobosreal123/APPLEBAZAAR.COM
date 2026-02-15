# Applebazaar

Storefront that uses the **same Firestore inventory as your POS**: `users/{userId}/stores/{storeId}/inventory`. Visitors browse that inventory, sign up or log in, and place orders. Orders are saved to the top-level `orders` collection; inventory is updated from the POS when you fulfill orders.

## Setup

1. **Firebase project**
   - Use the same project as your POS. Ensure **Authentication** (Email/Password) and **Firestore** are enabled.
   - Register a web app for this site and add its config to `.env`.

2. **Environment**
   - Copy `.env.example` to `.env`.
   - Set all `VITE_FIREBASE_*` values from Firebase Console → Project settings → Your apps.
   - Set **POS store(s) for the website catalog** (first matching option is used):
     - **Multiple owners and/or stores:** `VITE_POS_STORES` = comma-separated `ownerId:storeId` pairs (e.g. `uid1:store1,uid2:store2,uid1:store2`).
     - **One owner, multiple stores:** `VITE_POS_OWNER_UID` + `VITE_POS_STORE_IDS` = comma-separated store IDs.
     - **Single store:** `VITE_POS_OWNER_UID` + `VITE_POS_STORE_ID`.

3. **Firestore rules**
   - Deploy `firestore.rules` so the website can read the store(s) inventory.
   - Create a document **`publicStore/publicStorewebsite`** in Firestore so public read is allowed for the same store(s) as in `.env`:
     - **Single owner:** `ownerId` (string), and either `storeId` (string) or `storeIds` (array of strings).
     - **Multiple owners:** `storeKeys` (array of strings): each entry is `"ownerId_storeId"` (e.g. `["uid1_store1","uid2_store2"]`). This must match the pairs you set in `VITE_POS_STORES`.
   - That document controls which store(s) inventory is publicly readable.

4. **Inventory and item images**
   - The website reads from `users/{VITE_POS_OWNER_UID}/stores/{VITE_POS_STORE_ID}/inventory`. Use the same fields your POS uses: at least `name`, `price`, `stock`; optional `description`, `imageUrl` / `imagePath`, `barcode`, `category`.
   - Item images: the POS saves the **full download URL** in Firestore as `imageUrl` (e.g. `https://firebasestorage.googleapis.com/...`). The website uses that URL directly. The Storage object path (`users/uid/stores/storeId/item-images/...`) is only the location inside the bucket; it is not stored in Firestore.
   - Deploy **Storage rules** so the website can read item images: Firebase Console → Storage → Rules, paste `storage.rules`, or run `firebase deploy --only storage`.

5. **Install and run**
   - `npm install`
   - `npm run dev`

## Scripts

- `npm run dev` – start dev server
- `npm run build` – production build
- `npm run preview` – preview production build

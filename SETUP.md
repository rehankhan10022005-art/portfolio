# Setup guide — Firebase + Cloudinary + GitHub Pages

Your site no longer needs a Node/Express server at all. It's now:

- **index.html** — the public portfolio. Reads content from Firestore, and
  live-updates the moment Admin saves (no refresh needed).
- **admin-login.html** — signs in with Firebase Auth (email/password).
- **admin.html** — the Media Library. Reads/writes the Firestore document
  `content/site`, uploads files straight to Cloudinary.
- **seed-content.html** — run this **once** to load starting content into
  Firestore. You can delete it afterwards.
- **firebase-init.js / cloudinary-config.js** — shared config, already
  filled in with your project's values.
- **firestore.rules** — security rules: public read, admin-only write.
- `server-example.js` is no longer used — safe to ignore or delete.

## 1. Firebase Authentication

1. Firebase Console → your project (`portfolio-777a5`) → **Build → Authentication**.
2. **Sign-in method** tab → enable **Email/Password**.
3. **Users** tab → confirm `megatech1978@gmail.com` exists (you said you
   already created it — if not, add it here with a password).

## 2. Firestore Database

1. Firebase Console → **Build → Firestore Database → Create database**.
2. Start in **production mode** (the rules below lock it down properly —
   you don't need "test mode").
3. Pick any region close to your visitors.

### Deploy the security rules

Easiest path — paste directly in the console:

1. Firestore Database → **Rules** tab.
2. Replace the contents with what's in `firestore.rules` in this repo.
3. Click **Publish**.

(Alternative: `firebase deploy --only firestore:rules` via the Firebase CLI
if you prefer — not required.)

## 3. Cloudinary

1. Confirm your cloud name is **`cowoq8sh`** (already wired into the code —
   tell me if it's actually different and I'll fix it).
2. Cloudinary Console → **Settings → Upload → Upload presets**.
3. Confirm a preset named **`portfolio`** exists with **Signing Mode: Unsigned**.
   - Optionally set **Folder** to `saeed-portfolio` and restrict allowed
     formats to images/video if you want tighter control.
4. Nothing else needed — uploads go straight from the Admin panel's browser
   to Cloudinary, no server involved.

## 4. Seed your content (one time, important)

Firestore starts empty. Until it has data, the site quietly falls back to
the built-in placeholder content — that's fine, but the Admin panel's Save
button always writes the **whole** document, so you want real content in
there before you start editing.

1. Push everything to GitHub (step 5) and enable GitHub Pages, **or** just
   open these files locally in a browser (Firebase Auth + Firestore work
   fine from `file://` for this).
2. Go to `admin-login.html`, sign in as `megatech1978@gmail.com`.
3. Go to `seed-content.html`.
4. Click **"Seed Firestore now"**. This writes your current project titles,
   descriptions, services, etc. into `content/site`.
5. Delete `seed-content.html` from the repo (optional, but tidy — it's not
   linked from anywhere public).

## 5. Push to GitHub

```bash
git clone https://github.com/rehankhan10022005-art/portfolio.git
cd portfolio
# copy all the files from this package into the repo folder, replacing old ones
git add .
git commit -m "Replace Express backend with Firebase + Cloudinary (live admin editing)"
git push origin main
```

## 6. Enable GitHub Pages

1. GitHub repo → **Settings → Pages**.
2. Source: **Deploy from a branch** → branch `main`, folder `/ (root)`.
3. Save. Your site will be live at:
   `https://rehankhan10022005-art.github.io/portfolio/`
4. Admin panel will be at `.../admin-login.html`.

## How it works end to end

1. You sign in at `admin-login.html` → Firebase Auth verifies you.
2. You edit media in `admin.html` → Save writes the full content object to
   Firestore's `content/site` document. Firestore Security Rules check
   your account before allowing the write — this is the actual security
   boundary, not just the page's login screen.
3. Every visitor's `index.html` has a live Firestore listener open. The
   instant your write lands, their page updates in place — reel, project
   images/videos, and content thumbnails — with no refresh and no rebuild.
4. Image/video uploads go straight from your browser to Cloudinary (using
   the unsigned `portfolio` preset), and the resulting URL is what gets
   saved to Firestore.

## Notes / things worth knowing

- **Cost**: Firestore and Cloudinary both have generous free tiers for a
  personal portfolio's traffic. You won't hit limits under normal use.
- **Cloudinary preset security**: because the preset is unsigned, anyone
  who found the preset name could technically upload files to your
  Cloudinary account (not to your site — Firestore rules still block them
  from ever showing up publicly). If that's a concern, add upload
  restrictions in the preset (allowed formats, max file size) in the
  Cloudinary dashboard.
- **Only one admin account** is authorized to write, enforced by
  `firestore.rules`. To add a second admin later, change the rule to check
  against a list, or store admin emails in a Firestore collection.

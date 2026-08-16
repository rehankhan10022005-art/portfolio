/**
 * NO LONGER NEEDED — this project now uses Firebase (Firestore + Auth) and
 * an unsigned Cloudinary upload preset instead of a custom Express backend.
 * See SETUP.md, firebase-init.js, and admin.html. This file is kept only
 * for reference and can be deleted.
 *
 * REFERENCE ONLY — not wired into the static site.
 *
 * The portfolio is currently a single static HTML file with no backend,
 * so there is nowhere to run real server-side authentication (or content
 * storage) yet. This file shows the minimal, correct shape of an Express
 * backend that the front-end pages in this pass already expect:
 *
 *   POST /api/admin/login                    — admin-login.html
 *   GET  /api/admin/session                  — admin.html (route guard)
 *   POST /api/admin/logout                   — admin.html
 *   GET  /api/content                        — portfolio page + admin.html (public read)
 *   PUT  /api/admin/content                   — admin.html Media Library "Save" (auth)
 *   POST /api/admin/media/upload-signature    — admin.html Media Library "Upload" (auth)
 *   DELETE /api/admin/media/:id               — admin.html Media Library "Remove" (auth, optional)
 *
 * To go live, deploy something like this behind HTTPS (Node/Express here,
 * but any backend works as long as it honors the same endpoints/contract),
 * and point the static site + admin pages at it. Requires Node 18+ for the
 * built-in `fetch` used below (or install node-fetch on older Node).
 *
 * npm install express bcrypt express-session dotenv
 */

require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// ADMIN_USERNAME and ADMIN_PASSWORD_HASH live in environment variables /
// a secrets manager — never in source control, never in client-side code.
// Generate a hash once with: bcrypt.hashSync('your-password', 12)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

app.use(session({
  secret: process.env.SESSION_SECRET, // long random value, from env
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,       // HTTPS only
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 8, // 8 hours
  },
}));

// Basic rate limiting on login is strongly recommended (e.g. express-rate-limit)
// to slow down credential-stuffing attempts.

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Missing credentials.' });
  }

  const validUsername = username === ADMIN_USERNAME;
  const validPassword = ADMIN_PASSWORD_HASH
    ? await bcrypt.compare(password, ADMIN_PASSWORD_HASH)
    : false;

  if (!validUsername || !validPassword) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials.' });
  }

  req.session.admin = true;
  res.json({ ok: true });
});

app.get('/api/admin/session', (req, res) => {
  if (req.session && req.session.admin) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Protect any other /admin API routes with this middleware:
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.status(401).json({ ok: false, error: 'Unauthorized' });
}
// app.use('/api/admin', requireAdmin, adminApiRouter);

/* ==================================================================
 * Content storage
 * ------------------------------------------------------------------
 * ONE source of truth for site media/content, shared by the public
 * portfolio page and the Admin media editor — matches the JSON shape
 * embedded in the portfolio page's <script id="site-data"> tag, which
 * is what the public page falls back to if this endpoint is ever
 * unreachable (so the site never breaks just because the backend is
 * down or not yet deployed).
 *
 * This reference implementation persists to a local JSON file, which
 * is enough to make the Admin panel genuinely work, but is NOT meant
 * for production concurrent writes. Swap readContent()/writeContent()
 * for real database calls (Postgres, Mongo, etc.) when ready — nothing
 * else in this file needs to change.
 * ================================================================== */
const CONTENT_FILE = path.join(__dirname, 'content.json');

const DEFAULT_CONTENT = {
  cloudinary: { cloudName: 'cowoq8sh' }, // public, non-secret — safe to expose
  hero: { image: '', video: '', videoPoster: '' },
  reel: {
    src: 'https://res.cloudinary.com/cowoq8sh/video/upload/v1786863621/Hand_grabbing_chicken_drumstick_202608091539_xu4nh0.mp4',
    poster: 'https://res.cloudinary.com/cowoq8sh/image/upload/v1786863589/ChatGPT_Image_Aug_9_2026_03_57_40_AM_zj29yr.png',
    type: 'cloudinary_video',
  },
};

function readContent() {
  try {
    return JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  } catch (e) {
    return null; // nothing saved yet
  }
}
function writeContent(content) {
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2));
}

// Public — no auth. The portfolio page's public visitors and the Admin
// media editor both read from here.
app.get('/api/content', (req, res) => {
  res.json(readContent() || DEFAULT_CONTENT);
});

// Auth required. Saves the full content object (the Admin media editor
// always sends the complete object back, not a partial patch).
app.put('/api/admin/content', requireAdmin, (req, res) => {
  const content = req.body;
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return res.status(400).json({ ok: false, error: 'Expected a JSON content object.' });
  }
  writeContent(content);
  res.json({ ok: true });
});

/* ==================================================================
 * Cloudinary — signed uploads + deletes
 * ------------------------------------------------------------------
 * The API secret NEVER leaves this server. The Admin media editor asks
 * this server for a short-lived signature, then uploads the file
 * straight to Cloudinary itself using that signature — the file bytes
 * never pass through this backend.
 *
 *   Admin → (authenticated) this server → signs params
 *   Admin → uploads file + signed params directly → Cloudinary
 *   Cloudinary → returns the asset URL/public_id → Admin
 *   Admin → PUT /api/admin/content → this server stores the URL
 * ================================================================== */
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'cowoq8sh'; // public config
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;         // from env — never in source control
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;   // from env — never sent to the client

// Cloudinary's signing rule: take every param EXCEPT file/api_key/signature/
// resource_type, sort the keys alphabetically, join as "key=value&key=value",
// append the API secret, then SHA-1 hex-digest the whole string.
function signCloudinaryParams(params) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + CLOUDINARY_API_SECRET).digest('hex');
}

app.post('/api/admin/media/upload-signature', requireAdmin, (req, res) => {
  if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return res.status(500).json({ ok: false, error: 'Cloudinary credentials are not configured on the server.' });
  }
  const timestamp = Math.round(Date.now() / 1000);
  const folder = (req.body && String(req.body.folder || '').trim()) || 'saeed-portfolio';
  const signature = signCloudinaryParams({ folder, timestamp });

  // resourceType isn't part of the signature — it only selects which Cloudinary
  // upload URL (image/ vs video/) the client posts to.
  res.json({
    ok: true,
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature,
  });
});

// Optional: lets Admin's "Remove" fully delete the old asset from Cloudinary
// storage instead of just clearing the reference to it. Uses the Admin API's
// HTTP Basic Auth (api_key:api_secret) rather than a signed upload param.
app.delete('/api/admin/media/:id', requireAdmin, async (req, res) => {
  if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return res.status(500).json({ ok: false, error: 'Cloudinary credentials are not configured on the server.' });
  }
  const publicId = decodeURIComponent(req.params.id);
  const resourceType = req.query.resourceType === 'video' ? 'video' : 'image';
  const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64');

  try {
    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/${resourceType}/upload/${encodeURIComponent(publicId)}`,
      { method: 'DELETE', headers: { Authorization: `Basic ${auth}` } }
    );
    if (!cloudRes.ok) throw new Error('Cloudinary refused the delete request.');
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'Could not delete the asset from Cloudinary.' });
  }
});

module.exports = app;

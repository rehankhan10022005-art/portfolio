/**
 * Shared Cloudinary config — public, non-secret values, safe to ship in
 * client code. Uploads use an UNSIGNED upload preset, so the browser can
 * upload directly to Cloudinary with no backend and no API secret exposed.
 *
 * The preset "portfolio" must exist in Cloudinary and be set to
 * Signing Mode: Unsigned (Settings -> Upload -> Upload presets).
 */
export const CLOUDINARY_CLOUD_NAME = "cowoq8sh";
export const CLOUDINARY_UPLOAD_PRESET = "portfolio";
export const CLOUDINARY_FOLDER = "saeed-portfolio";

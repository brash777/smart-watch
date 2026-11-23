import { z } from 'zod';

/*
 * The only module that reads import.meta.env. Values come from the VITE_* variables of the root
 * .env (documented in .env.example); a missing one stops the app with its name.
 */

const envSchema = z.object({
  VITE_APP_NAME: z.string().trim().min(1),
  VITE_API_URL: z.string().trim().min(1),
  VITE_WHATSAPP_SHARE_URL: z.url({ protocol: /^https?$/ }),
  VITE_UPLOAD_IMAGE_QUALITY: z.coerce.number().gt(0).max(1),
});

function readEnv() {
  const parsed = envSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Missing or invalid web environment variables: ${names} (see .env.example)`);
  }
  return {
    appName: parsed.data.VITE_APP_NAME,
    /** Without a trailing slash, so paths can start with one. */
    apiUrl: parsed.data.VITE_API_URL.replace(/\/+$/, ''),
    /** Opens WhatsApp with the text of its `text` query parameter. */
    whatsappShareUrl: parsed.data.VITE_WHATSAPP_SHARE_URL,
    /** JPEG quality of the photos the browser scales down before uploading them. */
    uploadImageQuality: parsed.data.VITE_UPLOAD_IMAGE_QUALITY,
  };
}

export const env = readEnv();

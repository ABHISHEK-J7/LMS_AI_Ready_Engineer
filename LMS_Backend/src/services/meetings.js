import { getStoredZoomCreds } from '../models/index.js';
import { env } from '../config/env.js';

/**
 * Zoom Server-to-Server OAuth integration — auto-creates a meeting for a class
 * session when configured. Credentials come from env vars (preferred) or the
 * admin Settings; if neither is set, callers fall back to manual links.
 *
 * Only Zoom is auto-created: its S2S OAuth uses app-level credentials. Google
 * Meet / MS Teams require per-user OAuth consent and stay as manual links.
 */

let _token = { value: null, exp: 0, key: null };

/** Active Zoom creds — env wins over admin-stored. Returns null if unconfigured. */
async function resolveZoomCreds() {
  if (env.zoomAccountId && env.zoomClientId && env.zoomClientSecret) {
    return {
      accountId: env.zoomAccountId,
      clientId: env.zoomClientId,
      clientSecret: env.zoomClientSecret,
      source: 'environment',
    };
  }
  const c = await getStoredZoomCreds();
  if (c.zoomAccountId && c.zoomClientId && c.zoomClientSecret) {
    return {
      accountId: c.zoomAccountId,
      clientId: c.zoomClientId,
      clientSecret: c.zoomClientSecret,
      source: 'settings',
    };
  }
  return null;
}

export async function zoomConfigured() {
  return Boolean(await resolveZoomCreds());
}

export async function zoomSource() {
  const c = await resolveZoomCreds();
  return c ? c.source : 'none';
}

const credsKey = (c) => `${c.accountId}:${c.clientId}`;

/** Fetch (and cache) an S2S access token via the account_credentials grant. */
async function getZoomToken(creds) {
  const key = credsKey(creds);
  if (_token.value && _token.key === key && Date.now() < _token.exp - 60_000) {
    return _token.value;
  }
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
  const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(creds.accountId)}`;
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Basic ${basic}` } });
  if (!res.ok) {
    throw new Error(`Zoom authentication failed (${res.status})`);
  }
  const json = await res.json();
  _token = { value: json.access_token, exp: Date.now() + (json.expires_in || 3600) * 1000, key };
  return _token.value;
}

/**
 * Create a scheduled Zoom meeting.
 * @param {{ topic: string, startISO: string, durationMin: number, timezone?: string }} opts
 * @returns {Promise<{ joinUrl: string, meetingId: string }>}
 */
export async function createZoomMeeting({ topic, startISO, durationMin, timezone }) {
  const creds = await resolveZoomCreds();
  if (!creds) throw new Error('Zoom is not configured');
  const token = await getZoomToken(creds);

  const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: topic.slice(0, 200),
      type: 2, // scheduled meeting
      start_time: startISO,
      duration: Math.max(1, Math.round(durationMin)),
      timezone: timezone || undefined,
      settings: { join_before_host: true, waiting_room: false, approval_type: 2 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Zoom meeting creation failed (${res.status}): ${body.slice(0, 160)}`);
  }
  const json = await res.json();
  return { joinUrl: json.join_url, meetingId: String(json.id) };
}

/** Verify the configured credentials by acquiring a token. */
export async function verifyZoom() {
  const creds = await resolveZoomCreds();
  if (!creds) throw new Error('Zoom is not configured');
  await getZoomToken(creds);
  return { ok: true, source: creds.source };
}

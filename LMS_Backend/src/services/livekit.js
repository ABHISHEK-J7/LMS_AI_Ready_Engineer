import { AccessToken } from 'livekit-server-sdk';
import { env } from '../config/env.js';

/**
 * LiveKit integration for in-app live classes. The backend mints short-lived
 * access tokens; the SPA uses them to connect directly to the LiveKit server
 * (self-hosted or LiveKit Cloud) at `env.livekit.url`. No media flows through
 * this API — only token issuance + authorization live here.
 */

export function livekitConfigured() {
  return Boolean(env.livekit.url && env.livekit.apiKey && env.livekit.apiSecret);
}

/** Public wss URL the client connects to (empty when unconfigured). */
export function livekitUrl() {
  return env.livekit.url;
}

/** One LiveKit room per scheduled class. */
export function roomNameForClass(classId) {
  return `class-${classId}`;
}

/**
 * Mint a join token for a class room.
 * @param {object} o
 * @param {string} o.classId
 * @param {string} o.identity  unique participant id (the user id)
 * @param {string} o.name      display name
 * @param {string} o.role      'admin' | 'trainer' | 'student'
 * @param {boolean} o.host     trainer/admin → room admin + always allowed to publish
 * @returns {Promise<{token:string, url:string, room:string}>}
 */
export async function createClassToken({ classId, identity, name, role, host }) {
  const room = roomNameForClass(classId);
  const at = new AccessToken(env.livekit.apiKey, env.livekit.apiSecret, {
    identity,
    name,
    ttl: '3h', // a class-length window
    metadata: JSON.stringify({ role, host: Boolean(host) }),
  });
  at.addGrant({
    roomJoin: true,
    room,
    // Only hosts (trainer/admin) may publish audio/video by default — this is the
    // authorization, not just a UI default, so a student can't broadcast via a
    // raw token. Grant a student publish rights server-side on an explicit
    // "raise hand" action if/when that's built.
    canPublish: Boolean(host),
    canSubscribe: true,
    canPublishData: true, // chat + reactions for everyone
    roomAdmin: Boolean(host), // host can moderate (mute others, end room)
  });
  const token = await at.toJwt();
  return { token, url: env.livekit.url, room };
}

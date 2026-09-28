/* global process, fetch, URL, console */
const apiKey = process.env.PLATPHORM_API_KEY;
if (!apiKey) throw new Error('Set PLATPHORM_API_KEY in the current shell; the key is never saved by this script.');

const origin = (process.env.FRWF_ORIGIN ?? 'https://frwf.ja1.io').replace(/\/$/, '');
const response = await fetch(`${origin}/api/rooms`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ruleset: process.env.FRWF_RULESET === 'chaos' ? 'chaos' : 'standard' }),
});
const payload = await response.json().catch(() => null);
if (!response.ok || !payload?.ok || !Array.isArray(payload.data?.tickets)) {
  const code = payload?.error?.code ?? `http_${response.status}`;
  throw new Error(`Private room request failed (${code}). No invitation was created.`);
}

const { roomId, expiresAt, tickets } = payload.data;
const seatInvites = tickets.map(({ role, ticket }) => {
  const invite = new URL(origin);
  invite.hash = `room=${roomId}.${ticket}`;
  return { role, invite: invite.toString() };
});
console.log(JSON.stringify({ roomId, expiresAt: new Date(expiresAt).toISOString(), seatInvites }, null, 2));

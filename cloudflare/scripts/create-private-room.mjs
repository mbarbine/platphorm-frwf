/* global process, fetch, console */
const origin = (process.env.FRWF_ORIGIN ?? 'https://frwf.ja1.io').replace(/\/$/, '');
const response = await fetch(`${origin}/api/rooms`, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ruleset: process.env.FRWF_RULESET === 'chaos' ? 'chaos' : 'standard', fighterId: process.env.FRWF_FIGHTER_ID ?? 'atlas' }),
});
const payload = await response.json().catch(() => null);
if (!response.ok || !payload?.ok || !payload.data?.roomId || !payload.data?.hostInvite || !payload.data?.joinInvite) {
  const code = payload?.error?.code ?? `http_${response.status}`;
  throw new Error(`Private room request failed (${code}). No invitation was created.`);
}
const { roomId, expiresAt, hostInvite, joinInvite } = payload.data;
console.log(JSON.stringify({ roomId, expiresAt: new Date(expiresAt).toISOString(), hostInvite, joinInvite }, null, 2));

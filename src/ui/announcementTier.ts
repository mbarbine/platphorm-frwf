export type AnnouncementTier = 'routine' | 'call' | 'main-event';

const ROUTINE_CALLS = /CROWD CALL|THROUGH THE ROPES|BACK BETWEEN THE ROPES|AIR MAIL|GRIP DENIED|GRIP BROKEN|DESK BUCKLES|ONE-TWO|TRIPLE|COMBO/;
const MAIN_EVENT_CALLS = /^(ONE|TWO|THREE|KNOCKOUT!|THREE!)$|COMMENTARY DESK — WRECKED|\.9 — KICKOUT|VOLTAGE PILEDRIVER|DOME POWERBOMB|SKYHOOK SUPLEX|HURLED/;

export const announcementTier = (message: string, signatures: readonly string[] = []): AnnouncementTier => {
  const call = message.toUpperCase();
  if (signatures.some((signature) => call.startsWith(signature.toUpperCase())) || MAIN_EVENT_CALLS.test(call)) return 'main-event';
  if (ROUTINE_CALLS.test(call)) return 'routine';
  return 'call';
};

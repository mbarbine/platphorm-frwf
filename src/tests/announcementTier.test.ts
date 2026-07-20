import { describe, expect, it } from 'vitest';
import { announcementTier } from '../ui/announcementTier';

describe('broadcast announcement hierarchy', () => {
  it('keeps routine crowd and navigation calls compact', () => {
    expect(announcementTier('ATLAS REX — CROWD CALL!')).toBe('routine');
    expect(announcementTier('THROUGH THE ROPES — RINGSIDE!')).toBe('routine');
  });

  it('uses the match-call tier for normal wrestling calls', () => {
    expect(announcementTier('FLASH REVERSAL!')).toBe('call');
  });

  it('reserves the largest presentation for counts and conclusions', () => {
    expect(announcementTier('TWO')).toBe('main-event');
    expect(announcementTier('KNOCKOUT!')).toBe('main-event');
  });

  it('treats roster signatures as main events without hard-coding names', () => {
    expect(announcementTier('Crown Breaker!', ['Crown Breaker'])).toBe('main-event');
  });
});

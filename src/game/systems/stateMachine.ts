import type { FighterState } from '../types/game';

const LEGAL_TRANSITIONS: Readonly<Record<FighterState, readonly FighterState[]>> = {
  idle: ['locomotion', 'blocking', 'climbing', 'attacking', 'grappling', 'staggered', 'downed', 'grabbed', 'pinned', 'victorious', 'defeated'],
  locomotion: ['idle', 'blocking', 'climbing', 'attacking', 'grappling', 'staggered', 'downed', 'grabbed', 'victorious', 'defeated'],
  blocking: ['idle', 'locomotion', 'staggered', 'grabbed', 'downed', 'defeated'],
  climbing: ['attacking', 'locomotion', 'staggered', 'downed', 'defeated'],
  attacking: ['idle', 'staggered', 'downed', 'grabbed', 'victorious', 'defeated'],
  grappling: ['idle', 'staggered', 'downed', 'victorious', 'defeated'],
  grabbed: ['airborne', 'staggered', 'downed', 'idle', 'defeated'],
  airborne: ['downed', 'staggered', 'idle', 'defeated'],
  staggered: ['idle', 'attacking', 'grappling', 'downed', 'grabbed', 'pinned', 'defeated'],
  downed: ['recovering', 'grabbed', 'pinned', 'defeated'],
  recovering: ['idle', 'downed', 'staggered', 'defeated'],
  pinning: ['idle', 'victorious', 'defeated'],
  pinned: ['downed', 'recovering', 'defeated'],
  victorious: [],
  defeated: [],
};

export const canTransition = (from: FighterState, to: FighterState): boolean => from === to || LEGAL_TRANSITIONS[from].includes(to);

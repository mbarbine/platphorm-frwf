import type { FighterId } from '../types/game';

/** Original user-provided photographs; framing leaves the source images intact. */
export const FIGHTER_PORTRAITS: Partial<Record<FighterId, { url: string; position: string }>> = {
  chelsea: { url: '/archive/chelsea-whiplash.png', position: '70% 25%' },
  britt: { url: '/archive/britt-bash.png', position: '35% 20%' },
  beer_bandit_bill: { url: '/archive/beer-bandits.png', position: '22% 30%' },
  beer_bandit_ted: { url: '/archive/beer-bandits.png', position: '70% 20%' },
  josh: { url: '/portraits/josh.png', position: '50% 35%' },
  chad: { url: '/portraits/chad.png', position: '50% 12%' },
  dale: { url: '/portraits/dale.png', position: '48% 12%' },
  john: { url: '/portraits/john.png', position: '50% 25%' },
  justin: { url: '/portraits/justin.png', position: '76% 20%' },
  mondo: { url: '/portraits/mondo.png', position: '29% 20%' },
  gil: { url: '/portraits/gil.png', position: '57% 15%' },
  sonny: { url: '/portraits/sonny.png', position: '77% 16%' },
  wrecking_ball: { url: '/portraits/wrecking_ball.png', position: '50% 16%' },
  steve: { url: '/portraits/steve.png', position: '50% 16%' },
};

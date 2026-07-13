import type { FighterDefinition, FighterId } from '../types/game';

export const FIGHTERS: readonly FighterDefinition[] = [
  {
    id: 'atlas', name: 'ATLAS REX', nickname: 'The Fault Line', archetype: 'Heavyweight Powerhouse',
    bio: 'A former orbital-yard rigger who treats gravity as a negotiable clause. Atlas came to the Circuit to make every landing historic.',
    signature: 'CROWN BREAKER', taunt: 'Raises both fists and dares the Dome to get louder.', tendency: 'aggressive',
    palette: { primary: '#ff5b35', secondary: '#35182f', skin: '#a9654c', emissive: '#ffcc33' },
    proportions: { height: 1.1, width: 1.24, headwear: 'crown' },
    stats: { power: 96, speed: 48, stamina: 68, technique: 70, charisma: 84 },
  },
  {
    id: 'vex', name: 'VEX VOLT', nickname: 'Live Wire', archetype: 'Agile Striker',
    bio: 'A rooftop courier turned combat showstopper. Vex attacks in bright, impossible angles and leaves before the echo arrives.',
    signature: 'VOLT FALLOUT', taunt: 'Sketches a lightning bolt in the air with one glowing glove.', tendency: 'opportunistic',
    palette: { primary: '#d7ff38', secondary: '#20364a', skin: '#7e513f', emissive: '#50f7ff' },
    proportions: { height: 1.02, width: 0.86, headwear: 'mohawk' },
    stats: { power: 64, speed: 97, stamina: 82, technique: 78, charisma: 91 },
  },
  {
    id: 'nova', name: 'NOVA FANG', nickname: 'The Lockstar', archetype: 'Technical Grappler',
    bio: 'Raised in a zero-gravity acrobatics house, Nova sees a match as a moving equation—and every opponent as the final variable.',
    signature: 'EVENT HORIZON', taunt: 'Calmly traces a circle, then snaps it shut.', tendency: 'technical',
    palette: { primary: '#b77bff', secondary: '#181734', skin: '#d39a77', emissive: '#ff63c3' },
    proportions: { height: 1.05, width: 0.96, headwear: 'mask' },
    stats: { power: 70, speed: 77, stamina: 91, technique: 98, charisma: 78 },
  },
  {
    id: 'brick', name: 'BRICK MERCY', nickname: 'Last Courtesy', archetype: 'Balanced Brawler',
    bio: 'A scrapyard pit champion with one rule: return every favor with interest. Brick can turn any loose object into a headline.',
    signature: 'MERCY DROP', taunt: 'Dusts off both hands with theatrical disappointment.', tendency: 'aggressive',
    palette: { primary: '#41b8ff', secondary: '#1b2735', skin: '#553a32', emissive: '#ff4d88' },
    proportions: { height: 1.07, width: 1.08, headwear: 'bandana' },
    stats: { power: 82, speed: 76, stamina: 80, technique: 79, charisma: 82 },
  },
] as const;

export const fighterById = (id: FighterId): FighterDefinition => {
  const fighter = FIGHTERS.find((candidate) => candidate.id === id);
  if (!fighter) throw new Error(`Unknown fighter: ${id}`);
  return fighter;
};

export const opponentFor = (id: FighterId): FighterId => {
  const index = FIGHTERS.findIndex((fighter) => fighter.id === id);
  return FIGHTERS[(index + 2) % FIGHTERS.length]?.id ?? 'brick';
};

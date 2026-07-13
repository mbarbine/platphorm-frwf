import type { FighterDefinition, FighterId } from '../types/game';

export const FIGHTERS: readonly FighterDefinition[] = [
  {
    id: 'atlas', name: 'ATLAS REX', nickname: 'The Fault Line', archetype: 'Heavyweight Powerhouse',
    bio: 'A former orbital-yard rigger who treats gravity as a negotiable clause. Atlas came to the Circuit to make every landing historic.',
    signature: 'CROWN BREAKER', taunt: 'Raises both fists and dares the Dome to get louder.', tendency: 'aggressive',
    personality: { cowardly: 8, showman: 78, technical: 64, aggressive: 92, reckless: 66, dirty: 28, athletic: 54, powerhouse: 98 },
    palette: { primary: '#ff5b35', secondary: '#35182f', skin: '#a9654c', emissive: '#ffcc33' },
    proportions: { height: 1.1, width: 1.24, headwear: 'crown' },
    stats: { power: 96, speed: 48, stamina: 68, technique: 70, charisma: 84 },
  },
  {
    id: 'vex', name: 'VEX VOLT', nickname: 'Live Wire', archetype: 'Agile Striker',
    bio: 'A rooftop courier turned combat showstopper. Vex attacks in bright, impossible angles and leaves before the echo arrives.',
    signature: 'VOLT FALLOUT', taunt: 'Sketches a lightning bolt in the air with one glowing glove.', tendency: 'opportunistic',
    personality: { cowardly: 22, showman: 96, technical: 76, aggressive: 72, reckless: 88, dirty: 18, athletic: 99, powerhouse: 42 },
    palette: { primary: '#d7ff38', secondary: '#20364a', skin: '#7e513f', emissive: '#50f7ff' },
    proportions: { height: 1.02, width: 0.86, headwear: 'mohawk' },
    stats: { power: 64, speed: 97, stamina: 82, technique: 78, charisma: 91 },
  },
  {
    id: 'nova', name: 'NOVA FANG', nickname: 'The Lockstar', archetype: 'Technical Grappler',
    bio: 'Raised in a zero-gravity acrobatics house, Nova sees a match as a moving equation—and every opponent as the final variable.',
    signature: 'EVENT HORIZON', taunt: 'Calmly traces a circle, then snaps it shut.', tendency: 'technical',
    personality: { cowardly: 18, showman: 68, technical: 99, aggressive: 58, reckless: 32, dirty: 12, athletic: 84, powerhouse: 56 },
    palette: { primary: '#b77bff', secondary: '#181734', skin: '#d39a77', emissive: '#ff63c3' },
    proportions: { height: 1.05, width: 0.96, headwear: 'mask' },
    stats: { power: 70, speed: 77, stamina: 91, technique: 98, charisma: 78 },
  },
  {
    id: 'brick', name: 'BRICK MERCY', nickname: 'Last Courtesy', archetype: 'Balanced Brawler',
    bio: 'A scrapyard pit champion with one rule: return every favor with interest. Brick can turn any loose object into a headline.',
    signature: 'MERCY DROP', taunt: 'Dusts off both hands with theatrical disappointment.', tendency: 'aggressive',
    personality: { cowardly: 12, showman: 72, technical: 70, aggressive: 86, reckless: 70, dirty: 84, athletic: 71, powerhouse: 82 },
    palette: { primary: '#41b8ff', secondary: '#1b2735', skin: '#553a32', emissive: '#ff4d88' },
    proportions: { height: 1.07, width: 1.08, headwear: 'bandana' },
    stats: { power: 82, speed: 76, stamina: 80, technique: 79, charisma: 82 },
  },
  {
    id: 'chad', name: 'CHAD “THE CLAW” KINSEY', nickname: 'The Mountain Hand', archetype: 'Ringside Roughneck',
    bio: 'A fearless climber with scrapyard balance and an iron grip, Chad treats the Volt Dome like a piece of heavy equipment: get above it, hold on, and make the landing count.',
    signature: 'CLAW HAMMER', taunt: 'Raises one iron claw toward the rafters, then points straight down at the landing zone.', tendency: 'opportunistic',
    personality: { cowardly: 4, showman: 91, technical: 69, aggressive: 82, reckless: 94, dirty: 62, athletic: 72, powerhouse: 88 },
    palette: { primary: '#8a3f32', secondary: '#263646', skin: '#c58c70', emissive: '#f3b84b' },
    proportions: { height: 1.07, width: 1.12, headwear: 'mullet' },
    stats: { power: 88, speed: 67, stamina: 42, technique: 74, charisma: 94 },
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

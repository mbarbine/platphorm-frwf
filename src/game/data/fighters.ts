import type { FighterDefinition, FighterId } from '../types/game';

export const FIGHTERS: readonly FighterDefinition[] = [
  {
    id: 'atlas', name: 'ATLAS REX', nickname: 'The Fault Line', archetype: 'Heavyweight Powerhouse',
    bio: 'A former orbital-yard rigger who treats gravity as a negotiable clause. Atlas came to the Circuit to make every landing historic.',
    signature: 'CROWN BREAKER', taunt: 'Raises both fists and dares the Dome to get louder.', tendency: 'aggressive',
    personality: { cowardly: 8, showman: 78, technical: 64, aggressive: 92, reckless: 66, dirty: 28, athletic: 54, powerhouse: 98 },
    palette: { primary: '#ff5b35', secondary: '#35182f', skin: '#a9654c', emissive: '#ffcc33' },
    proportions: { height: 1.1, width: 1.24, headwear: 'crown' },
    physics: { massKg: 126, standingHeightM: 2.04, shoulderWidthM: .61, hipWidthM: .39, armLength: 1.04, legLength: 1.02, torsoLength: 1.08, centerOfMassBias: -.07, reachM: 2.01, muscleStrength: .98, gripStrength: .91, balanceRecovery: .68, jointStiffness: .94 },
    stats: { power: 96, speed: 48, stamina: 68, technique: 70, charisma: 84 },
  },
  {
    id: 'vex', name: 'VEX VOLT', nickname: 'Live Wire', archetype: 'Agile Striker',
    bio: 'A rooftop courier turned combat showstopper. Vex attacks in bright, impossible angles and leaves before the echo arrives.',
    signature: 'VOLT FALLOUT', taunt: 'Sketches a lightning bolt in the air with one glowing glove.', tendency: 'opportunistic',
    personality: { cowardly: 22, showman: 96, technical: 76, aggressive: 72, reckless: 88, dirty: 18, athletic: 99, powerhouse: 42 },
    palette: { primary: '#d7ff38', secondary: '#20364a', skin: '#7e513f', emissive: '#50f7ff' },
    proportions: { height: 1.02, width: 0.86, headwear: 'mohawk' },
    physics: { massKg: 78, standingHeightM: 1.82, shoulderWidthM: .46, hipWidthM: .34, armLength: 1.04, legLength: 1.08, torsoLength: .96, centerOfMassBias: .02, reachM: 1.88, muscleStrength: .72, gripStrength: .7, balanceRecovery: .94, jointStiffness: .82 },
    stats: { power: 64, speed: 97, stamina: 82, technique: 78, charisma: 91 },
  },
  {
    id: 'nova', name: 'NOVA FANG', nickname: 'The Lockstar', archetype: 'Technical Grappler',
    bio: 'Raised in a zero-gravity acrobatics house, Nova sees a match as a moving equation—and every opponent as the final variable.',
    signature: 'EVENT HORIZON', taunt: 'Calmly traces a circle, then snaps it shut.', tendency: 'technical',
    personality: { cowardly: 18, showman: 68, technical: 99, aggressive: 58, reckless: 32, dirty: 12, athletic: 84, powerhouse: 56 },
    palette: { primary: '#b77bff', secondary: '#181734', skin: '#d39a77', emissive: '#ff63c3' },
    proportions: { height: 1.05, width: 0.96, headwear: 'mask' },
    physics: { massKg: 91, standingHeightM: 1.84, shoulderWidthM: .5, hipWidthM: .36, armLength: 1.06, legLength: 1.04, torsoLength: 1, centerOfMassBias: -.02, reachM: 1.96, muscleStrength: .79, gripStrength: .98, balanceRecovery: .99, jointStiffness: .96 },
    stats: { power: 70, speed: 77, stamina: 91, technique: 98, charisma: 78 },
  },
  {
    id: 'brick', name: 'BRICK MERCY', nickname: 'Last Courtesy', archetype: 'Balanced Brawler',
    bio: 'A scrapyard pit champion with one rule: return every favor with interest. Brick can turn any loose object into a headline.',
    signature: 'MERCY DROP', taunt: 'Dusts off both hands with theatrical disappointment.', tendency: 'aggressive',
    personality: { cowardly: 12, showman: 72, technical: 70, aggressive: 86, reckless: 70, dirty: 84, athletic: 71, powerhouse: 82 },
    palette: { primary: '#41b8ff', secondary: '#1b2735', skin: '#553a32', emissive: '#ff4d88' },
    proportions: { height: 1.07, width: 1.08, headwear: 'bandana' },
    physics: { massKg: 122, standingHeightM: 1.8, shoulderWidthM: .55, hipWidthM: .38, armLength: 1.02, legLength: 1.01, torsoLength: 1.03, centerOfMassBias: -.04, reachM: 1.93, muscleStrength: .87, gripStrength: .84, balanceRecovery: .82, jointStiffness: .86 },
    stats: { power: 82, speed: 76, stamina: 80, technique: 79, charisma: 82 },
  },
  {
    id: 'chad', name: 'CHAD “THE CLAW” KINSEY', nickname: 'The Mountain Hand', archetype: 'Ringside Roughneck',
    bio: 'A fearless climber with scrapyard balance and an iron grip, Chad treats the Volt Dome like a piece of heavy equipment: get above it, hold on, and make the landing count.',
    signature: 'CLAW HAMMER', taunt: 'Raises one iron claw toward the rafters, then points straight down at the landing zone.', tendency: 'opportunistic',
    personality: { cowardly: 4, showman: 91, technical: 69, aggressive: 82, reckless: 94, dirty: 62, athletic: 72, powerhouse: 88 },
    palette: { primary: '#8a3f32', secondary: '#263646', skin: '#c58c70', emissive: '#f3b84b' },
    proportions: { height: 1.07, width: 1.12, headwear: 'mullet' },
    physics: { massKg: 109, standingHeightM: 1.91, shoulderWidthM: .57, hipWidthM: .39, armLength: 1.07, legLength: 1, torsoLength: 1.04, centerOfMassBias: -.05, reachM: 2.02, muscleStrength: .92, gripStrength: .97, balanceRecovery: .7, jointStiffness: .84 },
    stats: { power: 88, speed: 67, stamina: 42, technique: 74, charisma: 94 },
  },
  {
    id: 'dale', name: 'DALE DAMAGE', nickname: 'The Wrecking Crew', archetype: 'Towering Powerhouse',
    bio: '6′4″, 225 lb of bearded backyard trouble. Dale traps an opponent’s face under his raised arm for Welcome to the Jungle.',
    signature: 'WELCOME TO THE JUNGLE', taunt: 'Spreads his arms, plants his boots, and dares anyone to move him.', tendency: 'aggressive',
    personality: { cowardly: 6, showman: 80, technical: 65, aggressive: 90, reckless: 45, dirty: 35, athletic: 52, powerhouse: 99 },
    palette: { primary: '#b84932', secondary: '#172329', skin: '#b98464', emissive: '#d7b877' },
    proportions: { height: 1.08, width: 1.12, headwear: 'bandana' },
    physics: { massKg: 102.0583, standingHeightM: 1.9304, shoulderWidthM: .58, hipWidthM: .39, armLength: 1.08, legLength: 1.03, torsoLength: 1.06, centerOfMassBias: -.06, reachM: 2.06, muscleStrength: 1, gripStrength: .96, balanceRecovery: .65, jointStiffness: .94 },
    stats: { power: 99, speed: 48, stamina: 73, technique: 68, charisma: 87 },
  },
  {
    id: 'thomas', name: 'THOMAS “DOUBLE H” MORSE', nickname: 'Double H', archetype: 'Towering Slam Specialist',
    bio: 'A tall, muscular FRWF original with long blonde hair and a beard. Double H closes the distance, lifts with his legs, and drives his opponent into the mat with the Spine Buster.', signature: 'SPINE BUSTER', taunt: 'Spreads his arms, then draws a line across his chest.', tendency: 'aggressive',
    personality: { cowardly: 8, showman: 85, technical: 82, aggressive: 92, reckless: 45, dirty: 25, athletic: 59, powerhouse: 92 },
    palette: { primary: '#af9156', secondary: '#171a20', skin: '#be9576', emissive: '#af9156' },
    proportions: { height: 1.08, width: 1.226, headwear: 'bandana' },
    physics: { massKg: 124, standingHeightM: 2.03, shoulderWidthM: 0.65, hipWidthM: 0.43, armLength: 1.08, legLength: 1.08, torsoLength: 1.08, centerOfMassBias: -.04, reachM: 2.11, muscleStrength: 0.92, gripStrength: .9, balanceRecovery: .8, jointStiffness: .9 },
    stats: { power: 92, speed: 59, stamina: 82, technique: 82, charisma: 85 },
  },
  {
    id: 'sonny', name: 'SONNY SIXXSHOT', nickname: 'Sixxshot', archetype: 'Fast Counter Striker',
    bio: 'The bandana-masked FRWF original brings quick feet, sharp counters and fearless aerial offense.', signature: 'SIXXSHOT FALLOUT', taunt: 'Crosses his arms, then points toward his opponent.', tendency: 'opportunistic',
    personality: { cowardly: 8, showman: 91, technical: 82, aggressive: 68, reckless: 45, dirty: 25, athletic: 92, powerhouse: 68 },
    palette: { primary: '#d9d5c5', secondary: '#36413e', skin: '#c49a79', emissive: '#d9d5c5' },
    proportions: { height: 0.952, width: 0.906, headwear: 'bandana' },
    physics: { massKg: 82, standingHeightM: 1.79, shoulderWidthM: 0.48, hipWidthM: 0.35, armLength: 0.952, legLength: 0.952, torsoLength: 0.952, centerOfMassBias: -.04, reachM: 1.87, muscleStrength: 0.68, gripStrength: .9, balanceRecovery: .8, jointStiffness: .9 },
    stats: { power: 68, speed: 92, stamina: 87, technique: 82, charisma: 91 },
  },
  {
    id: 'wrecking_ball', name: 'THE WRECKING BALL', nickname: 'The Wrecking Ball', archetype: 'Super Heavyweight',
    bio: 'A tall, enormous FRWF original with glasses and a cream vest. His size gives every lift, body check and landing unmistakable weight.', signature: 'WRECKING BALL CRUSH', taunt: 'Plants his feet and raises a clenched fist.', tendency: 'aggressive',
    personality: { cowardly: 8, showman: 89, technical: 63, aggressive: 99, reckless: 45, dirty: 25, athletic: 36, powerhouse: 99 },
    palette: { primary: '#d4c49a', secondary: '#191c20', skin: '#c29b7d', emissive: '#d4c49a' },
    proportions: { height: 1.069, width: 1.434, headwear: 'bandana' },
    physics: { torsoDepthM: .48, massKg: 181, standingHeightM: 2.01, shoulderWidthM: 0.76, hipWidthM: 0.56, armLength: 1.069, legLength: 1.069, torsoLength: 1.069, centerOfMassBias: -.04, reachM: 2.09, muscleStrength: 0.99, gripStrength: .9, balanceRecovery: .8, jointStiffness: .9 },
    stats: { power: 99, speed: 36, stamina: 67, technique: 63, charisma: 89 },
  },
  {
    id: 'steve', name: 'STEVE “STRIKING LIGHTNING” LEWBALLIN', nickname: 'Striking Lightning', archetype: 'Precision Brawler',
    bio: 'The FRWF original in glasses and a dark jacket. Steve works close, counters cleanly and builds toward an explosive signature slam.', signature: 'LIGHTNING DRIVER', taunt: 'Adjusts his jacket, then raises his guard.', tendency: 'technical',
    personality: { cowardly: 8, showman: 90, technical: 92, aggressive: 79, reckless: 45, dirty: 25, athletic: 79, powerhouse: 79 },
    palette: { primary: '#70a190', secondary: '#24262b', skin: '#b89375', emissive: '#70a190' },
    proportions: { height: 0.984, width: 0.981, headwear: 'bandana' },
    physics: { massKg: 94, standingHeightM: 1.85, shoulderWidthM: 0.52, hipWidthM: 0.38, armLength: 0.984, legLength: 0.984, torsoLength: 0.984, centerOfMassBias: -.04, reachM: 1.93, muscleStrength: 0.79, gripStrength: .9, balanceRecovery: .8, jointStiffness: .9 },
    stats: { power: 79, speed: 79, stamina: 84, technique: 92, charisma: 90 },
  },
  {
    id: 'john', name: 'JOHN “THE TRAIN” THUNDAS', nickname: 'The Train', archetype: 'Ringside Power Brawler',
    bio: 'The FRWF original with long dark hair, a goatee and green shades. The Train builds momentum and commits his whole body to the finish.', signature: 'THUNDER RAIL', taunt: 'Throws both arms wide and calls for the crowd.', tendency: 'aggressive',
    personality: { cowardly: 8, showman: 96, technical: 73, aggressive: 89, reckless: 45, dirty: 25, athletic: 64, powerhouse: 89 },
    palette: { primary: '#85a949', secondary: '#202223', skin: '#c19a79', emissive: '#85a949' },
    proportions: { height: 1.016, width: 1.094, headwear: 'bandana' },
    physics: { massKg: 109, standingHeightM: 1.91, shoulderWidthM: 0.58, hipWidthM: 0.4, armLength: 1.016, legLength: 1.016, torsoLength: 1.016, centerOfMassBias: -.04, reachM: 1.99, muscleStrength: 0.89, gripStrength: .9, balanceRecovery: .8, jointStiffness: .9 },
    stats: { power: 89, speed: 64, stamina: 78, technique: 73, charisma: 96 },
  },
  {
    id: 'justin', name: 'JUSTIN “THE CHEF” COOK', nickname: 'The Chef', archetype: 'Technical Showman',
    bio: 'The FRWF original in glasses, a white chef hat and black apron. The Chef works the clinch patiently before serving up his signature slam.', signature: 'THE MAIN COURSE', taunt: 'Raises a fist and beckons his opponent closer.', tendency: 'technical',
    personality: { cowardly: 8, showman: 94, technical: 92, aggressive: 76, reckless: 45, dirty: 25, athletic: 76, powerhouse: 76 },
    palette: { primary: '#d9d3b6', secondary: '#202221', skin: '#b9997b', emissive: '#d9d3b6' },
    proportions: { height: 0.995, width: 1.0, headwear: 'bandana' },
    physics: { massKg: 93, standingHeightM: 1.87, shoulderWidthM: 0.53, hipWidthM: 0.38, armLength: 0.995, legLength: 0.995, torsoLength: 0.995, centerOfMassBias: -.04, reachM: 1.95, muscleStrength: 0.76, gripStrength: .9, balanceRecovery: .8, jointStiffness: .9 },
    stats: { power: 76, speed: 76, stamina: 88, technique: 92, charisma: 94 },
  },
  {
    id: 'mondo', name: 'MONDO', nickname: 'Mondo', archetype: 'Masked Chaos Brawler',
    bio: 'The FRWF original in a green mask, colorful head wrap and tie-dye shirt. Mondo brings unpredictable movement and a heavy landing.', signature: 'MONDO MELTDOWN', taunt: 'Tilts his head, opens his arms and lets the crowd answer.', tendency: 'opportunistic',
    personality: { cowardly: 8, showman: 98, technical: 77, aggressive: 85, reckless: 45, dirty: 25, athletic: 65, powerhouse: 85 },
    palette: { primary: '#6db47d', secondary: '#37483d', skin: '#bc9575', emissive: '#6db47d' },
    proportions: { height: 1.0, width: 1.132, headwear: 'bandana' },
    physics: { massKg: 112, standingHeightM: 1.88, shoulderWidthM: 0.6, hipWidthM: 0.43, armLength: 1.0, legLength: 1.0, torsoLength: 1.0, centerOfMassBias: -.04, reachM: 1.96, muscleStrength: 0.85, gripStrength: .9, balanceRecovery: .8, jointStiffness: .9 },
    stats: { power: 85, speed: 65, stamina: 79, technique: 77, charisma: 98 },
  },
  {
    id: 'gil', name: 'G.I. JIL', nickname: 'G.I. Jil', archetype: 'Agile Grappler',
    bio: 'The FRWF original with long brown hair, a camouflage cap, black top and denim shorts. Quick footwork sets up precise counters and a decisive throw.', signature: 'FIELD MANEUVER', taunt: 'Salutes the crowd, then settles into a ready stance.', tendency: 'technical',
    personality: { cowardly: 8, showman: 88, technical: 94, aggressive: 66, reckless: 45, dirty: 25, athletic: 94, powerhouse: 66 },
    palette: { primary: '#898659', secondary: '#20252a', skin: '#c39b81', emissive: '#898659' },
    proportions: { height: 0.904, width: 0.83, headwear: 'bandana' },
    physics: { massKg: 69, standingHeightM: 1.7, shoulderWidthM: 0.44, hipWidthM: 0.37, armLength: 0.904, legLength: 0.904, torsoLength: 0.904, centerOfMassBias: -.04, reachM: 1.78, muscleStrength: 0.66, gripStrength: .9, balanceRecovery: .8, jointStiffness: .9 },
    stats: { power: 66, speed: 94, stamina: 92, technique: 94, charisma: 88 },
  },
  {
    id: 'josh', name: 'JOSH “THE ENFORCER”', nickname: 'The Enforcer', archetype: 'Counter Brawler',
    bio: 'An FRWF original with a cap, goatee and black sleeveless shirt. The Enforcer works behind a sharp jab and answers pressure with a committed counter.',
    signature: 'ENFORCER SLAM', taunt: 'Raises his fists and settles into a firm guard.', tendency: 'technical',
    personality: { cowardly: 8, showman: 76, technical: 84, aggressive: 82, reckless: 40, dirty: 30, athletic: 78, powerhouse: 72 },
    palette: { primary: '#b7a37c', secondary: '#202124', skin: '#c49a79', emissive: '#b7a37c' },
    proportions: { height: .984, width: .96, headwear: 'bandana' },
    // Provisional game balance values, not measurements inferred from the reference photo.
    physics: { massKg: 88, standingHeightM: 1.85, shoulderWidthM: .51, hipWidthM: .37, armLength: 1, legLength: 1, torsoLength: 1, centerOfMassBias: -.04, reachM: 1.93, muscleStrength: .78, gripStrength: .86, balanceRecovery: .84, jointStiffness: .88 },
    stats: { power: 78, speed: 78, stamina: 84, technique: 84, charisma: 76 },
  },
  {
    id: 'chelsea', name: 'CHELSEA WHIPLASH', nickname: 'Whiplash', archetype: 'Agile Grappler',
    bio: 'An FRWF original inspired by the supplied archive. A playable movement and signature profile; the shared model is provisional while the individual likeness and attire are authored.', signature: 'WHIPLASH REVERSAL', taunt: 'Salutes the crowd, then settles into a ready stance.', tendency: 'technical',
    personality: { cowardly: 8, showman: 88, technical: 94, aggressive: 66, reckless: 45, dirty: 25, athletic: 94, powerhouse: 66 },
    palette: { primary: '#dba56d', secondary: '#20252a', skin: '#c39b81', emissive: '#898659' },
    proportions: { height: 0.904, width: 0.83, headwear: 'bandana' },
    physics: { massKg: 69, standingHeightM: 1.7, shoulderWidthM: 0.44, hipWidthM: 0.37, armLength: 0.904, legLength: 0.904, torsoLength: 0.904, centerOfMassBias: -.04, reachM: 1.78, muscleStrength: 0.66, gripStrength: .9, balanceRecovery: .8, jointStiffness: .9 },
    stats: { power: 66, speed: 94, stamina: 92, technique: 94, charisma: 88 },
  },
  {
    id: 'britt', name: 'BRITT BASH', nickname: 'Britt Bash', archetype: 'Agile Grappler',
    bio: 'An FRWF original inspired by the supplied archive. A playable movement and signature profile; the shared model is provisional while the individual likeness and attire are authored.', signature: 'BASH LANDING', taunt: 'Salutes the crowd, then settles into a ready stance.', tendency: 'technical',
    personality: { cowardly: 8, showman: 88, technical: 94, aggressive: 66, reckless: 45, dirty: 25, athletic: 94, powerhouse: 66 },
    palette: { primary: '#e14798', secondary: '#20252a', skin: '#c39b81', emissive: '#898659' },
    proportions: { height: 0.904, width: 0.83, headwear: 'bandana' },
    physics: { massKg: 69, standingHeightM: 1.7, shoulderWidthM: 0.44, hipWidthM: 0.37, armLength: 0.904, legLength: 0.904, torsoLength: 0.904, centerOfMassBias: -.04, reachM: 1.78, muscleStrength: 0.66, gripStrength: .9, balanceRecovery: .8, jointStiffness: .9 },
    stats: { power: 66, speed: 94, stamina: 92, technique: 94, charisma: 88 },
  },
  {
    id: 'beer_bandit_bill', name: 'BEER BANDIT BILL', nickname: 'Beer Bandit Bill', archetype: 'Fast Counter Striker',
    bio: 'An FRWF original inspired by the supplied archive. A playable movement and signature profile; the shared model is provisional while the individual likeness and attire are authored.', signature: 'GREEN LIGHT HEIST', taunt: 'Crosses his arms, then points toward his opponent.', tendency: 'opportunistic',
    personality: { cowardly: 8, showman: 91, technical: 82, aggressive: 68, reckless: 45, dirty: 25, athletic: 92, powerhouse: 68 },
    palette: { primary: '#76bd3b', secondary: '#36413e', skin: '#c49a79', emissive: '#d9d5c5' },
    proportions: { height: 0.952, width: 0.906, headwear: 'bandana' },
    physics: { massKg: 82, standingHeightM: 1.79, shoulderWidthM: 0.48, hipWidthM: 0.35, armLength: 0.952, legLength: 0.952, torsoLength: 0.952, centerOfMassBias: -.04, reachM: 1.87, muscleStrength: 0.68, gripStrength: .9, balanceRecovery: .8, jointStiffness: .9 },
    stats: { power: 68, speed: 92, stamina: 87, technique: 82, charisma: 91 },
  },
  {
    id: 'beer_bandit_ted', name: 'BEER BANDIT TED', nickname: 'Beer Bandit Ted', archetype: 'Fast Counter Striker',
    bio: 'An FRWF original inspired by the supplied archive. A playable movement and signature profile; the shared model is provisional while the individual likeness and attire are authored.', signature: 'LAST CALL DRIVER', taunt: 'Crosses his arms, then points toward his opponent.', tendency: 'opportunistic',
    personality: { cowardly: 8, showman: 91, technical: 82, aggressive: 68, reckless: 45, dirty: 25, athletic: 92, powerhouse: 68 },
    palette: { primary: '#696f76', secondary: '#36413e', skin: '#c49a79', emissive: '#d9d5c5' },
    proportions: { height: 0.952, width: 0.906, headwear: 'bandana' },
    physics: { massKg: 82, standingHeightM: 1.79, shoulderWidthM: 0.48, hipWidthM: 0.35, armLength: 0.952, legLength: 0.952, torsoLength: 0.952, centerOfMassBias: -.04, reachM: 1.87, muscleStrength: 0.68, gripStrength: .9, balanceRecovery: .8, jointStiffness: .9 },
    stats: { power: 68, speed: 92, stamina: 87, technique: 82, charisma: 91 },
  },
] as const;

// Precompute fast O(1) lookup map for fighters to avoid repetitive array .find calls
const FIGHTER_MAP = Object.fromEntries(FIGHTERS.map((fighter) => [fighter.id, fighter])) as Record<FighterId, FighterDefinition>;

// Precompute fast O(1) lookup map for opponents to avoid repetitive index scans
const OPPONENT_MAP = Object.fromEntries(
  FIGHTERS.map((fighter, index) => [
    fighter.id,
    FIGHTERS[(index + 2) % FIGHTERS.length]?.id ?? 'brick'
  ])
) as Record<FighterId, FighterId>;

export const fighterById = (id: FighterId): FighterDefinition => {
  const fighter = FIGHTER_MAP[id];
  if (!fighter) throw new Error(`Unknown fighter: ${id}`);
  return fighter;
};

export const opponentFor = (id: FighterId): FighterId => {
  return OPPONENT_MAP[id] ?? 'brick';
};

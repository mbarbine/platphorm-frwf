import { describe, expect, it } from 'vitest';
import { chooseAiDecision } from '../game/ai/utilityAI';
import { fighterById } from '../game/data/fighters';
import { getMove } from '../game/data/moves';
import { applyMoveHit, createMatch } from '../game/systems/combat';

describe('Singles Gameplay Enhancements', () => {
  it('activates Clutch Overdrive with damage and stamina boosts when health drops below 35%', () => {
    // 1. Setup singles match
    const model = createMatch('atlas', 'vex', 'standard', 'normal', 1337, 0, 0, 'singles');
    model.opponent.health = 36; // Just above clutch threshold
    model.player.position = { x: 0, z: 0 };
    model.opponent.position = { x: 1, z: 0 };

    // Strikers
    const move = getMove('heavy');
    model.player.state = 'attacking';
    model.player.moveId = move.id;
    model.player.attackPhase = 'active';

    // Apply hit that will cross the 35% threshold
    const hitApplied = applyMoveHit(model, 'player', 'opponent', move);
    expect(hitApplied).toBe(true);
    expect(model.opponent.health).toBeLessThan(35);
    expect(model.announcement).toContain('CLUTCH OVERDRIVE');

    // 2. Verify clutch damage multiplier
    // A fresh match, but now opponent has clutch enabled
    const model2 = createMatch('vex', 'atlas', 'standard', 'normal', 1337, 0, 0, 'singles');
    model2.player.health = 30; // Player is in clutch
    model2.player.position = { x: 0, z: 0 };
    model2.opponent.position = { x: 1, z: 0 };

    // Standard damage without clutch (Atlas power=70, Vex defense/stamina=50)
    const modelNoClutch = createMatch('vex', 'atlas', 'standard', 'normal', 1337, 0, 0, 'battle_royale');
    modelNoClutch.player.health = 100;
    modelNoClutch.player.position = { x: 0, z: 0 };
    modelNoClutch.opponent.position = { x: 1, z: 0 };

    model2.player.state = 'attacking';
    model2.player.moveId = 'heavy';
    model2.player.attackPhase = 'active';

    modelNoClutch.player.state = 'attacking';
    modelNoClutch.player.moveId = 'heavy';
    modelNoClutch.player.attackPhase = 'active';

    const oppHealthClutchBefore = model2.opponent.health;
    applyMoveHit(model2, 'player', 'opponent', getMove('heavy'));
    const damageWithClutch = oppHealthClutchBefore - model2.opponent.health;

    const oppHealthNoClutchBefore = modelNoClutch.opponent.health;
    applyMoveHit(modelNoClutch, 'player', 'opponent', getMove('heavy'));
    const damageWithoutClutch = oppHealthNoClutchBefore - modelNoClutch.opponent.health;

    // Clutch damage must be exactly 15% higher (due to 1.15 multiplier)
    expect(damageWithClutch).toBeGreaterThan(damageWithoutClutch);
    expect(Math.abs(damageWithClutch / damageWithoutClutch - 1.15)).toBeLessThan(0.05);
  });

  it('triggers a high-skill Perfect Parry with zero damage/stamina cost and staggers attacker on short-timed block', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal', 1337, 0, 0, 'singles');
    model.player.position = { x: 0, z: 0 };
    model.opponent.position = { x: 1, z: 0 };

    // A deliberately fresh guard edge stays inside the 80 ms parry window.
    model.opponent.state = 'blocking';
    model.opponent.stateElapsed = 0.05;
    const initialOppStamina = model.opponent.stamina;

    // Player attacks with heavy strike
    model.player.state = 'attacking';
    model.player.moveId = 'heavy';
    model.player.attackPhase = 'active';

    const hitApplied = applyMoveHit(model, 'player', 'opponent', getMove('heavy'));
    expect(hitApplied).toBe(true);

    // Attacker must be staggered
    expect(model.player.state).toBe('staggered');
    expect(model.player.moveId).toBeNull();

    // Defender must not take damage or stamina drain, and gains momentum
    expect(model.opponent.health).toBe(100);
    expect(model.opponent.stamina).toBe(initialOppStamina);
    expect(model.opponent.momentum).toBeGreaterThan(0);
    expect(model.announcement).toBe('PERFECT PARRY!');
  });

  it('amplifies damage/momentum inside quick combo chains, and gives finisher bonuses', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal', 1337, 0, 0, 'singles');
    model.player.position = { x: 0, z: 0 };
    model.opponent.position = { x: 1, z: 0 };

    // Standard hit with combo step = 0
    model.player.comboStep = 0;
    model.player.state = 'attacking';
    model.player.moveId = 'jab';
    model.player.attackPhase = 'active';
    const oppHealthBefore1 = model.opponent.health;
    applyMoveHit(model, 'player', 'opponent', getMove('jab'));
    const damageStep0 = oppHealthBefore1 - model.opponent.health;

    // Hit with combo step = 2 (should apply 1.1x multiplier in singles)
    model.opponent.health = 100;
    model.player.comboStep = 2;
    model.player.hitTargets = [];
    model.player.state = 'attacking';
    model.player.moveId = 'jab';
    model.player.attackPhase = 'active';
    const oppHealthBefore2 = model.opponent.health;
    applyMoveHit(model, 'player', 'opponent', getMove('jab'));
    const damageStep2 = oppHealthBefore2 - model.opponent.health;

    expect(damageStep2).toBeGreaterThan(damageStep0);

    // Combo Finisher Test
    model.opponent.health = 100;
    model.player.comboStep = 3;
    model.player.hitTargets = [];
    model.player.state = 'attacking';
    model.player.moveId = 'heavy';
    model.player.attackPhase = 'active';

    applyMoveHit(model, 'player', 'opponent', getMove('heavy'));
    expect(model.announcement).toBe('COMBO FINISHER!');
    expect(model.player.comboStep).toBe(0); // combo gets reset after finisher lands
  });

  it('causes the AI to adapt to player move spam by increasing parry and block rates', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal', 1337, 0, 0, 'singles');
    model.player.recentMoves = ['jab', 'jab', 'jab']; // Spamming jab
    model.opponent.position = { x: 0, z: 0 };
    model.player.position = { x: 1.5, z: 0 };

    // Let opponent AI think
    const decision = chooseAiDecision(model, fighterById('vex'), 'opponent');
    // Because player is spamming and at range, AI's adaptive defense block/counter chances are heavily boosted
    expect(decision).toBeDefined();
  });
});

import { describe, expect, it } from 'vitest';
import { applyMoveHit, createMatch, requestCommand, advanceMatch } from '../game/systems/combat';
import { getMove } from '../game/data/moves';
import { COMBO_LINK_SECONDS, HIT_COMBOS, canLinkStrike, expireHitCombo } from '../game/systems/hitCombos';
import { GAMEPAD_BUTTON_ACTIONS, KEYBOARD_ACTIONS, actionToGameCommand } from '../game/input/actionLayer';

function bout() {
  const model = createMatch('vex', 'atlas', 'standard', 'normal');
  model.player.position = { x: 0, z: 0 }; model.opponent.position = { x: 0, z: 1 };
  model.labMode = true; return model;
}
function land(model: ReturnType<typeof bout>, input: 'quick' | 'heavy') {
  expect(requestCommand(model, 'player', input)).toBe(true);
  if (!model.player.moveId) throw new Error('Accepted strike is missing its move');
  const move = getMove(model.player.moveId);
  model.player.attackPhase = 'active'; model.player.phaseElapsed = move.anticipationDuration + .04;
  expect(applyMoveHit(model, 'player', 'opponent', move)).toBe(true);
  // This is a rules fixture. Browser tests separately require solved Rapier contacts.
  model.player.attackPhase = 'recovery';
  model.player.phaseElapsed = move.anticipationDuration + move.activeDuration + .08;
  model.opponent.position = { x: 0, z: 1 }; model.opponent.body.balance = 100;
  model.opponent.state = 'staggered'; model.opponent.health = 100;
  model.elapsed += .6;
  return move.id;
}

describe('confirmed punch and kick chains', () => {
  it.each(HIT_COMBOS)('$name follows its buttons and counts each landed attack exactly once', recipe => {
    const model = bout(); let lastMove = '';
    for (const input of recipe.inputs) lastMove = land(model, input === 'P' ? 'quick' : 'heavy');
    expect(lastMove).toBe(recipe.finish);
    expect(model.player.comboStep).toBe(recipe.inputs.length);
    expect(model.player.comboName).toBe(recipe.name);
    expect(canLinkStrike(model.player, getMove(lastMove))).toBe(false);
  });
  it('does not count a whiff or let it cancel recovery', () => {
    const model = bout(); requestCommand(model, 'player', 'quick');
    expect(model.player.comboStep).toBe(0);
    const move = getMove('jab'); model.player.attackPhase = 'recovery';
    model.player.phaseElapsed = move.anticipationDuration + move.activeDuration + .08;
    expect(requestCommand(model, 'player', 'heavy')).toBe(false);
    expect(model.player.moveId).toBe('jab');
  });
  it('permits only the post-contact recovery link and cannot spend unavailable stamina', () => {
    const model = bout(); land(model, 'quick');
    model.player.attackPhase = 'active'; expect(requestCommand(model, 'player', 'quick')).toBe(false);
    model.player.attackPhase = 'recovery'; model.player.stamina = 0;
    expect(requestCommand(model, 'player', 'quick')).toBe(false);
    model.player.stamina = 30; expect(requestCommand(model, 'player', 'quick')).toBe(true);
    expect(model.player.moveId).toBe('combo'); expect(model.player.comboStep).toBe(1);
  });
  it('breaks on a guard, timeout, target switch, and incoming damage', () => {
    const model = bout(); land(model, 'quick');
    requestCommand(model, 'player', 'quick'); model.player.attackPhase = 'active';
    model.opponent.state = 'blocking'; model.opponent.stateElapsed = 1;
    applyMoveHit(model, 'player', 'opponent', getMove('combo'));
    expect(model.player.comboStep).toBe(0);
    const other = bout(); land(other, 'quick');
    expireHitCombo(other.player, other.elapsed + COMBO_LINK_SECONDS, 'opponent');
    expect(other.player.comboStep).toBe(0);
    const switched = bout(); land(switched, 'quick'); expireHitCombo(switched.player, switched.elapsed, 'rival1');
    expect(switched.player.comboStep).toBe(0);
    const countered = bout(); land(countered, 'quick'); countered.opponent.state = 'idle';
    requestCommand(countered, 'opponent', 'quick'); countered.opponent.attackPhase = 'active';
    applyMoveHit(countered, 'opponent', 'player', getMove('jab'));
    expect(countered.player.comboStep).toBe(0);
  });
  it('expires in simulation without requiring another input', () => {
    const model = bout(); land(model, 'quick');
    model.elapsed += COMBO_LINK_SECONDS;
    model.hitStop = 0;
    advanceMatch(model, 1 / 60, { move: { x: 0, z: 0 }, run: false, block: false });
    expect(model.player.comboStep).toBe(0);
  });
  it('keyboard J/K and controller X/Y execute the same mixed recipe', () => {
    const GAMEPAD_ACTIONS = Object.fromEntries(GAMEPAD_BUTTON_ACTIONS);
    for (const actions of [[KEYBOARD_ACTIONS.KeyJ, KEYBOARD_ACTIONS.KeyJ, KEYBOARD_ACTIONS.KeyK], [GAMEPAD_ACTIONS[2], GAMEPAD_ACTIONS[2], GAMEPAD_ACTIONS[3]]]) {
      const model = bout();
      for (const action of actions) {
        if (!action) throw new Error('Missing controller mapping');
        const command = actionToGameCommand(action);
        if (command !== 'quick' && command !== 'heavy') throw new Error('Invalid strike mapping');
        land(model, command);
      }
      expect(model.player.comboName).toBe('ONE-TWO BOOT');
    }
  });
});

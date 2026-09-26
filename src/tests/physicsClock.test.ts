import { describe,it,expect } from 'vitest';
import { physicsFrameBudget,FIXED_STEP,MAX_FRAME_STEPS } from '../game/runtime/physicsClock';
import { rosterIsPresented,useRosterPresentation } from '../game/presentation/rosterReadiness';

describe('rendered action timing',()=>{
  it('preserves normal frame-rate simulation without accumulating drift',()=>{
    for(const fps of [30,60,90,120,144]) {
      let remainder=0,steps=0;
      for(let f=0;f<fps*10;f++){const b=physicsFrameBudget(remainder,1/fps);steps+=b.steps;remainder=b.remainder;}
      expect(steps).toBe(600);expect(remainder).toBeLessThan(1e-8);
    }
  });
  it('spreads an action across rendered frames after a multi-second stall',()=>{
    const budget=physicsFrameBudget(0,4);
    expect(budget.steps).toBe(MAX_FRAME_STEPS);
    expect(budget.steps*FIXED_STEP).toBeLessThan(.14); // shortest shared jab wind-up
    expect(physicsFrameBudget(budget.remainder,1/60).steps).toBe(1);
  });
  it('keeps laboratory playback slow without changing the fixed solver step',()=>{
    expect(physicsFrameBudget(0,1/30,.5).steps).toBe(1);
    expect(physicsFrameBudget(0,NaN).steps).toBe(0);
  });
  it('waits for every current wrestler and rejects readiness from an earlier match',()=>{
    useRosterPresentation.setState({runtimeId:-1,slots:new Set()});
    const mark=useRosterPresentation.getState().mark;
    mark(4,'player');expect(rosterIsPresented(4,['player','opponent'])).toBe(false);
    mark(4,'opponent');expect(rosterIsPresented(4,['player','opponent'])).toBe(true);
    expect(rosterIsPresented(5,['player','opponent'])).toBe(false);
    mark(5,'opponent');expect(rosterIsPresented(5,['player','opponent'])).toBe(false);
  });
});

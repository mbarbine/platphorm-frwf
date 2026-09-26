import { describe, expect, it } from 'vitest';
import { CROWD_SIGNS, fanArmAngles, fogBurstEnvelope } from '../game/presentation/crowdActivity';
import { crowdPopulation } from '../game/presentation/crowdPopulation';

describe('living crowd', () => {
  it('mixes quiet fans, individual cheers, signs and lighters in a packed audience', () => {
    const fans = crowdPopulation(768,12);
    expect(fans.filter(f=>f.prop<.15).length).toBeGreaterThan(60);
    expect(fans.filter(f=>f.prop>=.15&&f.prop<.22).length).toBeGreaterThan(20);
    expect(fans.filter(f=>f.activity>.64&&f.prop>=.22).length).toBeGreaterThan(100);
    expect(new Set(fans.filter(f=>f.prop<.15).map(f=>CROWD_SIGNS[f.message])).size).toBe(8);
    const poses = fans.map(f=>fanArmAngles(3,f.phase,f.activity,f.prop,.8,false).left.toFixed(2));
    expect(new Set(poses).size).toBeGreaterThan(30);
  });
  it('keeps held props raised while reduced motion stops unladen cheers', () => {
    expect(fanArmAngles(3,1,.2,.5,1,true)).toEqual({left:0,right:0});
    expect(fanArmAngles(3,1,.2,.1,1,true).right).toBeGreaterThan(2);
  });
  it('leaves the entrance clear between short, smoothly fading fog cues', () => {
    expect(fogBurstEnvelope(0)).toBe(0); expect(fogBurstEnvelope(4)).toBe(1);
    for(let t=8;t<55;t++) expect(fogBurstEnvelope(t)).toBe(0);
    expect(fogBurstEnvelope(59)).toBe(1);
  });
});

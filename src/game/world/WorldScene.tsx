import { FrwfArchive } from './FrwfArchive';
import { CIRCUIT_OBJECTIVES, circuitProgress } from './circuit';
import { VENUES } from '../data/venues';
import { Canvas, useFrame } from '@react-three/fiber';
import { Component, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, PointerEvent } from 'react';
import { type Group, Vector3 } from 'three';
import { useGameInput } from '../input/useGameInput';
import { mobileInput } from '../input/mobileInput';
import { useSettings } from '../state/settings';
import { RendererHealth } from '../components/RendererHealth';
import { useWorldSession } from './worldSession';
import { moveThroughWorld, nearbyEncounter, encounterForFighter, REGION_NAMES, regionAt, WORLD_ENCOUNTERS } from './showground';
import type { WorldEncounter } from './showground';
import { ShowgroundEnvironment, WorldSign } from './ShowgroundEnvironment';
import { WorldWrestler } from './WorldWrestler';
import { fighterById } from '../data/fighters';

class WorldBoundary extends Component<{ children: ReactNode; onExit: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="world-error" role="alert"><h2>The showground couldn’t load.</h2><p>Your last saved position is kept.</p><button className="button" onClick={this.props.onExit}>BACK TO MENU</button></div> : this.props.children; }
}
function WalkingPlayer({ paused, onPause, onInteract }: { paused: boolean; onPause: () => void; onInteract: () => void }) {
  const input = useGameInput(onPause, !paused);
  const root = useRef<Group>(null);
  const initial = useRef(useWorldSession.getState().save);
  const position = useRef({ ...initial.current.position }); const facing = useRef(initial.current.facing);
  const motion = useRef({ distance: 0, speed: 0 }); const publishAt = useRef(0);
  const cameraTarget = useRef(new Vector3(initial.current.position.x, 1, initial.current.position.z));
  const target = useRef(new Vector3());
  useFrame(({ camera, size, clock }, delta) => {
    const dt = Math.min(delta, .05); const frame = input.read();
    if (!paused) {
      const next = moveThroughWorld(position.current, frame.move, dt * (frame.run ? 6 : 3.6));
      const dx = next.x - position.current.x; const dz = next.z - position.current.z;
      // OPTIMIZATION: Standard Math.sqrt replaces slow Math.hypot in hot frame loop.
      const distance = Math.sqrt(dx * dx + dz * dz);
      motion.current.speed = distance / Math.max(dt, .001); motion.current.distance += distance;
      if (distance > .001) facing.current += Math.atan2(Math.sin(Math.atan2(dx, dz) - facing.current), Math.cos(Math.atan2(dx, dz) - facing.current)) * Math.min(1, dt * 15);
      position.current = next;
      if (clock.elapsedTime > publishAt.current) { useWorldSession.getState().move(next, facing.current); publishAt.current = clock.elapsedTime + .1; }
      if (frame.actions?.some(action => action.phase === 'started' && (action.action === 'contextAction' || action.action === 'dodgeCounter'))) { useWorldSession.getState().move(next, facing.current); onInteract(); }
    } else motion.current.speed = 0;
    if (root.current) { root.current.position.set(position.current.x, 0, position.current.z); root.current.rotation.y = facing.current; }
    const portrait = size.width < size.height;
    cameraTarget.current.lerp(target.current.set(position.current.x, 1, position.current.z - 1.8), 1 - Math.exp(-dt * 7));
    camera.position.copy(cameraTarget.current).add(target.current.set(0, portrait ? 13 : 9, portrait ? 16 : 11));
    camera.lookAt(cameraTarget.current);
  });
  useEffect(() => () => { useWorldSession.getState().move(position.current, facing.current); useWorldSession.getState().checkpoint(); }, []);
  return <group ref={root} position={[initial.current.position.x, 0, initial.current.position.z]}>
    <Suspense fallback={<mesh position={[0, 1, 0]}><capsuleGeometry args={[.3, 1.2, 4, 8]} /><meshStandardMaterial color="#d4aa65" /></mesh>}><WorldWrestler fighter={initial.current.fighter} motion={motion} /></Suspense>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .025, 0]}><ringGeometry args={[.47, .54, 32]} /><meshBasicMaterial color="#f5df98" transparent opacity={.7} /></mesh>
  </group>;
}
function WorldTouch({ paused }: { paused: boolean }) {
  const pad = useRef<HTMLDivElement>(null); const pointer = useRef<number | null>(null); const [stick, setStick] = useState({ x: 0, z: 0 });
  const release = useCallback(() => { pointer.current = null; setStick({ x: 0, z: 0 }); mobileInput.setMove({ x: 0, z: 0 }); }, []);
  useEffect(() => { if (paused) { release(); mobileInput.reset(); } }, [paused, release]);
  useEffect(() => () => mobileInput.reset(), []);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (paused || pointer.current !== event.pointerId) return;
    const rect = pad.current?.getBoundingClientRect(); if (!rect) return;
    const x = (event.clientX - rect.left - rect.width / 2) / (rect.width * .35); const z = (event.clientY - rect.top - rect.height / 2) / (rect.height * .35);
    // OPTIMIZATION: Standard Math.sqrt replaces slow Math.hypot on touch input pointer move updates.
    const length = Math.max(1, Math.sqrt(x * x + z * z));
    const next = { x: x / length, z: z / length }; setStick(next); mobileInput.setMove(next);
  };
  return <div className="world-touch">
    <div ref={pad} className="mobile-stick" role="group" aria-label="Explore movement joystick" aria-disabled={paused} onPointerDown={event => { if (paused || pointer.current !== null) return; event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><i style={{ transform: `translate(${stick.x * 25}px,${stick.z * 25}px)` }} /><span>MOVE</span></div>
    <button className="world-run" disabled={paused} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); mobileInput.setRun(true); }} onPointerUp={() => mobileInput.setRun(false)} onPointerCancel={() => mobileInput.setRun(false)} onLostPointerCapture={() => mobileInput.setRun(false)}>HOLD TO RUN</button>
  </div>;
}
export function WorldScene({ onEncounter, onExit }: { onEncounter: (encounter: WorldEncounter) => void; onExit: () => void }) {
  const save = useWorldSession(state => state.save); const saveStatus = useWorldSession(state => state.saveStatus);
  const [archive, setArchive] = useState(false);
  const [paused, setPaused] = useState(false); const [offer, setOffer] = useState<WorldEncounter | null>(null); const [lost, setLost] = useState(false); const [map, setMap] = useState(false); const [circuit, setCircuit] = useState(false); const [trackedId, setTrackedId] = useState<string | null>(null);
  const encounters = WORLD_ENCOUNTERS.map(e => encounterForFighter(e, save.fighter));
  const nearest = nearbyEncounter(save.position); const nearby = nearest ? encounterForFighter(nearest, save.fighter) : undefined; const region = regionAt(save.position);
  const progress = circuitProgress(save.results, save.medals);
  const tracked = encounters.find(e => e.id === trackedId) ?? encounters.find(e => !save.results[e.id]?.wins && progress.victories >= (e.requiredVictories ?? 0));
  const quality = useSettings(state => state.graphicsQuality);
  const pause = useCallback(() => { setPaused(value => !value); useWorldSession.getState().checkpoint(); }, []);
  const interact = useCallback(() => { const encounter = nearbyEncounter(useWorldSession.getState().save.position); if (encounter) { setOffer(encounterForFighter(encounter, useWorldSession.getState().save.fighter)); useWorldSession.getState().checkpoint(); } }, []);
  useEffect(() => {
    const timer = window.setInterval(() => useWorldSession.getState().checkpoint(), 3000);
    const visibility = () => { if (document.hidden) { setPaused(true); useWorldSession.getState().checkpoint(); } };
    document.addEventListener('visibilitychange', visibility);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const disabled = archive || paused || !!offer || lost;
  return <section className="world-screen" data-testid="showground" data-region={region} data-world-x={save.position.x.toFixed(2)} data-world-z={save.position.z.toFixed(2)}>
    <WorldBoundary onExit={onExit}><Canvas shadows={quality !== 'performance'} dpr={[1, quality === 'performance' ? 1 : 1.5]} camera={{ position: [0, 11, 33], fov: 48 }}>
      <RendererHealth onLost={() => { setLost(true); useWorldSession.getState().checkpoint(); }} onRestored={() => { setLost(false); setPaused(true); }} />
      <ShowgroundEnvironment />
      <WalkingPlayer paused={disabled} onPause={pause} onInteract={interact} />
      {encounters.map(encounter => <group key={encounter.id} position={[encounter.position.x, 0, encounter.position.z]}>
        <Suspense fallback={null}><WorldWrestler fighter={encounter.host} /></Suspense>
        <WorldSign text={encounter.title.toUpperCase()} position={[0, 3.2, 0]} width={4.8} color={save.results[encounter.id]?.wins ? '#a9d99c' : '#f2deac'} />
        <mesh position={[0, .035, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.25, 1.31, 40]} /><meshBasicMaterial color="#eac66a" transparent opacity={.6} /></mesh>
      </group>)}
    </Canvas></WorldBoundary>
    <header className="world-header"><div><span>FRWF / FREE ROAM</span><h1>{REGION_NAMES[region]}</h1><small>{saveStatus === 'saved' ? 'Progress saved on this device' : 'Saving unavailable · progress lasts this visit'}</small></div><nav aria-label="World controls"><button onClick={() => setArchive(true)}>FRWF ARCHIVE</button><button onClick={() => setCircuit(value => !value)} aria-expanded={circuit}>CIRCUIT</button><button onClick={() => setMap(value => !value)} aria-expanded={map}>MAP</button><button onClick={pause} aria-label="Pause exploration">Ⅱ</button></nav></header>
    {tracked && !disabled && !circuit && <div className="world-waypoint"><i style={{ transform: `rotate(${Math.atan2(tracked.position.x - save.position.x, save.position.z - tracked.position.z)}rad)` }} aria-hidden="true">↑</i><span>{tracked.title}<small>{Math.round(Math.sqrt((tracked.position.x - save.position.x) * (tracked.position.x - save.position.x) + (tracked.position.z - save.position.z) * (tracked.position.z - save.position.z)))} m · {VENUES[tracked.venue].name}</small></span></div>}
    {map && <aside className="world-map" aria-label="Showground map"><svg viewBox="-26 -28 52 58" role="img" aria-label={`Your position and ${WORLD_ENCOUNTERS.length} wrestling activities`}><rect x="-24" y="-25" width="48" height="52" fill="#566342" /><path d="M0 27V-25M0-3H-14M0-2.5H17" stroke="#b8a078" strokeWidth="3" /><rect x="-21" y="-21" width="15" height="14" fill="#82857a" /><rect x="5" y="-14.7" width="12" height="9.4" fill="#c5c0a7" />{WORLD_ENCOUNTERS.map(e => <circle key={e.id} cx={e.position.x} cy={e.position.z} r="1.2" fill={save.results[e.id]?.wins ? '#95e495' : '#fbd474'} />)}<circle cx={save.position.x} cy={save.position.z} r="1.15" fill="white" stroke="#181f20" strokeWidth=".4" /></svg><span>WHITE · YOU / GOLD · WRESTLING</span><p>Northwest: Backstage fight club<br />Northeast: Main Event / Championship<br />Southwest: Reversal test<br />East: Tables & trouble</p></aside>}
    {circuit && <aside className="world-circuit" aria-label="Local wrestling circuit"><header><span>YOUR WRESTLING CIRCUIT</span><button onClick={() => setCircuit(false)} aria-label="Close circuit">×</button></header><h2>{progress.rank}</h2><p>{progress.reputation} reputation · {progress.victories} / {WORLD_ENCOUNTERS.length} encounters won</p><progress value={progress.fraction} max={1} aria-label="Progress toward next circuit rank" /><small>{progress.next ? `${progress.next.threshold - progress.reputation} to ${progress.next.title}` : 'Top circuit rank earned'} · saved on this device</small>{encounters.map(e => <article key={e.id}><b>{e.title}</b><span>{progress.victories < (e.requiredVictories ?? 0) ? `Unlock: win ${e.requiredVictories} distinct encounters` : `${VENUES[e.venue].name} · ${e.difficulty}`}</span><button className="circuit-track" disabled={progress.victories < (e.requiredVictories ?? 0)} onClick={() => { setTrackedId(e.id); setCircuit(false); }}>TRACK ENCOUNTER</button><div className="circuit-medals">{CIRCUIT_OBJECTIVES.map(o => <span key={o.id} title={o.detail} className={save.medals[e.id]?.includes(o.id) ? 'earned' : ''}>{save.medals[e.id]?.includes(o.id) ? '★' : '☆'} {o.label}</span>)}</div></article>)}</aside>}
    {!disabled && <div className="world-prompt">{nearby ? <button onClick={interact}><span>F / A · TALK & WRESTLE</span><b>{nearby.title}</b></button> : <p>WASD / left stick to explore · Shift to run<br /><span>Walk up to a wrestler to start a bout.</span></p>}</div>}
    <WorldTouch paused={disabled} />
    {archive && <FrwfArchive onClose={() => setArchive(false)} />}
    {offer && <div className="world-modal" role="dialog" aria-modal="true" aria-label={offer.title}><article><span>MEET {fighterById(offer.host).name}</span><h2>{offer.title}</h2><p>{offer.description}</p><p className="world-offer-detail">Fight in {VENUES[offer.venue].name}. You’ll return to this spot afterward.</p>{save.results[offer.id] && <p>Your record: {save.results[offer.id]?.wins} wins / {save.results[offer.id]?.bouts} completed bouts</p>}<ul className="world-objectives">{CIRCUIT_OBJECTIVES.map(o => <li key={o.id}>{save.medals[offer.id]?.includes(o.id) ? '★' : '☆'} {o.detail}</li>)}</ul>{progress.victories < (offer.requiredVictories ?? 0) && <p>Win {offer.requiredVictories} distinct encounters to unlock this bout. Current: {progress.victories}.</p>}<button className="button button--hero" disabled={progress.victories < (offer.requiredVictories ?? 0)} onClick={() => { if (useWorldSession.getState().begin(offer.id)) onEncounter(offer); }}>START BOUT</button><button className="button button--quiet" onClick={() => setOffer(null)}>KEEP EXPLORING</button></article></div>}
    {paused && !offer && !lost && <div className="world-modal" role="dialog" aria-modal="true" aria-label="Exploration paused"><article><span>TAKE A BREATHER</span><h2>Showground paused</h2><button className="button button--hero" onClick={pause}>RESUME EXPLORING</button><button className="button button--quiet" onClick={() => { useWorldSession.getState().checkpoint(); onExit(); }}>SAVE & RETURN TO MENU</button></article></div>}
    {lost && <div className="world-modal" role="alert"><article><h2>Graphics interrupted</h2><p>Your position is saved. Return to the menu and enter the showground again.</p><button className="button" onClick={onExit}>BACK TO MENU</button></article></div>}
  </section>;
}

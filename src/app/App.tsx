import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { FIGHTERS, fighterById, opponentFor } from '../game/data/fighters';
import { BALANCE } from '../game/data/balance';
import { useMatchStore } from '../game/state/matchStore';
import { useSettings } from '../game/state/settings';
import { audioEngine } from '../game/audio/audioEngine';
import type { ControlDevice, Difficulty, FighterId, MatchMode, Ruleset } from '../game/types/game';
import { HUD } from '../ui/HUD';
import { Logo } from '../ui/Logo';
import { Tutorial } from '../ui/Tutorial';
import { MobileControls } from '../ui/MobileControls';
import { RELEASE_IDENTITY } from '../game/release/releaseIdentity';
import { SpectatorControls } from '../ui/SpectatorControls';

const importGameScene = () => import('../game/components/GameScene');
let gameScenePromise: ReturnType<typeof importGameScene> | null = null;
const loadGameScene = (): ReturnType<typeof importGameScene> => gameScenePromise ??= importGameScene();
const GameScene = lazy(async () => ({ default: (await loadGameScene()).GameScene }));
const FighterPreview = lazy(async () => ({ default: (await import('../ui/FighterPreview')).FighterPreview }));
const SettingsPanel = lazy(async () => ({ default: (await import('../ui/SettingsPanel')).SettingsPanel }));
const PhysicsLab = lazy(async () => ({ default: (await import('../game/components/PhysicsLab')).PhysicsLab }));

type Screen = 'init' | 'main' | 'how' | 'settings' | 'select' | 'rules' | 'match' | 'results';

export function App() {
  const [screen, setScreen] = useState<Screen>('init'); const [selected, setSelected] = useState<FighterId>('atlas'); const [rules, setRules] = useState<Ruleset>('standard');
  const [matchMode, setMatchMode] = useState<MatchMode>('battle_royale');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal'); const [device, setDevice] = useState<ControlDevice>('keyboard'); const [paused, setPaused] = useState(false);
  const [beers, setBeers] = useState(0);
  const [runtimePreload, setRuntimePreload] = useState<'idle' | 'loading' | 'ready'>('idle');
  const physicsLab = new URLSearchParams(window.location.search).get('physicsLab') === '1';
  const toyTest = new URLSearchParams(window.location.search).get('toyTest') === '1';
  const settings = useSettings(); const configure = useMatchStore((state) => state.configure); const rematch = useMatchStore((state) => state.rematch); const result = useMatchStore((state) => state.model.result); const replayActive = useMatchStore((state) => state.replayActive);
  const opponentId = opponentFor(selected); const fighter = fighterById(selected); const opponent = fighterById(opponentId);
  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale));
    document.documentElement.dataset.highContrast = settings.highContrast ? 'true' : 'false';
    document.documentElement.dataset.lowFlash = settings.lowFlash ? 'true' : 'false';
    audioEngine.configure(settings);
  }, [settings]);

  const confirm = (next: Screen): void => { audioEngine.play('confirm', settings); setScreen(next); };
  const preloadRuntime = useCallback((): void => {
    if (runtimePreload !== 'idle') return;
    setRuntimePreload('loading');
    void loadGameScene().then(() => setRuntimePreload('ready'));
  }, [runtimePreload]);
  const enter = (): void => { audioEngine.unlock(settings); setScreen('main'); preloadRuntime(); };
  const start = (): void => { configure(selected, opponentId, rules, difficulty, beers, 0, physicsLab ? 'singles' : matchMode); if (physicsLab) useMatchStore.getState().setLabMode(true); if (toyTest) useMatchStore.getState().setToyTestMode(true); setPaused(false); confirm('match'); audioEngine.play('bell', settings); };
  const togglePause = useCallback(() => {
    const next = !useMatchStore.getState().model.paused;
    useMatchStore.getState().pause(next);
    setPaused(next);
  }, []);
  const finish = useCallback(() => setScreen('results'), []);
  const doRematch = (): void => { rematch(); setPaused(false); confirm('match'); audioEngine.play('bell', settings); };

  const menuBackdrop = screen !== 'match' && <div className="backdrop"><div className="backdrop__ring" /><div className="backdrop__beam backdrop__beam--a" /><div className="backdrop__beam backdrop__beam--b" /></div>;
  return <main className={`app app--${screen}${toyTest ? ' app--toy-test' : ''}`}>
    {menuBackdrop}
    {screen === 'init' && <section className="init-screen"><Logo /><div className="init-card"><span>SYSTEM CHECK</span><b>LOCAL ARENA READY</b><small>WebGL · deterministic combat · procedural audio</small></div><button className="button button--hero" onClick={enter}>ENTER THE VOLT DOME</button><p>No network connection required after installation.</p></section>}
    {screen === 'main' && <section className="menu-screen"><Logo /><div className="menu-copy"><p>NEON UNDERGROUND ARCADE WRESTLING</p><h1>MAKE THE DOME<br /><em>LOSE CONTROL.</em></h1><span>Five originals. One electric ring. Every match tells a different story.</span></div><nav className="main-nav" aria-label="Main menu"><button className="button button--hero" onPointerEnter={preloadRuntime} onFocus={preloadRuntime} onClick={() => { preloadRuntime(); confirm('select'); }}>PLAY</button><button className="button button--quiet" onClick={() => confirm('how')}>HOW TO PLAY</button><button className="button button--quiet" onClick={() => confirm('settings')}>SETTINGS</button></nav><footer data-runtime-preload={runtimePreload} data-release-sha={RELEASE_IDENTITY.gitSha}>RINGFALL v{RELEASE_IDENTITY.applicationVersion} · BUILD {RELEASE_IDENTITY.shortGitSha} · ARENA {runtimePreload === 'ready' ? 'PRIMED' : runtimePreload === 'loading' ? 'WARMING' : 'STANDBY'}</footer></section>}
    {screen === 'how' && <section className="panel panel--how"><div className="section-heading"><span>CORNER COACH</span><h2>HOW TO PLAY</h2></div><div className="how-grid">
      <article><b>1 · CONTROL THE SPACE</b><p>WASD moves and aims. Shift runs. C jumps. Near a center rope, F enters or exits cleanly; a corner keeps F reserved for climbing.</p></article><article><b>2 · DIRECTIONAL STRIKING</b><p>J and K change with your direction: high cross and uppercut forward, low kick while retreating, roundhouse left, high kick right. The live deck always names the move that will fire.</p></article><article><b>3 · LOAD THE ROPES</b><p>Sprint into a visibly stretching rope. Its rebound adds speed; press K, Y, or POWER during the glowing window to land a Railway Stiff-Arm knockdown.</p></article><article><b>4 · OWN THE CORNERS</b><p>Press F three times to climb lower, middle, and top. At the top: J drops an elbow, K fires a missile kick, F launches Domefall, Q poses, and Space climbs down.</p></article><article><b>5 · WRESTLE, DON'T MASH</b><p>Press L to establish a two-hand clinch. Keep holding a direction and use J, K, or L; the deck and grapple board name the exact takedown, slam, choke, whip, or throw.</p></article><article><b>6 · RECOVER & FINISH</b><p>I guards; timed Space reverses. When down, Space performs a visible stamina-bound kick-up. Fill Momentum, then use F to finish—or pin a vulnerable opponent.</p></article>
    </div><button className="button" onClick={() => confirm('main')}>BACK TO MENU</button></section>}
    {screen === 'settings' && <Suspense fallback={<div className="canvas-fallback"><b>OPENING CONTROL ROOM</b></div>}><SettingsPanel onBack={() => confirm('main')} /></Suspense>}
    {screen === 'select' && <section className="select-screen"><div className="section-heading"><span>CHOOSE YOUR SIGNAL</span><h2>FIGHTER SELECT</h2></div><div className="select-layout"><div className="roster" role="list">{FIGHTERS.map((candidate) => <button key={candidate.id} className={candidate.id === selected ? 'roster-card roster-card--active' : 'roster-card'} onClick={() => { setSelected(candidate.id); setBeers(0); audioEngine.play('menu', settings); }}><span style={{ background: candidate.palette.primary }} /><div><b>{candidate.name}</b><small>{candidate.archetype}</small></div></button>)}</div><Suspense fallback={<div className="fighter-preview preview-loading">ASSEMBLING FIGHTER…</div>}><FighterPreview fighterId={selected} /></Suspense><article className="fighter-dossier"><span>{fighter.nickname}</span><h3>{fighter.name}</h3><b>{fighter.archetype}</b><p>{fighter.bio}</p><div className="stats">{Object.entries(fighter.stats).map(([label, value]) => <div key={label}><span>{label}</span><i><u style={{ width: `${value}%` }} /></i><b>{value}</b></div>)}</div><div className="signature"><span>SIGNATURE FINISHER</span><b>{fighter.signature}</b></div></article></div><div className="button-row"><button className="button button--quiet" onClick={() => confirm('main')}>BACK</button><button className="button button--hero" onClick={() => confirm('rules')}>LOCK IN {fighter.name}</button></div></section>}
    {screen === 'rules' && <section className="panel rules-screen"><div className="section-heading"><span>TALE OF THE TAPE</span><h2>MATCH SETUP</h2></div><div className="versus"><div><span style={{ color: fighter.palette.primary }}>YOU</span><b>{fighter.name}</b><small>{fighter.archetype}</small></div><strong>{matchMode === 'battle_royale' ? 'VS ALL' : 'VS'}</strong><div><span style={{ color: opponent.palette.primary }}>{matchMode === 'battle_royale' ? 'FULL ROSTER' : 'CPU'}</span><b>{matchMode === 'battle_royale' ? 'FOUR RIVALS' : opponent.name}</b><small>{matchMode === 'battle_royale' ? 'Every wrestler · no teams' : opponent.archetype}</small></div></div><div className="option-grid"><fieldset><legend>MATCH MODE</legend><button data-testid="battle-royale-mode" className={matchMode === 'battle_royale' ? 'option active' : 'option'} onClick={() => setMatchMode('battle_royale')}><b>BATTLE ROYALE · DEFAULT</b><span>All five wrestlers · total free-for-all · last wrestler standing</span></button><button className={matchMode === 'singles' ? 'option active' : 'option'} onClick={() => setMatchMode('singles')}><b>SINGLES</b><span>Focused one-on-one match for isolated move practice</span></button></fieldset><fieldset><legend>RULESET</legend><button className={rules === 'standard' ? 'option active' : 'option'} onClick={() => setRules('standard')}><b>STANDARD</b><span>Pure competition · no starting weapons · balanced Momentum</span></button><button className={rules === 'chaos' ? 'option active' : 'option'} onClick={() => setRules('chaos')}><b>CHAOS CIRCUIT</b><span>Props · arena events · faster Momentum · hotter environment</span></button></fieldset><fieldset><legend>RIVAL AI</legend><button className={difficulty === 'normal' ? 'option active' : 'option'} onClick={() => setDifficulty('normal')}><b>NORMAL</b><span>Readable reactions · strategic mistakes · first-session friendly</span></button><button className={difficulty === 'hard' ? 'option active' : 'option'} onClick={() => setDifficulty('hard')}><b>HARD</b><span>Sharper spacing · stronger counters · fair shared stats</span></button></fieldset></div><BeerLocker fighterId={selected} beers={beers} onChange={setBeers} /><div className="prematch-strip"><span>CONTROL DEVICE <b>{device.toUpperCase()}</b></span><span>VENUE <b>THE VOLT DOME</b></span><span>WIN CONDITION <b>{matchMode === 'battle_royale' ? 'LAST WRESTLER STANDING' : 'PIN OR KO'}</b></span></div><div className="button-row"><button className="button button--quiet" onClick={() => confirm('select')}>CHANGE FIGHTER</button><button className="button button--hero" onClick={start}>{physicsLab || matchMode === 'singles' ? 'START MATCH' : 'START MATCH · BATTLE ROYALE'}</button></div></section>}
    {screen === 'match' && <section className="match-screen"><Suspense fallback={<div className="canvas-fallback"><b>THE VOLT DOME IS POWERING UP</b><span>Preparing local physics and shader modules…</span></div>}><GameScene onPause={togglePause} onDevice={setDevice} onFinished={finish} /></Suspense>{!toyTest && <><HUD device={device} paused={paused} />{settings.controlDeckMode !== 'hidden' && <Tutorial device={device} />}<MobileControls onPause={togglePause} paused={paused || replayActive} /><SpectatorControls /></>}{physicsLab && <Suspense fallback={null}><PhysicsLab /></Suspense>}{replayActive && <div className="replay-overlay"><span>VOLT DOME INSTANT REPLAY</span><b>PHYSICAL IMPACT REVIEW</b><button onClick={() => useMatchStore.getState().stopReplay()}>SKIP REPLAY</button></div>}{paused && <div className="pause-overlay"><Logo compact /><span>MATCH PAUSED</span><button className="button button--hero" onClick={togglePause}>RESUME</button><button className="button button--quiet" onClick={() => { useMatchStore.getState().pause(false); setPaused(false); setScreen('settings'); }}>SETTINGS</button><button className="button button--quiet" onClick={() => { useMatchStore.getState().pause(false); setPaused(false); setScreen('main'); }}>QUIT TO MENU</button></div>}</section>}
    {screen === 'results' && result && <Results result={result} winnerName={fighterById(useMatchStore.getState().model[result.winner].definitionId).name} onRematch={doRematch} onChange={() => confirm('select')} onMenu={() => confirm('main')} />}
  </main>;
}

function BeerLocker({ fighterId, beers, onChange }: { fighterId: FighterId; beers: number; onChange: (value: number) => void }) {
  return <div className="locker-room">
    <div><span>LOCKER ROOM · FIVE-BEER ALLOTMENT</span><b>{beers} / {BALANCE.stamina.beersPerFighter} DRUNK</b><small>Each beer adds {BALANCE.stamina.beerCapBoost} stamina for this match. {fighterId === 'chad' ? 'The Claw starts with the lowest gas tank—beer brings the brawl back.' : 'Unopened cans stay on the bench.'}</small></div>
    <div className="beer-cans" aria-label={`${beers} of five beers consumed`}>{Array.from({ length: BALANCE.stamina.beersPerFighter }, (_, index) => <i key={index} className={index < beers ? 'beer beer--drunk' : 'beer'}>RF</i>)}</div>
    <div><button className="button button--quiet" disabled={beers === 0} onClick={() => onChange(Math.max(0, beers - 1))}>PUT ONE BACK</button><button className="button" disabled={beers >= BALANCE.stamina.beersPerFighter} onClick={() => onChange(Math.min(BALANCE.stamina.beersPerFighter, beers + 1))}>DRINK A BEER</button></div>
  </div>;
}

function Results({ result, winnerName, onRematch, onChange, onMenu }: { result: NonNullable<ReturnType<typeof useMatchStore.getState>['model']['result']>; winnerName: string; onRematch: () => void; onChange: () => void; onMenu: () => void }) {
  const duration = `${Math.floor(result.duration / 60)}:${String(Math.floor(result.duration % 60)).padStart(2, '0')}`;
  const rows = useMemo(() => [['MATCH TIME', duration], ['DAMAGE DEALT', result.playerStats.damageDealt.toFixed(1)], ['COUNTERS', result.playerStats.counters], ['GRAPPLES', result.playerStats.grapples], ['FINISHERS', result.playerStats.finishers], ['NEAR FALLS', result.playerStats.nearFalls], ['PROP IMPACTS', result.playerStats.propImpacts]] as const, [duration, result]);
  const highlights = [['BEST SPOT', result.highlights.bestSpot], ['BEST SLAM', result.highlights.bestSlam], ['BRUTAL IMPACT', result.highlights.mostBrutalImpact], ['WILD REVERSAL', result.highlights.mostUnexpectedReversal]] as const;
  return <section className="results-screen"><div className="results-flare" /><span className="results-kicker">OFFICIAL VOLT DOME DECISION</span><h2>{winnerName}<small>WINS BY {result.method}</small></h2><div className={`grade grade--${result.grade}`}><span>HYPE RATING</span><b>{result.grade}</b><small>{Math.round(result.hype)} / 100</small></div><div className="results-stats">{rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>{highlights.some(([, moment]) => moment !== null) && <div className="highlight-reel"><strong>VOLT DOME HIGHLIGHT REEL</strong>{highlights.filter((entry) => entry[1] !== null).map(([label, moment]) => <div key={label}><span>{label}</span><b>{moment?.label}</b><small>{moment?.time.toFixed(1)}s · IMPACT {Math.round(moment?.score ?? 0)}</small></div>)}</div>}<div className="button-row"><button className="button button--hero" onClick={onRematch}>INSTANT REMATCH</button><button className="button button--quiet" onClick={onChange}>CHANGE FIGHTER</button><button className="button button--quiet" onClick={onMenu}>MAIN MENU</button></div></section>;
}

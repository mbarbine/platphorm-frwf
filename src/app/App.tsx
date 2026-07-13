import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { FIGHTERS, fighterById, opponentFor } from '../game/data/fighters';
import { BALANCE } from '../game/data/balance';
import { useMatchStore } from '../game/state/matchStore';
import { useSettings } from '../game/state/settings';
import { audioEngine } from '../game/audio/audioEngine';
import type { ControlDevice, Difficulty, FighterId, Ruleset } from '../game/types/game';
import { HUD } from '../ui/HUD';
import { Logo } from '../ui/Logo';
import { SettingsPanel } from '../ui/SettingsPanel';
import { Tutorial } from '../ui/Tutorial';

const GameScene = lazy(async () => ({ default: (await import('../game/components/GameScene')).GameScene }));
const FighterPreview = lazy(async () => ({ default: (await import('../ui/FighterPreview')).FighterPreview }));

type Screen = 'init' | 'main' | 'how' | 'settings' | 'select' | 'rules' | 'match' | 'results';

export function App() {
  const [screen, setScreen] = useState<Screen>('init'); const [selected, setSelected] = useState<FighterId>('atlas'); const [rules, setRules] = useState<Ruleset>('standard');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal'); const [device, setDevice] = useState<ControlDevice>('keyboard'); const [paused, setPaused] = useState(false);
  const [beers, setBeers] = useState(0);
  const settings = useSettings(); const configure = useMatchStore((state) => state.configure); const rematch = useMatchStore((state) => state.rematch); const result = useMatchStore((state) => state.model.result);
  const opponentId = opponentFor(selected); const fighter = fighterById(selected); const opponent = fighterById(opponentId);
  useEffect(() => { document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale)); audioEngine.configure(settings); }, [settings]);

  const confirm = (next: Screen): void => { audioEngine.play('confirm', settings); setScreen(next); };
  const enter = (): void => { audioEngine.unlock(settings); setScreen('main'); };
  const start = (): void => { configure(selected, opponentId, rules, difficulty, beers, 0); setPaused(false); confirm('match'); audioEngine.play('bell', settings); };
  const togglePause = useCallback(() => {
    const next = !useMatchStore.getState().model.paused;
    useMatchStore.getState().pause(next);
    setPaused(next);
  }, []);
  const finish = useCallback(() => setScreen('results'), []);
  const doRematch = (): void => { rematch(); setPaused(false); confirm('match'); audioEngine.play('bell', settings); };

  const menuBackdrop = screen !== 'match' && <div className="backdrop"><div className="backdrop__ring" /><div className="backdrop__beam backdrop__beam--a" /><div className="backdrop__beam backdrop__beam--b" /></div>;
  return <main className={`app app--${screen}`}>
    {menuBackdrop}
    {screen === 'init' && <section className="init-screen"><Logo /><div className="init-card"><span>SYSTEM CHECK</span><b>LOCAL ARENA READY</b><small>WebGL · deterministic combat · procedural audio</small></div><button className="button button--hero" onClick={enter}>ENTER THE VOLT DOME</button><p>No network connection required after installation.</p></section>}
    {screen === 'main' && <section className="menu-screen"><Logo /><div className="menu-copy"><p>NEON UNDERGROUND ARCADE WRESTLING</p><h1>MAKE THE DOME<br /><em>LOSE CONTROL.</em></h1><span>Five originals. One electric ring. Every match tells a different story.</span></div><nav className="main-nav" aria-label="Main menu"><button className="button button--hero" onClick={() => confirm('select')}>PLAY</button><button className="button button--quiet" onClick={() => confirm('how')}>HOW TO PLAY</button><button className="button button--quiet" onClick={() => confirm('settings')}>SETTINGS</button></nav><footer>RINGFALL v1.0 · ORIGINAL COMBAT SPORT</footer></section>}
    {screen === 'how' && <section className="panel panel--how"><div className="section-heading"><span>CORNER COACH</span><h2>HOW TO PLAY</h2></div><div className="how-grid">
      <article><b>1 · CONTROL THE SPACE</b><p>Move with WASD or the D-pad. Hold Shift to run. Press C or L3 to jump. Touch a rope at speed to rebound into a harder strike.</p></article><article><b>2 · WRESTLE, DON'T MASH</b><p>Press L to lock up. During the grapple, hold a direction and press J, K, or L for a different takedown, slam, throw, whip, or power move.</p></article><article><b>3 · GUARD & REVERSE</b><p>Hold I to block strikes or stuff a grapple; guarding drains stamina. Major attacks telegraph—tap Space in the window to reverse.</p></article><article><b>4 · CLOSE THE SHOW</b><p>At full Momentum, stagger or drop your rival and press F for a signature. Press F over a downed rival to pin.</p></article><article><b>CHAOS CIRCUIT</b><p>Use E near a chair or sign, then K or E to swing it. Broadcast events alter props, ropes, lighting, or Momentum.</p></article><article><b>GAMEPAD</b><p>Stick/D-pad move · RT run · L3 jump · X quick · Y heavy · B grapple · LT guard · A counter · LB prop · RB taunt · R3 context.</p></article>
    </div><button className="button" onClick={() => confirm('main')}>BACK TO MENU</button></section>}
    {screen === 'settings' && <SettingsPanel onBack={() => confirm('main')} />}
    {screen === 'select' && <section className="select-screen"><div className="section-heading"><span>CHOOSE YOUR SIGNAL</span><h2>FIGHTER SELECT</h2></div><div className="select-layout"><div className="roster" role="list">{FIGHTERS.map((candidate) => <button key={candidate.id} className={candidate.id === selected ? 'roster-card roster-card--active' : 'roster-card'} onClick={() => { setSelected(candidate.id); setBeers(0); audioEngine.play('menu', settings); }}><span style={{ background: candidate.palette.primary }} /><div><b>{candidate.name}</b><small>{candidate.archetype}</small></div></button>)}</div><Suspense fallback={<div className="fighter-preview preview-loading">ASSEMBLING FIGHTER…</div>}><FighterPreview fighterId={selected} /></Suspense><article className="fighter-dossier"><span>{fighter.nickname}</span><h3>{fighter.name}</h3><b>{fighter.archetype}</b><p>{fighter.bio}</p><div className="stats">{Object.entries(fighter.stats).map(([label, value]) => <div key={label}><span>{label}</span><i><u style={{ width: `${value}%` }} /></i><b>{value}</b></div>)}</div><div className="signature"><span>SIGNATURE FINISHER</span><b>{fighter.signature}</b></div></article></div><div className="button-row"><button className="button button--quiet" onClick={() => confirm('main')}>BACK</button><button className="button button--hero" onClick={() => confirm('rules')}>LOCK IN {fighter.name}</button></div></section>}
    {screen === 'rules' && <section className="panel rules-screen"><div className="section-heading"><span>TALE OF THE TAPE</span><h2>MATCH SETUP</h2></div><div className="versus"><div><span style={{ color: fighter.palette.primary }}>YOU</span><b>{fighter.name}</b><small>{fighter.archetype}</small></div><strong>VS</strong><div><span style={{ color: opponent.palette.primary }}>CPU</span><b>{opponent.name}</b><small>{opponent.archetype}</small></div></div><div className="option-grid"><fieldset><legend>RULESET</legend><button className={rules === 'standard' ? 'option active' : 'option'} onClick={() => setRules('standard')}><b>STANDARD</b><span>Pure competition · no starting weapons · balanced Momentum</span></button><button className={rules === 'chaos' ? 'option active' : 'option'} onClick={() => setRules('chaos')}><b>CHAOS CIRCUIT</b><span>Props · arena events · faster Momentum · hotter environment</span></button></fieldset><fieldset><legend>OPPONENT</legend><button className={difficulty === 'normal' ? 'option active' : 'option'} onClick={() => setDifficulty('normal')}><b>NORMAL</b><span>Readable reactions · strategic mistakes · first-session friendly</span></button><button className={difficulty === 'hard' ? 'option active' : 'option'} onClick={() => setDifficulty('hard')}><b>HARD</b><span>Sharper spacing · stronger counters · fair shared stats</span></button></fieldset></div><BeerLocker fighterId={selected} beers={beers} onChange={setBeers} /><div className="prematch-strip"><span>CONTROL DEVICE <b>{device.toUpperCase()}</b></span><span>VENUE <b>THE VOLT DOME</b></span><span>WIN CONDITION <b>PIN OR KO</b></span></div><div className="button-row"><button className="button button--quiet" onClick={() => confirm('select')}>CHANGE FIGHTER</button><button className="button button--hero" onClick={start}>START MATCH</button></div></section>}
    {screen === 'match' && <section className="match-screen"><Suspense fallback={<div className="canvas-fallback"><b>THE VOLT DOME IS POWERING UP</b><span>Preparing local physics and shader modules…</span></div>}><GameScene onPause={togglePause} onDevice={setDevice} onFinished={finish} /></Suspense><HUD device={device} paused={paused} /><Tutorial />{paused && <div className="pause-overlay"><Logo compact /><span>MATCH PAUSED</span><button className="button button--hero" onClick={togglePause}>RESUME</button><button className="button button--quiet" onClick={() => { useMatchStore.getState().pause(false); setPaused(false); setScreen('settings'); }}>SETTINGS</button><button className="button button--quiet" onClick={() => { useMatchStore.getState().pause(false); setPaused(false); setScreen('main'); }}>QUIT TO MENU</button></div>}</section>}
    {screen === 'results' && result && <Results result={result} winnerName={result.winner === 'player' ? fighter.name : opponent.name} onRematch={doRematch} onChange={() => confirm('select')} onMenu={() => confirm('main')} />}
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

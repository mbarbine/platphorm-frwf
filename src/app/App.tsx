import { FighterSelection } from '../ui/FighterSelection';
import { gameServerEndpoint } from '../game/multiplayer/serverEndpoint';
import { VENUES, type CombatVenue, venueFor } from '../game/data/venues';
import { circuitProgress, earnedMedals, CIRCUIT_OBJECTIVES } from '../game/world/circuit';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { FIGHTERS, fighterById, opponentFor } from '../game/data/fighters';
import { BALANCE } from '../game/data/balance';
import { useMatchStore } from '../game/state/matchStore';
import { useSettings } from '../game/state/settings';
import { ArchiveBackdrop, ArenaLoading } from '../ui/ArchiveBackdrop';
import { BackgroundMusic } from '../game/audio/BackgroundMusic';
import { audioEngine } from '../game/audio/audioEngine';
import type { ControlDevice, Difficulty, FighterId, MatchMode, Ruleset } from '../game/types/game';
import { HUD } from '../ui/HUD';
import { Logo } from '../ui/Logo';
import { Tutorial } from '../ui/Tutorial';
import { MobileControls } from '../ui/MobileControls';
import { RELEASE_IDENTITY } from '../game/release/releaseIdentity';
import { SpectatorControls } from '../ui/SpectatorControls';
import { useWorldSession } from '../game/world/worldSession';
import type { WorldEncounter } from '../game/world/showground';
import { useMultiplayerStore } from '../game/multiplayer/MultiplayerStore';
import { parseRoomInvite } from '../game/multiplayer/ColyseusClient';
import { InstallGame } from '../ui/InstallGame';

const importGameScene = () => import('../game/components/GameScene');
let gameScenePromise: ReturnType<typeof importGameScene> | null = null;
const loadGameScene = (): ReturnType<typeof importGameScene> => gameScenePromise ??= importGameScene();
const GameScene = lazy(async () => ({ default: (await loadGameScene()).GameScene }));
const WorldScene = lazy(async () => ({ default: (await import('../game/world/WorldScene')).WorldScene }));
const SettingsPanel = lazy(async () => ({ default: (await import('../ui/SettingsPanel')).SettingsPanel }));
const PhysicsLab = lazy(async () => ({ default: (await import('../game/components/PhysicsLab')).PhysicsLab }));

type Screen = 'init' | 'main' | 'how' | 'settings' | 'select' | 'rules' | 'match' | 'results' | 'multiplayer_lobby' | 'world';

export function App() {
  const settings = useSettings();
  const [screen, setScreen] = useState<Screen>('init'); const [selected, setSelected] = useState<FighterId>('atlas'); const [rules, setRules] = useState<Ruleset>('standard');
  const [matchMode, setMatchMode] = useState<MatchMode>('battle_royale');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal'); const [device, setDevice] = useState<ControlDevice>('keyboard'); const [paused, setPaused] = useState(false);
  const [matchSettings, setMatchSettings] = useState(false);
  const [selectionTarget, setSelectionTarget] = useState<'match' | 'world' | 'online'>('match');
  const [worldEncounter, setWorldEncounter] = useState<WorldEncounter | null>(null);
  const [beers, setBeers] = useState(0);
  const [runtimePreload, setRuntimePreload] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [multiplayerError, setMultiplayerError] = useState('');

  const physicsLab = new URLSearchParams(window.location.search).get('physicsLab') === '1';
  const toyTest = new URLSearchParams(window.location.search).get('toyTest') === '1';
  const configure = useMatchStore((state) => state.configure); const rematch = useMatchStore((state) => state.rematch); const result = useMatchStore((state) => state.model.result); const replayActive = useMatchStore((state) => state.replayActive);
  const opponentId = opponentFor(selected); const fighter = fighterById(selected); const opponent = fighterById(opponentId);

  useEffect(() => {
    if (screen !== 'how') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') confirm('main');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'select') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const currentIndex = FIGHTERS.findIndex(f => f.id === selected);
        let nextIndex = currentIndex;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          nextIndex = (currentIndex + 1) % FIGHTERS.length;
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          nextIndex = (currentIndex - 1 + FIGHTERS.length) % FIGHTERS.length;
        }
        const candidate = FIGHTERS[nextIndex];
        if (candidate) {
          const nextId = candidate.id;
          setSelected(nextId);
          setBeers(0);
          audioEngine.play('menu', settings);
          setTimeout(() => {
            const btn = document.querySelector(`[data-fighter-select-id="${nextId}"]`) as HTMLButtonElement | null;
            btn?.focus();
          }, 0);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, selected, settings]);

  // Multiplayer hooks
  const multiplayerStatus = useMultiplayerStore((state) => state.status);
  const multiplayerRoomPhase = useMultiplayerStore((state) => state.roomPhase);
  const multiplayerRuleset = useMultiplayerStore((state) => state.ruleset);
  const multiplayerRoomId = useMultiplayerStore((state) => state.roomId);
  const multiplayerJoinInvite = useMultiplayerStore((state) => state.joinInvite);
  const multiplayerHostSessionId = useMultiplayerStore((state) => state.hostSessionId);
  const multiplayerSessionId = useMultiplayerStore((state) => state.sessionId);
  const multiplayerMyRole = useMultiplayerStore((state) => state.myRole);
  const multiplayerRoles = useMultiplayerStore((state) => state.roles);
  const multiplayerFightersMap = useMultiplayerStore((state) => state.fighters);
  const multiplayerReadyPlayers = useMultiplayerStore((state) => state.readyPlayers);
  const multiplayerConnectedPlayers = useMultiplayerStore((state) => state.connected);
  const multiplayerGuestInvites = useMultiplayerStore((state) => state.guestInvites);
  const multiplayerChat = useMultiplayerStore((state) => state.lobbyChat);
  const [lobbyChatText, setLobbyChatText] = useState('');

  useEffect(() => {
    const invite = parseRoomInvite(window.location.href);
    if (!invite) return;
    const privateInvite = window.location.href;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    setScreen('multiplayer_lobby');
    void useMultiplayerStore.getState().joinByRoomId(privateInvite, { fighterId: selected }).catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale));
    document.documentElement.dataset.highContrast = settings.highContrast ? 'true' : 'false';
    document.documentElement.dataset.lowFlash = settings.lowFlash ? 'true' : 'false';
    audioEngine.configure(settings);
  }, [settings]);

  // Synchronize Multiplayer transition to actual active gameplay
  useEffect(() => {
    if (screen === 'multiplayer_lobby' && multiplayerStatus === 'connected' && multiplayerRoomPhase === 'active') {
      const p1SessionId = [...multiplayerRoles.entries()].find((entry) => entry[1] === 'player1')?.[0];
      const p2SessionId = [...multiplayerRoles.entries()].find((entry) => entry[1] === 'player2')?.[0];
      const p1Fighter = p1SessionId ? (multiplayerFightersMap.get(p1SessionId)?.definitionId as FighterId) : 'atlas';
      const p2Fighter = p2SessionId ? (multiplayerFightersMap.get(p2SessionId)?.definitionId as FighterId) : 'nova';
      const localFighter = multiplayerMyRole === 'player2' ? p2Fighter : p1Fighter;
      const remoteFighter = multiplayerMyRole === 'player2' ? p1Fighter : p2Fighter;

      configure(localFighter, remoteFighter, 'standard', 'normal', 0, 0, 'singles');
      useMatchStore.getState().setNetworkAuthority(true);
      setScreen('match');
      audioEngine.play('bell', settings);
    }
  }, [screen, multiplayerStatus, multiplayerRoomPhase, multiplayerMyRole, multiplayerRoles, multiplayerFightersMap, configure, settings]);

  const confirm = (next: Screen): void => { audioEngine.play('confirm', settings); setScreen(next); };
  const preloadRuntime = useCallback((): void => {
    if (runtimePreload !== 'idle' && runtimePreload !== 'error') return;
    setRuntimePreload('loading');
    void loadGameScene().then(() => setRuntimePreload('ready')).catch(() => { gameScenePromise = null; setRuntimePreload('error'); });
  }, [runtimePreload]);
  const enter = (): void => { audioEngine.unlock(settings); setScreen('main'); preloadRuntime(); };
  const [selectedVenue, setSelectedVenue] = useState<CombatVenue>('turkey_dome');
  const start = (): void => { configure(selected, opponentId, rules, difficulty, beers, 0, matchMode); useMatchStore.getState().configureVenue(selectedVenue); if (physicsLab) useMatchStore.getState().setLabMode(true); if (toyTest) useMatchStore.getState().setToyTestMode(true); setPaused(false); confirm('match'); audioEngine.play('bell', settings); };
  const togglePause = useCallback(() => {
    const next = !useMatchStore.getState().model.paused;
    useMatchStore.getState().pause(next);
    setPaused(next);
    if (next) audioEngine.stopReaction();
  }, []);
  useEffect(() => {
    const suspend = () => {
      if (document.hidden && screen === 'match' && !useMatchStore.getState().model.networkAuthority) {
        useMatchStore.getState().pause(true); setPaused(true); audioEngine.stopReaction();
      }
    };
    document.addEventListener('visibilitychange', suspend);
    return () => document.removeEventListener('visibilitychange', suspend);
  }, [screen]);
  const finish = useCallback(() => {
    if (worldEncounter) useWorldSession.getState().finish(useMatchStore.getState().model.result?.winner === 'player', useMatchStore.getState().model.result ?? undefined);
    setScreen('results');
  }, [worldEncounter]);
  const enterWorldBout = (encounter: WorldEncounter): void => {
    const player = useWorldSession.getState().save.fighter;
    configure(player, encounter.host, encounter.rules, encounter.difficulty, 0, 0, 'singles');
    useMatchStore.getState().configureVenue(encounter.venue);
    setWorldEncounter(encounter); setPaused(false); confirm('match'); audioEngine.play('bell', settings);
  };
  const returnToWorld = (): void => { useWorldSession.getState().abandon(); setWorldEncounter(null); setPaused(false); setMatchSettings(false); confirm('world'); };
  const doRematch = (): void => {
    if (useMatchStore.getState().model.networkAuthority) {
      useMultiplayerStore.getState().voteRematch(); setScreen('multiplayer_lobby'); return;
    }
    if (worldEncounter) useWorldSession.getState().begin(worldEncounter.id);
    rematch(); setPaused(false); confirm('match'); audioEngine.play('bell', settings);
  };

  const menuBackdrop = screen !== 'match' && screen !== 'world' && <div className="backdrop"><div className="backdrop__ring" /><div className="backdrop__beam backdrop__beam--a" /><div className="backdrop__beam backdrop__beam--b" /></div>;
  return <main className={`app app--${screen}${toyTest ? ' app--toy-test' : ''}`}>
    <BackgroundMusic active={screen !== 'init' && !paused} />
    {menuBackdrop}
    {screen !== 'match' && screen !== 'world' && <ArchiveBackdrop active={screen !== 'init'} />}
    {screen === 'init' && <section className="init-screen"><Logo /><div className="init-card"><span>FRWF / TURKEY FARM</span><b>TURKEY DOME READY</b><small>Backyard wrestling · barnyard chaos</small></div><button className="button button--hero" onClick={enter}>ENTER RINGFALL</button><InstallGame /><p>Step into the ring. Make it unforgettable.</p></section>}
    {screen === 'main' && <section className="menu-screen"><Logo /><div className="menu-copy"><p>FRWF / BACKYARD WRESTLING</p><h1>MAKE THE DOME<br /><em>LOSE CONTROL.</em></h1><span>Explore the grounds. Meet the originals. Earn your place in the ring.</span></div><nav className="main-nav" aria-label="Main menu"><button className="button button--hero" onPointerEnter={preloadRuntime} onFocus={preloadRuntime} onClick={() => { setSelectionTarget('world'); setSelected(useWorldSession.getState().save.fighter); confirm('select'); }}>EXPLORE SHOWGROUND</button><button className="button button--hero" onPointerEnter={preloadRuntime} onFocus={preloadRuntime} onClick={() => { setSelectionTarget('match'); setWorldEncounter(null); preloadRuntime(); confirm('select'); }}>PLAY</button><button className="button button--hero" style={{ marginTop: '0.5rem', background: 'linear-gradient(135deg, #7000ff 0%, #ff007b 100%)' }} onPointerEnter={preloadRuntime} onFocus={preloadRuntime} onClick={() => { preloadRuntime(); confirm('multiplayer_lobby'); }}>PLAY ONLINE</button><button className="button button--quiet" onClick={() => confirm('how')}>HOW TO PLAY</button><button className="button button--quiet" onClick={() => confirm('settings')}>SETTINGS</button><InstallGame /></nav><footer data-runtime-preload={runtimePreload} data-release-sha={RELEASE_IDENTITY.gitSha}>RINGFALL v{RELEASE_IDENTITY.applicationVersion} · BUILD {RELEASE_IDENTITY.shortGitSha} · ARENA {runtimePreload === 'ready' ? 'PRIMED' : runtimePreload === 'loading' ? 'WARMING' : runtimePreload === 'error' ? 'RETRY REQUIRED' : 'STANDBY'}</footer></section>}
    {screen === 'how' && <section className="panel panel--how" aria-label="How to play guide"><div className="section-heading"><span>CORNER COACH</span><h2>HOW TO PLAY</h2></div><div className="sr-only" role="status" aria-live="polite">How to Play guide displayed. Press Escape or click Back to Menu to return.</div><div className="how-grid">
      <article><b>1 · MOVE WITH PURPOSE</b><p>Use <kbd>WASD</kbd> to circle your opponent. Hold <kbd>Shift</kbd> only when you want to sprint or hit the ropes.</p></article><article><b>2 · STRIKE CLEANLY</b><p><kbd>J</kbd> throws the fast strike. <kbd>K</kbd> throws the power strike. Arcade controls keep these attacks consistent while you move. Technical controls add directional variations.</p></article><article><b>3 · WRESTLE UP CLOSE</b><p>Get chest-to-chest and press <kbd>L</kbd> for a collar lock. Then use <kbd>J</kbd>, <kbd>K</kbd>, or <kbd>L</kbd> with a direction to choose a takedown, slam, or throw.</p></article><article><b>4 · DEFEND</b><p>Hold <kbd>I</kbd> to guard. Tap <kbd>Space</kbd> to dodge or reverse during the counter window. <kbd>Space</kbd> also helps you recover when down.</p></article><article><b>5 · FOLLOW THE ACTION PROMPT</b><p><kbd>F</kbd> only appears when it matters: pin a downed rival, use a finisher, climb a corner, or move through the ropes.</p></article><article><b>6 · ADVANCED TOOLS</b><p><kbd>C</kbd> jumps, <kbd>E</kbd> handles props, and <kbd>Q</kbd> taunts. Learn those after the five core controls feel natural.</p></article>
    </div><button className="button" onClick={() => confirm('main')}>BACK TO MENU</button></section>}
    {screen === 'settings' && <Suspense fallback={<div className="canvas-fallback"><b>OPENING CONTROL ROOM</b></div>}><SettingsPanel onBack={() => confirm('main')} /></Suspense>}
    {screen === 'select' && <FighterSelection selected={selected} onSelect={id => { setSelected(id); setBeers(0); audioEngine.play('menu', settings); }} onBack={() => confirm('main')} onConfirm={() => { if (selectionTarget === 'world') { useWorldSession.getState().enter(selected); confirm('world'); } else if (selectionTarget === 'online') confirm('multiplayer_lobby'); else confirm('rules'); }} />}
    {screen === "rules" && (
      <section className="panel rules-screen">
        <div className="section-heading">
          <span>TALE OF THE TAPE</span>
          <h2>MATCH SETUP</h2>
        </div>

        <div className="versus">
          <div>
            <span style={{ color: fighter.palette.primary }}>YOU</span>
            <b>{fighter.name}</b>
            <small>{fighter.archetype}</small>
          </div>
          <strong>{matchMode === "battle_royale" ? "VS ALL" : "VS"}</strong>
          <div>
            <span style={{ color: opponent.palette.primary }}>
              {matchMode === "battle_royale" ? "FREE FOR ALL" : "CPU"}
            </span>
            <b>{matchMode === "battle_royale" ? "FOUR RIVALS" : opponent.name}</b>
            <small>
              {matchMode === "battle_royale" ? "Four rivals from the roster · no teams" : opponent.archetype}
            </small>
          </div>
        </div>

        <div className="option-grid">
          <fieldset>
            <legend>MATCH MODE</legend>
            <button
              className={matchMode === "singles" ? "option active" : "option"}
              aria-pressed={matchMode === "singles"}
              onClick={() => setMatchMode("singles")}
            >
              <b>SINGLES</b>
              <span>Readable one-on-one wrestling · pin or knockout</span>
            </button>
            <button
              data-testid="battle-royale-mode"
              className={matchMode === "battle_royale" ? "option active" : "option"}
              aria-pressed={matchMode === "battle_royale"}
              onClick={() => setMatchMode("battle_royale")}
            >
              <b>BATTLE ROYALE</b>
              <span>Five-wrestler free-for-all · last wrestler standing</span>
            </button>
          </fieldset>

          <fieldset>
            <legend>RULESET</legend>
            <button
              className={rules === "standard" ? "option active" : "option"}
              aria-pressed={rules === "standard"}
              onClick={() => setRules("standard")}
            >
              <b>STANDARD</b>
              <span>Pure competition · no starting weapons · balanced Momentum</span>
            </button>
            <button
              className={rules === "chaos" ? "option active" : "option"}
              aria-pressed={rules === "chaos"}
              onClick={() => setRules("chaos")}
            >
              <b>CHAOS CIRCUIT</b>
              <span>Props · arena events · faster Momentum · hotter environment</span>
            </button>
          </fieldset>

          <fieldset>
            <legend>VENUE</legend>
            {(Object.keys(VENUES) as CombatVenue[]).map((id) => (
              <button
                key={id}
                className={selectedVenue === id ? "option active" : "option"}
                aria-pressed={selectedVenue === id}
                onClick={() => {
                  setSelectedVenue(id);
                  if (id === "underground") setRules("chaos");
                }}
              >
                <b>{VENUES[id].name.toUpperCase()}</b>
                <span>
                  {id === "turkey_dome"
                    ? "New · real turkey barn · timber roof, hay bales and a flock of animated turkeys"
                    : id === "dome"
                    ? "FRWF Arena · classic ropes, corners and ringside"
                    : id === "underground"
                    ? "Brick fight cellar · weapons and table spots"
                    : "Falls count anywhere"}
                </span>
              </button>
            ))}
          </fieldset>

          <fieldset>
            <legend>RIVAL AI</legend>
            <button
              className={difficulty === "easy" ? "option active" : "option"}
              aria-pressed={difficulty === "easy"}
              onClick={() => setDifficulty("easy")}
            >
              <b>EASY / CORNER SCHOOL</b>
              <span>Longer opening · slower decisions · space to learn</span>
            </button>
            <button
              className={difficulty === "normal" ? "option active" : "option"}
              aria-pressed={difficulty === "normal"}
              onClick={() => setDifficulty("normal")}
            >
              <b>NORMAL</b>
              <span>Steady pressure · strikes and grapples · space to recover</span>
            </button>
            <button
              className={difficulty === "hard" ? "option active" : "option"}
              aria-pressed={difficulty === "hard"}
              onClick={() => setDifficulty("hard")}
            >
              <b>HARD</b>
              <span>Sharper spacing · stronger counters · fair shared stats</span>
            </button>
          </fieldset>
        </div>

        <BeerLocker fighterId={selected} beers={beers} onChange={setBeers} />

        <div className="prematch-strip">
          <span>
            CONTROL DEVICE <b>{device.toUpperCase()}</b>
          </span>
          <span>
            VENUE <b>{VENUES[selectedVenue].name.toUpperCase()}</b>
          </span>
          <span>
            WIN CONDITION <b>{matchMode === "battle_royale" ? "LAST WRESTLER STANDING" : "PIN OR KO"}</b>
          </span>
        </div>

        <div className="button-row">
          <button className="button button--quiet" onClick={() => confirm("select")}>
            CHANGE FIGHTER
          </button>
          <button className="button button--hero" onClick={start}>
            {physicsLab || matchMode === "singles" ? "START MATCH" : "START MATCH · BATTLE ROYALE"}
          </button>
        </div>
      </section>
    )}
    {screen === 'multiplayer_lobby' && <section className="panel rules-screen multiplayer-lobby">
      <div className="section-heading"><span>CONNECT WITH RIVALS</span><h2>ONLINE MULTIPLAYER</h2></div>

      {multiplayerStatus === 'disconnected' && <div className="multiplayer-lobby__setup" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '640px', margin: '0 auto' }}>
        <p style={{ textAlign: 'center', margin: 0, color: '#aaa' }}>Host a private match for free, then share your one-seat invitation. No account or platform key needed.</p>

        <div className="versus" style={{ padding: '1rem', background: 'rgba(0,0,0,0.5)', borderRadius: '8px' }}>
          <div>
            <span style={{ color: fighter.palette.primary }}>YOUR WRESTLER</span>
            <b>{fighter.name}</b>
            <small>{fighter.archetype}</small>
          </div>
          <button className="button button--quiet" onClick={() => { setSelectionTarget('online'); setScreen('select'); }}>CHANGE FIGHTER</button>
        </div>

        <div className="option-grid" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#7000ff' }}>HOST MATCH</h3>
            <p style={{ margin: 0, color: '#aaa', lineHeight: 1.5 }}>Create a room and get a private link for your rival. If you leave, host control passes to the other player.</p>
            <button className="button" onClick={async () => {
              setMultiplayerError(''); audioEngine.play('confirm', settings);
              try { await useMultiplayerStore.getState().createPrivateRoom({ fighterId: selected, ruleset: rules }); }
              catch (error) { setMultiplayerError(error instanceof Error ? error.message : 'Could not host a match.'); }
            }}>HOST A MATCH</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
            <label htmlFor="multiplayer-room-code-input" style={{ margin: 0, fontSize: '1.1rem', color: '#ff007b', fontWeight: 'bold', display: 'block' }}>JOIN MATCH</label>
            <input
              id="multiplayer-room-code-input"
              type="text"
              placeholder="PASTE PRIVATE INVITATION..."
              value={joinRoomId}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setJoinRoomId(e.target.value.trim())}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && joinRoomId) {
                  e.preventDefault();
                  audioEngine.play('confirm', settings);
                  try {
                    await useMultiplayerStore.getState().joinByRoomId(joinRoomId, { fighterId: selected });
                  } catch (err) {
                    console.error('Failed to join room', err);
                  }
                }
              }}
              style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.8)', color: '#fff', border: '2px solid #7000ff', borderRadius: '4px', fontFamily: 'monospace', fontSize: '1.1rem', textAlign: 'center' }}
            />
            <button className="button" style={{ width: '100%' }} disabled={!joinRoomId} onClick={async () => {
              audioEngine.play('confirm', settings);
              try {
                await useMultiplayerStore.getState().joinByRoomId(joinRoomId, { fighterId: selected });
              } catch (err) {
                console.error('Failed to join room', err);
              }
            }}>JOIN MATCH</button>
          </div>
        </div>

        {multiplayerError && <p role="alert" style={{ margin: 0, color: '#ff819d', textAlign: 'center' }}>{multiplayerError}</p>}
      </div>}

      {multiplayerStatus === 'connecting' && <div className="multiplayer-lobby__loading" style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="canvas-fallback" style={{ position: 'relative', background: 'transparent' }}>
          <b>CONNECTING TO THE MATCHMAKER</b>
          <span>Synchronizing version protocols and secure sockets...</span>
        </div>
      </div>}

      {multiplayerStatus === 'error' && <div className="multiplayer-lobby__error" style={{ textAlign: 'center', padding: '3rem' }}>
        <h3 style={{ color: '#ff3b30' }}>CONNECTION ERROR</h3>
        <p>{gameServerEndpoint ? 'The invitation could not be used. Check that it includes a valid room ID and private seat ticket.' : 'The Cloudflare match service is not configured for this environment.'}</p>
        <button className="button" style={{ marginTop: '1.5rem' }} onClick={() => useMultiplayerStore.getState().disconnect()}>RETRY</button>
      </div>}

      {multiplayerStatus === 'connected' && (() => {
        const roster = [...multiplayerRoles.entries()].sort((a, b) => Number(a[1].slice(-1)) - Number(b[1].slice(-1)));
        const readyCount = roster.filter(([id]) => multiplayerConnectedPlayers.get(id) && multiplayerReadyPlayers.get(id)).length;
        const connectedCount = roster.filter(([id]) => multiplayerConnectedPlayers.get(id)).length;
        const canStart = multiplayerSessionId === multiplayerHostSessionId && connectedCount === 2 && readyCount === connectedCount;
        return <div className="multiplayer-lobby__connected" style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
          <div className="locker-room" style={{ background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span>ROOM MATCHMAKER</span>
              <b style={{ color: '#00ffaa' }}>CONNECTION ESTABLISHED</b>
              <small>Private match · host control follows the connected players.</small>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>ROOM ID · SHARE THE INVITE LINK</span>
              <strong data-testid="multiplayer-room-code" style={{ fontSize: '1.8rem', color: '#ff007b', letterSpacing: '4px', fontFamily: 'monospace' }}>{multiplayerRoomId}</strong>
              {multiplayerGuestInvites.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '.4rem', width: 'min(100%, 700px)', marginTop: '.5rem' }}>
                {multiplayerGuestInvites.map((invite, index) => <button key={invite} className="button button--quiet" aria-label={`Copy player ${index + 2} invitation`} onClick={async () => {
                  try { await navigator.clipboard.writeText(invite); }
                  catch { setMultiplayerError('Clipboard unavailable. Copy the invitation from the address bar after opening it.'); }
                }}>COPY SEAT {index + 2} LINK</button>)}
              </div>}
            </div>
          </div>

          <div aria-label="Room players and readiness" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '.75rem' }}>
            {roster.map(([id, role]) => {
              const fighterId = multiplayerFightersMap.get(id)?.definitionId as FighterId | undefined;
              const isConnected = multiplayerConnectedPlayers.get(id) === true;
              const isReady = multiplayerReadyPlayers.get(id) === true;
              const isHost = id === multiplayerHostSessionId;
              return <article key={id} aria-label={`${role.toUpperCase()} ${isConnected ? isReady ? 'READY' : 'WAITING' : 'OPEN SEAT'}`} style={{ padding: '1rem', border: `1px solid ${isConnected && isReady ? '#baff37' : '#494255'}`, background: isConnected && isReady ? 'rgba(186,255,55,.1)' : 'rgba(5,5,12,.65)', borderRadius: 8 }}>
                <span style={{ color: isHost ? '#ffbe40' : '#b8b1c7', fontWeight: 800 }}>{role.toUpperCase()}{isHost ? ' · HOST' : ''}</span>
                <b style={{ display: 'block', fontSize: '1.1rem', marginTop: '.35rem' }}>{isConnected && fighterId ? fighterById(fighterId).name : 'OPEN SEAT'}</b>
                <strong style={{ display: 'block', marginTop: '.25rem', color: isConnected && isReady ? '#caff49' : '#ff9dba' }}>{!isConnected ? 'WAITING FOR PLAYER' : isReady ? 'READY TO FIGHT' : 'WAITING · NOT READY'}</strong>
              </article>;
            })}
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            {multiplayerMyRole && multiplayerSessionId === multiplayerHostSessionId && multiplayerRoomPhase === 'lobby' && <label>HOST RULESET · changing it hands host control to your rival{' '}
              <select aria-label="Host ruleset" value={multiplayerRuleset} onChange={event => {
                const next = event.target.value as Ruleset; setRules(next);
                useMultiplayerStore.getState().updateRoomSettings(next);
              }}><option value="standard">STANDARD</option><option value="chaos">CHAOS</option></select>
            </label>}
            {multiplayerMyRole && multiplayerMyRole !== 'spectator' && multiplayerSessionId !== multiplayerHostSessionId && <div style={{ display: 'flex', gap: '1.5rem' }}>
              <button className="button" onClick={() => {
                const currentIndex = FIGHTERS.findIndex(f => f.id === selected);
                const nextFighterObj = FIGHTERS[(currentIndex + 1) % FIGHTERS.length];
                const nextFighter = nextFighterObj ? nextFighterObj.id : 'atlas';
                setSelected(nextFighter);
                useMultiplayerStore.getState().selectFighter(nextFighter);
                audioEngine.play('menu', settings);
              }}>CHANGE FIGHTER</button>
              <button className="button button--hero" onClick={() => {
                useMultiplayerStore.getState().setReady(!multiplayerReadyPlayers.get(multiplayerSessionId));
                audioEngine.play('confirm', settings);
              }}>{multiplayerReadyPlayers.get(multiplayerSessionId) ? 'READY · CLICK TO WAIT' : 'READY TO FIGHT'}</button>
            </div>}
            {multiplayerSessionId === multiplayerHostSessionId && <div style={{ display: 'grid', justifyItems: 'center', gap: '.5rem' }}>
              <strong style={{ color: canStart ? '#caff49' : '#ffbe40' }}>READY · {readyCount}/{connectedCount} CONNECTED PLAYERS</strong>
              {connectedCount > 2 && <span role="status">The current live match engine is singles only; this room cannot start with more than two connected wrestlers yet.</span>}
              <button className="button button--hero" disabled={!canStart} onClick={() => useMultiplayerStore.getState().startMatch()}>START MATCH</button>
            </div>}
            {multiplayerMyRole === 'spectator' && <p style={{ color: '#aaa', fontStyle: 'italic' }}>You are spectating this room lobby.</p>}
          </div>

          <section aria-label="Lobby chat" style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,.5)', border: '1px solid #383044', borderRadius: 8 }}>
            <h3>LOCKER ROOM CHAT</h3>
            <div aria-live="polite" style={{ minHeight: '5rem', maxHeight: '10rem', overflowY: 'auto', display: 'grid', alignContent: 'start', gap: '.35rem', marginBottom: '.75rem' }}>
              {multiplayerChat.length === 0 ? <span style={{ color: '#999' }}>No messages yet. Say something to the room.</span> : multiplayerChat.map((entry, index) => <p key={`${entry.timestamp}-${index}`} style={{ margin: 0 }}><b>{multiplayerRoles.get(entry.sessionId)?.toUpperCase() ?? 'PLAYER'}:</b> {entry.text}</p>)}
            </div>
            <form style={{ display: 'flex', gap: '.5rem' }} onSubmit={event => { event.preventDefault(); const text = lobbyChatText.trim(); if (text) { useMultiplayerStore.getState().sendLobbyChat(text); setLobbyChatText(''); } }}>
              <input aria-label="Lobby chat message" maxLength={240} value={lobbyChatText} onChange={event => setLobbyChatText(event.target.value)} placeholder="Message the room" style={{ flex: 1, minWidth: 0, padding: '.7rem', color: '#fff', background: '#111018', border: '1px solid #55446d', borderRadius: 4 }} />
              <button className="button" disabled={!lobbyChatText.trim()}>SEND</button>
            </form>
          </section>
        </div>;
      })()}

      <div className="button-row" style={{ marginTop: '2rem' }}>
        <button className="button button--quiet" onClick={() => {
          useMultiplayerStore.getState().disconnect();
          confirm('main');
        }}>RETURN TO MENU</button>
      </div>
    </section>}
    {screen === 'world' && <Suspense fallback={<ArenaLoading />}><WorldScene onEncounter={enterWorldBout} onExit={() => confirm('main')} /></Suspense>}
    {screen === 'match' && <section className="match-screen"><Suspense fallback={<ArenaLoading />}><GameScene onPause={togglePause} onDevice={setDevice} onFinished={finish} onlineRole={useMatchStore.getState().model.networkAuthority ? multiplayerMyRole : null} /></Suspense>{!toyTest && <><HUD device={device} paused={paused} />{settings.controlDeckMode !== 'hidden' && <Tutorial device={device} />}<MobileControls onPause={togglePause} paused={paused || replayActive} /><SpectatorControls /></>}{physicsLab && <Suspense fallback={null}><PhysicsLab /></Suspense>}{replayActive && <ReplayOverlay />}{paused && matchSettings && <div className="pause-overlay pause-overlay--settings"><Suspense fallback={null}><SettingsPanel onBack={() => setMatchSettings(false)} /></Suspense></div>}{paused && !matchSettings && <div className="pause-overlay"><Logo compact /><span>MATCH PAUSED</span><button className="button button--hero" onClick={togglePause}>RESUME</button><button className="button button--quiet" onClick={() => { setMatchSettings(true); }}>SETTINGS</button><button className="button button--quiet" onClick={() => { useMatchStore.getState().pause(false); useMatchStore.getState().setNetworkAuthority(false); void useMultiplayerStore.getState().disconnect(); setPaused(false); if (worldEncounter) returnToWorld(); else setScreen('main'); }}>{worldEncounter ? 'RETURN TO SHOWGROUND' : 'QUIT TO MENU'}</button></div>}</section>}
    {screen === 'results' && result && <Results result={result} winnerName={fighterById(useMatchStore.getState().model[result.winner].definitionId).name} onWorld={worldEncounter ? returnToWorld : undefined} onRematch={doRematch} onChange={() => { setWorldEncounter(null); setSelectionTarget('match'); confirm('select'); }} onMenu={() => { setWorldEncounter(null); confirm('main'); }} />}
  </main>;
}

export function ReplayOverlay() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === ' ') {
        event.preventDefault();
        useMatchStore.getState().stopReplay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return <div className="replay-overlay">
    <div className="sr-only" role="status" aria-live="polite">Instant replay playing: physical impact review. Press Escape or activate button to skip.</div>
    <span>FRWF INSTANT REPLAY</span>
    <b>PHYSICAL IMPACT REVIEW</b>
    <button type="button" aria-label="Skip instant replay (Escape key)" onClick={() => useMatchStore.getState().stopReplay()}>SKIP REPLAY</button>
  </div>;
}

export function BeerLocker({ fighterId, beers, onChange }: { fighterId: FighterId; beers: number; onChange: (value: number) => void }) {
  return <div className="locker-room">
    <div><span>LOCKER ROOM · FIVE-BEER ALLOTMENT</span><b aria-live="polite">{beers} / {BALANCE.stamina.beersPerFighter} DRUNK</b><small>Each beer adds {BALANCE.stamina.beerCapBoost} stamina for this match. {fighterId === 'chad' ? 'The Claw starts with the lowest gas tank—beer brings the brawl back.' : 'Unopened cans stay on the bench.'}</small></div>
    <div className="beer-cans" aria-label={`${beers} of five beers consumed`}>{Array.from({ length: BALANCE.stamina.beersPerFighter }, (_, index) => <i key={index} aria-hidden="true" className={index < beers ? 'beer beer--drunk' : 'beer'}>RF</i>)}</div>
    <div><button className="button button--quiet" disabled={beers === 0} aria-label={`Put one beer back (currently ${beers} of ${BALANCE.stamina.beersPerFighter} drunk)`} onClick={() => onChange(Math.max(0, beers - 1))}>PUT ONE BACK</button><button className="button" disabled={beers >= BALANCE.stamina.beersPerFighter} aria-label={`Drink a beer (currently ${beers} of ${BALANCE.stamina.beersPerFighter} drunk)`} onClick={() => onChange(Math.min(BALANCE.stamina.beersPerFighter, beers + 1))}>DRINK A BEER</button></div>
  </div>;
}

function Results({ result, winnerName, onRematch, onChange, onMenu, onWorld }: { result: NonNullable<ReturnType<typeof useMatchStore.getState>['model']['result']>; winnerName: string; onRematch: () => void; onChange: () => void; onMenu: () => void; onWorld?: () => void }) {
  const duration = `${Math.floor(result.duration / 60)}:${String(Math.floor(result.duration % 60)).padStart(2, '0')}`;
  const rows = useMemo(() => [['MATCH TIME', duration], ['DAMAGE DEALT', result.playerStats.damageDealt.toFixed(1)], ['COUNTERS', result.playerStats.counters], ['GRAPPLES', result.playerStats.grapples], ['FINISHERS', result.playerStats.finishers], ['NEAR FALLS', result.playerStats.nearFalls], ['PROP IMPACTS', result.playerStats.propImpacts]] as const, [duration, result]);
  const save = useWorldSession(s => s.save);
  const circuit = circuitProgress(save.results, save.medals);
  const medals = earnedMedals(result);
  const highlights = [['BEST SPOT', result.highlights.bestSpot], ['BEST SLAM', result.highlights.bestSlam], ['BRUTAL IMPACT', result.highlights.mostBrutalImpact], ['WILD REVERSAL', result.highlights.mostUnexpectedReversal]] as const;
  return <section className="results-screen"><div className="results-flare" /><span className="results-kicker">{venueFor(useMatchStore.getState().model).name.toUpperCase()} DECISION</span><h2>{winnerName}<small>WINS BY {result.method}</small></h2><div className={`grade grade--${result.grade}`}><span>HYPE RATING</span><b>{result.grade}</b><small>{Math.round(result.hype)} / 100</small></div><div aria-live="polite" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>Match decision: {winnerName} wins by {result.method}. Hype rating: {result.grade}.</div><div className="results-stats">{rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>{highlights.some(([, moment]) => moment !== null) && <div className="highlight-reel"><strong>MATCH HIGHLIGHT REEL</strong>{highlights.filter((entry) => entry[1] !== null).map(([label, moment]) => <div key={label}><span>{label}</span><b>{moment?.label}</b><small>{moment?.time.toFixed(1)}s · IMPACT {Math.round(moment?.score ?? 0)}</small></div>)}</div>}<div className="circuit-result">{onWorld && <><span>LOCAL CIRCUIT · {circuit.rank.toUpperCase()}</span><b>{circuit.reputation} REPUTATION</b><p>{medals.length ? CIRCUIT_OBJECTIVES.filter(o => medals.includes(o.id)).map(o => `★ ${o.label}`).join(" · ") : "Keep working the circuit. Completed bout recorded."}</p></>}</div><div className="button-row">{onWorld && <button className="button button--hero" onClick={onWorld}>RETURN TO SHOWGROUND</button>}<button className="button button--hero" onClick={onRematch}>INSTANT REMATCH</button><button className="button button--quiet" onClick={onChange}>CHANGE FIGHTER</button><button className="button button--quiet" onClick={onMenu}>MAIN MENU</button></div></section>;
}

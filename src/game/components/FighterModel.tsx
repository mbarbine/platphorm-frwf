import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { MutableRefObject } from 'react';
import { AdditiveBlending, Vector3 } from 'three';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { getPairedPose, getStrikePose, getStrikeReactionPose, getTauntPose } from '../animation/choreography';
import { locomotionPresentation } from '../animation/locomotionPresentation';
import { resolveCombatOrientation } from '../animation/combatOrientation';
import { POSES } from '../animation/poses';
import { recoveryPose } from '../animation/recoveryMotion';
import { fighterById } from '../data/fighters';
import { getMove } from '../data/moves';
import { fighterVisual } from '../presentation/fighterVisuals';
import type { FighterVisualProfile } from '../presentation/fighterVisuals';
import type { FighterDetail } from '../presentation/presentationManifest';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import { authoredDeckPoseOwnsRoot, visiblePelvisDrop } from '../presentation/matPresentation';
import { strikeDriveProfile } from '../physics/strikeDynamics';
import type { AnimationKey, FighterDefinition, FighterId, FighterRuntime, FighterSlot } from '../types/game';

interface Props {
  runtime?: FighterRuntime;
  counterpart?: FighterRuntime;
  fighterId?: FighterId;
  preview?: boolean;
  side?: FighterSlot;
  reportAlignment?: boolean;
  detail?: FighterDetail;
}

type GroupRef = MutableRefObject<Group | null>;

interface PartProps {
  fighter: FighterDefinition;
  profile: FighterVisualProfile;
}

const SkinMaterial = ({ fighter, profile }: PartProps) => (
  <meshStandardMaterial color={fighter.palette.skin} roughness={profile.skinRoughness} metalness={.02} />
);

const GearMaterial = ({ fighter, profile, accent = false, dark = false }: PartProps & { accent?: boolean; dark?: boolean }) => (
  <meshStandardMaterial
    color={dark ? fighter.palette.secondary : accent ? fighter.palette.emissive : fighter.palette.primary}
    roughness={dark ? .58 : .34}
    metalness={dark ? .18 : profile.gearMetalness}
    emissive={accent ? fighter.palette.emissive : '#000000'}
    emissiveIntensity={accent ? .18 : 0}
  />
);

const ClothMaterial = ({ fighter, profile, secondary = false }: PartProps & { secondary?: boolean }) => (
  <meshStandardMaterial
    color={secondary ? fighter.palette.secondary : fighter.palette.primary}
    roughness={.82}
    metalness={Math.min(.08, profile.gearMetalness * .15)}
  />
);

function JointCover({ fighter, profile, scale = 1 }: PartProps & { scale?: number }) {
  return (
    <mesh scale={[.135 * scale, .125 * scale, .135 * scale]}>
      <sphereGeometry args={[1, 12, 8]} />
      <SkinMaterial fighter={fighter} profile={profile} />
    </mesh>
  );
}

function Hand({ fighter, profile, side, detailed }: PartProps & { side: -1 | 1; detailed: boolean }) {
  const taped = profile.attire === 'brawler' || profile.attire === 'roughneck';
  return (
    <group position={[0, -.58, .035]}>
      <mesh scale={[.145 * profile.armScale, .145, .16]}>
        <sphereGeometry args={[1, 12, 8]} />
        {taped ? <ClothMaterial fighter={fighter} profile={profile} secondary /> : <SkinMaterial fighter={fighter} profile={profile} />}
      </mesh>
      {detailed && [-.09, -.03, .03, .09].map((x) => (
        <mesh key={x} position={[x, -.095, .07]} rotation={[.16, 0, side * .025]}>
          <capsuleGeometry args={[.034, .12, 4, 7]} />
          {taped ? <ClothMaterial fighter={fighter} profile={profile} secondary /> : <SkinMaterial fighter={fighter} profile={profile} />}
        </mesh>
      ))}
      {detailed && <mesh position={[side * .16, -.01, .1]} rotation={[0, 0, side * .52]}>
        <capsuleGeometry args={[.045, .13, 4, 7]} />
        <SkinMaterial fighter={fighter} profile={profile} />
      </mesh>}
      <mesh position={[0, .14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[.16 * profile.armScale, .045, 7, 16]} />
        <GearMaterial fighter={fighter} profile={profile} accent={profile.attire === 'striker'} dark={profile.attire !== 'striker'} />
      </mesh>
    </group>
  );
}

function Arm({ fighter, profile, side, armRef, forearmRef, detailed }: PartProps & { side: -1 | 1; armRef: GroupRef; forearmRef: GroupRef; detailed: boolean }) {
  const shoulderX = side * fighter.physics.shoulderWidthM * .7;
  return (
    <group ref={armRef} position={[shoulderX, 1.83 * fighter.proportions.height, 0]}>
      <mesh position={[0, -.05, 0]} scale={[.16 * profile.armScale, .19, .175 * profile.armScale]}>
        <sphereGeometry args={[1, 14, 9]} />
        <SkinMaterial fighter={fighter} profile={profile} />
      </mesh>
      {profile.attire === 'conqueror' && (
        <mesh position={[side * .08, .04, -.01]} rotation={[0, 0, side * -.2]} scale={[.4, .13, .36]}>
          <sphereGeometry args={[1, 12, 7, 0, Math.PI * 2, 0, Math.PI * .58]} />
          <GearMaterial fighter={fighter} profile={profile} accent />
        </mesh>
      )}
      <mesh position={[0, -.355, 0]} scale={[profile.armScale, 1, profile.armScale]}>
        <capsuleGeometry args={[.135, .58, 8, 14]} />
        <SkinMaterial fighter={fighter} profile={profile} />
      </mesh>
      <group position={[0, -.62, 0]}>
        <JointCover fighter={fighter} profile={profile} scale={profile.armScale} />
        {(profile.attire === 'technician' || profile.attire === 'brawler') && (
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, .8]}>
            <torusGeometry args={[.18 * profile.armScale, .055, 7, 16]} />
            <GearMaterial fighter={fighter} profile={profile} dark />
          </mesh>
        )}
      </group>
      <group ref={forearmRef} position={[0, -.64, 0]}>
        <mesh position={[0, -.28, 0]} scale={[profile.armScale, 1, profile.armScale]}>
          <capsuleGeometry args={[.12, .46, 8, 14]} />
          <SkinMaterial fighter={fighter} profile={profile} />
        </mesh>
        <mesh position={[0, -.47, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[.125 * profile.armScale, .035, 7, 14]} />
          <GearMaterial fighter={fighter} profile={profile} dark />
        </mesh>
        <Hand fighter={fighter} profile={profile} side={side} detailed={detailed} />
      </group>
    </group>
  );
}

function Boot({ fighter, profile }: PartProps) {
  return (
    <group position={[0, -.66, .13]} scale={[profile.bootScale, 1, profile.bootScale]}>
      <mesh position={[0, .06, -.07]} scale={[.25, .25, .23]}>
        <sphereGeometry args={[1, 12, 8]} />
        <GearMaterial fighter={fighter} profile={profile} dark />
      </mesh>
      <mesh position={[0, -.06, .13]} scale={[.25, .17, .42]}>
        <sphereGeometry args={[1, 14, 8]} />
        <GearMaterial fighter={fighter} profile={profile} dark />
      </mesh>
      <mesh position={[0, -.175, .15]} scale={[.27, .045, .45]}>
        <sphereGeometry args={[1, 12, 7]} />
        <meshStandardMaterial color={profile.soleColor} roughness={.7} metalness={.18} />
      </mesh>
      {profile.attire === 'striker' && (
        <mesh position={[0, .05, .18]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[.18, .035, 6, 14]} />
          <GearMaterial fighter={fighter} profile={profile} accent />
        </mesh>
      )}
    </group>
  );
}

function Leg({ fighter, profile, side, legRef, shinRef }: PartProps & { side: -1 | 1; legRef: GroupRef; shinRef: GroupRef }) {
  const x = side * fighter.physics.hipWidthM * .56;
  const trunks = profile.attire === 'technician' || profile.attire === 'striker';
  return (
    <group ref={legRef} position={[x, .86 * fighter.proportions.height, 0]}>
      <mesh position={[0, -.13, 0]} scale={[.17 * profile.thighScale, .2, .18 * profile.thighScale]}>
        <sphereGeometry args={[1, 13, 8]} />
        {trunks ? <ClothMaterial fighter={fighter} profile={profile} /> : <SkinMaterial fighter={fighter} profile={profile} />}
      </mesh>
      <mesh position={[0, -.405, 0]} scale={[profile.thighScale, 1, profile.thighScale]}>
        <capsuleGeometry args={[.15, .56, 8, 14]} />
        <SkinMaterial fighter={fighter} profile={profile} />
      </mesh>
      <group position={[0, -.68, 0]}>
        <JointCover fighter={fighter} profile={profile} scale={profile.thighScale} />
        <mesh position={[0, .015, .135]} scale={[.14 * profile.thighScale, .1, .065]}>
          <sphereGeometry args={[1, 11, 7]} />
          <GearMaterial fighter={fighter} profile={profile} dark />
        </mesh>
      </group>
      <group ref={shinRef} position={[0, -.69, 0]}>
        <mesh position={[0, -.315, 0]} scale={[profile.calfScale, 1, profile.calfScale]}>
          <capsuleGeometry args={[.125, .5, 8, 14]} />
          {profile.attire === 'conqueror' || profile.attire === 'roughneck'
            ? <ClothMaterial fighter={fighter} profile={profile} secondary />
            : <SkinMaterial fighter={fighter} profile={profile} />}
        </mesh>
        <mesh position={[0, -.48, .115]} scale={[.125 * profile.calfScale, .19, .055]}>
          <sphereGeometry args={[1, 12, 8]} />
          <GearMaterial fighter={fighter} profile={profile} accent={profile.attire === 'technician'} dark={profile.attire !== 'technician'} />
        </mesh>
        <Boot fighter={fighter} profile={profile} />
      </group>
    </group>
  );
}

function Headwear({ fighter, profile }: PartProps) {
  if (profile.hair === 'crownFade') {
    return (
      <group position={[0, .3, -.025]}>
        <mesh scale={[.31, .12, .29]}>
          <sphereGeometry args={[1, 14, 8, 0, Math.PI * 2, 0, Math.PI * .55]} />
          <meshStandardMaterial color={profile.hairColor} roughness={.9} />
        </mesh>
        {[-.2, 0, .2].map((x) => (
          <mesh key={x} position={[x, .16 + (x === 0 ? .06 : 0), 0]} rotation={[0, 0, x * .8]}>
            <coneGeometry args={[.075, .25, 7]} />
            <GearMaterial fighter={fighter} profile={profile} accent />
          </mesh>
        ))}
      </group>
    );
  }
  if (profile.hair === 'voltHawk') {
    return (
      <group position={[0, .34, -.02]}>
        {[-.18, -.06, .06, .18].map((z, index) => (
          <mesh key={z} position={[0, index % 2 === 0 ? .08 : .12, z]} rotation={[z * .5, 0, 0]}>
            <coneGeometry args={[.075, .3, 7]} />
            <meshStandardMaterial color={profile.hairColor} emissive={fighter.palette.emissive} emissiveIntensity={.22} roughness={.55} />
          </mesh>
        ))}
      </group>
    );
  }
  if (profile.hair === 'fangMask') {
    return (
      <group position={[0, .02, .315]}>
        <mesh scale={[.34, .28, .055]}>
          <sphereGeometry args={[1, 14, 9]} />
          <GearMaterial fighter={fighter} profile={profile} dark />
        </mesh>
        <mesh position={[-.16, -.18, .045]} rotation={[0, 0, -.18]}>
          <coneGeometry args={[.045, .18, 6]} />
          <GearMaterial fighter={fighter} profile={profile} accent />
        </mesh>
        <mesh position={[.16, -.18, .045]} rotation={[0, 0, .18]}>
          <coneGeometry args={[.045, .18, 6]} />
          <GearMaterial fighter={fighter} profile={profile} accent />
        </mesh>
      </group>
    );
  }
  if (profile.hair === 'bandana') {
    return (
      <group position={[0, .24, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[.31, .06, 8, 22]} />
          <ClothMaterial fighter={fighter} profile={profile} />
        </mesh>
        <mesh position={[-.31, -.04, -.16]} rotation={[0, 0, -.65]}>
          <capsuleGeometry args={[.045, .28, 5, 8]} />
          <ClothMaterial fighter={fighter} profile={profile} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[0, .29, -.02]} scale={[.35, .14, .33]}>
        <sphereGeometry args={[1, 14, 8, 0, Math.PI * 2, 0, Math.PI * .62]} />
        <meshStandardMaterial color={profile.hairColor} roughness={.94} />
      </mesh>
      <mesh position={[0, .03, -.29]} scale={[.32, .4, .12]}>
        <sphereGeometry args={[1, 13, 9]} />
        <meshStandardMaterial color={profile.hairColor} roughness={.94} />
      </mesh>
      <mesh position={[0, -.2, .28]} scale={[.25, .17, .055]}>
        <sphereGeometry args={[1, 12, 7]} />
        <meshStandardMaterial color={profile.hairColor} roughness={.94} />
      </mesh>
    </group>
  );
}

function Face({ fighter, profile, browLeft, browRight, mouth }: PartProps & { browLeft: GroupRef; browRight: GroupRef; mouth: GroupRef }) {
  return (
    <group position={[0, .02, .31]}>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * .125, .075, .012]}>
          <mesh scale={[.075, .045, .035]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#f4f0e9" roughness={.35} emissive={fighter.palette.emissive} emissiveIntensity={.08} />
          </mesh>
          <mesh position={[0, 0, .032]} scale={[.03, .033, .025]}>
            <sphereGeometry args={[1, 10, 7]} />
            <meshStandardMaterial color={profile.eyeColor} roughness={.3} emissive={profile.eyeColor} emissiveIntensity={.18} />
          </mesh>
          <mesh position={[0, 0, .052]} scale={[.014, .017, .014]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color="#050407" />
          </mesh>
        </group>
      ))}
      <group ref={browLeft} position={[-.125, .16, .045]}>
        <mesh scale={[.105, .018, .022]}><sphereGeometry args={[1, 10, 6]} /><meshStandardMaterial color={profile.browColor} roughness={.86} /></mesh>
      </group>
      <group ref={browRight} position={[.125, .16, .045]}>
        <mesh scale={[.105, .018, .022]}><sphereGeometry args={[1, 10, 6]} /><meshStandardMaterial color={profile.browColor} roughness={.86} /></mesh>
      </group>
      <mesh position={[0, -.005, .065]} rotation={[Math.PI / 2, 0, 0]} scale={[.065, .12, .065]}>
        <coneGeometry args={[1, 1, 8]} />
        <SkinMaterial fighter={fighter} profile={profile} />
      </mesh>
      <group ref={mouth} position={[0, -.14, .068]}>
        <mesh scale={[.105, .018, .022]}>
          <sphereGeometry args={[1, 12, 6]} />
          <meshStandardMaterial color={fighter.id === 'chad' ? '#3b2018' : '#5a1831'} roughness={.7} />
        </mesh>
      </group>
    </group>
  );
}

function Head({ fighter, profile, headRef, browLeft, browRight, mouth, detailed }: PartProps & { headRef: GroupRef; browLeft: GroupRef; browRight: GroupRef; mouth: GroupRef; detailed: boolean }) {
  return (
    <group ref={headRef} position={[0, 2.25 * fighter.proportions.height, 0]}>
      <mesh position={[0, -.31, 0]} scale={[.15 * fighter.proportions.width, .22, .15 * fighter.proportions.width]}>
        <capsuleGeometry args={[1, 1, 7, 11]} />
        <SkinMaterial fighter={fighter} profile={profile} />
      </mesh>
      <mesh scale={[.34 * profile.headScale[0], .39 * profile.headScale[1], .33 * profile.headScale[2]]}>
        <sphereGeometry args={[1, 16, 11]} />
        <SkinMaterial fighter={fighter} profile={profile} />
      </mesh>
      <mesh position={[0, -.22, .035]} scale={[.27 * profile.headScale[0], .18, .26 * profile.headScale[2]]}>
        <sphereGeometry args={[1, 14, 9]} />
        <SkinMaterial fighter={fighter} profile={profile} />
      </mesh>
      {detailed && [-1, 1].map((earSide) => <mesh key={earSide} position={[earSide * .335 * profile.headScale[0], .015, 0]} scale={[.055, .09, .045]}><sphereGeometry args={[1, 10, 7]} /><SkinMaterial fighter={fighter} profile={profile} /></mesh>)}
      <Face fighter={fighter} profile={profile} browLeft={browLeft} browRight={browRight} mouth={mouth} />
      <Headwear fighter={fighter} profile={profile} />
    </group>
  );
}

function TorsoGear({ fighter, profile }: PartProps) {
  if (profile.attire === 'conqueror') {
    return (
      <group>
        <mesh position={[0, .14, .29]} scale={[.39, .24, .055]}><sphereGeometry args={[1, 13, 8]} /><GearMaterial fighter={fighter} profile={profile} dark /></mesh>
        <mesh position={[0, -.31, .31]} scale={[.35, .08, .045]}><sphereGeometry args={[1, 12, 7]} /><GearMaterial fighter={fighter} profile={profile} accent /></mesh>
        {[-.18, .18].map((x) => <mesh key={x} position={[x, .13, .34]} rotation={[0, 0, x * -1.5]}><capsuleGeometry args={[.035, .46, 5, 8]} /><GearMaterial fighter={fighter} profile={profile} accent /></mesh>)}
      </group>
    );
  }
  if (profile.attire === 'striker') {
    return (
      <group position={[0, .05, .3]}>
        <mesh rotation={[0, 0, -.55]}><capsuleGeometry args={[.045, .62, 5, 9]} /><GearMaterial fighter={fighter} profile={profile} accent /></mesh>
        <mesh position={[.13, -.05, .02]} rotation={[0, 0, -.55]}><capsuleGeometry args={[.025, .34, 5, 8]} /><GearMaterial fighter={fighter} profile={profile} accent /></mesh>
      </group>
    );
  }
  if (profile.attire === 'technician') {
    return (
      <group position={[0, .06, .31]}>
        <mesh scale={[.33, .25, .045]}><sphereGeometry args={[1, 13, 8]} /><ClothMaterial fighter={fighter} profile={profile} secondary /></mesh>
        <mesh scale={[.22, .17, .06]}><torusGeometry args={[1, .18, 7, 18]} /><GearMaterial fighter={fighter} profile={profile} accent /></mesh>
      </group>
    );
  }
  if (profile.attire === 'brawler') {
    return (
      <group>
        <mesh position={[-.18, .03, .31]} rotation={[0, 0, -.12]}><capsuleGeometry args={[.05, .66, 5, 9]} /><ClothMaterial fighter={fighter} profile={profile} /></mesh>
        <mesh position={[.18, .03, .31]} rotation={[0, 0, .12]}><capsuleGeometry args={[.05, .66, 5, 9]} /><ClothMaterial fighter={fighter} profile={profile} /></mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[-.2, .03, .315]} rotation={[0, 0, -.08]}><capsuleGeometry args={[.035, .7, 5, 9]} /><meshStandardMaterial color="#d7b17a" metalness={.34} roughness={.56} /></mesh>
      <mesh position={[.2, .03, .315]} rotation={[0, 0, .08]}><capsuleGeometry args={[.035, .7, 5, 9]} /><meshStandardMaterial color="#d7b17a" metalness={.34} roughness={.56} /></mesh>
      <mesh position={[0, -.06, .33]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.23, .022, 6, 22]} /><meshStandardMaterial color="#754c2d" roughness={.8} /></mesh>
    </group>
  );
}

function Body({ fighter, profile, torsoRef }: PartProps & { torsoRef: GroupRef }) {
  const width = fighter.proportions.width;
  const height = fighter.proportions.height;
  const shoulderWidth = fighter.physics.shoulderWidthM;
  const hipWidth = fighter.physics.hipWidthM;
  return (
    <>
      <group ref={torsoRef} position={[0, 1.52 * height, 0]}>
        <mesh position={[0, .43, -.015]} rotation={[0, 0, Math.PI / 2]} scale={[1, shoulderWidth * 1.25, 1]}>
          <capsuleGeometry args={[.145, .78, 7, 14]} />
          <SkinMaterial fighter={fighter} profile={profile} />
        </mesh>
        <mesh position={[0, .25, 0]} scale={[.84 * shoulderWidth, .43, .25 * width]}>
          <sphereGeometry args={[1, 16, 10]} />
          <SkinMaterial fighter={fighter} profile={profile} />
        </mesh>
        <mesh position={[0, -.1, 0]} scale={[.92 * hipWidth, .36, .22 * width]}>
          <sphereGeometry args={[1, 15, 9]} />
          <SkinMaterial fighter={fighter} profile={profile} />
        </mesh>
        <TorsoGear fighter={fighter} profile={profile} />
      </group>
      <group position={[0, 1.02 * height, 0]}>
        <mesh scale={[hipWidth, .23, .26 * width]}>
          <sphereGeometry args={[1, 15, 9]} />
          <ClothMaterial fighter={fighter} profile={profile} secondary />
        </mesh>
        <mesh position={[0, .18, .02]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, .8]}>
          <torusGeometry args={[hipWidth * .88, .05, 8, 24]} />
          <GearMaterial fighter={fighter} profile={profile} accent={profile.attire === 'conqueror' || profile.attire === 'technician'} dark={profile.attire !== 'conqueror' && profile.attire !== 'technician'} />
        </mesh>
        {profile.attire === 'conqueror' && (
          <mesh position={[0, .18, .31 * width]} scale={[.13, .09, .045]}>
            <octahedronGeometry args={[1, 0]} />
            <GearMaterial fighter={fighter} profile={profile} accent />
          </mesh>
        )}
      </group>
    </>
  );
}

function animationFor(runtime: FighterRuntime | undefined, preview: boolean): AnimationKey {
  if (preview) return 'taunt';
  if (!runtime) return 'combatIdle';
  if (runtime.moveId) {
    const move = getMove(runtime.moveId);
    return move.category === 'grapple' && runtime.attackPhase === 'anticipation' && runtime.phaseElapsed < move.anticipationDuration * .45
      ? 'grappleEntry'
      : move.animationKey;
  }
  // OPTIMIZATION: Replacing Math.hypot with a zero-allocation squared magnitude comparison to avoid slow square root computations entirely.
  if (runtime.state === 'locomotion') {
    const vx = runtime.velocity.x;
    const vz = runtime.velocity.z;
    return (vx * vx + vz * vz) > 14.44 ? 'run' : 'walk'; // 3.8 * 3.8 = 14.44
  }
  if (runtime.state === 'blocking') return 'block';
  if (runtime.state === 'jumping') return 'aerial';
  if (runtime.state === 'climbing') return 'climb';
  if (runtime.state === 'grabbed' || runtime.state === 'staggered') return 'stagger';
  if (runtime.state === 'airborne') return 'knockdown';
  if (runtime.state === 'downed') return 'downed';
  if (runtime.state === 'recovering') return 'recovery';
  if (runtime.state === 'pinning') return 'pin';
  if (runtime.state === 'pinned') return 'kickout';
  if (runtime.state === 'victorious') return 'victory';
  if (runtime.state === 'defeated') return 'defeat';
  return 'combatIdle';
}

export function FighterModel({ runtime, counterpart, fighterId, preview = false, side = 'player', reportAlignment = true, detail = 'full' }: Props) {
  const id = runtime?.definitionId ?? fighterId ?? 'atlas';
  const fighter = fighterById(id);
  const profile = fighterVisual(id);
  const root = useRef<Group>(null);
  const shell = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftForearm = useRef<Group>(null);
  const rightForearm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftShin = useRef<Group>(null);
  const rightShin = useRef<Group>(null);
  const browLeft = useRef<Group>(null);
  const browRight = useRef<Group>(null);
  const mouth = useRef<Group>(null);
  const flash = useRef<Mesh>(null);
  const motionTrail = useRef<Mesh>(null);
  const previousHealth = useRef(runtime?.health ?? 100);
  const elapsed = useRef(0);
  const presentationInitialized = useRef(false);
  const previousRuntimeState = useRef(runtime?.state ?? null);
  const trailAttackId = useRef(-1);
  const trailSource = useRef<string | null>(null);
  const trailVectors = useRef({
    current: new Vector3(), previous: new Vector3(), localCurrent: new Vector3(), localPrevious: new Vector3(), midpoint: new Vector3(), direction: new Vector3(), up: new Vector3(0, 1, 0),
  });
  const alignmentPoints = useRef({
    pelvis: new Vector3(), chest: new Vector3(), head: new Vector3(), leftHand: new Vector3(), rightHand: new Vector3(), leftFoot: new Vector3(), rightFoot: new Vector3(),
  });
  const phaseOffset = side === 'player' ? 0 : Math.PI;
  const width = fighter.proportions.width;
  const height = fighter.proportions.height;
  const isFiniteNumber = (value: unknown): value is number => Number.isFinite(value as number);
  const safeNumber = (value: unknown, fallback: number): number => isFiniteNumber(value) ? value : fallback;

  useFrame((_, delta) => {
    // Clamp delta time to protect against sudden frame drops, preventing presentation spikes and teleportation
    const clampedDelta = Math.min(delta, 0.1);
    elapsed.current += clampedDelta;
    if (!shell.current || !root.current || !torso.current || !head.current || !leftArm.current || !rightArm.current || !leftForearm.current || !rightForearm.current || !leftLeg.current || !rightLeg.current || !leftShin.current || !rightShin.current) return;
    const t = elapsed.current;
    const movement = runtime ? locomotionPresentation(runtime) : null;
    const combatOrientation = runtime ? resolveCombatOrientation(runtime, counterpart) : null;
    let key = animationFor(runtime, preview);
    if (movement?.state === 'braking') key = 'walk';
    let animatedPose = POSES[key];
    if (movement && ['walk', 'run'].includes(key)) {
      const runningPose = movement.state === 'run';
      const guardLift = (profile.guardHeight - 1) * .7;
      animatedPose = {
        ...POSES.combatIdle,
        torso: [runningPose ? .18 : movement.state === 'backward' ? -.035 : .055, movement.lateral * -.055, movement.lateral * -.045],
        leftArm: [runningPose ? -.28 : -.54 - guardLift, 0, -.32], rightArm: [runningPose ? -.28 : -.58 - guardLift, 0, .32],
        leftForearm: [runningPose ? -.7 : -.94, 0, -.12], rightForearm: [runningPose ? -.7 : -1.02, 0, .12],
        rootTilt: runningPose ? .14 : movement.state === 'braking' ? -.075 : movement.state === 'backward' ? -.035 : .035,
        rootRoll: movement.lateral * -.055,
      };
    }
    if (runtime && (runtime.state === 'downed' || runtime.state === 'recovering')) animatedPose = recoveryPose(runtime.recoveryOrientation, runtime.state, runtime.stateElapsed);
    if (runtime?.moveId) {
      const move = getMove(runtime.moveId);
      animatedPose = move.id === 'taunt'
        ? getTauntPose(runtime.definitionId, move, runtime.attackPhase, runtime.phaseElapsed)
        : getPairedPose(move, 'actor', runtime.attackPhase, runtime.phaseElapsed, runtime.definitionId) ?? getStrikePose(move, runtime.attackPhase, runtime.phaseElapsed) ?? animatedPose;
    }
    let pairedVictim = false;
    if (runtime && counterpart?.moveId && ['grabbed', 'airborne', 'downed', 'staggered'].includes(runtime.state)) {
      const holdingMove = getMove(counterpart.moveId);
      const pairedPose = getPairedPose(holdingMove, 'victim', counterpart.attackPhase, counterpart.phaseElapsed, counterpart.definitionId);
      pairedVictim = pairedPose !== null;
      animatedPose = pairedPose ?? getStrikeReactionPose(holdingMove, counterpart.attackPhase, counterpart.phaseElapsed) ?? animatedPose;
    }

    const runtimeStamina = runtime ? safeNumber(runtime.stamina, 0) : 0;
    const runtimeStaminaCap = runtime ? safeNumber(runtime.staminaCap, 1) : 1;
    const fatigue = runtime ? Math.max(0, 1 - runtimeStamina / Math.max(1, runtimeStaminaCap)) : 0;
    const tempo = profile.motionTempo * (key === 'run' ? 1.18 : 1);
    // OPTIMIZATION: Replacing Math.hypot with standard Math.sqrt to prevent CPU-intensive dynamic scaling logic.
    let movementSpeed = 0;
    if (runtime) {
      const vx = safeNumber(runtime.velocity?.x, 0);
      const vz = safeNumber(runtime.velocity?.z, 0);
      movementSpeed = Math.sqrt(vx * vx + vz * vz);
    }
    const speedScale = key === 'run' ? Math.min(1.35, .85 + movementSpeed * .07) : 1;
    const poseResponse = runtime?.attackPhase === 'active' ? 38 : runtime?.attackPhase === 'anticipation' ? 21 : runtime?.attackPhase === 'recovery' ? 11 : 14 * profile.motionTempo;
    const smooth = 1 - Math.exp(-clampedDelta * poseResponse);
    const idle = ['combatIdle', 'idle', 'taunt'].includes(key);
    const groundedBob = idle
      ? Math.sin(t * 2.25 * tempo + phaseOffset) * .022 * profile.stepWeight
      : Math.abs(Math.sin(t * 6.8 * tempo * speedScale + phaseOffset)) * .035 * profile.stepWeight;
    const breath = Math.sin(t * 2.05 * tempo + phaseOffset) * (.012 + fatigue * .02);
    const personalityRoll = idle ? Math.sin(t * 1.4 * tempo + phaseOffset) * .018 * (id === 'vex' ? 1.5 : 1) : 0;
    const muscle = safeNumber(runtime?.body?.muscle, 1);
    const pelvisDrop = visiblePelvisDrop(runtime);
    // Rapier owns the shell lift. Preserve enough of the paired performance
    // pose to make the carried body visibly clear the mat, while keeping the
    // impact/downed offsets shallow so the visual rig cannot sink through it.
    const authoredRootY = pairedVictim
      ? animatedPose.rootY * (animatedPose.rootY > 0 ? .58 : .22)
      : animatedPose.rootY;

    root.current.position.x += (animatedPose.rootX - root.current.position.x) * smooth;
    root.current.position.y += ((authoredRootY + groundedBob - pelvisDrop) - root.current.position.y) * smooth;
    root.current.position.z += (animatedPose.rootZ - root.current.position.z) * smooth;
    const locomotionLean = movement && ['idle', 'forward', 'backward', 'strafe-left', 'strafe-right', 'diagonal', 'run', 'braking'].includes(movement.state);
    const physicalForwardLean = safeNumber(runtime?.body?.leanForward, 0);
    const physicalSideLean = safeNumber(runtime?.body?.leanSide, 0);
    if (side === 'player') {
      document.documentElement.dataset.playerLeanForward = physicalForwardLean.toFixed(3);
      document.documentElement.dataset.playerLeanSide = physicalSideLean.toFixed(3);
    }
    const authoredDeckRoot = authoredDeckPoseOwnsRoot(runtime);
    const visibleForwardLean = authoredDeckRoot ? 0 : locomotionLean ? Math.max(-.18, Math.min(.24, physicalForwardLean)) : physicalForwardLean;
    const visibleSideLean = authoredDeckRoot ? 0 : locomotionLean ? Math.max(-.14, Math.min(.14, physicalSideLean)) : physicalSideLean;
    const completedRecovery = previousRuntimeState.current === 'recovering' && runtime?.state === 'idle';
    if (completedRecovery) {
      // At low frame rates the final interpolated kneel could otherwise remain
      // visible after controls had already unlocked.
      root.current.rotation.x = animatedPose.rootTilt + visibleForwardLean + fatigue * profile.fatigueDroop * .09;
      root.current.rotation.z = animatedPose.rootRoll + visibleSideLean + personalityRoll;
    }
    root.current.rotation.x += (animatedPose.rootTilt + visibleForwardLean + fatigue * profile.fatigueDroop * .09 - root.current.rotation.x) * smooth;
    root.current.rotation.y += (animatedPose.rootYaw - root.current.rotation.y) * smooth;
    root.current.rotation.z += (animatedPose.rootRoll + visibleSideLean + personalityRoll - root.current.rotation.z) * smooth;
    previousRuntimeState.current = runtime?.state ?? null;

    const apply = (group: Group, rx: number, ry: number, rz: number, droop = 0): void => {
      group.rotation.x += (rx + droop - group.rotation.x) * smooth;
      group.rotation.y += (ry - group.rotation.y) * smooth;
      group.rotation.z += (rz - group.rotation.z) * smooth;
    };
    apply(
      torso.current,
      animatedPose.torso[0] + breath + fatigue * .06,
      animatedPose.torso[1] + safeNumber(runtime?.body?.twist, 0) * .34 + (combatOrientation?.torsoYaw ?? 0),
      animatedPose.torso[2],
    );
    apply(
      head.current,
      safeNumber(runtime?.body?.headSnap, 0) * .55 + fatigue * .06,
      -safeNumber(runtime?.body?.twist, 0) * .18 + (combatOrientation?.headYaw ?? 0),
      safeNumber(runtime?.body?.headSnap, 0) * .24,
    );
    const armDroop = idle ? fatigue * profile.fatigueDroop * .34 : 0;
    const gaitCycle = runtime ? safeNumber(runtime.body?.gaitPhase, t * 3) : t * 3;
    const gaitStrength = movement ? safeNumber(movement.gaitStrength, 0) : 0;
    const gaitForward = movement ? safeNumber(movement.forward, 0) : 0;
    const armSwing = movement && movement.state === 'run' ? Math.sin(gaitCycle) * gaitStrength * .68
      : movement && gaitForward > .35 ? Math.sin(gaitCycle) * gaitStrength * .18 : 0;
    apply(leftArm.current, animatedPose.leftArm[0] + armSwing, animatedPose.leftArm[1], animatedPose.leftArm[2], armDroop);
    apply(rightArm.current, animatedPose.rightArm[0] - armSwing, animatedPose.rightArm[1], animatedPose.rightArm[2], armDroop);
    apply(leftForearm.current, animatedPose.leftForearm[0] + (1 - muscle) * .34, animatedPose.leftForearm[1], animatedPose.leftForearm[2]);
    apply(rightForearm.current, animatedPose.rightForearm[0] + (1 - muscle) * .34, animatedPose.rightForearm[1], animatedPose.rightForearm[2]);

    const stride = safeNumber(runtime?.body?.stride, 0);
    const gaitBoost = key === 'run' ? 1.15 : key === 'walk' ? .82 : 1;
    const forwardFactor = movement ? Math.abs(movement.forward) < .16 ? 0 : Math.sign(movement.forward) * Math.max(.35, Math.abs(movement.forward)) : 1;
    const lateralFactor = movement?.lateral ?? 0;
    const leftFootPhase = safeNumber(runtime?.body?.leftFoot?.phase, 0);
    const rightFootPhase = safeNumber(runtime?.body?.rightFoot?.phase, Math.PI);
    const leftCycle = runtime ? Math.sin(leftFootPhase) : 0; const rightCycle = runtime ? Math.sin(rightFootPhase) : 0;
    const leftSwing = leftCycle * stride * .48 * gaitBoost * forwardFactor;
    const rightSwing = rightCycle * stride * .48 * gaitBoost * forwardFactor;
    const leftStrafe = leftCycle * stride * .28 * lateralFactor; const rightStrafe = rightCycle * stride * .28 * lateralFactor;
    apply(leftLeg.current, animatedPose.leftLeg[0] - leftSwing + (1 - muscle) * .08, animatedPose.leftLeg[1], animatedPose.leftLeg[2] + leftStrafe);
    apply(rightLeg.current, animatedPose.rightLeg[0] - rightSwing + (1 - muscle) * .08, animatedPose.rightLeg[1], animatedPose.rightLeg[2] + rightStrafe);
    apply(leftShin.current, animatedPose.leftShin[0] + Math.max(0, leftSwing) * .7 + (1 - muscle) * .22, animatedPose.leftShin[1], animatedPose.leftShin[2]);
    apply(rightShin.current, animatedPose.rightShin[0] + Math.max(0, rightSwing) * .7 + (1 - muscle) * .22, animatedPose.rightShin[1], animatedPose.rightShin[2]);

    if (runtime) {
      const leftFootLift = safeNumber(runtime.body.leftFoot.lift, 0);
      const rightFootLift = safeNumber(runtime.body.rightFoot.lift, 0);
      const leftFootOffsetX = safeNumber(runtime.body.leftFoot.offset?.x, 0);
      const leftFootOffsetZ = safeNumber(runtime.body.leftFoot.offset?.z, 0);
      const rightFootOffsetX = safeNumber(runtime.body.rightFoot.offset?.x, 0);
      const rightFootOffsetZ = safeNumber(runtime.body.rightFoot.offset?.z, 0);
      const facing = safeNumber(runtime?.facing, 0);
      leftLeg.current.position.y = .86 * height + leftFootLift;
      rightLeg.current.position.y = .86 * height + rightFootLift;
      const forwardX = Math.sin(facing); const forwardZ = Math.cos(facing); const rightX = Math.cos(facing); const rightZ = -Math.sin(facing);
      const leftLocalX = leftFootOffsetX * rightX + leftFootOffsetZ * rightZ;
      const leftLocalZ = leftFootOffsetX * forwardX + leftFootOffsetZ * forwardZ;
      const rightLocalX = rightFootOffsetX * rightX + rightFootOffsetZ * rightZ;
      const rightLocalZ = rightFootOffsetX * forwardX + rightFootOffsetZ * forwardZ;
      leftLeg.current.position.x = -.27 * width * profile.stanceWidth + leftLocalX * .28; leftLeg.current.position.z = leftLocalZ * .2;
      rightLeg.current.position.x = .27 * width * profile.stanceWidth + rightLocalX * .28; rightLeg.current.position.z = rightLocalZ * .2;
      // The authored hierarchy is intentionally richer than the compact hidden
      // collision skeleton. Scale and floor it from the boot sole so its pelvis,
      // head, hands, and feet stay within a few centimetres of physical authority
      // instead of rendering a giant visual body around a smaller Rapier rig.
      const runtimeX = safeNumber(runtime.position?.x, shell.current.position.x);
      const runtimeZ = safeNumber(runtime.position?.z, shell.current.position.z);
      const targetY = safeNumber(3.0775 - .645 * height + safeNumber(runtime.body?.verticalOffset, 0), 3.0775 - .645 * height);
      // OPTIMIZATION: Replacing slow Math.hypot with standard Math.sqrt.
      const dx = runtimeX - shell.current.position.x;
      const dz = runtimeZ - shell.current.position.z;
      const planarError = Number.isFinite(runtimeX) && Number.isFinite(runtimeZ)
        ? Math.sqrt(dx * dx + dz * dz)
        : Number.POSITIVE_INFINITY;
      if (!presentationInitialized.current || planarError > 2.2) {
        shell.current.position.set(runtimeX, targetY, runtimeZ); shell.current.rotation.y = safeNumber(runtime.facing, 0); presentationInitialized.current = true;
      } else {
        const correctionRate = runtime.attackPhase === 'active' || planarError > .7 ? 34 : movement?.state === 'run' ? 28 : 22;
        const correction = 1 - Math.exp(-clampedDelta * correctionRate);
        shell.current.position.x += (runtimeX - shell.current.position.x) * correction;
        shell.current.position.y += (targetY - shell.current.position.y) * (1 - Math.exp(-clampedDelta * 30));
        shell.current.position.z += (runtimeZ - shell.current.position.z) * correction;
        const safeFacing = safeNumber(runtime.facing, 0);
        const facingError = Math.atan2(Math.sin(safeFacing - shell.current.rotation.y), Math.cos(safeFacing - shell.current.rotation.y));
        shell.current.rotation.y += facingError * (1 - Math.exp(-clampedDelta * 24));
      }
      root.current.updateWorldMatrix(true, true);
      root.current.localToWorld(alignmentPoints.current.pelvis.set(0, 1.02 * height, 0));
      torso.current.getWorldPosition(alignmentPoints.current.chest);
      head.current.getWorldPosition(alignmentPoints.current.head);
      leftForearm.current.localToWorld(alignmentPoints.current.leftHand.set(0, -.58, .035));
      rightForearm.current.localToWorld(alignmentPoints.current.rightHand.set(0, -.58, .035));
      leftShin.current.localToWorld(alignmentPoints.current.leftFoot.set(0, -.66, .13));
      rightShin.current.localToWorld(alignmentPoints.current.rightFoot.set(0, -.66, .13));
      if (reportAlignment) {
        // Optimized: Avoid Object.entries to prevent temporary array/string allocations inside high-frequency frames
        const pts = alignmentPoints.current;
        bodyWorksRuntime.setPresentationPoint(side, 'pelvis', pts.pelvis);
        bodyWorksRuntime.setPresentationPoint(side, 'chest', pts.chest);
        bodyWorksRuntime.setPresentationPoint(side, 'head', pts.head);
        bodyWorksRuntime.setPresentationPoint(side, 'leftHand', pts.leftHand);
        bodyWorksRuntime.setPresentationPoint(side, 'rightHand', pts.rightHand);
        bodyWorksRuntime.setPresentationPoint(side, 'leftFoot', pts.leftFoot);
        bodyWorksRuntime.setPresentationPoint(side, 'rightFoot', pts.rightFoot);
      }

      const trail = motionTrail.current; const strike = runtime.moveId ? strikeDriveProfile(runtime.moveId) : null;
      const sourcePoint = strike?.source === 'leftHand' || strike?.source === 'leftForearm'
        ? alignmentPoints.current.leftHand
        : strike?.source === 'rightHand' || strike?.source === 'rightForearm'
          ? alignmentPoints.current.rightHand
          : strike?.source === 'leftFoot' || strike?.source === 'leftShin'
            ? alignmentPoints.current.leftFoot
            : strike?.source === 'rightFoot' || strike?.source === 'rightShin'
              ? alignmentPoints.current.rightFoot
              : strike?.source === 'chest' ? alignmentPoints.current.chest : null;
      if (trail && sourcePoint && strike && runtime.attackPhase === 'active') {
        const vectors = trailVectors.current; vectors.current.copy(sourcePoint);
        if (trailAttackId.current !== runtime.attackInstanceId) {
          // Anticipation continuously primes `previous` with the chambered
          // limb position. Keep that point for the first active frame so a
          // low-frame-rate contact still draws the full punch/kick streak.
          trailAttackId.current = runtime.attackInstanceId;
          if (trailSource.current !== strike.source || vectors.previous.lengthSq() < .0001) vectors.previous.copy(vectors.current);
        }
        trailSource.current = strike.source;
        vectors.localCurrent.copy(vectors.current); vectors.localPrevious.copy(vectors.previous);
        shell.current.worldToLocal(vectors.localCurrent); shell.current.worldToLocal(vectors.localPrevious);
        vectors.direction.copy(vectors.localCurrent).sub(vectors.localPrevious);
        const distance = vectors.direction.length();
        // Never turn a stale limb-to-limb sample into a screen-wide streak.
        // A valid authored strike travels less than this between sampled poses.
        if (distance > 1.8) {
          vectors.previous.copy(vectors.current);
          trail.visible = false;
        } else if (distance > .018) {
          vectors.midpoint.copy(vectors.localCurrent).add(vectors.localPrevious).multiplyScalar(.5);
          vectors.direction.multiplyScalar(1 / distance);
          trail.position.copy(vectors.midpoint);
          trail.quaternion.setFromUnitVectors(vectors.up, vectors.direction);
          const thickness = runtime.moveId === 'uppercut' ? 2.45
            : ['aerial', 'aerial_kick', 'aerial_elbow'].includes(runtime.moveId ?? '') ? 2.8
            : 1.0;
          trail.scale.set(thickness, Math.max(.08, distance), thickness);
          trail.visible = true;
          (trail.material as MeshBasicMaterial).opacity = Math.min(.72, .2 + distance * 2.4);
        }
        vectors.previous.copy(vectors.current);
      } else if (trail) {
        const material = trail.material as MeshBasicMaterial;
        material.opacity = Math.max(0, material.opacity - clampedDelta * 7.5);
        if (material.opacity <= .015) trail.visible = false;
        if (sourcePoint) {
          trailVectors.current.previous.copy(sourcePoint);
          trailSource.current = strike?.source ?? null;
        } else {
          trailSource.current = null;
        }
      }
    } else {
      root.current.rotation.y = Math.sin(t * .45 * tempo) * .16;
    }

    const pain = runtime ? ['grabbed', 'staggered', 'airborne', 'downed', 'pinned', 'defeated'].includes(runtime.state) : false;
    const exertion = runtime ? runtime.moveId !== null || runtime.state === 'climbing' || runtime.state === 'recovering' : preview;
    const confidence = preview || runtime?.state === 'victorious' || (runtime?.momentum ?? 0) > 82;
    if (browLeft.current && browRight.current && mouth.current) {
      const browAngle = pain ? .34 : exertion ? -.2 : confidence ? -.12 : -.03;
      browLeft.current.rotation.z += (browAngle - browLeft.current.rotation.z) * smooth;
      browRight.current.rotation.z += (-browAngle - browRight.current.rotation.z) * smooth;
      browLeft.current.position.y += ((pain ? .13 : .16) - browLeft.current.position.y) * smooth;
      browRight.current.position.y += ((pain ? .13 : .16) - browRight.current.position.y) * smooth;
      mouth.current.scale.x += ((confidence ? 1.25 : pain ? .72 : 1) - mouth.current.scale.x) * smooth;
      mouth.current.scale.y += ((pain || exertion ? 2.6 : 1) - mouth.current.scale.y) * smooth;
      mouth.current.rotation.z += ((confidence ? -.08 : pain ? .12 : 0) - mouth.current.rotation.z) * smooth;
    }

    if (runtime && runtime.health < previousHealth.current && flash.current) {
      flash.current.visible = true;
      (flash.current.material as MeshBasicMaterial).opacity = .34;
    }
    if (runtime) previousHealth.current = runtime.health;
    if (flash.current) {
      const material = flash.current.material as MeshBasicMaterial;
      material.opacity = Math.max(0, material.opacity - clampedDelta * 5.8);
      if (material.opacity <= .01) flash.current.visible = false;
    }
  });

  return (
    <group ref={shell}>
      <group ref={root} scale={preview ? 1.05 : .75}>
        <Body fighter={fighter} profile={profile} torsoRef={torso} />
        <Head fighter={fighter} profile={profile} headRef={head} browLeft={browLeft} browRight={browRight} mouth={mouth} detailed={detail === 'full'} />
        <Arm fighter={fighter} profile={profile} side={-1} armRef={leftArm} forearmRef={leftForearm} detailed={detail !== 'reduced'} />
        <Arm fighter={fighter} profile={profile} side={1} armRef={rightArm} forearmRef={rightForearm} detailed={detail !== 'reduced'} />
        <Leg fighter={fighter} profile={profile} side={-1} legRef={leftLeg} shinRef={leftShin} />
        <Leg fighter={fighter} profile={profile} side={1} legRef={rightLeg} shinRef={rightShin} />
        <mesh ref={flash} position={[0, 1.25, 0]} scale={[1.25 * width, 1.55 * height, .8]} visible={false}>
          <boxGeometry />
          <meshBasicMaterial transparent depthWrite={false} opacity={0} color="white" />
        </mesh>
      </group>
      <mesh ref={motionTrail} visible={false} renderOrder={4}>
        <cylinderGeometry args={[.055, .14, 1, 9, 1, true]} />
        <meshBasicMaterial color={fighter.palette.emissive} transparent opacity={0} depthWrite={false} toneMapped={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
}

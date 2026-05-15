import { Canvas } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { Suspense, useState } from 'react';
import * as THREE from 'three';

export type Keypoint = {
  index: number;
  x?: number;
  y?: number;
  wx?: number;
  wy?: number;
  wz?: number;
  visibility?: number;
  estimated?: boolean;
  absent?: boolean;
};

interface PoseSkeleton3DProps {
  keypoints: Keypoint[];
  height?: number;
}

const BONE_CONNECTIONS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [29, 31],
  [28, 30],
  [30, 32],
] as const;

const JOINT_LABELS = new Map<number, string>([
  [0, 'Head'],
  [11, 'L. Shoulder'],
  [12, 'R. Shoulder'],
  [13, 'L. Elbow'],
  [14, 'R. Elbow'],
  [15, 'L. Wrist'],
  [16, 'R. Wrist'],
  [23, 'L. Hip'],
  [24, 'R. Hip'],
  [25, 'L. Knee'],
  [26, 'R. Knee'],
  [27, 'L. Ankle'],
  [28, 'R. Ankle'],
]);

const BODY_REGIONS = {
  HEAD: {
    indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    color: '#94a3b8',
    opacity: 0.3,
  },
  LEFT_ARM: {
    indices: [11, 13, 15, 17, 19, 21],
    color: '#60a5fa',
    opacity: 0.35,
  },
  RIGHT_ARM: {
    indices: [12, 14, 16, 18, 20, 22],
    color: '#38bdf8',
    opacity: 0.35,
  },
  TORSO: {
    indices: [11, 12, 23, 24],
    color: '#818cf8',
    opacity: 0.3,
  },
  LEFT_LEG: {
    indices: [23, 25, 27, 29, 31],
    color: '#4ade80',
    opacity: 0.35,
  },
  RIGHT_LEG: {
    indices: [24, 26, 28, 30, 32],
    color: '#34d399',
    opacity: 0.35,
  },
} as const;

type BodyRegion = keyof typeof BODY_REGIONS;
const BODY_REGION_ORDER = Object.keys(BODY_REGIONS) as BodyRegion[];

type WorldKeypoint = Keypoint & {
  wx: number;
  wy: number;
  wz: number;
};

function hasWorldPoint(keypoint: Keypoint): keypoint is WorldKeypoint {
  return !keypoint.absent && keypoint.wx != null && keypoint.wy != null && keypoint.wz != null;
}

type BodySegmentProps = {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  color: string;
  opacity: number;
};

function BodySegment({ start, end, radius, color, opacity }: BodySegmentProps) {
  const dir = end.clone().sub(start);
  const length = dir.length();
  if (length < 0.01) return null;

  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );
  const midpointArray = midpoint.toArray() as [number, number, number];
  const quaternionArray = quaternion.toArray() as [number, number, number, number];

  return (
    <mesh position={midpointArray} quaternion={quaternionArray}>
      <cylinderGeometry args={[radius, radius, length, 10, 1]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.6}
        metalness={0.0}
        depthWrite={false}
      />
    </mesh>
  );
}

function JointLabel({ position, text }: { position: THREE.Vector3; text: string }) {
  const positionArray = position.toArray() as [number, number, number];

  return (
    <Html position={positionArray} center distanceFactor={3} zIndexRange={[0, 0]}>
      <div
        style={{
          background: 'rgba(15,15,25,0.82)',
          color: '#e2e8f0',
          fontSize: '10px',
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 600,
          padding: '2px 6px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          border: '1px solid rgba(255,255,255,0.08)',
          letterSpacing: '0.03em',
        }}
      >
        {text}
      </div>
    </Html>
  );
}

function getRegion(index: number): BodyRegion {
  return BODY_REGION_ORDER.find((region) =>
    BODY_REGIONS[region].indices.some((regionIndex) => regionIndex === index),
  ) ?? 'TORSO';
}

function regionColour(index: number): string {
  return BODY_REGIONS[getRegion(index)].color;
}

function regionOpacity(index: number): number {
  return BODY_REGIONS[getRegion(index)].opacity;
}

function getSegmentRadius(aIndex: number, bIndex: number): number {
  if (aIndex >= 0 && aIndex <= 10) return 0.055;
  if ((aIndex === 11 && bIndex === 13) || (aIndex === 12 && bIndex === 14)) return 0.04;
  if (aIndex === 11 || aIndex === 12) return 0.07;
  if ((aIndex === 13 && bIndex === 15) || (aIndex === 14 && bIndex === 16)) return 0.032;
  if ((aIndex === 23 && bIndex === 25) || (aIndex === 24 && bIndex === 26)) return 0.058;
  if (aIndex === 23 || aIndex === 24) return 0.065;
  if ((aIndex === 25 && bIndex === 27) || (aIndex === 26 && bIndex === 28)) return 0.046;
  if (aIndex >= 27 && aIndex <= 30) return 0.028;
  return 0.034;
}

function SkeletonScene({
  keypoints,
  showBody,
}: {
  keypoints: Keypoint[];
  showBody: boolean;
}) {
  const byIndex = new Map(keypoints.map((keypoint) => [keypoint.index, keypoint]));
  const visibleWorldKeypoints = keypoints.filter(hasWorldPoint);

  return (
    <>
      <gridHelper args={[2, 8, '#1e2030', '#252840']} position={[0, -0.6, 0]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 4, 3]} intensity={1.2} castShadow={false} />
      <pointLight color="#a5b4fc" intensity={0.4} position={[-1, 1, -1]} />

      <OrbitControls
        enablePan={false}
        minDistance={0.9}
        maxDistance={4}
        target={[0, 0.05, 0]}
        autoRotate={false}
      />

      {showBody &&
        BONE_CONNECTIONS.map(([start, end]) => {
          const a = byIndex.get(start);
          const b = byIndex.get(end);
          if (!a || !b || !hasWorldPoint(a) || !hasWorldPoint(b)) return null;

          return (
            <BodySegment
              key={`body-${start}-${end}`}
              start={new THREE.Vector3(a.wx, a.wy, a.wz)}
              end={new THREE.Vector3(b.wx, b.wy, b.wz)}
              radius={getSegmentRadius(start, end)}
              color={regionColour(start)}
              opacity={regionOpacity(start)}
            />
          );
        })}

      {visibleWorldKeypoints.map((keypoint) => (
        <mesh key={`joint-${keypoint.index}`} position={[keypoint.wx, keypoint.wy, keypoint.wz]}>
          <sphereGeometry args={[0.028, 16, 16]} />
          <meshStandardMaterial
            color={keypoint.estimated ? '#f59e0b' : regionColour(keypoint.index)}
            roughness={0.4}
            metalness={0.2}
          />
        </mesh>
      ))}

      {BONE_CONNECTIONS.map(([start, end]) => {
        const a = byIndex.get(start);
        const b = byIndex.get(end);
        if (!a || !b || !hasWorldPoint(a) || !hasWorldPoint(b)) return null;

        return (
          <Line
            key={`${start}-${end}`}
            points={[
              [a.wx, a.wy, a.wz],
              [b.wx, b.wy, b.wz],
            ]}
            color={a.estimated || b.estimated ? '#fbbf24' : regionColour(start)}
            lineWidth={1.5}
          />
        );
      })}

      {Array.from(JOINT_LABELS.entries()).map(([index, text]) => {
        const keypoint = byIndex.get(index);
        if (!keypoint || !hasWorldPoint(keypoint)) return null;

        return (
          <JointLabel
            key={`label-${index}`}
            position={new THREE.Vector3(keypoint.wx, keypoint.wy, keypoint.wz)}
            text={text}
          />
        );
      })}
    </>
  );
}

export function PoseSkeleton3D({ keypoints, height = 260 }: PoseSkeleton3DProps) {
  const [showBody, setShowBody] = useState(false);
  const depthKeypointCount = keypoints.filter((keypoint) => !keypoint.absent && keypoint.wx != null)
    .length;

  if (depthKeypointCount < 6) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100 px-4 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-dark-900/50 dark:text-slate-400"
        style={{ height }}
      >
        3D preview not available — reference images lacked depth data
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-dark-900/40">
      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', padding: '6px 6px 0' }}>
        {['Skeleton', 'Body'].map((mode) => (
          <button
            key={mode}
            onClick={() => setShowBody(mode === 'Body')}
            style={{
              padding: '3px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              border: '1px solid rgba(255,255,255,0.12)',
              cursor: 'pointer',
              background: (showBody ? mode === 'Body' : mode === 'Skeleton')
                ? '#6366f1'
                : 'rgba(255,255,255,0.05)',
              color: '#e2e8f0',
              transition: 'background 0.15s',
            }}
          >
            {mode}
          </button>
        ))}
      </div>
      <div style={{ height }}>
        <Canvas
          camera={{ position: [0, 0.3, 2.4], fov: 48 }}
          style={{ background: '#0d0d14' }}
        >
          <Suspense fallback={null}>
            <SkeletonScene keypoints={keypoints} showBody={showBody} />
          </Suspense>
        </Canvas>
      </div>
      <div className="bg-slate-50 px-3 py-2 text-center text-xs text-slate-500 dark:bg-dark-900 dark:text-slate-400">
        Drag to rotate  ·  Scroll to zoom
      </div>
    </div>
  );
}

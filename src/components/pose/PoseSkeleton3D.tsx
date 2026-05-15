import { Canvas } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
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

const COLORS = {
  center: '#94a3b8',
  leftSide: '#818cf8',
  rightSide: '#60a5fa',
} as const;

const OPACITY = 0.72;

type WorldKeypoint = Keypoint & {
  wx: number;
  wy: number;
  wz: number;
};

function hasWorldPoint(keypoint: Keypoint): keypoint is WorldKeypoint {
  return !keypoint.absent && keypoint.wx != null && keypoint.wy != null && keypoint.wz != null;
}

type BoneCylinderProps = {
  a: THREE.Vector3;
  b: THREE.Vector3;
  radius: number;
  color: string;
  opacity: number;
};

function BoneCylinder({ a, b, radius, color, opacity }: BoneCylinderProps) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 0.01) return null;

  const midPoint = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const axis = new THREE.Vector3(0, 1, 0);
  const normDir = dir.clone().normalize();
  const quat = new THREE.Quaternion();
  if (normDir.dot(axis) < -0.9999) {
    quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  } else {
    quat.setFromUnitVectors(axis, normDir);
  }
  const position = midPoint.toArray() as [number, number, number];
  const quaternion = quat.toArray() as [number, number, number, number];

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, len, 12, 1]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.55}
        metalness={0.05}
        depthWrite={false}
      />
    </mesh>
  );
}

function JointSphere({
  position,
  radius,
  color,
  opacity,
}: {
  position: THREE.Vector3;
  radius: number;
  color: string;
  opacity: number;
}) {
  const positionArray = position.toArray() as [number, number, number];

  return (
    <mesh position={positionArray}>
      <sphereGeometry args={[radius, 14, 10]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.45}
        metalness={0.05}
        depthWrite={false}
      />
    </mesh>
  );
}

function vec(keypoint: Keypoint | undefined): THREE.Vector3 | null {
  if (!keypoint || keypoint.absent || keypoint.wx == null || keypoint.wy == null || keypoint.wz == null) {
    return null;
  }
  return new THREE.Vector3(keypoint.wx, keypoint.wy, keypoint.wz);
}

function mid(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
}

function HumanBodyMesh({ keypoints }: { keypoints: Keypoint[] }) {
  const by = new Map(keypoints.map((keypoint) => [keypoint.index, keypoint]));
  const g = (idx: number) => vec(by.get(idx));

  const nose = g(0);
  const lEar = g(7);
  const rEar = g(8);
  const lShoulder = g(11);
  const rShoulder = g(12);
  const lElbow = g(13);
  const rElbow = g(14);
  const lWrist = g(15);
  const rWrist = g(16);
  const lHip = g(23);
  const rHip = g(24);
  const lKnee = g(25);
  const rKnee = g(26);
  const lAnkle = g(27);
  const rAnkle = g(28);
  const lHeel = g(29);
  const rHeel = g(30);
  const lFoot = g(31);
  const rFoot = g(32);

  const midShoulder = lShoulder && rShoulder ? mid(lShoulder, rShoulder) : null;
  const midHip = lHip && rHip ? mid(lHip, rHip) : null;
  const headCenter: THREE.Vector3 | null = (() => {
    if (lEar && rEar) return mid(lEar, rEar);
    if (nose) return nose.clone().add(new THREE.Vector3(0, 0.06, 0));
    return null;
  })();

  const C = COLORS;
  const OP = OPACITY;

  return (
    <group>
      {headCenter && <JointSphere position={headCenter} radius={0.098} color={C.center} opacity={OP} />}
      {headCenter && midShoulder && (
        <BoneCylinder a={headCenter} b={midShoulder} radius={0.032} color={C.center} opacity={OP} />
      )}
      {lShoulder && rShoulder && (
        <BoneCylinder a={lShoulder} b={rShoulder} radius={0.042} color={C.center} opacity={OP} />
      )}
      {midShoulder && midHip && (
        <BoneCylinder a={midShoulder} b={midHip} radius={0.082} color={C.center} opacity={OP} />
      )}
      {lHip && rHip && <BoneCylinder a={lHip} b={rHip} radius={0.052} color={C.center} opacity={OP} />}

      {lShoulder && lElbow && (
        <BoneCylinder a={lShoulder} b={lElbow} radius={0.04} color={C.leftSide} opacity={OP} />
      )}
      {lElbow && <JointSphere position={lElbow} radius={0.034} color={C.leftSide} opacity={OP} />}
      {lElbow && lWrist && (
        <BoneCylinder a={lElbow} b={lWrist} radius={0.03} color={C.leftSide} opacity={OP} />
      )}
      {lWrist && <JointSphere position={lWrist} radius={0.026} color={C.leftSide} opacity={OP} />}

      {rShoulder && rElbow && (
        <BoneCylinder a={rShoulder} b={rElbow} radius={0.04} color={C.rightSide} opacity={OP} />
      )}
      {rElbow && <JointSphere position={rElbow} radius={0.034} color={C.rightSide} opacity={OP} />}
      {rElbow && rWrist && (
        <BoneCylinder a={rElbow} b={rWrist} radius={0.03} color={C.rightSide} opacity={OP} />
      )}
      {rWrist && <JointSphere position={rWrist} radius={0.026} color={C.rightSide} opacity={OP} />}

      {lHip && lKnee && <BoneCylinder a={lHip} b={lKnee} radius={0.055} color={C.leftSide} opacity={OP} />}
      {lKnee && <JointSphere position={lKnee} radius={0.044} color={C.leftSide} opacity={OP} />}
      {lKnee && lAnkle && (
        <BoneCylinder a={lKnee} b={lAnkle} radius={0.038} color={C.leftSide} opacity={OP} />
      )}
      {lAnkle && lHeel && (
        <BoneCylinder a={lAnkle} b={lHeel} radius={0.026} color={C.leftSide} opacity={OP} />
      )}
      {lHeel && lFoot && <BoneCylinder a={lHeel} b={lFoot} radius={0.022} color={C.leftSide} opacity={OP} />}

      {rHip && rKnee && <BoneCylinder a={rHip} b={rKnee} radius={0.055} color={C.rightSide} opacity={OP} />}
      {rKnee && <JointSphere position={rKnee} radius={0.044} color={C.rightSide} opacity={OP} />}
      {rKnee && rAnkle && (
        <BoneCylinder a={rKnee} b={rAnkle} radius={0.038} color={C.rightSide} opacity={OP} />
      )}
      {rAnkle && rHeel && (
        <BoneCylinder a={rAnkle} b={rHeel} radius={0.026} color={C.rightSide} opacity={OP} />
      )}
      {rHeel && rFoot && <BoneCylinder a={rHeel} b={rFoot} radius={0.022} color={C.rightSide} opacity={OP} />}
    </group>
  );
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
      <ambientLight intensity={0.45} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.4} castShadow={false} />
      <directionalLight position={[-2, 1, -2]} intensity={0.5} color="#a5b4fc" />
      <pointLight position={[0, -1, 1]} intensity={0.3} color="#fbbf24" />

      <OrbitControls
        enablePan={false}
        minDistance={0.9}
        maxDistance={4}
        target={[0, 0.05, 0]}
        autoRotate={false}
      />

      <group>
        {showBody && (
          <Suspense fallback={null}>
            <HumanBodyMesh keypoints={keypoints} />
          </Suspense>
        )}

        {visibleWorldKeypoints.map((keypoint) => (
          <mesh key={`joint-${keypoint.index}`} position={[keypoint.wx, keypoint.wy, keypoint.wz]}>
            <sphereGeometry args={[0.028, 16, 16]} />
            <meshStandardMaterial
              color={keypoint.estimated ? '#f59e0b' : '#6366f1'}
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
              color={a.estimated || b.estimated ? '#fbbf24' : '#818cf8'}
              lineWidth={1.5}
            />
          );
        })}
      </group>
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

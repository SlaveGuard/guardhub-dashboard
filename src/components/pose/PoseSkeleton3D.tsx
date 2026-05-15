import { Canvas } from '@react-three/fiber';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import {
  AmbientLight,
  DirectionalLight,
  GridHelper,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
} from 'three';

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

type WorldKeypoint = Keypoint & {
  wx: number;
  wy: number;
  wz: number;
};

function hasWorldPoint(keypoint: Keypoint): keypoint is WorldKeypoint {
  return !keypoint.absent && keypoint.wx != null && keypoint.wy != null && keypoint.wz != null;
}

function disposeMaterial(material: Material | Material[]) {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }
  material.dispose();
}

function PoseScene({
  keypoints,
  visibleWorldKeypoints,
}: {
  keypoints: Keypoint[];
  visibleWorldKeypoints: WorldKeypoint[];
}) {
  const { scene } = useThree();
  const byIndex = new Map(keypoints.map((keypoint) => [keypoint.index, keypoint]));

  useEffect(() => {
    const group = new Group();
    const grid = new GridHelper(2, 8, '#1e2030', '#252840');
    grid.position.y = -0.6;
    group.add(grid);

    group.add(new AmbientLight(0xffffff, 0.5));

    const directionalLight = new DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(2, 4, 3);
    directionalLight.castShadow = false;
    group.add(directionalLight);

    const pointLight = new PointLight('#a5b4fc', 0.4);
    pointLight.position.set(-1, 1, -1);
    group.add(pointLight);

    visibleWorldKeypoints.forEach((keypoint) => {
      const joint = new Mesh(
        new SphereGeometry(0.028, 16, 16),
        new MeshStandardMaterial({
          color: keypoint.estimated ? '#f59e0b' : '#6366f1',
          roughness: 0.4,
          metalness: 0.2,
        }),
      );
      joint.position.set(keypoint.wx, keypoint.wy, keypoint.wz);
      group.add(joint);
    });

    scene.add(group);
    return () => {
      scene.remove(group);
      group.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          disposeMaterial(object.material);
        }
      });
    };
  }, [scene, visibleWorldKeypoints]);

  return (
    <>
      <OrbitControls
        enablePan={false}
        minDistance={0.9}
        maxDistance={4}
        target={[0, 0.05, 0]}
        autoRotate={false}
      />

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
            lineWidth={2}
          />
        );
      })}
    </>
  );
}

export function PoseSkeleton3D({ keypoints, height = 260 }: PoseSkeleton3DProps) {
  const depthKeypointCount = keypoints.filter((keypoint) => !keypoint.absent && keypoint.wx != null)
    .length;
  const visibleWorldKeypoints = keypoints.filter(hasWorldPoint);

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
      <div style={{ height }}>
        <Canvas
          camera={{ position: [0, 0.3, 2.4], fov: 48 }}
          style={{ background: '#0d0d14' }}
        >
          <PoseScene keypoints={keypoints} visibleWorldKeypoints={visibleWorldKeypoints} />
        </Canvas>
      </div>
      <div className="bg-slate-50 px-3 py-2 text-center text-xs text-slate-500 dark:bg-dark-900 dark:text-slate-400">
        Drag to rotate  ·  Scroll to zoom
      </div>
    </div>
  );
}

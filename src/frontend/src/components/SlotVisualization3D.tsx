import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';

interface SlotVisualization3DProps {
  slotType: 'SHIRT_FRONT' | 'SHIRT_BACK' | 'SHIRT_SLEEVE' | 'CAP_FRONT' | 'CAP_SIDE';
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  debug?: boolean;
}

const DEFAULT_LOGO = '/ccubelogo.png';

// ===== 티셔츠 형태 Shape (2D 실루엣) =====
function createShirtShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.6, -1.0);
  shape.lineTo(-0.6, 0.3);
  shape.lineTo(-1.1, 0.5);
  shape.lineTo(-1.1, 0.8);
  shape.lineTo(-0.7, 0.9);
  shape.lineTo(-0.25, 1.0);
  shape.lineTo(0, 0.85);
  shape.lineTo(0.25, 1.0);
  shape.lineTo(0.7, 0.9);
  shape.lineTo(1.1, 0.8);
  shape.lineTo(1.1, 0.5);
  shape.lineTo(0.6, 0.3);
  shape.lineTo(0.6, -1.0);
  shape.lineTo(-0.6, -1.0);
  return shape;
}

// ===== 패브릭 반투명 머티리얼 생성 =====
function createFabricMaterial(opacity: number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xF6F6F2,
    transparent: true,
    opacity: opacity,
    roughness: 0.85,
    metalness: 0,
    transmission: 0,
    clearcoat: 0,
    ior: 1.0,
    sheen: 0.1,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0xFAFAFA),
    side: THREE.DoubleSide,
    depthWrite: false,
    alphaTest: 0.01,
  });
}

// ===== 크라운 프로파일 곡선 생성 (Bezier 기반) =====
function createCrownProfileCurve(
  baseRadius: number,
  height: number,
  tension: number = 0.5
): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  const segments = 24;

  // Bezier 컨트롤 포인트: 실제 캡 실루엣
  const p0 = new THREE.Vector2(baseRadius, 0);
  const p1 = new THREE.Vector2(baseRadius * (1 + tension * 0.08), height * 0.35);
  const p2 = new THREE.Vector2(baseRadius * 0.55, height * 0.88);
  const p3 = new THREE.Vector2(0.001, height);  // 0이면 LatheGeometry에서 문제

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
    const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;

    points.push(new THREE.Vector2(Math.max(0.001, x), y));
  }

  return points;
}

// ===== 챙 외곽 Shape 생성 (반달형) =====
function createBrimShape(width: number, length: number): THREE.Shape {
  const shape = new THREE.Shape();
  const halfWidth = width / 2;

  shape.moveTo(-halfWidth, 0);
  shape.quadraticCurveTo(-halfWidth * 0.9, length * 0.5, -halfWidth * 0.65, length);
  shape.quadraticCurveTo(0, length * 1.12, halfWidth * 0.65, length);
  shape.quadraticCurveTo(halfWidth * 0.9, length * 0.5, halfWidth, 0);
  shape.quadraticCurveTo(0, -length * 0.03, -halfWidth, 0);

  return shape;
}

// ===== 베이스볼 캡 생성 (LatheGeometry + ExtrudeGeometry) =====
function createBaseballCapGroup(params: {
  width?: number;
  depth?: number;
  height?: number;
  opacity?: number;
  debug?: boolean;
}): THREE.Group {
  const {
    width = 0.19,
    height = 0.12,
    opacity = 0.65,
    debug = false,
  } = params;

  const group = new THREE.Group();
  group.name = 'BaseballCap';

  const crownRadius = width / 2;
  const crownHeight = height;
  const brimLength = 0.075;
  const brimWidth = width * 0.85;

  // ===== 1. 크라운 (LatheGeometry) =====
  const profilePoints = createCrownProfileCurve(crownRadius, crownHeight, 0.5);
  const crownGeometry = new THREE.LatheGeometry(profilePoints, 48, 0, Math.PI * 2);

  // 타원형으로 변형 (앞뒤 더 길게)
  const ovalScaleX = 0.88;
  const ovalScaleZ = 1.05;
  const crownPositions = crownGeometry.attributes.position;
  for (let i = 0; i < crownPositions.count; i++) {
    const x = crownPositions.getX(i);
    const z = crownPositions.getZ(i);
    crownPositions.setX(i, x * ovalScaleX);
    crownPositions.setZ(i, z * ovalScaleZ);
  }
  crownGeometry.computeVertexNormals();

  const crownMaterial = createFabricMaterial(opacity);
  const crownMesh = new THREE.Mesh(crownGeometry, crownMaterial);
  crownMesh.name = 'Cap_Crown';
  group.add(crownMesh);

  // ===== 2. 챙 (ExtrudeGeometry + Vertex Bend) =====
  const brimShape = createBrimShape(brimWidth, brimLength);
  const brimGeometry = new THREE.ExtrudeGeometry(brimShape, {
    depth: 0.003,
    bevelEnabled: true,
    bevelThickness: 0.001,
    bevelSize: 0.001,
    bevelSegments: 2,
  });

  // 챙 아래로 휘기
  const brimPositions = brimGeometry.attributes.position;
  const curveAmount = 0.018;
  for (let i = 0; i < brimPositions.count; i++) {
    const x = brimPositions.getX(i);
    const y = brimPositions.getY(i);  // 앞쪽 방향
    const z = brimPositions.getZ(i);

    const lengthFactor = Math.max(0, y / brimLength);
    const edgeFactor = Math.abs(x) / (brimWidth / 2);

    const bendZ = -curveAmount * Math.pow(lengthFactor, 1.4);
    const edgeBend = -curveAmount * 0.4 * edgeFactor * lengthFactor;

    brimPositions.setZ(i, z + bendZ + edgeBend);
  }
  brimGeometry.computeVertexNormals();

  const brimMaterial = createFabricMaterial(Math.min(0.78, opacity * 1.15));
  const brimMesh = new THREE.Mesh(brimGeometry, brimMaterial);
  brimMesh.name = 'Cap_Brim';
  brimMesh.rotation.x = -Math.PI / 2;
  brimMesh.position.set(0, 0.002, crownRadius * ovalScaleZ * 0.95);
  group.add(brimMesh);

  // ===== 3. 버튼 =====
  const buttonGeometry = new THREE.CylinderGeometry(0.006, 0.008, 0.005, 16);
  const buttonMaterial = createFabricMaterial(Math.min(0.88, opacity * 1.3));
  const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial);
  buttonMesh.name = 'Cap_Button';
  buttonMesh.position.set(0, crownHeight + 0.003, 0);
  group.add(buttonMesh);

  // ===== 4. 아일릿 =====
  const eyeletsGroup = new THREE.Group();
  eyeletsGroup.name = 'Cap_Eyelets';
  const eyeletGeometry = new THREE.TorusGeometry(0.003, 0.0008, 8, 16);
  const eyeletMaterial = new THREE.MeshBasicMaterial({
    color: 0xD0D0D0,
    transparent: true,
    opacity: opacity * 0.9,
  });

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const eyeletY = crownHeight * 0.58;
    const eyeletRadius = crownRadius * 0.82;

    const eyelet = new THREE.Mesh(eyeletGeometry, eyeletMaterial);
    eyelet.position.set(
      Math.sin(angle) * eyeletRadius * ovalScaleX,
      eyeletY,
      Math.cos(angle) * eyeletRadius * ovalScaleZ
    );
    eyelet.rotation.y = -angle;
    eyelet.rotation.x = Math.PI / 2;
    eyeletsGroup.add(eyelet);
  }
  group.add(eyeletsGroup);

  // ===== 5. 6패널 스티칭 라인 =====
  const seamsGroup = new THREE.Group();
  seamsGroup.name = 'Cap_Seams';
  const seamMaterial = new THREE.LineBasicMaterial({
    color: 0xE8E8E4,
    transparent: true,
    opacity: 0.35,
  });

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const seamPoints: THREE.Vector3[] = [];

    for (let t = 0; t <= 1; t += 0.04) {
      const profileIdx = Math.floor(t * (profilePoints.length - 1));
      const pt = profilePoints[profileIdx];

      const x = Math.sin(angle) * pt.x * ovalScaleX;
      const z = Math.cos(angle) * pt.x * ovalScaleZ;
      const y = pt.y;

      seamPoints.push(new THREE.Vector3(x, y, z));
    }

    const seamGeometry = new THREE.BufferGeometry().setFromPoints(seamPoints);
    const seamLine = new THREE.Line(seamGeometry, seamMaterial);
    seamsGroup.add(seamLine);
  }
  group.add(seamsGroup);

  // ===== 디버그 =====
  if (debug) {
    const axesHelper = new THREE.AxesHelper(0.15);
    group.add(axesHelper);

    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    console.log('=== Baseball Cap Dimensions ===');
    console.log(`Width (X):  ${size.x.toFixed(4)}m (target: 0.17~0.21m)`);
    console.log(`Depth (Z):  ${size.z.toFixed(4)}m (target: 0.24~0.28m)`);
    console.log(`Height (Y): ${size.y.toFixed(4)}m (target: 0.10~0.14m)`);

    const boxHelper = new THREE.Box3Helper(box, new THREE.Color(0x00ff00));
    group.add(boxHelper);
  }

  return group;
}

// ===== 로고 텍스처 컴포넌트 =====
function LogoPlane({ logoUrl, width, height }: { logoUrl: string; width: number; height: number }) {
  const texture = useLoader(THREE.TextureLoader, logoUrl || DEFAULT_LOGO);
  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
    </mesh>
  );
}

// ===== 티셔츠 3D =====
function Shirt3D({ logoPosition, logoUrl }: { logoPosition: 'front' | 'back' | 'sleeve'; logoUrl?: string }) {
  const shirtShape = useMemo(() => createShirtShape(), []);
  const isBack = logoPosition === 'back';

  const extrudeSettings = {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  };

  return (
    <group rotation={[0, isBack ? Math.PI : 0, 0]}>
      <mesh position={[0, 0, -0.04]}>
        <extrudeGeometry args={[shirtShape, extrudeSettings]} />
        <meshPhysicalMaterial
          color="#f1f5f9"
          transparent
          opacity={0.6}
          roughness={0.3}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {logoPosition === 'front' && (
        <group position={[-0.25, 0.35, 0.06]}>
          <LogoPlane logoUrl={logoUrl || DEFAULT_LOGO} width={0.35} height={0.28} />
        </group>
      )}
      {logoPosition === 'back' && (
        <group position={[0, 0.1, 0.06]}>
          <LogoPlane logoUrl={logoUrl || DEFAULT_LOGO} width={0.6} height={0.45} />
        </group>
      )}
      {logoPosition === 'sleeve' && (
        <group position={[-0.9, 0.65, 0.06]}>
          <LogoPlane logoUrl={logoUrl || DEFAULT_LOGO} width={0.22} height={0.18} />
        </group>
      )}
    </group>
  );
}

// ===== 베이스볼 캡 3D (LatheGeometry 기반) =====
function Cap3D({ logoPosition, logoUrl, debug = false }: { logoPosition: 'front' | 'side'; logoUrl?: string; debug?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  // THREE.Group을 useMemo로 생성
  const capGroup = useMemo(() => {
    return createBaseballCapGroup({
      width: 0.19,
      height: 0.12,
      opacity: 0.65,
      debug: debug,
    });
  }, [debug]);

  // 스케일 조정 (화면에서 적절한 크기로)
  const scale = 5.5;

  return (
    <group ref={groupRef} rotation={[0.12, logoPosition === 'side' ? -0.4 : 0, 0]} position={[0, -0.15, 0]}>
      <primitive object={capGroup} scale={[scale, scale, scale]} />

      {/* 로고 - 정면 */}
      {logoPosition === 'front' && (
        <group position={[0, 0.32, 0.48]} rotation={[-0.1, 0, 0]}>
          <LogoPlane logoUrl={logoUrl || DEFAULT_LOGO} width={0.28} height={0.22} />
        </group>
      )}

      {/* 로고 - 측면 */}
      {logoPosition === 'side' && (
        <group position={[0.42, 0.32, 0.22]} rotation={[0, Math.PI / 3, 0]}>
          <LogoPlane logoUrl={logoUrl || DEFAULT_LOGO} width={0.24} height={0.18} />
        </group>
      )}
    </group>
  );
}

// ===== 로딩 폴백 =====
function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshBasicMaterial color="#e2e8f0" transparent opacity={0.5} />
    </mesh>
  );
}

// ===== 메인 컴포넌트 =====
export default function SlotVisualization3D({ slotType, logoUrl, size = 'md', debug = false }: SlotVisualization3DProps) {
  const sizeClasses = {
    sm: 'h-32',
    md: 'h-48',
    lg: 'h-64',
  };

  const isCap = slotType.startsWith('CAP');
  const logoPosition = slotType.includes('FRONT')
    ? 'front'
    : slotType.includes('BACK')
    ? 'back'
    : slotType.includes('SLEEVE')
    ? 'sleeve'
    : 'side';

  const getSlotLabel = () => {
    switch (slotType) {
      case 'CAP_FRONT':
        return '모자 정면';
      case 'CAP_SIDE':
        return '모자 측면';
      case 'SHIRT_FRONT':
        return '셔츠 정면';
      case 'SHIRT_BACK':
        return '셔츠 등판';
      case 'SHIRT_SLEEVE':
        return '셔츠 소매';
      default:
        return slotType;
    }
  };

  return (
    <div className={`w-full ${sizeClasses[size]} bg-gradient-to-b from-slate-50 to-slate-100 rounded-lg overflow-hidden relative`}>
      <Canvas
        camera={{ position: [0, 0, isCap ? 2.2 : 3.2], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[2, 4, 3]} intensity={0.35} />
          <directionalLight position={[-2, 2, -2]} intensity={0.2} />

          {isCap ? (
            <Cap3D logoPosition={logoPosition as 'front' | 'side'} logoUrl={logoUrl} debug={debug} />
          ) : (
            <Shirt3D logoPosition={logoPosition as 'front' | 'back' | 'sleeve'} logoUrl={logoUrl} />
          )}

          <ContactShadows
            position={[0, -1.2, 0]}
            opacity={0.3}
            scale={4}
            blur={2}
            far={2}
          />

          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.8}
            autoRotate
            autoRotateSpeed={0.6}
          />
        </Suspense>
      </Canvas>

      <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 shadow-sm">
        {getSlotLabel()}
      </div>

      <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md text-xs text-slate-500">
        드래그로 회전
      </div>
    </div>
  );
}

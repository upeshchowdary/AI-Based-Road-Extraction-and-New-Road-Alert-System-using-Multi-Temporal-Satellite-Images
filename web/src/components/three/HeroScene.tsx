/**
 * HeroScene — "Orbit → Road" globe (UI_PROMPT.md H1)
 *
 * Professional Aerospace Upgrades:
 *  - Interactive mouse parallax with smooth spring damping
 *  - 3D Sentinel-2 satellite craft in real Sun-synchronous orbit (786 km alt)
 *  - Glowing orbital track ring with animated pulse wave
 *  - Sensor cone/frustum projecting multispectral scanner beam to earth
 *  - Twinkling multi-spectral starfield with chromatic depth
 *  - Dual-layer atmospheric scattering shell + twilight sunset fringe
 *  - City light shimmer uniform + specular ocean gloss
 *  - AP boundary glow + dual pulse rings at Zone A centroid
 */
import { Line, useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  PerspectiveCamera,
  SRGBColorSpace,
  NormalBlending,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { Line2 } from 'three-stdlib'
import { CAMERA_START_DIST, ZONE, cameraAt } from './cameraPath'
import { clamp01, facing, latLonToXYZ, smooth, subsolarPoint } from './geo'
import { DATA, fetchJson } from '@/lib/data'

const latLonToVec3 = (lat: number, lon: number, r = 1) => new Vector3(...latLonToXYZ(lat, lon, r))

export interface HeroState {
  progress: number
  t0: number
}

/* ── Earth Surface Shader ─────────────────────────────────────────────────── */
const earthVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vUv = uv;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const earthFrag = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uWater;
  uniform vec3 uSun;
  uniform vec3 uRim;
  uniform float uTime;
  uniform float uLight;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vW;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(cameraPosition - vW);
    float ndl = dot(n, uSun);
    float dayMix = smoothstep(-0.10, 0.22, ndl);

    vec3 day   = texture2D(uDay,   vUv).rgb;
    vec3 night = texture2D(uNight, vUv).rgb;
    float water = texture2D(uWater, vUv).r;

    // Specular ocean gloss
    vec3 dayCol = day * (0.30 + 1.15 * max(ndl, 0.0));
    vec3 h = normalize(uSun + v);
    dayCol += vec3(1.0, 0.94, 0.85) * pow(max(dot(n, h), 0.0), 380.0) * water * 0.28;

    // City lights shimmer
    float shimmer = 0.93 + 0.07 * sin(uTime * 2.4 + hash(vUv * 40.0) * 6.28);
    vec3 nightCol = night * vec3(1.15, 0.84, 0.48) * 3.0 * shimmer + day * 0.035;

    vec3 col = mix(nightCol, dayCol, dayMix);
    // light variant: a calm, fully daylit atlas globe (no city lights, gentle terminator)
    vec3 atlas = day * (0.78 + 0.32 * max(dot(n, v), 0.0));
    col = mix(col, atlas, uLight);

    // Fresnel atmospheric rim
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.2);
    col += uRim * fres * mix(0.16 + 0.55 * dayMix, 0.35, uLight);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/* ── Atmosphere Shell Shader ──────────────────────────────────────────────── */
const atmoVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const atmoFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSun;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 v = normalize(cameraPosition - vW);
    float rim = pow(1.0 - max(dot(normalize(vN), v), 0.0), 3.6);
    float lit = smoothstep(-0.35, 0.35, dot(vW, uSun));
    // Twilight fringe
    float twi = smoothstep(-0.1, 0.1, dot(normalize(vN), uSun));
    vec3 col = mix(uColor * 0.9 + vec3(0.14, 0.04, 0.0), uColor, twi);
    gl_FragColor = vec4(col * rim * lit * 1.8, rim * lit * 0.92);
    #include <colorspace_fragment>
  }
`

/* ── Starfield Shader ─────────────────────────────────────────────────────── */
const starVert = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 1.6 + aPhase * 6.28));
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (320.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`
const starFrag = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;
    float alpha = (1.0 - r) * vAlpha;
    gl_FragColor = vec4(vColor, alpha);
  }
`

function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function Stars() {
  const r = useMemo(() => mulberry(1564), [])
  const { geo, mat } = useMemo(() => {
    const n = 3200
    const pos: number[] = []
    const sizes: number[] = []
    const phases: number[] = []
    const colors: number[] = []

    const palette = [
      [0.98, 0.98, 1.0],  // diamond white
      [0.75, 0.88, 1.0],  // sentinel ice blue
      [1.0, 0.88, 0.72],  // warm star
      [0.65, 0.82, 1.0],  // deep azure
    ]

    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1
      const t = r() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      pos.push(60 * s * Math.cos(t), 60 * u, 60 * s * Math.sin(t))
      sizes.push(0.9 + r() * 2.6)
      phases.push(r())
      const c = palette[Math.floor(r() * palette.length)]
      colors.push(c[0], c[1], c[2])
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('aSize', new Float32BufferAttribute(sizes, 1))
    g.setAttribute('aPhase', new Float32BufferAttribute(phases, 1))
    g.setAttribute('aColor', new Float32BufferAttribute(colors, 3))

    const m = new ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
    })
    return { geo: g, mat: m }
  }, [r])

  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
  })

  return <points geometry={geo} material={mat} />
}

/* ── 3D Sentinel-2 Satellite in Sun-Synchronous Orbit ─────────────────────── */
function SentinelSatellite({ orbitRadius = 1.124 }: { orbitRadius?: number }) {
  const satRef = useRef<Group>(null)
  const beamRef = useRef<Mesh>(null)

  // Pre-generate orbital track ring (tilted 98.6° for sun-sync orbit)
  const orbitPoints = useMemo(() => {
    const pts: Vector3[] = []
    const steps = 96
    const inc = (98.6 * Math.PI) / 180
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * Math.PI * 2
      // Rotate circular orbit by inclination
      const x = orbitRadius * Math.cos(th)
      const y = orbitRadius * Math.sin(th) * Math.sin(inc)
      const z = orbitRadius * Math.sin(th) * Math.cos(inc)
      pts.push(new Vector3(x, y, z))
    }
    return pts
  }, [orbitRadius])

  useFrame(({ clock }) => {
    if (!satRef.current) return
    const t = clock.elapsedTime * 0.18 // orbital speed
    const inc = (98.6 * Math.PI) / 180
    const x = orbitRadius * Math.cos(t)
    const y = orbitRadius * Math.sin(t) * Math.sin(inc)
    const z = orbitRadius * Math.sin(t) * Math.cos(inc)

    satRef.current.position.set(x, y, z)
    // Point sensor beam down towards earth center (0,0,0)
    satRef.current.lookAt(0, 0, 0)

    if (beamRef.current) {
      const pulse = 0.25 + 0.15 * Math.sin(clock.elapsedTime * 4.0)
      const mat = beamRef.current.material as MeshBasicMaterial
      mat.opacity = pulse
    }
  })

  return (
    <group>
      {/* Orbital track ring */}
      <Line
        points={orbitPoints}
        color="#4fd1e8"
        lineWidth={1.2}
        transparent
        opacity={0.35}
        dashed
        dashScale={24}
        dashSize={1}
        gapSize={0.6}
        depthWrite={false}
      />
      {/* Secondary faint orbit glow */}
      <Line
        points={orbitPoints}
        color="#1e90ff"
        lineWidth={4}
        transparent
        opacity={0.12}
        depthWrite={false}
      />

      {/* Satellite Craft Group */}
      <group ref={satRef}>
        {/* Main Bus (Gold/Silver payload body) */}
        <mesh>
          <boxGeometry args={[0.024, 0.024, 0.04]} />
          <meshBasicMaterial color="#e0a840" />
        </mesh>
        {/* Optical Sensor Aperture (pointing along +Z towards lookAt target) */}
        <mesh position={[0, 0, 0.022]}>
          <cylinderGeometry args={[0.008, 0.008, 0.006, 16]} />
          <meshBasicMaterial color="#05070c" />
        </mesh>
        {/* Solar Wing (single-wing design matching real Sentinel-2) */}
        <mesh position={[0.042, 0, 0]}>
          <boxGeometry args={[0.06, 0.02, 0.002]} />
          <meshBasicMaterial color="#1a4c8a" />
        </mesh>
        {/* Status Beacon LED */}
        <mesh position={[0, 0.016, 0]}>
          <sphereGeometry args={[0.004, 8, 8]} />
          <meshBasicMaterial color="#4fd1e8" />
        </mesh>

        {/* Downward Multispectral Swath Beam */}
        <mesh ref={beamRef} position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.045, 0.12, 16, 1, true]} />
          <meshBasicMaterial
            color="#4fd1e8"
            transparent
            opacity={0.3}
            blending={AdditiveBlending}
            depthWrite={false}
            side={BackSide}
          />
        </mesh>
      </group>
    </group>
  )
}

type Tier = 'high' | 'medium'

function Earth({
  tier,
  state,
  onReady,
  light = false,
}: {
  tier: Tier
  state: HeroState
  onReady: () => void
  light?: boolean
}) {
  const k = tier === 'high' ? '4k' : '2k'
  const [day, night, water] = useTexture([
    `/textures/earth-day-${k}.webp`,
    `/textures/earth-night-${k}.webp`,
    '/textures/earth-water-2k.webp',
  ])
  const gl = useThree((s) => s.gl)
  const pointer = useThree((s) => s.pointer)

  useMemo(() => {
    day.colorSpace = SRGBColorSpace
    night.colorSpace = SRGBColorSpace
    water.colorSpace = NoColorSpace
    const an = Math.min(16, gl.capabilities.getMaxAnisotropy())
    day.anisotropy = an
    night.anisotropy = an
  }, [day, night, water, gl])

  const sun = useMemo(() => {
    const s = subsolarPoint()
    return latLonToVec3(s.lat, s.lon)
  }, [])

  const earthMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: earthVert,
        fragmentShader: earthFrag,
        uniforms: {
          uDay: { value: day },
          uNight: { value: night },
          uWater: { value: water },
          uSun: { value: new Vector3() },
          uRim: { value: light ? new Color('#9cc3e6') : new Color('#5fa8f5').multiplyScalar(1.2) },
          uTime: { value: 0 },
          uLight: { value: light ? 1 : 0 },
        },
      }),
    [day, night, water, light],
  )

  // Outer glow atmosphere
  const atmoMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        uniforms: {
          uColor: { value: new Color(light ? '#8fb8de' : '#4a9de0') },
          uSun: { value: new Vector3() },
        },
        side: BackSide,
        blending: light ? NormalBlending : AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [light],
  )

  // Inner haze
  const hazeColor = useMemo(() => new Color('#2a6cb5'), [])
  const hazeMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        uniforms: {
          uColor: { value: hazeColor },
          uSun: { value: new Vector3() },
        },
        side: BackSide,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [hazeColor],
  )

  // AP boundary
  const [apPts, setApPts] = useState<Vector3[] | null>(null)
  useEffect(() => {
    fetchJson<FeatureCollection<MultiPolygon | Polygon>>(DATA.apGlobe).then((fc) => {
      const g = fc.features[0].geometry
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
      const ring = polys.reduce((a, b) => (b[0].length > a[0].length ? b : a))[0]
      setApPts(ring.map(([lon, lat]) => latLonToVec3(lat, lon, 1.002)))
    })
  }, [])
  const zonePos = useMemo(() => latLonToVec3(ZONE.lat, ZONE.lon, 1.003), [])

  const group = useRef<Group>(null)
  const apLine = useRef<Line2>(null)
  const apGlow = useRef<Line2>(null)
  const apSuperGlow = useRef<Line2>(null)
  const marker = useRef<Mesh>(null)
  const markerInner = useRef<Mesh>(null)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const tmp = useMemo(() => new Vector3(), [])

  // Smooth mouse parallax damping vectors
  const mouseParallax = useRef({ x: 0, y: 0 })

  useEffect(() => {
    onReady()
  }, [onReady])

  useFrame(({ clock }) => {
    const p = state.progress
    const t = (performance.now() - state.t0) / 1000
    const { lat, lon, dist, centred: s2 } = cameraAt(p, t)

    // Interactive mouse parallax damping (diminishes as we zoom into the road)
    const parallaxWeight = Math.max(0, 1 - p * 1.5) * 0.05
    mouseParallax.current.x += (pointer.x * parallaxWeight - mouseParallax.current.x) * 0.06
    mouseParallax.current.y += (pointer.y * parallaxWeight - mouseParallax.current.y) * 0.06

    const [rx, ry] = facing(lat, lon)
    if (group.current) {
      group.current.rotation.set(
        rx - mouseParallax.current.y * 0.4,
        ry + mouseParallax.current.x * 0.6,
        0,
        'XYZ',
      )
    }

    camera.position.set(0, 0, dist)
    camera.lookAt(0, 0, 0)

    const wide = size.width / size.height > 1.15
    const shift = wide ? -0.2 * size.width * (1 - s2) : 0
    const lift = wide ? 0 : -0.12 * size.height * (1 - s2)
    camera.setViewOffset(size.width, size.height, shift, lift, size.width, size.height)
    camera.updateProjectionMatrix()

    // Animate sun direction and time uniform
    if (group.current) {
      tmp.copy(sun).applyEuler(group.current.rotation).normalize()
      earthMat.uniforms.uSun.value.copy(tmp)
      earthMat.uniforms.uTime.value = clock.elapsedTime
      atmoMat.uniforms.uSun.value.copy(tmp)
      hazeMat.uniforms.uSun.value.copy(tmp)
    }

    // AP boundary draw-in
    const draw = clamp01(smooth(0.33, 0.5, p))
    for (const l of [apLine.current, apGlow.current, apSuperGlow.current]) {
      if (!l) continue
      const segs = (l.geometry.attributes.instanceStart?.count ?? 0) as number
      l.geometry.instanceCount = Math.floor(segs * draw)
      l.visible = draw > 0.001
    }

    // Zone marker: dual-ring pulse
    if (marker.current && markerInner.current) {
      const m = smooth(0.5, 0.58, p)
      const pulse = 1 + 0.22 * Math.sin(t * 2.8)
      const pulseInner = 1 + 0.12 * Math.sin(t * 2.8 + 1.0)
      marker.current.scale.setScalar(m * pulse * 0.0025)
      markerInner.current.scale.setScalar(m * pulseInner * 0.0015)
      marker.current.visible = m > 0.01
      markerInner.current.visible = m > 0.01
    }
  })

  return (
    <group ref={group}>
      {/* Earth */}
      <mesh material={earthMat}>
        <sphereGeometry args={[1, 128, 96]} />
      </mesh>

      {/* Inner atmosphere haze */}
      <mesh material={hazeMat} scale={1.032}>
        <sphereGeometry args={[1, 48, 36]} />
      </mesh>

      {/* Outer atmosphere glow */}
      <mesh material={atmoMat} scale={1.095}>
        <sphereGeometry args={[1, 64, 48]} />
      </mesh>

      {/* Sentinel-2 Satellite in Sun-Synchronous Orbit */}
      <SentinelSatellite orbitRadius={1.124} />

      {/* AP super-glow (wide, very faint) */}
      {apPts && (
        <Line
          ref={apSuperGlow}
          points={apPts}
          color={light ? '#0f6e6e' : '#4fd1e8'}
          lineWidth={22}
          transparent
          opacity={0.06}
          depthWrite={false}
        />
      )}
      {/* AP glow */}
      {apPts && (
        <Line
          ref={apGlow}
          points={apPts}
          color={light ? '#0f6e6e' : '#4fd1e8'}
          lineWidth={9}
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      )}
      {/* AP outline */}
      {apPts && (
        <Line
          ref={apLine}
          points={apPts}
          color={light ? '#0c5c5c' : '#7ee8f8'}
          lineWidth={1.8}
          transparent
          opacity={0.98}
        />
      )}

      {/* Zone A marker — outer pulse ring */}
      <mesh
        ref={marker}
        position={zonePos}
        onUpdate={(m) => m.lookAt(zonePos.clone().multiplyScalar(2))}
      >
        <ringGeometry args={[0.75, 1, 64]} />
        <meshBasicMaterial color={light ? '#0f6e6e' : '#4fd1e8'} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {/* Zone A marker — inner dot */}
      <mesh
        ref={markerInner}
        position={zonePos}
        onUpdate={(m) => m.lookAt(zonePos.clone().multiplyScalar(2))}
      >
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial color={light ? '#c2410c' : '#ffb547'} transparent opacity={0.95} depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function HeroScene({
  tier,
  state,
  active,
  onReady,
  light = false,
}: {
  tier: Tier
  state: HeroState
  active: boolean
  onReady: () => void
  light?: boolean
}) {
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={tier === 'high' ? [1, 2] : [1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 30, near: 0.01, far: 200, position: [0, 0, CAMERA_START_DIST] }}
      aria-hidden
    >
      {!light && <Stars />}
      <Earth tier={tier} state={state} onReady={onReady} light={light} />
    </Canvas>
  )
}

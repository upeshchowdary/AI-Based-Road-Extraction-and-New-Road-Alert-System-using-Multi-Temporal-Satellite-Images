/**
 * Hero "orbit → road" globe (UI_PROMPT.md H1). Lazy-loaded after first paint.
 * The scroll progress lives in a mutable object (no React re-render per frame).
 */
import { Line, useTexture } from '@react-three/drei'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  NoColorSpace,
  PerspectiveCamera,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three'
import type { Line2 } from 'three-stdlib'
import { fetchJson, DATA } from '@/lib/data'
import { CAMERA_START_DIST, ZONE, cameraAt } from './cameraPath'
import { clamp01, facing, latLonToXYZ, smooth, subsolarPoint } from './geo'

const latLonToVec3 = (lat: number, lon: number, r = 1) => new Vector3(...latLonToXYZ(lat, lon, r))

export interface HeroState {
  progress: number
  /** performance.now() at mount — idle rotation clock shared with the HUD */
  t0: number
}


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
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(cameraPosition - vW);
    float ndl = dot(n, uSun);
    float dayMix = smoothstep(-0.10, 0.20, ndl);
    vec3 day = texture2D(uDay, vUv).rgb;
    vec3 night = texture2D(uNight, vUv).rgb;
    float water = texture2D(uWater, vUv).r;
    vec3 dayCol = day * (0.3 + 1.0 * max(ndl, 0.0));
    vec3 h = normalize(uSun + v);
    dayCol += vec3(1.0, 0.9, 0.75) * pow(max(dot(n, h), 0.0), 320.0) * water * 0.14;
    vec3 nightCol = night * vec3(1.0, 0.78, 0.48) * 2.2 + day * 0.045;
    vec3 col = mix(nightCol, dayCol, dayMix);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    col += uRim * fres * (0.12 + 0.45 * dayMix);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
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
    // Back faces of the shell: d = 0 at the shell silhouette, ~0.37 where the ray grazes the Earth limb.
    float d = -dot(normalize(vN), v);
    float rim = pow(smoothstep(0.0, 0.34, d), 2.4);
    float lit = 0.3 + 0.7 * smoothstep(-0.35, 0.35, dot(normalize(vN), uSun));
    gl_FragColor = vec4(uColor * rim * lit * 1.25, rim * lit);
    #include <colorspace_fragment>
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
  const geo = useMemo(() => {
    const r = mulberry(1564)
    const n = 1400
    const pos: number[] = []
    const col: number[] = []
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1
      const t = r() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      pos.push(40 * s * Math.cos(t), 40 * u, 40 * s * Math.sin(t))
      const b = 0.35 + r() * 0.65
      col.push(b, b, b * (0.92 + r() * 0.1))
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new Float32BufferAttribute(col, 3))
    return g
  }, [])
  return (
    <points geometry={geo}>
      <pointsMaterial size={1.6} sizeAttenuation={false} vertexColors transparent opacity={0.75} depthWrite={false} />
    </points>
  )
}

type Tier = 'high' | 'medium'

function Earth({ tier, state, onReady }: { tier: Tier; state: HeroState; onReady: () => void }) {
  const k = tier === 'high' ? '4k' : '2k'
  const [day, night, water] = useTexture([
    `/textures/earth-day-${k}.webp`,
    `/textures/earth-night-${k}.webp`,
    '/textures/earth-water-2k.webp',
  ])
  const gl = useThree((s) => s.gl)
  useMemo(() => {
    day.colorSpace = SRGBColorSpace
    night.colorSpace = SRGBColorSpace
    water.colorSpace = NoColorSpace
    const an = Math.min(8, gl.capabilities.getMaxAnisotropy())
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
          uRim: { value: new Color('#4fd1e8').multiplyScalar(0.9) },
        },
      }),
    [day, night, water],
  )
  const atmoMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        uniforms: { uColor: { value: new Color('#6cc9f0') }, uSun: { value: new Vector3() } },
        side: BackSide,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  )

  // Andhra Pradesh outline (OSM boundary), drawn progressively during stage 3.
  const [apPts, setApPts] = useState<Vector3[] | null>(null)
  useEffect(() => {
    fetchJson<FeatureCollection<MultiPolygon | Polygon>>(DATA.apGlobe).then((fc) => {
      const g = fc.features[0].geometry
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
      const ring = polys.reduce((a, b) => (b[0].length > a[0].length ? b : a))[0]
      setApPts(ring.map(([lon, lat]) => latLonToVec3(lat, lon, 1.0015)))
    })
  }, [])
  const zonePos = useMemo(() => latLonToVec3(ZONE.lat, ZONE.lon, 1.002), [])

  const group = useRef<Group>(null)
  const apLine = useRef<Line2>(null)
  const apGlow = useRef<Line2>(null)
  const marker = useRef<Mesh>(null)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const tmp = useMemo(() => new Vector3(), [])

  useEffect(() => {
    onReady()
  }, [onReady])

  useFrame(() => {
    const p = state.progress
    const t = (performance.now() - state.t0) / 1000
    const { lat, lon, dist, centred: s2 } = cameraAt(p, t)

    const [rx, ry] = facing(lat, lon)
    if (group.current) group.current.rotation.set(rx, ry, 0, 'XYZ')
    camera.position.set(0, 0, dist)
    camera.lookAt(0, 0, 0)

    // Globe sits right of the headline at first, then centres as the dive starts.
    const wide = size.width / size.height > 1.15
    const shift = wide ? -0.2 * size.width * (1 - s2) : 0
    const lift = wide ? 0 : -0.12 * size.height * (1 - s2)
    camera.setViewOffset(size.width, size.height, shift, lift, size.width, size.height)
    camera.updateProjectionMatrix()

    // Sun direction must follow the globe rotation so the terminator stays geographically fixed.
    if (group.current) {
      tmp.copy(sun).applyEuler(group.current.rotation).normalize()
      earthMat.uniforms.uSun.value.copy(tmp)
      atmoMat.uniforms.uSun.value.copy(tmp)
    }

    const draw = clamp01(smooth(0.33, 0.5, p))
    for (const l of [apLine.current, apGlow.current]) {
      if (!l) continue
      const segs = (l.geometry.attributes.instanceStart?.count ?? 0) as number
      l.geometry.instanceCount = Math.floor(segs * draw)
      l.visible = draw > 0.001
    }
    if (marker.current) {
      const m = smooth(0.5, 0.58, p)
      const pulse = 1 + 0.18 * Math.sin(t * 3)
      marker.current.scale.setScalar(m * pulse * 0.0022)
      marker.current.visible = m > 0.01
    }

  })

  return (
    <group ref={group}>
      <mesh material={earthMat}>
        <sphereGeometry args={[1, 128, 96]} />
      </mesh>
      <mesh material={atmoMat} scale={1.07}>
        <sphereGeometry args={[1, 64, 48]} />
      </mesh>
      {apPts && (
        <>
          <Line ref={apGlow} points={apPts} color="#4fd1e8" lineWidth={7} transparent opacity={0.18} depthWrite={false} />
          <Line ref={apLine} points={apPts} color="#4fd1e8" lineWidth={1.6} transparent opacity={0.95} />
        </>
      )}
      <mesh ref={marker} position={zonePos} onUpdate={(m) => m.lookAt(zonePos.clone().multiplyScalar(2))}>
        <ringGeometry args={[0.8, 1, 48]} />
        <meshBasicMaterial color="#4fd1e8" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function HeroScene({
  tier,
  state,
  active,
  onReady,
}: {
  tier: Tier
  state: HeroState
  active: boolean
  onReady: () => void
}) {
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={tier === 'high' ? [1, 2] : [1, 1.5]}
      gl={{ antialias: tier === 'high', alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 32, near: 0.01, far: 100, position: [0, 0, CAMERA_START_DIST] }}
      aria-hidden
    >
      <Stars />
      <Earth tier={tier} state={state} onReady={onReady} />
    </Canvas>
  )
}

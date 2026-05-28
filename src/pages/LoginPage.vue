<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import * as THREE from 'three'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const email = ref('demo@libra.local')
const password = ref('demo1234')
const error = ref<string | null>(null)
const submitting = ref(false)
const webglContainer = ref<HTMLElement | null>(null)
const loginTheme = ref<'dark' | 'light'>('dark')
const themeLabel = computed(() => loginTheme.value === 'dark' ? 'DARK' : 'LIGHT')
const themeIcon = computed(() => loginTheme.value === 'dark' ? 'ph ph-moon' : 'ph ph-sun')

let disposeWebgl: (() => void) | null = null
let applyShaderTheme: ((theme: 'dark' | 'light') => void) | null = null

async function onSubmit() {
  error.value = null
  submitting.value = true
  try {
    await auth.login({ email: email.value, password: password.value })
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.replace(redirect)
  } catch (e: any) {
    error.value = e?.response?.data?.detail || e?.message || '로그인 실패'
  } finally {
    submitting.value = false
  }
}

function syncTheme(theme: 'dark' | 'light') {
  loginTheme.value = theme
  localStorage.setItem('theme', theme)
  document.body.classList.toggle('dark-theme', theme === 'dark')
  applyShaderTheme?.(theme)
}

function toggleTheme() {
  syncTheme(loginTheme.value === 'dark' ? 'light' : 'dark')
}

function initLoginWebgl() {
  const container = webglContainer.value
  const loginPage = document.getElementById('login-page')
  if (!container || !loginPage) return

  container.innerHTML = ''

  const getComputedColors = () => {
    const styles = getComputedStyle(loginPage)
    return {
      core: new THREE.Color(styles.getPropertyValue('--shader-core').trim()),
      fringe: new THREE.Color(styles.getPropertyValue('--shader-fringe').trim())
    }
  }

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
  camera.position.z = 1.5

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.domElement.style.pointerEvents = 'none'
  container.appendChild(renderer.domElement)

  const geometry = new THREE.PlaneGeometry(2, 2)
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `
  const fragmentShader = `
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    uniform vec3 u_colorCore;
    uniform vec3 u_colorFringe;
    uniform float u_isLightMode;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      vec2 shift = vec2(100.0);
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < 4; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      vec2 st = uv;
      st.x *= u_resolution.x / u_resolution.y;

      vec2 mouseOffset = (u_mouse - 0.5) * 0.08;
      st += mouseOffset;

      vec2 q = vec2(
        fbm(st * 1.5 + vec2(u_time * 0.04)),
        fbm(st * 1.8 - vec2(u_time * 0.02))
      );
      vec2 r = vec2(
        fbm(st * 1.2 + q + vec2(1.7, 9.2) + vec2(u_time * 0.03)),
        fbm(st * 1.6 + q + vec2(8.3, 2.8) - vec2(u_time * 0.02))
      );
      float nebulaStrength = fbm(st * 2.0 + r);

      vec3 colNebula = mix(u_colorFringe * 0.15, u_colorCore, nebulaStrength * 0.8);
      colNebula += u_colorFringe * (r.x * 0.35);

      vec2 starSt = st * 45.0;
      vec2 ipos = floor(starSt);
      vec2 fpos = fract(starSt);
      float starNoise = hash(ipos);
      float starIntensity = 0.0;
      if (starNoise > 0.96) {
        vec2 offset = vec2(hash(ipos + vec2(13.0)), hash(ipos + vec2(37.0))) * 0.8 + 0.1;
        float dist = length(fpos - offset);
        float glow = exp(-dist * (60.0 - 40.0 * sin(u_time * (2.0 + starNoise * 3.0) + starNoise * 10.0)));
        starIntensity = glow * (0.3 + 0.7 * hash(ipos + vec2(99.0)));
      }
      vec3 colStars = vec3(starIntensity) * 0.9;

      vec3 finalColor = colNebula + colStars;
      finalColor = vec3(1.0) - exp(-finalColor * 1.8);
      float alpha = clamp(nebulaStrength * 1.2 + starIntensity * 0.8 + 0.1, 0.0, 1.0);

      if(u_isLightMode > 0.5) {
        alpha = clamp((nebulaStrength * 0.6 + starIntensity * 0.2), 0.0, 0.35);
      }

      gl_FragColor = vec4(finalColor, alpha);
    }
  `

  const colors = getComputedColors()
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_colorCore: { value: colors.core },
      u_colorFringe: { value: colors.fringe },
      u_isLightMode: { value: loginTheme.value === 'light' ? 1.0 : 0.0 }
    },
    transparent: true,
    blending: THREE.NormalBlending
  })

  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  const constellationGroup = new THREE.Group()
  constellationGroup.position.set(-0.4, 0.0, 0.0)
  scene.add(constellationGroup)

  const starPositions = [
    new THREE.Vector3(0.0, 0.45, 0.1),
    new THREE.Vector3(-0.35, 0.05, 0.0),
    new THREE.Vector3(0.35, 0.15, 0.0),
    new THREE.Vector3(-0.15, -0.4, 0.05),
    new THREE.Vector3(0.2, -0.3, 0.02),
    new THREE.Vector3(0.32, -0.45, 0.05)
  ]
  const lineIndices = [0, 1, 0, 2, 1, 3, 2, 4, 4, 5, 1, 2]
  const lineVertices: number[] = []
  for (const lineIndex of lineIndices) {
    const p = starPositions[lineIndex]
    lineVertices.push(p.x, p.y, p.z)
  }

  const lineGeometry = new THREE.BufferGeometry()
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lineVertices, 3))
  const lineMaterial = new THREE.LineBasicMaterial({
    color: loginTheme.value === 'light' ? 0x121316 : 0x8ba3cc,
    transparent: true,
    opacity: loginTheme.value === 'light' ? 0.85 : 0.35,
    blending: loginTheme.value === 'light' ? THREE.NormalBlending : THREE.AdditiveBlending
  })
  const constellationLines = new THREE.LineSegments(lineGeometry, lineMaterial)
  constellationGroup.add(constellationLines)

  const createCircleTexture = (mode: 'dark' | 'light') => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    if (!ctx) return new THREE.CanvasTexture(canvas)

    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    if (mode === 'light') {
      gradient.addColorStop(0, 'rgba(18, 19, 22, 1)')
      gradient.addColorStop(0.35, 'rgba(18, 19, 22, 0.9)')
      gradient.addColorStop(0.7, 'rgba(18, 19, 22, 0.3)')
      gradient.addColorStop(1, 'rgba(18, 19, 22, 0)')
    } else {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    }
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 32, 32)
    return new THREE.CanvasTexture(canvas)
  }

  let starTexture = createCircleTexture(loginTheme.value)
  const pointsGeometry = new THREE.BufferGeometry()
  const pointsVertices: number[] = []
  starPositions.forEach((p) => pointsVertices.push(p.x, p.y, p.z))
  pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pointsVertices, 3))
  const pointsMaterial = new THREE.PointsMaterial({
    size: loginTheme.value === 'light' ? 0.18 : 0.15,
    color: loginTheme.value === 'light' ? 0x121316 : 0xffffff,
    map: starTexture,
    transparent: true,
    opacity: loginTheme.value === 'light' ? 0.95 : 1.0,
    blending: loginTheme.value === 'light' ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false
  })
  const constellationPoints = new THREE.Points(pointsGeometry, pointsMaterial)
  constellationGroup.add(constellationPoints)

  let targetMouse = new THREE.Vector2(0.5, 0.5)
  const handleMouseMove = (e: MouseEvent) => {
    targetMouse.x = e.clientX / window.innerWidth
    targetMouse.y = 1.0 - e.clientY / window.innerHeight
  }
  document.addEventListener('mousemove', handleMouseMove)

  const clock = new THREE.Clock()
  let animationId = 0
  const animate = () => {
    animationId = requestAnimationFrame(animate)
    const elapsedTime = clock.getElapsedTime()
    material.uniforms.u_time.value = elapsedTime
    material.uniforms.u_mouse.value.lerp(targetMouse, 0.05)

    const targetRotY = (targetMouse.x - 0.5) * 0.45
    const targetRotX = -(targetMouse.y - 0.5) * 0.45
    constellationGroup.rotation.y = THREE.MathUtils.lerp(constellationGroup.rotation.y, targetRotY, 0.05)
    constellationGroup.rotation.x = THREE.MathUtils.lerp(constellationGroup.rotation.x, targetRotX, 0.05)
    constellationGroup.position.y = Math.sin(elapsedTime * 0.8) * 0.02

    renderer.render(scene, camera)
  }
  animate()

  const handleResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
    material.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', handleResize)

  applyShaderTheme = (theme: 'dark' | 'light') => {
    setTimeout(() => {
      const nextColors = getComputedColors()
      material.uniforms.u_colorCore.value = nextColors.core
      material.uniforms.u_colorFringe.value = nextColors.fringe
      material.uniforms.u_isLightMode.value = theme === 'light' ? 1.0 : 0.0
    }, 50)

    lineMaterial.color.setHex(theme === 'light' ? 0x121316 : 0x8ba3cc)
    lineMaterial.opacity = theme === 'light' ? 0.85 : 0.35
    lineMaterial.blending = theme === 'light' ? THREE.NormalBlending : THREE.AdditiveBlending
    pointsMaterial.color.setHex(theme === 'light' ? 0x121316 : 0xffffff)
    pointsMaterial.size = theme === 'light' ? 0.18 : 0.15
    pointsMaterial.opacity = theme === 'light' ? 0.95 : 1.0
    pointsMaterial.blending = theme === 'light' ? THREE.NormalBlending : THREE.AdditiveBlending
    starTexture.dispose()
    starTexture = createCircleTexture(theme)
    pointsMaterial.map = starTexture
    pointsMaterial.needsUpdate = true
  }

  disposeWebgl = () => {
    cancelAnimationFrame(animationId)
    document.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('resize', handleResize)
    scene.remove(mesh)
    scene.remove(constellationGroup)
    geometry.dispose()
    material.dispose()
    lineGeometry.dispose()
    lineMaterial.dispose()
    pointsGeometry.dispose()
    pointsMaterial.dispose()
    starTexture.dispose()
    renderer.dispose()
    renderer.domElement.remove()
    applyShaderTheme = null
    disposeWebgl = null
  }
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
  syncTheme(savedTheme)
  initLoginWebgl()
})

onBeforeUnmount(() => {
  disposeWebgl?.()
})
</script>

<template>
  <section id="login-page" class="view-section" :data-theme="loginTheme">
    <div id="webgl-container" ref="webglContainer" aria-hidden="true"></div>

    <div class="top-bar">
      <div class="version-tag">V03.01</div>
      <button type="button" class="theme-toggle" @click="toggleTheme">
        <i :class="themeIcon"></i>
        <span>{{ themeLabel }}</span>
      </button>
    </div>

    <div class="tech-label label-top-left">SYS.CORE // ON-LINE</div>
    <div class="tech-label label-bottom-left">UPLINK_ESTABLISHED_</div>
    <div class="tech-label label-vertical-right">
      <span>TELE</span>
      <span>=</span>
      <span>PROMPT</span>
      <span>-3R</span>
    </div>

    <div class="layout-grid">
      <div class="auth-wrapper">
        <div class="auth-panel">
          <div class="header-group">
            <div class="system-badge">AURA.IDENTITY</div>
            <h1>Authenticate</h1>
            <p class="subtitle">Secure bio-metric or credential access.</p>
          </div>

          <div class="sso-grid">
            <button type="button" class="btn-sso" aria-label="Sign in with Apple" disabled>
              <i class="ph-fill ph-apple-logo"></i>
            </button>
            <button type="button" class="btn-sso" aria-label="Sign in with Google" disabled>
              <i class="ph-fill ph-google-logo"></i>
            </button>
            <button type="button" class="btn-sso" aria-label="Sign in with Github" disabled>
              <i class="ph-fill ph-github-logo"></i>
            </button>
          </div>

          <div class="sso-divider">STANDARD PROTOCOL</div>

          <form id="login-form" class="form-group" @submit.prevent="onSubmit">
            <div class="input-wrapper">
              <label for="login-email">IDENTIFIER</label>
              <input
                id="login-email"
                v-model="email"
                type="email"
                placeholder="user@domain.net"
                required
                autocomplete="email"
              />
            </div>
            <div class="input-wrapper">
              <label for="login-password">PASSCODE</label>
              <input
                id="login-password"
                v-model="password"
                type="password"
                placeholder="••••••••••••"
                required
                autocomplete="current-password"
              />
            </div>

            <p v-if="error" class="auth-error">{{ error }}</p>

            <button id="btn-signin-submit" type="submit" class="btn-primary" :disabled="submitting">
              {{ submitting ? 'UPLINKING...' : 'INITIALIZE UPLINK' }}
              <i class="ph ph-arrow-right"></i>
            </button>
          </form>

          <div class="auth-footer">
            <span class="auth-foot-text">신규 식별자 발급</span>
            <RouterLink id="btn-goto-signup" to="/signup" class="auth-foot-link">REGISTER&nbsp;→</RouterLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
@import url('https://unpkg.com/@phosphor-icons/web@2.1.2/src/regular/style.css');
@import url('https://unpkg.com/@phosphor-icons/web@2.1.2/src/fill/style.css');
@import '@/assets/jy-design/login.css';

#login-page .auth-error {
  color: #ffb3ba;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  margin: 0;
}
</style>

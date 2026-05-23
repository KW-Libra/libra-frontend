<script setup lang="ts">
import { computed } from 'vue'

/**
 * LibraScale — 바로크 양식 은색 정밀 천칭.
 * 기본 도형(rect/circle/ellipse/line/polygon) 미사용. <path> + gradient/filter 로만 구성.
 *
 * tilt:  -1(왼쪽 무거움) ~ 0(평형) ~ +1(오른쪽 무거움)
 * leftWeight / rightWeight: 옵션. 주어지면 자동으로 tilt 계산.
 */
const props = withDefaults(
  defineProps<{
    tilt?: number
    leftWeight?: number
    rightWeight?: number
    leftLabel?: string
    rightLabel?: string
    size?: number
    animated?: boolean
    palette?: 'brass' | 'silver' | 'obsidian'
  }>(),
  {
    tilt: 0,
    size: 360,
    animated: true,
    palette: 'silver',
  },
)

const autoTilt = computed(() => {
  if (props.leftWeight == null || props.rightWeight == null) return props.tilt
  const sum = props.leftWeight + props.rightWeight
  if (sum === 0) return 0
  const raw = (props.rightWeight - props.leftWeight) / sum
  return Math.max(-1, Math.min(1, raw))
})

const tiltDeg = computed(() => autoTilt.value * 12)

// 무거운 쪽은 크게 떨어지고, 가벼운 쪽은 약간 들어올려짐 (비대칭 = 중력감)
const leftDrop = computed(() => {
  const t = autoTilt.value
  return t < 0 ? -t * 26 : -t * 6
})
const rightDrop = computed(() => {
  const t = autoTilt.value
  return t > 0 ? t * 26 : t * 6
})
// 무거운 쪽 체인은 팽팽(불투명도 1), 가벼운 쪽은 약간 늘어진 느낌(0.88)
const leftChainSlack = computed(() => (autoTilt.value > 0.1 ? 0.86 : 1))
const rightChainSlack = computed(() => (autoTilt.value < -0.1 ? 0.86 : 1))

const palettes = {
  brass: {
    metalHi: '#FFE7A8',
    metal: '#D9A24A',
    metalDark: '#7A4A14',
    metalShadow: '#3A2008',
    engrave: '#5C3206',
    pillar1: '#F3E4C2',
    pillar2: '#C9A66B',
    pillar3: '#7A5524',
    plinth1: '#2A1B0A',
    plinth2: '#0F0905',
    glow: '#FFD27A',
  },
  silver: {
    metalHi: '#FFFFFF',
    metal: '#C8C8C8',
    metalDark: '#4A4A4A',
    metalShadow: '#1A1A1A',
    engrave: '#2A2A2A',
    pillar1: '#F0F0F0',
    pillar2: '#9A9A9A',
    pillar3: '#3A3A3A',
    plinth1: '#181818',
    plinth2: '#060606',
    glow: '#E8E8E8',
  },
  obsidian: {
    metalHi: '#7B6CCB',
    metal: '#3F347D',
    metalDark: '#1B1448',
    metalShadow: '#06031C',
    engrave: '#0E0934',
    pillar1: '#3D3470',
    pillar2: '#221A52',
    pillar3: '#0B0832',
    plinth1: '#0A0728',
    plinth2: '#020014',
    glow: '#9C8BFF',
  },
} as const

const c = computed(() => palettes[props.palette])

// 탄성/오버슈트 곡선 — 무거운 쪽이 떨어졌다가 살짝 튀고 안착
const spring = 'cubic-bezier(.17,.67,.35,1.4)'

// 빔이 먼저 기울고, 체인/접시는 살짝 늦게 따라옴 → 관성/중력감
const beamStyle = computed(() => ({
  transform: `rotate(${tiltDeg.value}deg)`,
  transformOrigin: '250px 200px',
  transition: props.animated ? `transform 520ms ${spring}` : 'none',
}))
const leftChainStyle = computed(() => ({
  transform: `translateY(${leftDrop.value}px)`,
  opacity: leftChainSlack.value,
  transition: props.animated
    ? `transform 760ms ${spring} 120ms, opacity 400ms ease 120ms`
    : 'none',
}))
const rightChainStyle = computed(() => ({
  transform: `translateY(${rightDrop.value}px)`,
  opacity: rightChainSlack.value,
  transition: props.animated
    ? `transform 760ms ${spring} 120ms, opacity 400ms ease 120ms`
    : 'none',
}))
</script>

<template>
  <div class="libra-scale" :style="{ width: `${size}px` }">
    <svg
      viewBox="0 0 500 600"
      :width="size"
      :height="size * 1.2"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Libra balance scale"
    >
      <defs>
        <!-- Metal beam gradient -->
        <linearGradient id="ls-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" :stop-color="c.metalHi" />
          <stop offset="0.4" :stop-color="c.metal" />
          <stop offset="0.75" :stop-color="c.metalDark" />
          <stop offset="1" :stop-color="c.metalShadow" />
        </linearGradient>

        <!-- 3D sphere gradient — used for finial knobs / column knobs -->
        <radialGradient id="ls-sphere" cx="0.35" cy="0.28" r="0.75">
          <stop offset="0" :stop-color="c.metalHi" />
          <stop offset="0.35" :stop-color="c.metal" />
          <stop offset="0.85" :stop-color="c.metalDark" />
          <stop offset="1" :stop-color="c.metalShadow" />
        </radialGradient>

        <!-- Small reflective sphere -->
        <radialGradient id="ls-sphere-sm" cx="0.32" cy="0.25" r="0.7">
          <stop offset="0" :stop-color="c.metalHi" />
          <stop offset="0.5" :stop-color="c.metal" />
          <stop offset="1" :stop-color="c.metalShadow" />
        </radialGradient>

        <!-- Pan inner — shallow concave plate -->
        <radialGradient id="ls-pan-inner" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" :stop-color="c.metalHi" stop-opacity="0.95" />
          <stop offset="0.6" :stop-color="c.metal" />
          <stop offset="1" :stop-color="c.metalDark" />
        </radialGradient>

        <!-- Pan rim brushed metal -->
        <linearGradient id="ls-pan-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" :stop-color="c.metalShadow" />
          <stop offset="0.18" :stop-color="c.metalHi" />
          <stop offset="0.5" :stop-color="c.metal" />
          <stop offset="0.82" :stop-color="c.metalHi" />
          <stop offset="1" :stop-color="c.metalShadow" />
        </linearGradient>

        <!-- Column flute gradient -->
        <linearGradient id="ls-pillar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" :stop-color="c.pillar3" />
          <stop offset="0.2" :stop-color="c.pillar2" />
          <stop offset="0.5" :stop-color="c.pillar1" />
          <stop offset="0.8" :stop-color="c.pillar2" />
          <stop offset="1" :stop-color="c.pillar3" />
        </linearGradient>

        <!-- Base tier gradient -->
        <linearGradient id="ls-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" :stop-color="c.metal" />
          <stop offset="0.5" :stop-color="c.metalDark" />
          <stop offset="1" :stop-color="c.metalShadow" />
        </linearGradient>

        <!-- Chain link gradient -->
        <linearGradient id="ls-chain" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" :stop-color="c.metalShadow" />
          <stop offset="0.4" :stop-color="c.metal" />
          <stop offset="0.55" :stop-color="c.metalHi" />
          <stop offset="0.75" :stop-color="c.metal" />
          <stop offset="1" :stop-color="c.metalDark" />
        </linearGradient>

        <!-- Acanthus leaf gradient -->
        <linearGradient id="ls-leaf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" :stop-color="c.metalHi" />
          <stop offset="0.5" :stop-color="c.metal" />
          <stop offset="1" :stop-color="c.metalDark" />
        </linearGradient>

        <!-- Glow filter -->
        <filter id="ls-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
          <feComponentTransfer><feFuncA type="linear" slope="1.3" /></feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="over" />
        </filter>

        <!-- Drop shadow filter -->
        <filter id="ls-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
          <feOffset dx="0" dy="3" result="off" />
          <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        <!-- Reusable chain link -->
        <symbol id="ls-link" viewBox="-8 -5 16 10">
          <path
            d="M -5 0
               C -5 -3 -2 -4.5  0 -4.5
               C  2 -4.5  5 -3  5  0
               C  5  3  2  4.5  0  4.5
               C -2 4.5 -5  3 -5  0 Z
               M -2.6 0
               C -2.6 -1.7 -1.1 -2.6 0 -2.6
               C  1.1 -2.6  2.6 -1.7  2.6 0
               C  2.6 1.7  1.1  2.6 0  2.6
               C -1.1 2.6 -2.6  1.7 -2.6 0 Z"
            fill="url(#ls-chain)"
            fill-rule="evenodd"
            stroke="#000"
            stroke-opacity="0.45"
            stroke-width="0.4"
          />
        </symbol>

        <!-- Reusable single acanthus leaf, curled tip pointing up-right -->
        <symbol id="ls-acanthus" viewBox="-12 -22 24 22" overflow="visible">
          <path
            d="M 0 0
               C -3 -3 -8 -6 -10 -12
               C -11 -16 -8 -20 -3 -20
               C 0 -19 1 -14 -1 -10
               C -1 -7 2 -6 4 -8
               C 6 -11 5 -16 8 -18
               C 11 -19 12 -14 10 -10
               C 8 -6 4 -3 0 0 Z"
            fill="url(#ls-leaf)"
            stroke="#000"
            stroke-opacity="0.5"
            stroke-width="0.5"
          />
          <path
            d="M -2 -4 C -4 -8 -6 -12 -7 -16"
            fill="none"
            :stroke="c.engrave"
            stroke-width="0.6"
            stroke-linecap="round"
          />
          <path
            d="M 2 -4 C 4 -8 6 -12 7 -16"
            fill="none"
            :stroke="c.engrave"
            stroke-width="0.6"
            stroke-linecap="round"
          />
        </symbol>
      </defs>

      <!-- ===== Ground shadow ===== -->
      <path
        d="M 100 588
           C 100 580  250 576  250 576
           C 250 576  400 580  400 588
           C 400 596  250 600  250 600
           C 250 600  100 596 100 588 Z"
        :fill="c.plinth2"
        opacity="0.55"
        filter="url(#ls-glow)"
      />

      <!-- ===== Base — 3 oval tiers ===== -->
      <!-- Bottom tier (widest, with acanthus around it) -->
      <path
        d="M 130 575
           C 130 562  250 555  250 555
           C 250 555  370 562  370 575
           L 370 583
           C 370 593  250 598  250 598
           C 250 598  130 593 130 583 Z"
        fill="url(#ls-base)"
        stroke="#000"
        stroke-opacity="0.55"
        stroke-width="0.8"
      />
      <!-- Top highlight ring of bottom tier -->
      <path
        d="M 135 560
           C 165 552 335 552 365 560
           C 335 568 165 568 135 560 Z"
        :fill="c.metalHi"
        opacity="0.4"
      />
      <!-- Acanthus leaf pattern around bottom tier -->
      <use href="#ls-acanthus" x="140" y="575" width="22" height="20" transform="rotate(-20 151 575)" />
      <use href="#ls-acanthus" x="175" y="570" width="22" height="20" transform="rotate(-10 186 570)" />
      <use href="#ls-acanthus" x="215" y="568" width="22" height="20" transform="rotate(-5 226 568)" />
      <use href="#ls-acanthus" x="263" y="568" width="22" height="20" transform="rotate(5 274 568)" />
      <use href="#ls-acanthus" x="303" y="570" width="22" height="20" transform="rotate(10 314 570)" />
      <use href="#ls-acanthus" x="338" y="575" width="22" height="20" transform="rotate(20 349 575)" />

      <!-- Middle tier (oval cylinder) -->
      <path
        d="M 165 545
           C 165 535  250 530  250 530
           C 250 530  335 535  335 545
           L 335 555
           C 335 563  250 567  250 567
           C 250 567  165 563  165 555 Z"
        fill="url(#ls-base)"
        stroke="#000"
        stroke-opacity="0.55"
        stroke-width="0.8"
      />
      <path
        d="M 170 532
           C 200 526 300 526 330 532
           C 300 538 200 538 170 532 Z"
        :fill="c.metalHi"
        opacity="0.45"
      />
      <!-- Engraved decorative ring -->
      <path
        d="M 175 550 C 210 555 290 555 325 550"
        :stroke="c.engrave"
        stroke-width="0.7"
        fill="none"
        opacity="0.7"
      />

      <!-- Top tier (smallest, supports column) -->
      <path
        d="M 200 520
           C 200 513  250 510  250 510
           C 250 510  300 513  300 520
           L 300 530
           C 300 537  250 540  250 540
           C 250 540  200 537  200 530 Z"
        fill="url(#ls-base)"
        stroke="#000"
        stroke-opacity="0.55"
        stroke-width="0.8"
      />
      <path
        d="M 205 514
           C 220 510 280 510 295 514
           C 280 518 220 518 205 514 Z"
        :fill="c.metalHi"
        opacity="0.5"
      />

      <!-- ===== Lower decorative knob (sphere with leaves) ===== -->
      <!-- Leaves spreading from below sphere -->
      <use href="#ls-acanthus" x="218" y="505" width="22" height="22" transform="rotate(-25 229 505)" />
      <use href="#ls-acanthus" x="260" y="505" width="22" height="22" transform="rotate(25 271 505)" />

      <!-- Sphere -->
      <path
        d="M 232 490
           C 232 478 240 470 250 470
           C 260 470 268 478 268 490
           C 268 502 260 510 250 510
           C 240 510 232 502 232 490 Z"
        fill="url(#ls-sphere)"
        stroke="#000"
        stroke-opacity="0.55"
        stroke-width="0.7"
      />
      <!-- Sphere highlight -->
      <path
        d="M 238 482 C 242 476 250 475 254 478 C 250 480 244 482 240 486 Z"
        :fill="c.metalHi"
        opacity="0.7"
      />

      <!-- Connector between knob and column -->
      <path
        d="M 240 465
           L 238 472
           L 262 472
           L 260 465 Z"
        fill="url(#ls-beam)"
        stroke="#000"
        stroke-opacity="0.5"
        stroke-width="0.6"
      />

      <!-- ===== Column shaft (fluted, narrow & elegant) ===== -->
      <path
        d="M 238 465
           Q 236 350 240 240
           L 260 240
           Q 264 350 262 465 Z"
        fill="url(#ls-pillar)"
        stroke="#000"
        stroke-opacity="0.5"
        stroke-width="0.7"
      />
      <!-- Fluting grooves -->
      <path d="M 243 245 Q 242 350 242 460" :stroke="c.pillar3" stroke-width="1" fill="none" opacity="0.75" />
      <path d="M 247 244 Q 246 350 246 461" :stroke="c.pillar3" stroke-width="1" fill="none" opacity="0.75" />
      <path d="M 250 243 Q 250 350 250 462" :stroke="c.pillar3" stroke-width="1.1" fill="none" opacity="0.85" />
      <path d="M 253 244 Q 254 350 254 461" :stroke="c.pillar3" stroke-width="1" fill="none" opacity="0.75" />
      <path d="M 257 245 Q 258 350 258 460" :stroke="c.pillar3" stroke-width="1" fill="none" opacity="0.75" />
      <!-- Flute highlights -->
      <path d="M 245 248 Q 244 350 244 458" :stroke="c.pillar1" stroke-width="0.5" fill="none" opacity="0.6" />
      <path d="M 249 246 Q 249 350 249 459" :stroke="c.pillar1" stroke-width="0.5" fill="none" opacity="0.6" />
      <path d="M 252 246 Q 252 350 252 459" :stroke="c.pillar1" stroke-width="0.5" fill="none" opacity="0.6" />
      <path d="M 256 248 Q 257 350 257 458" :stroke="c.pillar1" stroke-width="0.5" fill="none" opacity="0.6" />
      <!-- Column right-side shadow -->
      <path d="M 260 244 Q 264 350 262 464 L 260 464 Q 262 350 258 244 Z" :fill="c.pillar3" opacity="0.5" />

      <!-- ===== Middle knob on column (large reflective sphere) ===== -->
      <path
        d="M 230 350
           C 230 336 239 326 250 326
           C 261 326 270 336 270 350
           C 270 364 261 374 250 374
           C 239 374 230 364 230 350 Z"
        fill="url(#ls-sphere)"
        stroke="#000"
        stroke-opacity="0.55"
        stroke-width="0.7"
      />
      <!-- Specular highlight -->
      <path
        d="M 236 340 C 240 334 248 332 253 335 C 247 338 240 342 237 346 Z"
        :fill="c.metalHi"
        opacity="0.8"
      />
      <!-- Lower shadow crescent -->
      <path
        d="M 234 358 C 240 368 260 368 266 358 C 260 372 240 372 234 358 Z"
        :fill="c.metalShadow"
        opacity="0.55"
      />
      <!-- Decorative engraved band -->
      <path
        d="M 232 350 C 240 354 260 354 268 350"
        :stroke="c.engrave"
        stroke-width="0.5"
        fill="none"
        opacity="0.6"
      />

      <!-- ===== Corinthian capital (top of column) ===== -->
      <!-- Bottom curve of capital -->
      <path
        d="M 232 240
           Q 232 232 240 230
           L 260 230
           Q 268 232 268 240
           Q 250 244 232 240 Z"
        fill="url(#ls-pillar)"
        stroke="#000"
        stroke-opacity="0.5"
        stroke-width="0.6"
      />
      <!-- Acanthus leaves of capital (3 rows, fanning outward) -->
      <use href="#ls-acanthus" x="222" y="232" width="20" height="20" transform="rotate(-30 232 232)" />
      <use href="#ls-acanthus" x="240" y="228" width="20" height="20" transform="rotate(-8 250 228)" />
      <use href="#ls-acanthus" x="258" y="232" width="20" height="20" transform="rotate(30 268 232)" />
      <use href="#ls-acanthus" x="232" y="222" width="18" height="18" transform="rotate(-20 241 222)" />
      <use href="#ls-acanthus" x="250" y="222" width="18" height="18" transform="rotate(20 259 222)" />
      <!-- Abacus (top plate of capital) -->
      <path
        d="M 222 212
           Q 220 204 228 204
           L 272 204
           Q 280 204 278 212
           Q 250 216 222 212 Z"
        fill="url(#ls-pillar)"
        stroke="#000"
        stroke-opacity="0.55"
        stroke-width="0.7"
      />
      <path
        d="M 224 206 L 276 206"
        :stroke="c.pillar1"
        stroke-width="0.6"
        opacity="0.65"
      />

      <!-- ===== Fulcrum pivot (between capital and beam) ===== -->
      <path
        d="M 244 200
           L 240 192
           Q 250 188 260 192
           L 256 200 Z"
        fill="url(#ls-beam)"
        stroke="#000"
        stroke-opacity="0.55"
        stroke-width="0.6"
      />

      <!-- ===== Beam group (rotates with tilt) ===== -->
      <g :style="beamStyle">
        <!-- Baroque arched beam: peaks at center, sweeps down and out -->
        <path
          d="M 60 230
             Q 100 200 150 188
             Q 200 178 250 174
             Q 300 178 350 188
             Q 400 200 440 230
             L 440 244
             Q 400 218 350 206
             Q 300 198 250 195
             Q 200 198 150 206
             Q 100 218 60 244 Z"
          fill="url(#ls-beam)"
          stroke="#000"
          stroke-opacity="0.55"
          stroke-width="0.8"
          filter="url(#ls-shadow)"
        />
        <!-- Top highlight ridge of beam -->
        <path
          d="M 70 226
             Q 110 200 160 192
             Q 205 184 250 181
             Q 295 184 340 192
             Q 390 200 430 226
             Q 390 208 340 200
             Q 295 192 250 189
             Q 205 192 160 200
             Q 110 208 70 226 Z"
          :fill="c.metalHi"
          opacity="0.6"
        />
        <!-- Engraved scroll line along beam -->
        <path
          d="M 80 224
             Q 130 204 180 200
             Q 220 196 250 196
             Q 280 196 320 200
             Q 370 204 420 224"
          :stroke="c.engrave"
          stroke-width="0.7"
          fill="none"
          opacity="0.85"
        />
        <!-- Decorative ticks along beam -->
        <path
          d="M 100 220 l 2 -3 M 130 213 l 2 -3 M 160 207 l 2 -3 M 190 203 l 2 -3 M 220 200 l 2 -3 M 280 200 l 2 -3 M 310 203 l 2 -3 M 340 207 l 2 -3 M 370 213 l 2 -3 M 400 220 l 2 -3"
          :stroke="c.engrave"
          stroke-width="0.6"
          opacity="0.7"
        />

        <!-- ===== Center acanthus crest (3-5 leaves) ===== -->
        <use href="#ls-acanthus" x="226" y="172" width="20" height="22" transform="rotate(-40 236 172)" />
        <use href="#ls-acanthus" x="240" y="166" width="20" height="22" transform="rotate(-15 250 166)" />
        <use href="#ls-acanthus" x="250" y="164" width="20" height="22" transform="rotate(0 260 164)" />
        <use href="#ls-acanthus" x="260" y="166" width="20" height="22" transform="rotate(15 270 166)" />
        <use href="#ls-acanthus" x="274" y="172" width="20" height="22" transform="rotate(40 284 172)" />

        <!-- Central medallion above acanthus -->
        <path
          d="M 244 158
             C 244 151 247 148 250 148
             C 253 148 256 151 256 158
             C 256 165 253 168 250 168
             C 247 168 244 165 244 158 Z"
          fill="url(#ls-sphere-sm)"
          stroke="#000"
          stroke-opacity="0.55"
          stroke-width="0.5"
        />

        <!-- ===== Finial cluster (crown + spheres + cross) ===== -->
        <!-- Connector stem from medallion to lower sphere -->
        <path
          d="M 247 148
             L 247 138
             L 253 138
             L 253 148 Z"
          fill="url(#ls-beam)"
          stroke="#000"
          stroke-opacity="0.5"
          stroke-width="0.4"
        />

        <!-- Large lower sphere -->
        <path
          d="M 236 122
             C 236 110 242 102 250 102
             C 258 102 264 110 264 122
             C 264 134 258 142 250 142
             C 242 142 236 134 236 122 Z"
          fill="url(#ls-sphere)"
          stroke="#000"
          stroke-opacity="0.55"
          stroke-width="0.6"
        />
        <path
          d="M 241 115 C 244 110 250 109 253 112 C 248 114 244 117 242 120 Z"
          :fill="c.metalHi"
          opacity="0.75"
        />

        <!-- Connector neck -->
        <path
          d="M 246 102
             L 246 96
             L 254 96
             L 254 102 Z"
          fill="url(#ls-beam)"
        />

        <!-- Middle smaller sphere -->
        <path
          d="M 240 88
             C 240 81 244 76 250 76
             C 256 76 260 81 260 88
             C 260 95 256 100 250 100
             C 244 100 240 95 240 88 Z"
          fill="url(#ls-sphere-sm)"
          stroke="#000"
          stroke-opacity="0.55"
          stroke-width="0.5"
        />
        <path
          d="M 244 84 C 246 80 250 79 252 81 C 249 83 246 85 245 87 Z"
          :fill="c.metalHi"
          opacity="0.8"
        />

        <!-- Connector pin -->
        <path
          d="M 248 76
             L 248 70
             L 252 70
             L 252 76 Z"
          fill="url(#ls-beam)"
        />

        <!-- Cross/crown (Latin cross with flared ends) -->
        <!-- Vertical bar -->
        <path
          d="M 247 38
             Q 244 38 244 41
             L 244 64
             Q 244 67 247 67
             L 253 67
             Q 256 67 256 64
             L 256 41
             Q 256 38 253 38 Z"
          fill="url(#ls-beam)"
          stroke="#000"
          stroke-opacity="0.55"
          stroke-width="0.5"
          filter="url(#ls-glow)"
        />
        <!-- Horizontal arms -->
        <path
          d="M 232 47
             Q 232 44 235 44
             L 265 44
             Q 268 44 268 47
             L 268 53
             Q 268 56 265 56
             L 235 56
             Q 232 56 232 53 Z"
          fill="url(#ls-beam)"
          stroke="#000"
          stroke-opacity="0.55"
          stroke-width="0.5"
        />
        <!-- Flared arm tips (left/right/top/bottom) -->
        <path
          d="M 232 47 Q 226 50 232 53 Z"
          fill="url(#ls-beam)"
          stroke="#000"
          stroke-opacity="0.5"
          stroke-width="0.4"
        />
        <path
          d="M 268 47 Q 274 50 268 53 Z"
          fill="url(#ls-beam)"
          stroke="#000"
          stroke-opacity="0.5"
          stroke-width="0.4"
        />
        <path
          d="M 244 38 Q 250 32 256 38 Z"
          fill="url(#ls-beam)"
          stroke="#000"
          stroke-opacity="0.5"
          stroke-width="0.4"
        />
        <path
          d="M 244 67 Q 250 72 256 67 Z"
          fill="url(#ls-beam)"
          stroke="#000"
          stroke-opacity="0.5"
          stroke-width="0.4"
        />
        <!-- Top spark sphere -->
        <path
          d="M 247 28
             C 247 24 248 22 250 22
             C 252 22 253 24 253 28
             C 253 32 252 34 250 34
             C 248 34 247 32 247 28 Z"
          fill="url(#ls-sphere-sm)"
          filter="url(#ls-glow)"
        />

        <!-- ===== Beam tip ornaments (left & right) ===== -->
        <path
          d="M 60 233
             Q 50 230 48 238
             Q 50 246 60 244 Z"
          fill="url(#ls-beam)"
          stroke="#000"
          stroke-opacity="0.55"
          stroke-width="0.6"
        />
        <path
          d="M 440 233
             Q 450 230 452 238
             Q 450 246 440 244 Z"
          fill="url(#ls-beam)"
          stroke="#000"
          stroke-opacity="0.55"
          stroke-width="0.6"
        />

        <!-- Suspension yokes (3 attach points each side) -->
        <!-- Left -->
        <path
          d="M 50 248
             Q 47 252 50 256
             Q 53 252 50 248 Z
             M 70 252
             Q 67 256 70 260
             Q 73 256 70 252 Z
             M 90 248
             Q 87 252 90 256
             Q 93 252 90 248 Z"
          fill="url(#ls-chain)"
          stroke="#000"
          stroke-opacity="0.4"
          stroke-width="0.4"
        />
        <!-- Right -->
        <path
          d="M 410 248
             Q 407 252 410 256
             Q 413 252 410 248 Z
             M 430 252
             Q 427 256 430 260
             Q 433 256 430 252 Z
             M 450 248
             Q 447 252 450 256
             Q 453 252 450 248 Z"
          fill="url(#ls-chain)"
          stroke="#000"
          stroke-opacity="0.4"
          stroke-width="0.4"
        />

        <!-- ===== Left chain + pan (gravity group) ===== -->
        <g :style="leftChainStyle">
          <!-- 3 chains, 5 links each, splaying outward toward pan rim -->
          <!-- Inner chain (50 → 70) -->
          <use href="#ls-link" x="44" y="258" width="12" height="10" />
          <use href="#ls-link" x="46" y="270" width="12" height="10" />
          <use href="#ls-link" x="50" y="282" width="12" height="10" />
          <use href="#ls-link" x="55" y="294" width="12" height="10" />
          <use href="#ls-link" x="60" y="306" width="12" height="10" />
          <!-- Center chain (70 → 90) -->
          <use href="#ls-link" x="64" y="258" width="12" height="10" />
          <use href="#ls-link" x="66" y="270" width="12" height="10" />
          <use href="#ls-link" x="68" y="282" width="12" height="10" />
          <use href="#ls-link" x="70" y="294" width="12" height="10" />
          <use href="#ls-link" x="72" y="306" width="12" height="10" />
          <!-- Outer chain (90 → 110) -->
          <use href="#ls-link" x="84" y="258" width="12" height="10" />
          <use href="#ls-link" x="88" y="270" width="12" height="10" />
          <use href="#ls-link" x="92" y="282" width="12" height="10" />
          <use href="#ls-link" x="98" y="294" width="12" height="10" />
          <use href="#ls-link" x="104" y="306" width="12" height="10" />

          <!-- ===== Pan (wide, shallow) ===== -->
          <!-- Outer rim shadow -->
          <path
            d="M 20 332
               Q 90 320 160 332
               L 158 348
               Q 90 360 22 348 Z"
            fill="url(#ls-pan-rim)"
            stroke="#000"
            stroke-opacity="0.55"
            stroke-width="0.8"
          />
          <!-- Inner concave dish (shallow) -->
          <path
            d="M 30 336
               Q 90 326 150 336
               Q 130 350 90 352
               Q 50 350 30 336 Z"
            fill="url(#ls-pan-inner)"
            stroke="#000"
            stroke-opacity="0.5"
            stroke-width="0.6"
          />
          <!-- Concentric decorative rings inside -->
          <path
            d="M 45 338 Q 90 332 135 338"
            :stroke="c.engrave"
            stroke-width="0.5"
            fill="none"
            opacity="0.6"
          />
          <path
            d="M 55 343 Q 90 339 125 343"
            :stroke="c.engrave"
            stroke-width="0.5"
            fill="none"
            opacity="0.55"
          />
          <path
            d="M 70 348 Q 90 346 110 348"
            :stroke="c.engrave"
            stroke-width="0.5"
            fill="none"
            opacity="0.5"
          />
          <!-- Surface reflection highlight -->
          <path
            d="M 45 335 Q 90 328 135 335 Q 100 333 50 337 Z"
            :fill="c.metalHi"
            opacity="0.55"
          />
          <!-- Bottom edge of rim (flat under-surface) -->
          <path
            d="M 22 348 Q 90 360 158 348 Q 145 354 90 356 Q 35 354 22 348 Z"
            :fill="c.metalDark"
            opacity="0.7"
          />

          <!-- Optional label -->
          <g v-if="leftLabel">
            <path
              d="M 35 376 Q 90 370 145 376 L 143 392 Q 90 398 37 392 Z"
              :fill="c.plinth1"
              opacity="0.9"
            />
            <text
              x="90"
              y="388"
              text-anchor="middle"
              font-size="12"
              font-weight="700"
              :fill="c.metalHi"
              font-family="'Inter', sans-serif"
            >{{ leftLabel }}</text>
          </g>
        </g>

        <!-- ===== Right chain + pan (gravity group) ===== -->
        <g :style="rightChainStyle">
          <use href="#ls-link" x="384" y="258" width="12" height="10" />
          <use href="#ls-link" x="384" y="270" width="12" height="10" />
          <use href="#ls-link" x="386" y="282" width="12" height="10" />
          <use href="#ls-link" x="388" y="294" width="12" height="10" />
          <use href="#ls-link" x="390" y="306" width="12" height="10" />

          <use href="#ls-link" x="404" y="258" width="12" height="10" />
          <use href="#ls-link" x="406" y="270" width="12" height="10" />
          <use href="#ls-link" x="408" y="282" width="12" height="10" />
          <use href="#ls-link" x="410" y="294" width="12" height="10" />
          <use href="#ls-link" x="412" y="306" width="12" height="10" />

          <use href="#ls-link" x="424" y="258" width="12" height="10" />
          <use href="#ls-link" x="426" y="270" width="12" height="10" />
          <use href="#ls-link" x="430" y="282" width="12" height="10" />
          <use href="#ls-link" x="434" y="294" width="12" height="10" />
          <use href="#ls-link" x="440" y="306" width="12" height="10" />

          <path
            d="M 340 332
               Q 410 320 480 332
               L 478 348
               Q 410 360 342 348 Z"
            fill="url(#ls-pan-rim)"
            stroke="#000"
            stroke-opacity="0.55"
            stroke-width="0.8"
          />
          <path
            d="M 350 336
               Q 410 326 470 336
               Q 450 350 410 352
               Q 370 350 350 336 Z"
            fill="url(#ls-pan-inner)"
            stroke="#000"
            stroke-opacity="0.5"
            stroke-width="0.6"
          />
          <path
            d="M 365 338 Q 410 332 455 338"
            :stroke="c.engrave"
            stroke-width="0.5"
            fill="none"
            opacity="0.6"
          />
          <path
            d="M 375 343 Q 410 339 445 343"
            :stroke="c.engrave"
            stroke-width="0.5"
            fill="none"
            opacity="0.55"
          />
          <path
            d="M 390 348 Q 410 346 430 348"
            :stroke="c.engrave"
            stroke-width="0.5"
            fill="none"
            opacity="0.5"
          />
          <path
            d="M 365 335 Q 410 328 455 335 Q 420 333 370 337 Z"
            :fill="c.metalHi"
            opacity="0.55"
          />
          <path
            d="M 342 348 Q 410 360 478 348 Q 465 354 410 356 Q 355 354 342 348 Z"
            :fill="c.metalDark"
            opacity="0.7"
          />

          <g v-if="rightLabel">
            <path
              d="M 355 376 Q 410 370 465 376 L 463 392 Q 410 398 357 392 Z"
              :fill="c.plinth1"
              opacity="0.9"
            />
            <text
              x="410"
              y="388"
              text-anchor="middle"
              font-size="12"
              font-weight="700"
              :fill="c.metalHi"
              font-family="'Inter', sans-serif"
            >{{ rightLabel }}</text>
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.libra-scale {
  display: inline-block;
  user-select: none;
}
.libra-scale svg {
  display: block;
  overflow: visible;
}
</style>

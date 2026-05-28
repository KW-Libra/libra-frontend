<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const profit = ref(142894.5)
const bars = ref<number[]>([])
const running = ref(false)
const flowProgress = ref(0)
const completedNodes = ref<Set<string>>(new Set())
const processingNodes = ref<Set<string>>(new Set())
const activePills = ref(false)
const logs = ref([
  {
    time: '[09:00:00]',
    agent: 'SYS_CORE',
    tone: 'agent-system',
    message: 'System initialized. Awaiting manual trigger.'
  }
])

const profitText = computed(() => {
  return profit.value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
})

let profitTimer: number | undefined

function goToApp() {
  auth.hydrate()
  router.push(auth.isAuthenticated ? '/dashboard' : '/login')
}

function addLog(agent: string, tone: string, message: string) {
  const now = new Date()
  logs.value.push({
    time: `[${now.toTimeString().split(' ')[0]}]`,
    agent,
    tone,
    message
  })
}

function resetNodes() {
  completedNodes.value = new Set()
  processingNodes.value = new Set()
  activePills.value = false
  flowProgress.value = 0
}

function setProcessing(ids: string[]) {
  processingNodes.value = new Set(ids)
}

function complete(ids: string[]) {
  const nextCompleted = new Set(completedNodes.value)
  ids.forEach((id) => nextCompleted.add(id))
  completedNodes.value = nextCompleted
  processingNodes.value = new Set([...processingNodes.value].filter((id) => !ids.includes(id)))
}

function nodeClass(id: string) {
  return {
    processing: processingNodes.value.has(id),
    completed: completedNodes.value.has(id)
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function runSimulation() {
  if (running.value) return
  running.value = true
  resetNodes()
  addLog('SYS_CORE', 'agent-system', 'Initiating multi-agent analysis protocol...')

  setProcessing(['input'])
  flowProgress.value = 10
  await delay(800)
  complete(['input'])

  setProcessing(['core', 'domain'])
  activePills.value = true
  flowProgress.value = 40
  addLog('CORE_COUNCIL', 'agent-system', 'Processing earnings reports for Q3 holding set.')
  await delay(600)
  addLog('MACRO_AGENT', 'agent-macro', 'Analyzing CPI data release. Inflation steady, rate cut probability decreased by 12%.')
  await delay(800)
  addLog('RISK_AGENT', 'agent-risk', 'Alert: Volatility spike in tech sector components. Beta exposure exceeds threshold by 0.5.')
  await delay(700)
  addLog('SENTIMENT_AGENT', 'agent-macro', 'Social volume for NVDA highly positive, institutional flow remains strong.')
  complete(['core', 'domain'])

  setProcessing(['mediator'])
  flowProgress.value = 65
  await delay(500)
  addLog('MEDIATOR_JUDGE', 'agent-mediator', 'Conflict detected: Risk suggests trim, Sentiment suggests hold. Weighing inputs...')
  await delay(1200)
  addLog('TAX_AGENT', 'agent-tax', 'Evaluating short-term capital gains impact on proposed AAPL trim. Tax drag minimal.')
  await delay(800)
  addLog('MEDIATOR_JUDGE', 'agent-mediator', 'Resolution: Partial trim of 2.5% to satisfy risk bounds while maintaining exposure.')
  complete(['mediator'])

  setProcessing(['final'])
  flowProgress.value = 80
  await delay(1000)
  addLog('FINAL_JUDGE', 'agent-mediator', 'Proposed allocation approved. Forwarding to execution.')
  complete(['final'])

  setProcessing(['exec'])
  flowProgress.value = 100
  await delay(800)
  addLog('EXECUTION_CORE', 'agent-system', 'Routing order via TWAP algorithm. Target completion: 15 mins.')
  complete(['exec'])

  await delay(1000)
  activePills.value = false
  running.value = false
  profit.value += 1250
  bars.value[bars.value.length - 1] = Math.min(100, bars.value[bars.value.length - 1] + 20)
  addLog('SYS_CORE', 'agent-system', 'Cycle complete. Standby.')
}

onMounted(() => {
  document.body.classList.add('dark-theme')
  bars.value = Array.from({ length: 12 }, (_, index) => index === 11 ? 86 : 20 + Math.random() * 70)
  profitTimer = window.setInterval(() => {
    profit.value += (Math.random() - 0.4) * 15
  }, 3000)
})

onUnmounted(() => {
  if (profitTimer) window.clearInterval(profitTimer)
})
</script>

<template>
  <section id="landing-page" class="view-section">
    <nav>
      <div class="logo">Libra</div>
      <div class="nav-links">
        <a href="#landing-matrix-header"><i class="ph ph-robot"></i> Agents</a>
        <a href="#landing-features-section"><i class="ph ph-sparkle"></i> Features</a>
        <button id="btn-launch-app-header" class="btn-primary-outline" type="button" @click="goToApp">대시보드 시작하기</button>
      </div>
    </nav>

    <main>
      <section class="hero-section">
        <div class="text-section">
          <div class="badge">System Active_</div>
          <h1>Intelligent<br>Asset Allocation</h1>
          <p class="subhead">
            Libra deploys a multi-agent AI council to autonomously analyze, debate, and rebalance your portfolio in real-time — optimizing for risk-adjusted returns across global markets while you sleep.
          </p>

          <ul class="hero-features">
            <li><i class="ph ph-shield-check"></i> Risk-aware autonomous rebalancing</li>
            <li><i class="ph ph-cpu"></i> Multi-model consensus (Claude · GPT · Gemini · LLaMA)</li>
            <li><i class="ph ph-chart-line-up"></i> Tax-loss harvesting &amp; drift control</li>
          </ul>

          <div class="cta-group">
            <button class="btn-primary" type="button" aria-label="Initialize Agents" @click="runSimulation">
              <i class="ph ph-power"></i>
            </button>
            <div class="cta-text">
              INITIALIZE AGENTS
              <span>{{ running ? 'Processing command' : 'Awaiting command' }}</span>
            </div>
          </div>
        </div>

        <div class="canvas-section">
          <div class="spatial-backdrop"></div>
          <div class="spatial-scene">
            <svg class="splines" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path class="spline-glow" d="M33 27 Q 50 36 62 50" vector-effect="non-scaling-stroke"></path>
              <path class="spline-path" d="M33 27 Q 50 36 62 50" vector-effect="non-scaling-stroke"></path>
              <path class="spline-glow" d="M43 78 Q 55 66 62 50" vector-effect="non-scaling-stroke"></path>
              <path class="spline-path" d="M43 78 Q 55 66 62 50" vector-effect="non-scaling-stroke"></path>
            </svg>

            <div class="node-cluster nc-1" style="--tz: 40px;">
              <div class="node-cluster-header"><i class="ph ph-briefcase"></i> Core Council</div>
              <div class="agent-pill">Disclosure <span class="status" :class="{ active: activePills }"></span></div>
              <div class="agent-pill">News <span class="status" :class="{ active: activePills }"></span></div>
              <div class="agent-pill">Profit/Cost <span class="status" :class="{ active: activePills }"></span></div>
            </div>

            <div class="node-cluster nc-2" style="--tz: 20px;">
              <div class="node-cluster-header"><i class="ph ph-globe"></i> Domain Council</div>
              <div class="agent-pill">Risk / Tax <span class="status" :class="{ active: activePills }"></span></div>
              <div class="agent-pill">Macro <span class="status" :class="{ active: activePills }"></span></div>
              <div class="agent-pill">Sentiment <span class="status" :class="{ active: activePills }"></span></div>
            </div>

            <div class="node-insight">
              <div class="meta-label lbl-core">EXECUTION_CORE</div>
              <div class="insight-core"><i class="ph-fill ph-cpu"></i></div>
            </div>
          </div>
        </div>
      </section>

      <section class="features-section" id="landing-features-section">
        <div class="features-header">
          <span class="features-badge">Why Libra</span>
          <h2>Built for tomorrow's portfolios.</h2>
          <p>Libra blends quantitative discipline with multi-agent reasoning — turning hours of analysis into minutes of decisive action.</p>
        </div>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon"><i class="ph ph-graph"></i></div>
            <h3>Multi-Agent Council</h3>
            <p>6 specialized agents deliberate and reach consensus before any trade.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="ph ph-shield-check"></i></div>
            <h3>Risk Compliance</h3>
            <p>Hard guardrails with beta exposure, drawdown triggers, and sector limits.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="ph ph-clock-counter-clockwise"></i></div>
            <h3>Full Auditability</h3>
            <p>Every decision is logged and replayable with full agent transcripts.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="ph ph-cpu"></i></div>
            <h3>Model Orchestration</h3>
            <p>Mix Claude, GPT, Gemini, and LLaMA per agent role.</p>
          </div>
        </div>
      </section>

      <section class="dashboard-grid" id="landing-matrix-header">
        <div class="glass-panel profit-panel">
          <div class="panel-header"><i class="ph ph-wallet"></i> Portfolio Overview</div>
          <div class="profit-display">
            <div class="profit-label">CURRENT NET PROFIT</div>
            <div class="profit-value"><span>$</span><span>{{ profitText }}</span></div>
            <div class="profit-change"><i class="ph-bold ph-trend-up"></i> +12.4% YTD</div>
          </div>
          <div class="mini-chart">
            <div
              v-for="(bar, index) in bars"
              :key="index"
              class="chart-bar"
              :style="{ left: `${(index / bars.length) * 100}%`, height: `${bar}%`, background: index === bars.length - 1 ? 'linear-gradient(to top, rgba(34,197,94,0.3), rgba(34,197,94,0.9))' : undefined }"
            ></div>
          </div>
          <div style="margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: var(--text-secondary);">
              <span>AUM</span> <span style="font-family: var(--font-mono); color: var(--text-primary);">$1,250,000.00</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary);">
              <span>Available Cash</span> <span style="font-family: var(--font-mono); color: var(--text-primary);">$45,200.00</span>
            </div>
          </div>
        </div>

        <div class="glass-panel matrix-panel">
          <div class="matrix-controls">
            <div class="panel-header" style="margin-bottom:0; border:none; padding:0;">
              <i class="ph ph-git-branch"></i> Agent Activation Matrix
            </div>
            <button class="btn-activate" :class="{ running }" type="button" @click="runSimulation">
              <i :class="running ? 'ph-bold ph-spinner ph-spin' : 'ph-bold ph-play'"></i>
              {{ running ? 'PROCESSING...' : 'START ANALYSIS' }}
            </button>
          </div>

          <div class="flow-container">
            <div class="flow-lines">
              <div class="flow-line-active" :style="{ width: `${flowProgress}%` }"></div>
            </div>
            <div class="flow-stage">
              <span class="flow-stage-title">Input</span>
              <div class="flow-node" :class="nodeClass('input')"><i class="ph ph-database"></i> Compliance</div>
            </div>
            <div class="flow-stage">
              <span class="flow-stage-title">Analysis</span>
              <div class="stage-group">
                <div class="flow-node stacked" :class="nodeClass('core')"><i class="ph ph-briefcase"></i> Core Council</div>
                <div class="flow-node stacked" :class="nodeClass('domain')"><i class="ph ph-globe"></i> Domain Council</div>
              </div>
            </div>
            <div class="flow-stage">
              <span class="flow-stage-title">Consensus</span>
              <div class="flow-node" :class="nodeClass('mediator')"><i class="ph ph-scales"></i> Mediator Judge</div>
              <div class="flow-node" style="margin-top: 8px;" :class="nodeClass('final')"><i class="ph ph-gavel"></i> Final Judge</div>
            </div>
            <div class="flow-stage">
              <span class="flow-stage-title">Output</span>
              <div class="flow-node" :class="nodeClass('exec')"><i class="ph ph-lightning"></i> Final Execution</div>
            </div>
          </div>
        </div>

        <div class="glass-panel log-panel">
          <div class="panel-header" style="margin-bottom: 16px;"><i class="ph ph-terminal-window"></i> Agent Transcript</div>
          <div class="log-container">
            <div v-for="(log, index) in logs" :key="`${log.time}-${index}`" class="log-entry">
              <div class="log-meta">
                <span class="log-time">{{ log.time }}</span>
                <span class="log-agent" :class="log.tone">{{ log.agent }}</span>
              </div>
              <div class="log-message">{{ log.message }}</div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer style="text-align: center; padding: 40px 0; font-size: 12px; color: var(--text-tertiary); border-top: 1px solid rgba(255,255,255,0.05); margin-top: 60px;">
      <p>© 2026 Libra Capital Technologies. All rights reserved.</p>
    </footer>
  </section>
</template>

<style>
@import url('https://unpkg.com/@phosphor-icons/web@2.1.2/src/regular/style.css');
@import url('https://unpkg.com/@phosphor-icons/web@2.1.2/src/fill/style.css');
@import url('https://unpkg.com/@phosphor-icons/web@2.1.2/src/bold/style.css');
@import '@/assets/jy-design/landing.css';
</style>

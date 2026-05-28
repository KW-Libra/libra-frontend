<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRunStreamStore } from '@/stores/runStream'
import {
  eventDetail,
  eventTitle,
  latestEvent,
  progressPercent,
  runThreadMatches,
  stageDotClass,
  stagePillClass,
  stageViews
} from '@/utils/runView'

const route = useRoute()
const router = useRouter()
const runStream = useRunStreamStore()

const threadId = computed(() => String(route.params.threadId || ''))
const hasLiveRun = computed(() =>
  runThreadMatches(threadId.value, runStream.currentThreadId, runStream.events)
)
const stages = computed(() => stageViews(runStream.events))
const progress = computed(() => progressPercent(stages.value))
const activeStage = computed(() => stages.value.find((stage) => stage.status === 'active'))
const lastEvent = computed(() => runStream.lastEvent)
const started = computed(() => latestEvent(runStream.events, 'run_started'))

watch(
  () => runStream.phase,
  (phase) => {
    if (!hasLiveRun.value) return
    if (phase === 'completed' || phase === 'interrupted' || phase === 'failed' || phase === 'ignored') {
      router.replace(`/run/${encodeURIComponent(threadId.value)}/result`)
    }
  },
  { immediate: true }
)

function goDashboard() {
  router.push('/dashboard')
}
</script>

<template>
  <div class="jy-run-host dark-theme">
    <nav class="notch-nav" aria-label="primary">
      <div class="notch-nav-links">
        <button type="button" class="notch-link" @click="goDashboard">
          <i class="ph ph-squares-four"></i><span>대시보드</span>
        </button>
        <button type="button" class="notch-link active">
          <i class="ph ph-robot"></i><span>에이전트</span>
        </button>
      </div>
      <div class="notch-lang-toggle" role="group" aria-label="Language">
        <button type="button" class="notch-lang-btn active">KO</button>
        <button type="button" class="notch-lang-btn">EN</button>
      </div>
    </nav>

    <section id="dashboard-page" class="view-section">
      <div class="zone-dark run-zone">
        <header class="hud-header">
          <div class="header-col">
            <span class="label">AGENT EXECUTION</span>
            <div class="hud-title-wrap">
              <span>{{ runStream.isStreaming ? 'COUNCIL RUNNING // LIBRA_SATELLITE' : 'COUNCIL STATUS // LIBRA_SATELLITE' }}</span>
              <button v-if="runStream.isStreaming" type="button" class="hud-btn" @click="runStream.cancel">
                <i class="ph ph-stop-circle"></i> <span>중단</span>
              </button>
            </div>
          </div>
          <div class="header-col" style="visibility: hidden;" aria-hidden="true"></div>
          <div class="header-col">
            <span class="label">THREAD</span>
            <div class="hud-time-wrap">
              <div class="value thread-id">{{ threadId || 'NO THREAD' }}</div>
            </div>
          </div>
        </header>

        <div class="run-hero-grid">
          <div>
            <span class="label">CURRENT PHASE</span>
            <div class="dot-hero run-percent">{{ progress }}</div>
            <div class="core-sub-value">
              <div>
                <span class="label">PHASE</span>
                <span class="value">{{ runStream.phase }}</span>
              </div>
              <div>
                <span class="label">EVENTS</span>
                <span class="value positive">{{ runStream.events.length }}</span>
              </div>
            </div>
          </div>
          <div class="run-console">
            <div class="col-header">AGENT TRACE</div>
            <div v-if="!hasLiveRun" class="run-empty">
              <strong>NO LIVE RUN DATA</strong>
              <span>대시보드에서 판단을 다시 시작하면 이 콘솔에 실제 이벤트가 표시됩니다.</span>
            </div>
            <template v-else>
              <div class="trace-line">
                <span>ACTIVE NODE</span>
                <strong>{{ activeStage?.label || 'EVENT STREAM' }}</strong>
              </div>
              <div class="trace-line">
                <span>DESCRIPTION</span>
                <strong>{{ activeStage?.description || (lastEvent ? eventTitle(lastEvent) : 'WAITING') }}</strong>
              </div>
              <div v-if="lastEvent" class="trace-line">
                <span>LAST EVENT</span>
                <strong>{{ lastEvent.event }}</strong>
              </div>
              <div v-if="lastEvent && eventDetail(lastEvent)" class="trace-message">
                {{ eventDetail(lastEvent) }}
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="zone-transition"></div>

      <div class="zone-light">
        <div class="data-matrix run-stage-matrix">
          <div v-for="(stage, index) in stages" :key="stage.node" class="data-col">
            <div class="col-header">{{ String(index + 1).padStart(2, '0') }} {{ stage.label }}</div>
            <ul class="data-list">
              <li class="data-row">
                <span class="row-key">STATUS</span>
                <span class="row-val">{{ stage.status.toUpperCase() }}</span>
              </li>
              <li class="data-row">
                <span class="row-key">NODE</span>
                <span class="row-val">{{ stage.node }}</span>
              </li>
              <li class="data-row">
                <span class="row-key">DETAIL</span>
                <span class="row-val">{{ stage.description }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style>
@import url('https://unpkg.com/@phosphor-icons/web@2.1.2/src/regular/style.css');
@import '@/assets/jy-design/variables.css';
@import '@/assets/jy-design/global.css';
@import '@/assets/jy-design/dashboard.css';

.jy-run-host {
  min-height: 100vh;
  background: #141517;
}

.jy-run-host .run-zone {
  padding-top: 0;
}

.jy-run-host .thread-id {
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.jy-run-host .run-hero-grid {
  display: grid;
  grid-template-columns: 0.8fr 1.4fr;
  gap: 80px;
  align-items: end;
  padding-bottom: 32px;
}

.jy-run-host .run-percent {
  max-width: 420px;
}

.jy-run-host .run-percent::after {
  content: '%';
}

.jy-run-host .run-console {
  min-height: 260px;
}

.jy-run-host .trace-line,
.jy-run-host .trace-message,
.jy-run-host .run-empty {
  border-bottom: 1px dotted var(--monitor-border-light);
  padding: 13px 0;
  color: rgba(245, 245, 245, 0.74);
}

.jy-run-host .trace-line {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 18px;
}

.jy-run-host .trace-line strong,
.jy-run-host .trace-message,
.jy-run-host .run-empty strong {
  color: #ffffff;
  font-family: 'JetBrains Mono', monospace;
}

.jy-run-host .run-empty {
  display: grid;
  gap: 8px;
}

.jy-run-host .run-stage-matrix {
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 1024px) {
  .jy-run-host .run-hero-grid,
  .jy-run-host .run-stage-matrix {
    grid-template-columns: 1fr;
  }
}
</style>

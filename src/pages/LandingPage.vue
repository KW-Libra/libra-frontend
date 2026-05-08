<script setup lang="ts">
import { RouterLink } from "vue-router";

defineProps<{
  theme: "dark" | "light";
  lang: "ko" | "en";
}>();

defineEmits<{
  toggleTheme: [];
  setLang: [value: "ko" | "en"];
}>();

const today = new Date();
const isoDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
const issue = String(42 + today.getDate()).padStart(3, "0");
</script>

<template>
  <div class="landing">
    <div class="landing-shell-inner">
      <header class="landing-mast">
        <div class="landing-mast-left">
          <div>EDITION {{ issue }}</div>
          <div style="margin-top: 4px;">{{ isoDate }} KST</div>
        </div>
        <h1 class="landing-mast-title">LIBRA</h1>
        <div class="landing-mast-right">
          <button
            class="rail-toggle"
            type="button"
            style="background: transparent; border: 1px solid var(--ink); color: var(--ink); height: 34px; width: 56px;"
            @click="$emit('setLang', lang === 'ko' ? 'en' : 'ko')"
          >
            {{ lang.toUpperCase() }}
          </button>
          <button
            class="rail-toggle"
            type="button"
            style="background: transparent; border: 1px solid var(--ink); color: var(--ink); height: 34px; width: 56px;"
            @click="$emit('toggleTheme')"
          >
            {{ theme === "dark" ? "DARK" : "LITE" }}
          </button>
          <RouterLink class="landing-mast-cta" to="/dashboard">
            Decision Room →
          </RouterLink>
        </div>
      </header>

      <hr class="landing-rule-thin" style="margin: -1px 0 0;" />

      <section class="landing-lead reveal reveal-1">
        <div>
          <span class="kicker">Cover Story · No. 01</span>
          <h2 class="landing-lead-headline">
            Judge가 먼저 판단하고,<br />
            <em>필요한 에이전트</em>만<br />
            호출합니다.
          </h2>
          <p class="landing-lead-deck">
        KIS 잔고 동기화부터 공시·뉴스·리포트 검토, 비용·수익 평가까지 — 판단 그래프 위에서 다섯 명의 전문가
            에이전트가 협력해 포트폴리오를 점검합니다. 모든 호출과 미호출은 결정 트레이스에 기록됩니다.
          </p>
          <div class="landing-lead-byline">
            <span>BY JUDGE · OPUS 4.7</span>
            <span>READING TIME · 2 MIN</span>
            <span>FILED · {{ isoDate }}</span>
          </div>
          <div class="landing-lead-cta">
            <RouterLink class="btn btn-seal" to="/dashboard">
              <span>Decision Room 열기</span>
              <span aria-hidden="true">→</span>
            </RouterLink>
            <a class="btn" href="#features">개념 살펴보기</a>
          </div>
        </div>

        <div class="landing-lead-visual" aria-hidden="true">
          <svg viewBox="0 0 360 360" role="presentation">
            <!-- Hairline grid -->
            <g stroke="var(--rule)" stroke-width="1" fill="none">
              <line x1="0" y1="180" x2="360" y2="180" />
              <line x1="180" y1="0" x2="180" y2="360" />
              <circle cx="180" cy="180" r="148" />
              <circle cx="180" cy="180" r="100" />
              <circle cx="180" cy="180" r="56" />
            </g>

            <!-- Diagonals -->
            <g stroke="var(--rule-strong)" stroke-width="1" stroke-dasharray="2 6" fill="none">
              <line x1="76" y1="76" x2="284" y2="284" />
              <line x1="284" y1="76" x2="76" y2="284" />
            </g>

            <!-- Agent labels orbiting -->
            <g font-family="Fraunces, serif" font-size="28" font-weight="400" letter-spacing="-0.03em">
              <text x="180" y="42" text-anchor="middle" fill="var(--ink)">D</text>
              <text x="320" y="190" text-anchor="middle" fill="var(--ink)">N</text>
              <text x="180" y="334" text-anchor="middle" fill="var(--ink)">R</text>
              <text x="40" y="190" text-anchor="middle" fill="var(--ink)">P</text>
              <text x="92" y="100" text-anchor="middle" fill="var(--ink-3)">·</text>
              <text x="268" y="100" text-anchor="middle" fill="var(--ink-3)">C</text>
            </g>

            <!-- Center: Judge mark -->
            <g>
              <rect x="158" y="158" width="44" height="44" fill="var(--seal)" rx="2" />
              <text
                x="180"
                y="190"
                text-anchor="middle"
                fill="var(--seal-ink)"
                font-family="Fraunces, serif"
                font-size="22"
                font-weight="400"
              >
                LB
              </text>
            </g>

            <!-- Mono labels at corners -->
            <g font-family="JetBrains Mono, monospace" font-size="9" fill="var(--ink-3)" letter-spacing="0.1em">
              <text x="12" y="20">N · FLOW</text>
              <text x="240" y="20">SEAL 0001</text>
              <text x="12" y="350">JUDGE—FIRST</text>
              <text x="280" y="350">2026.05</text>
            </g>
          </svg>
        </div>
      </section>

      <hr class="landing-rule-thin" />

      <section class="landing-stats reveal reveal-2">
        <div>
          <h3 class="figure">5</h3>
          <span class="label">Agent modules</span>
        </div>
        <div>
          <h3 class="figure">∞</h3>
          <span class="label">Decision turns / run</span>
        </div>
        <div>
          <h3 class="figure">3</h3>
          <span class="label">LLM providers</span>
        </div>
        <div>
          <h3 class="figure">100%</h3>
          <span class="label">Local-first option</span>
        </div>
      </section>

      <section id="features" class="landing-section">
        <div class="landing-section-head">
          <div>
            <span class="kicker">Editorial · 사설</span>
            <h2 class="landing-section-title">
              모든 에이전트를<br /><em>항상</em> 부르지<br />않습니다.
            </h2>
          </div>
          <p class="landing-section-lede">
            Judge가 매 턴마다 다음 모듈을 선택합니다. 호출과 미호출 모두 결정 트레이스에 남아 사용자가 판단의
            경계를 검증할 수 있습니다. 비용도 시간도 줄어듭니다.
          </p>
        </div>

        <div class="landing-features">
          <article class="landing-feature">
            <div class="landing-feature-num">
              <span class="num">01</span>
              <span class="seal-mark" aria-hidden="true"></span>
            </div>
            <h3>동적 오케스트레이션</h3>
            <p>
              공시→뉴스→리포트 순서가 고정되지 않습니다. Judge가 매 턴마다 컨텍스트를 보고 다음 에이전트를
              결정해 비용과 응답 시간을 줄입니다.
            </p>
          </article>
          <article class="landing-feature">
            <div class="landing-feature-num">
              <span class="num">02</span>
              <span class="seal-mark" aria-hidden="true"></span>
            </div>
            <h3>호출과 미호출 모두 기록</h3>
            <p>
              왜 News만 부르고 Cost는 건너뛰었는지 <code style="font-family: var(--mono); font-size: 12px;">decision_trace</code>에
              남습니다. 사용자는 결정의 근거를 직접 검증·피드백합니다.
            </p>
          </article>
          <article class="landing-feature">
            <div class="landing-feature-num">
              <span class="num">03</span>
              <span class="seal-mark" aria-hidden="true"></span>
            </div>
            <h3>로컬과 클라우드를 동일 contract로</h3>
            <p>
              Anthropic Claude, Google Gemini, 또는 로컬 supergemma4-26b·llama 어떤 LLM이든 같은 인터페이스로
              연결됩니다. 실험과 운영을 한 코드로 마칩니다.
            </p>
          </article>
        </div>
      </section>

      <footer class="landing-foot">
        <h2 class="landing-foot-title">
          LIBRA<span class="landing-foot-title-jp">Balance Engine</span>
        </h2>
        <div class="landing-foot-meta">
          <span>v0.0.1 · 2026 · KO/EN</span>
          <span>MULTI-AGENTIC PORTFOLIO REBALANCER</span>
          <span>SEAL · 0001</span>
        </div>
      </footer>
    </div>
  </div>
</template>

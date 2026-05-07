<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import {
  getKisQuotes,
  searchKisStocks,
  type KisStockListing,
  type MarketQuote,
} from "../api";

const route = useRoute();
const loading = ref(false);
const stock = ref<KisStockListing | null>(null);
const quote = ref<MarketQuote | null>(null);
const notice = ref("KIS 종목 마스터와 현재가를 조회합니다.");

const ticker = computed(() => String(route.params.ticker ?? "").toUpperCase());
const changeTone = computed(() => {
  if (!quote.value || quote.value.change_rate_pct === 0) return "neutral";
  return quote.value.change_rate_pct > 0 ? "pos" : "neg";
});
const changeLabel = computed(() => {
  if (!quote.value) return "—";
  const sign = quote.value.change_rate_pct >= 0 ? "+" : "";
  return `${sign}${quote.value.change_rate_pct.toFixed(2)}%`;
});
const priceLabel = computed(() =>
  quote.value ? `${Math.round(quote.value.price_krw).toLocaleString("ko-KR")}원` : "—",
);
const companyName = computed(() => quote.value?.company_name || stock.value?.company_name || ticker.value);

async function load() {
  if (!ticker.value) return;
  loading.value = true;
  notice.value = `${ticker.value} 정보를 조회하는 중입니다.`;
  try {
    const [matches, quotes] = await Promise.allSettled([
      searchKisStocks(ticker.value, ["KOSPI", "KOSDAQ"], 5),
      getKisQuotes([ticker.value], "demo"),
    ]);
    stock.value = matches.status === "fulfilled" ? matches.value[0] ?? null : null;
    quote.value = quotes.status === "fulfilled" ? quotes.value[0] ?? null : null;
    notice.value = quote.value
      ? "KIS 현재가 조회가 완료되었습니다."
      : "종목은 열었지만 현재가 조회 결과가 없습니다. Profile의 KIS 모의투자 credential을 확인하세요.";
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "종목 정보를 불러오지 못했습니다.";
  } finally {
    loading.value = false;
  }
}

watch(ticker, load);
onMounted(load);
</script>

<template>
  <article class="symbol-page">
    <section class="symbol-hero">
      <div>
        <span class="micro-label">KIS Symbol</span>
        <h1>{{ companyName }}</h1>
        <p>{{ ticker }} · {{ stock?.market ?? "KR" }}</p>
      </div>
      <div class="symbol-price">
        <span>현재가</span>
        <strong>{{ priceLabel }}</strong>
        <em :data-tone="changeTone">{{ changeLabel }}</em>
      </div>
    </section>

    <section class="symbol-grid">
      <article class="symbol-panel">
        <header>
          <span class="micro-label">Next Action</span>
          <strong>목표 포트폴리오에 편입</strong>
        </header>
        <p>
          이 종목을 초기 설정 화면에서 검색해 목표 비중에 추가하면,
          Judge가 실제 보유 비중과 목표 비중의 차이를 기준으로 리밸런싱 후보를 만듭니다.
        </p>
        <RouterLink class="cta cta-primary" to="/onboarding">초기 설정에서 추가</RouterLink>
      </article>

      <article class="symbol-panel">
        <header>
          <span class="micro-label">Execution Context</span>
          <strong>{{ loading ? "조회 중" : "주문 전 확인" }}</strong>
        </header>
        <dl>
          <div>
            <dt>표준코드</dt>
            <dd>{{ stock?.standard_code ?? "—" }}</dd>
          </div>
          <div>
            <dt>거래량</dt>
            <dd>{{ quote?.volume?.toLocaleString("ko-KR") ?? "—" }}</dd>
          </div>
          <div>
            <dt>데이터 소스</dt>
            <dd>{{ quote?.source ?? stock?.source ?? "KIS" }}</dd>
          </div>
          <div>
            <dt>조회시각</dt>
            <dd>{{ quote?.quoted_at ? new Date(quote.quoted_at).toLocaleString("ko-KR") : "—" }}</dd>
          </div>
        </dl>
      </article>
    </section>

    <p class="board-notice">{{ notice }}</p>
  </article>
</template>

<style scoped>
.symbol-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 0 auto;
  max-width: var(--max);
  padding: 28px clamp(20px, 3vw, 40px) 64px;
  width: 100%;
}
.symbol-hero,
.symbol-panel {
  background: var(--paper-2);
  border: 1px solid var(--rule);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}
.symbol-hero {
  align-items: end;
  display: flex;
  gap: 24px;
  justify-content: space-between;
  padding: 30px 34px;
}
.symbol-hero h1 {
  font-size: clamp(42px, 7vw, 84px);
  letter-spacing: -0.04em;
  line-height: 0.95;
  margin: 10px 0;
}
.symbol-hero p {
  color: var(--ink-3);
  font-family: var(--mono);
  margin: 0;
}
.symbol-price {
  display: grid;
  gap: 4px;
  min-width: 220px;
  text-align: right;
}
.symbol-price span {
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 11px;
}
.symbol-price strong {
  font-size: 34px;
  letter-spacing: -0.03em;
}
.symbol-price em {
  color: var(--ink-3);
  font-family: var(--mono);
  font-style: normal;
}
.symbol-price em[data-tone="pos"] { color: var(--pos); }
.symbol-price em[data-tone="neg"] { color: var(--neg); }
.symbol-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr 1fr;
}
.symbol-panel {
  display: grid;
  gap: 16px;
  padding: 22px;
}
.symbol-panel header {
  display: grid;
  gap: 4px;
}
.symbol-panel header strong {
  font-size: 20px;
}
.symbol-panel p {
  color: var(--ink-2);
  line-height: 1.65;
  margin: 0;
}
.symbol-panel dl {
  display: grid;
  gap: 10px;
  margin: 0;
}
.symbol-panel dl div {
  border-top: 1px solid var(--rule);
  display: flex;
  justify-content: space-between;
  padding-top: 10px;
}
.symbol-panel dt,
.symbol-panel dd {
  margin: 0;
}
.symbol-panel dt {
  color: var(--ink-3);
}
.symbol-panel dd {
  color: var(--ink);
  font-family: var(--mono);
}
@media (max-width: 820px) {
  .symbol-hero {
    align-items: stretch;
    flex-direction: column;
  }
  .symbol-price {
    text-align: left;
  }
  .symbol-grid {
    grid-template-columns: 1fr;
  }
}
</style>

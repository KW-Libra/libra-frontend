<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";

import {
  getKisQuotes,
  searchKisStocks,
  type KisStockListing,
  type MarketQuote,
} from "../../api";

const router = useRouter();

const query = ref("");
const open = ref(false);
const loading = ref(false);
const results = ref<KisStockListing[]>([]);
const quotes = ref<MarketQuote[]>([]);
const errorText = ref("");
let timer: number | undefined;
let seq = 0;

const quoteMap = computed(() => new Map(quotes.value.map((quote) => [quote.ticker, quote])));

watch(query, (value) => {
  window.clearTimeout(timer);
  const term = value.trim();
  if (term.length < 2) {
    results.value = [];
    quotes.value = [];
    errorText.value = "";
    return;
  }
  timer = window.setTimeout(() => {
    void performSearch(term);
  }, 240);
});

onBeforeUnmount(() => {
  window.clearTimeout(timer);
});

async function performSearch(term: string) {
  const current = ++seq;
  loading.value = true;
  errorText.value = "";
  open.value = true;
  try {
    const found = await searchKisStocks(term, ["KOSPI", "KOSDAQ"], 8);
    if (current !== seq) return;
    results.value = found;
    const tickers = found.slice(0, 5).map((item) => item.ticker);
    if (tickers.length) {
      try {
        const quoteRows = await getKisQuotes(tickers, "demo");
        if (current === seq) quotes.value = quoteRows;
      } catch {
        if (current === seq) quotes.value = [];
      }
    }
  } catch (error) {
    if (current !== seq) return;
    results.value = [];
    quotes.value = [];
    errorText.value = error instanceof Error ? error.message : "종목 검색에 실패했습니다.";
  } finally {
    if (current === seq) loading.value = false;
  }
}

function openSymbol(stock: KisStockListing) {
  query.value = "";
  open.value = false;
  router.push(`/symbol/${encodeURIComponent(stock.ticker)}`);
}

function priceLabel(stock: KisStockListing) {
  const quote = quoteMap.value.get(stock.ticker);
  if (!quote) return stock.market;
  return `${Math.round(quote.price_krw).toLocaleString("ko-KR")}원`;
}

function changeLabel(stock: KisStockListing) {
  const quote = quoteMap.value.get(stock.ticker);
  if (!quote) return stock.ticker;
  const sign = quote.change_rate_pct >= 0 ? "+" : "";
  return `${sign}${quote.change_rate_pct.toFixed(2)}%`;
}

function changeTone(stock: KisStockListing) {
  const quote = quoteMap.value.get(stock.ticker);
  if (!quote || quote.change_rate_pct === 0) return "neutral";
  return quote.change_rate_pct > 0 ? "pos" : "neg";
}
</script>

<template>
  <div class="top-stock-search" @focusin="open = true">
    <span class="search-icon" aria-hidden="true">⌕</span>
    <input
      v-model.trim="query"
      type="search"
      placeholder="KIS 종목 검색"
      autocomplete="off"
      @keydown.esc="open = false"
    />

    <div v-if="open && query.length >= 2" class="search-popover">
      <div v-if="loading && !results.length" class="search-empty">검색 중</div>
      <div v-else-if="errorText" class="search-empty">{{ errorText }}</div>
      <div v-else-if="!results.length" class="search-empty">검색 결과 없음</div>
      <button
        v-for="stock in results"
        v-else
        :key="`${stock.market}-${stock.ticker}`"
        type="button"
        class="search-row"
        @click="openSymbol(stock)"
      >
        <span class="search-symbol">{{ stock.ticker }}</span>
        <span class="search-name">{{ stock.company_name }}</span>
        <span class="search-price">{{ priceLabel(stock) }}</span>
        <span class="search-change" :data-tone="changeTone(stock)">
          {{ changeLabel(stock) }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.top-stock-search {
  flex: 1 1 360px;
  max-width: 520px;
  min-width: 240px;
  position: relative;
}
.top-stock-search input {
  background: var(--paper-2);
  border: 1px solid var(--rule);
  border-radius: 10px;
  color: var(--ink);
  font-family: var(--mono);
  font-size: 12px;
  height: 38px;
  outline: none;
  padding: 0 12px 0 34px;
  transition: border-color 140ms, background 140ms;
  width: 100%;
}
.top-stock-search input:focus {
  background: var(--paper-3);
  border-color: var(--rule-strong);
}
.search-icon {
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 15px;
  left: 12px;
  position: absolute;
  top: 8px;
  z-index: 1;
}
.search-popover {
  background: var(--paper-2);
  border: 1px solid var(--rule);
  border-radius: 12px;
  box-shadow: var(--shadow-deep);
  display: grid;
  left: 0;
  max-height: 360px;
  overflow-y: auto;
  padding: 6px;
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 80;
}
.search-row {
  align-items: center;
  border-radius: 8px;
  color: var(--ink);
  display: grid;
  gap: 10px;
  grid-template-columns: 64px minmax(0, 1fr) 88px 64px;
  min-height: 42px;
  padding: 0 10px;
  text-align: left;
}
.search-row:hover {
  background: var(--paper-3);
}
.search-symbol,
.search-price,
.search-change,
.search-empty {
  font-family: var(--mono);
  font-size: 11px;
}
.search-symbol {
  color: var(--ink);
  font-weight: 700;
}
.search-name {
  color: var(--ink-2);
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-price {
  color: var(--ink-2);
  text-align: right;
}
.search-change {
  color: var(--ink-3);
  text-align: right;
}
.search-change[data-tone="pos"] { color: var(--pos); }
.search-change[data-tone="neg"] { color: var(--neg); }
.search-empty {
  color: var(--ink-3);
  padding: 18px;
  text-align: center;
}
@media (max-width: 720px) {
  .top-stock-search {
    max-width: none;
    min-width: 0;
    width: 100%;
  }
  .search-row {
    grid-template-columns: 58px minmax(0, 1fr) 56px;
  }
  .search-price {
    display: none;
  }
}
</style>

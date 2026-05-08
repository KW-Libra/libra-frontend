<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";

import {
  deleteKisCredential,
  getKisCredentialStatus,
  saveKisCredential,
  type KisCredentialStatus,
} from "../api";
import { useAuth } from "../composables/useAuth";

const { currentUser } = useAuth();

const status = ref<KisCredentialStatus | null>(null);
const loading = ref(false);
const saving = ref(false);
const message = ref(
  "KIS Open API 키를 저장하면 대시보드의 KIS sync가 사용자 계좌 기준으로 동작합니다.",
);
const error = ref("");

const form = reactive({
  environment: "demo" as "real" | "demo",
  appKey: "",
  appSecret: "",
  accountNo: "",
  productCode: "01",
  userAgent: "Mozilla/5.0",
});

const configuredLabel = computed(() =>
  status.value?.configured ? "Configured" : "Not connected",
);

const credentialTone = computed(() =>
  status.value?.configured ? "pos" : "warn",
);

const statusMeta = computed(() => {
  if (!status.value?.configured) return "KIS credential is not stored.";
  return `${status.value.environment?.toUpperCase()} · ${status.value.account_no_masked} · product ${status.value.product_code}`;
});

const environmentBadge = computed(() =>
  status.value?.environment ? status.value.environment.toUpperCase() : "—",
);

const heroEnvironmentLabel = computed(() =>
  status.value?.configured ? environmentBadge.value : "KIS",
);

async function loadStatus() {
  loading.value = true;
  error.value = "";
  try {
    status.value = await getKisCredentialStatus();
    if (status.value.configured && status.value.environment) {
      form.environment = status.value.environment;
      form.productCode = status.value.product_code ?? "01";
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  error.value = "";
  message.value = "KIS credential을 암호화해서 backend에 저장하는 중입니다.";
  try {
    status.value = await saveKisCredential({
      environment: form.environment,
      app_key: form.appKey,
      app_secret: form.appSecret,
      account_no: form.accountNo,
      product_code: form.productCode,
      user_agent: form.userAgent || null,
    });
    form.appKey = "";
    form.appSecret = "";
    form.accountNo = "";
    message.value = "KIS credential 저장이 완료됐습니다. Dashboard에서 KIS sync를 실행하세요.";
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    saving.value = false;
  }
}

async function remove() {
  saving.value = true;
  error.value = "";
  try {
    await deleteKisCredential();
    status.value = await getKisCredentialStatus();
    message.value = "저장된 KIS credential을 삭제했습니다.";
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(loadStatus);
</script>

<template>
  <article class="board">
    <!-- ── HERO ─────────────────────────────────────────────── -->
    <section class="board-hero">
      <div class="hero-figure-block">
        <span class="hero-eyebrow">KIS Open API · {{ configuredLabel }}</span>
        <h2 class="hero-figure">
          <span>{{ heroEnvironmentLabel }}</span>
        </h2>
        <div class="hero-delta">
          <span class="delta-meta">{{ statusMeta }}</span>
        </div>
      </div>

      <div class="hero-actions">
        <button class="cta-line" type="button" :disabled="loading" @click="loadStatus">
          {{ loading ? "Refreshing" : "Refresh" }}
        </button>
        <button
          class="cta-line"
          type="button"
          :disabled="saving || !status?.configured"
          @click="remove"
        >
          Delete credential
        </button>
      </div>
    </section>

    <!-- ── STATS ─────────────────────────────────────────────── -->
    <section class="board-stats">
      <div class="stat" :data-tone="credentialTone">
        <span>Credential</span>
        <strong>{{ configuredLabel }}</strong>
        <em>encrypted</em>
      </div>
      <div class="stat">
        <span>Environment</span>
        <strong>{{ environmentBadge }}</strong>
        <em>{{ status?.environment === "demo" ? "모의투자" : status?.environment === "real" ? "실전투자" : "—" }}</em>
      </div>
      <div class="stat">
        <span>Account</span>
        <strong>{{ status?.account_no_masked ?? "—" }}</strong>
        <em>product {{ status?.product_code ?? "—" }}</em>
      </div>
      <div class="stat">
        <span>Owner</span>
        <strong>{{ currentUser?.name ?? "—" }}</strong>
        <em>{{ currentUser?.email ?? "" }}</em>
      </div>
    </section>

    <!-- ── STATUS BANNER ────────────────────────────────────── -->
    <section class="board-verdict" :data-tone="credentialTone">
      <div class="verdict-copy">
        <span class="verdict-eyebrow">Account owner</span>
        <h3>{{ configuredLabel }}</h3>
        <p>{{ message }}</p>
      </div>
      <div class="verdict-meta">
        <span class="verdict-conf">
          environment <strong>{{ environmentBadge }}</strong>
        </span>
        <span class="verdict-when">{{ statusMeta }}</span>
      </div>
    </section>

    <!-- ── FORM ─────────────────────────────────────────────── -->
    <section class="profile-form-block">
      <header>
        <span class="block-eyebrow">KIS credential form</span>
        <span class="block-meta">App key, secret, 계좌번호는 backend DB에 암호문으로 저장됩니다.</span>
      </header>

      <form class="profile-form" @submit.prevent="save">
        <label class="profile-field">
          <span>Environment</span>
          <select v-model="form.environment" class="cell-input">
            <option value="demo">Demo · 모의투자</option>
            <option value="real">Real · 실전투자</option>
          </select>
        </label>

        <label class="profile-field">
          <span>Product code</span>
          <input
            v-model="form.productCode"
            class="cell-input"
            autocomplete="off"
            placeholder="01"
          />
        </label>

        <label class="profile-field profile-field-wide">
          <span>App key</span>
          <input
            v-model="form.appKey"
            class="cell-input"
            required
            autocomplete="off"
            placeholder="KIS app key"
          />
        </label>

        <label class="profile-field profile-field-wide">
          <span>App secret</span>
          <input
            v-model="form.appSecret"
            class="cell-input"
            required
            type="password"
            autocomplete="off"
            placeholder="KIS app secret"
          />
        </label>

        <label class="profile-field">
          <span>Account number</span>
          <input
            v-model="form.accountNo"
            class="cell-input"
            required
            autocomplete="off"
            placeholder="12345678-01"
          />
        </label>

        <label class="profile-field">
          <span>User agent</span>
          <input
            v-model="form.userAgent"
            class="cell-input"
            autocomplete="off"
            placeholder="Mozilla/5.0"
          />
        </label>

        <p v-if="error" class="board-error">{{ error }}</p>

        <div class="profile-form-foot">
          <button class="cta-solid" type="submit" :disabled="saving">
            {{ saving ? "Saving" : "Save KIS credential" }}
          </button>
        </div>
      </form>
    </section>
  </article>
</template>

<style scoped>
.profile-form-block {
  border-top: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 18px;
}
.profile-form-block > header {
  align-items: baseline;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}
.profile-form-block > header .block-meta {
  color: var(--ink-3);
  font-size: 12px;
  max-width: 60ch;
  text-align: right;
}

.profile-form {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (max-width: 720px) {
  .profile-form {
    grid-template-columns: 1fr;
  }
}
.profile-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.profile-field > span {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.profile-field-wide {
  grid-column: 1 / -1;
}

.cell-input {
  background: var(--paper);
  border: 1px solid var(--rule-strong);
  border-radius: 0;
  color: var(--ink);
  font-family: inherit;
  font-size: 13px;
  padding: 9px 12px;
  width: 100%;
}
.cell-input:focus {
  border-color: var(--ink);
  outline: none;
}
.cell-input:disabled {
  background: var(--paper-2);
  color: var(--ink-3);
}

.profile-form-foot {
  display: flex;
  grid-column: 1 / -1;
  justify-content: flex-end;
}

.board-error {
  border: 1px solid var(--neg);
  border-left-width: 3px;
  color: var(--neg);
  font-size: 13px;
  grid-column: 1 / -1;
  margin: 0;
  padding: 10px 14px;
}
</style>

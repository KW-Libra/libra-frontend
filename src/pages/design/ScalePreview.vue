<script setup lang="ts">
import { ref } from 'vue'
import LibraScale from '@/components/LibraScale.vue'

const tilt = ref(0)
const palette = ref<'brass' | 'silver' | 'obsidian'>('brass')
const size = ref(360)
const leftLabel = ref('Risk')
const rightLabel = ref('Profit')
const animated = ref(true)

const leftWeight = ref(5)
const rightWeight = ref(5)
const useWeights = ref(false)
</script>

<template>
  <div class="min-h-screen bg-neutral-900 text-neutral-100 p-8">
    <div class="max-w-6xl mx-auto">
      <h1 class="text-2xl font-bold mb-1">LibraScale Preview</h1>
      <p class="text-sm text-neutral-400 mb-8">컴포넌트 단독 미리보기. 통합 전 검토용.</p>

      <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <!-- Stage -->
        <div class="bg-gradient-to-br from-neutral-800 to-neutral-950 rounded-2xl border border-neutral-700 flex items-center justify-center p-8 min-h-[600px]">
          <LibraScale
            :tilt="useWeights ? undefined as any : tilt"
            :left-weight="useWeights ? leftWeight : undefined"
            :right-weight="useWeights ? rightWeight : undefined"
            :left-label="leftLabel || undefined"
            :right-label="rightLabel || undefined"
            :size="size"
            :palette="palette"
            :animated="animated"
          />
        </div>

        <!-- Controls -->
        <div class="bg-neutral-800 rounded-2xl border border-neutral-700 p-5 space-y-5 h-fit">
          <div>
            <label class="block text-xs font-semibold text-neutral-400 mb-2">Palette</label>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="p in (['brass','silver','obsidian'] as const)"
                :key="p"
                class="px-2 py-1.5 text-xs rounded-md border transition"
                :class="palette === p
                  ? 'bg-white text-neutral-900 border-white font-bold'
                  : 'bg-neutral-700 border-neutral-600 hover:bg-neutral-600'"
                @click="palette = p"
              >{{ p }}</button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-neutral-400 mb-2">Size: {{ size }}px</label>
            <input v-model.number="size" type="range" min="160" max="520" step="20" class="w-full" />
          </div>

          <div class="border-t border-neutral-700 pt-4">
            <label class="flex items-center gap-2 text-xs font-semibold text-neutral-400 mb-3">
              <input v-model="useWeights" type="checkbox" />
              weight 입력 사용 (자동 tilt 계산)
            </label>

            <template v-if="!useWeights">
              <label class="block text-xs font-semibold text-neutral-400 mb-2">Tilt: {{ tilt.toFixed(2) }}</label>
              <input v-model.number="tilt" type="range" min="-1" max="1" step="0.05" class="w-full" />
              <div class="flex justify-between text-[10px] text-neutral-500 mt-1">
                <span>좌측 무거움</span><span>평형</span><span>우측 무거움</span>
              </div>
              <div class="flex gap-1.5 mt-3">
                <button class="flex-1 px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded" @click="tilt = -0.6">L</button>
                <button class="flex-1 px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded" @click="tilt = 0">0</button>
                <button class="flex-1 px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded" @click="tilt = 0.6">R</button>
              </div>
            </template>

            <template v-else>
              <label class="block text-xs font-semibold text-neutral-400 mb-1">Left: {{ leftWeight }}</label>
              <input v-model.number="leftWeight" type="range" min="0" max="10" step="1" class="w-full mb-3" />
              <label class="block text-xs font-semibold text-neutral-400 mb-1">Right: {{ rightWeight }}</label>
              <input v-model.number="rightWeight" type="range" min="0" max="10" step="1" class="w-full" />
            </template>
          </div>

          <div class="border-t border-neutral-700 pt-4 space-y-3">
            <div>
              <label class="block text-xs font-semibold text-neutral-400 mb-1">Left label</label>
              <input v-model="leftLabel" type="text" class="w-full bg-neutral-900 border border-neutral-600 rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-neutral-400 mb-1">Right label</label>
              <input v-model="rightLabel" type="text" class="w-full bg-neutral-900 border border-neutral-600 rounded px-2 py-1 text-sm" />
            </div>
            <label class="flex items-center gap-2 text-xs text-neutral-400">
              <input v-model="animated" type="checkbox" /> animated
            </label>
          </div>
        </div>
      </div>

      <!-- Variant gallery -->
      <h2 class="text-lg font-bold mt-12 mb-4">팔레트 갤러리</h2>
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-neutral-800 rounded-xl border border-neutral-700 p-4 flex flex-col items-center">
          <LibraScale palette="brass" :size="240" :tilt="-0.4" left-label="Risk" right-label="Profit" />
          <div class="text-xs text-neutral-400 mt-2">brass · tilt -0.4</div>
        </div>
        <div class="bg-neutral-800 rounded-xl border border-neutral-700 p-4 flex flex-col items-center">
          <LibraScale palette="silver" :size="240" :tilt="0" left-label="ESG" right-label="Macro" />
          <div class="text-xs text-neutral-400 mt-2">silver · balanced</div>
        </div>
        <div class="bg-neutral-800 rounded-xl border border-neutral-700 p-4 flex flex-col items-center">
          <LibraScale palette="obsidian" :size="240" :tilt="0.5" left-label="Cost" right-label="Growth" />
          <div class="text-xs text-neutral-400 mt-2">obsidian · tilt +0.5</div>
        </div>
      </div>
    </div>
  </div>
</template>

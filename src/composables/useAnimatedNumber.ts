import { onBeforeUnmount, ref, watch, type Ref } from "vue";

/**
 * Smooth tween for any reactive number. Returns a ref whose value glides
 * from the previous value to the new one over `durationMs` using ease-out
 * cubic, so the dashboard's headline numbers don't snap.
 *
 * Honors prefers-reduced-motion: the value snaps instantly when the user
 * has reduced motion turned on.
 */
export function useAnimatedNumber(
  source: () => number | null | undefined,
  durationMs = 600,
): Ref<number> {
  const initial = Number(source() ?? 0);
  const display = ref(Number.isFinite(initial) ? initial : 0);

  let raf = 0;
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  watch(
    source,
    (next) => {
      const target = Number(next ?? 0);
      if (!Number.isFinite(target)) return;
      if (reduceMotion) {
        display.value = target;
        return;
      }
      const from = display.value;
      const delta = target - from;
      if (Math.abs(delta) < 0.5) {
        display.value = target;
        return;
      }
      const start = performance.now();
      cancelAnimationFrame(raf);
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        display.value = from + delta * eased;
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
    { flush: "post" },
  );

  onBeforeUnmount(() => cancelAnimationFrame(raf));

  return display;
}

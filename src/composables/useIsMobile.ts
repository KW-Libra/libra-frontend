import { onBeforeUnmount, onMounted, ref } from 'vue'

const MOBILE_MAX_WIDTH = 768

/**
 * 화면 폭 기준으로 모바일 여부를 반환하는 컴포저블.
 * - innerWidth <= 768 이면 모바일로 판단한다.
 * - resize 시 갱신하며, 언마운트 시 리스너를 정리한다.
 */
export function useIsMobile() {
  const isMobile = ref(typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX_WIDTH)

  function update() {
    isMobile.value = window.innerWidth <= MOBILE_MAX_WIDTH
  }

  onMounted(() => {
    update()
    window.addEventListener('resize', update)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', update)
  })

  return { isMobile }
}

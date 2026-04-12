import { ref, onScopeDispose } from 'vue';

/**
 * Pull-to-refresh composable.
 * 화면 최상단에서 아래로 스와이프하면 새로고침을 트리거합니다.
 *
 * @param {Function} onRefresh - 새로고침 시 호출할 async 콜백
 * @param {Object}   options
 * @param {number}   options.threshold - 트리거 임계값 (px, 기본 80)
 * @returns {{ isRefreshing: Ref<boolean>, pullDistance: Ref<number>, threshold: number }}
 */
export function usePullToRefresh(onRefresh, options = {}) {
  const threshold = options.threshold || 80;
  const isRefreshing = ref(false);
  const pullDistance = ref(0);

  let startY = 0;
  let isPulling = false;

  const onTouchStart = (e) => {
    if (window.scrollY !== 0 || isRefreshing.value) return;
    startY = e.touches[0].clientY;
    isPulling = true;
  };

  const onTouchMove = (e) => {
    if (!isPulling) return;
    const diff = e.touches[0].clientY - startY;
    if (diff < 0) {
      isPulling = false;
      pullDistance.value = 0;
      return;
    }
    // 댐프닝 적용: 실제 이동 = diff * 0.4
    pullDistance.value = Math.min(diff * 0.4, threshold * 1.5);
    if (diff > 10) e.preventDefault();
  };

  const onTouchEnd = async () => {
    if (!isPulling) return;
    isPulling = false;
    if (pullDistance.value >= threshold) {
      isRefreshing.value = true;
      try {
        await onRefresh();
      } finally {
        isRefreshing.value = false;
      }
    }
    pullDistance.value = 0;
  };

  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: true });

  onScopeDispose(() => {
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
  });

  return { isRefreshing, pullDistance, threshold };
}

import { defineStore } from 'pinia';
import { toRaw } from 'vue';
import { get, set } from 'idb-keyval';
import apiClient from '@/utils/apiClient';
import { peekTimerState, clearTimerState } from '@/utils/timerPersistence';

const cacheKey = (memberId) => `tags-${memberId}`;

// 온라인 복귀 시 자동 갱신을 위한 전역 리스너
let onlineListenerRegistered = false;

export const useTagStore = defineStore('tag', {
    state: () => ({
        tagTree: [],
        lastFetchedAt: null,
        isRefreshing: false,
        fetchError: false,
        _activeMemberId: null,
        _pendingRefreshMemberId: null,
    }),
    getters: {
        rootTag: (state) => state.tagTree.find((t) => t.type === 'ROOT') ?? null,
        tagList() {
            return this.rootTag?.children ?? [];
        },
        hasCachedData: (state) => state.tagTree.length > 0,
        findTagById: (state) => (id) => {
            const numId = Number(id);
            const search = (nodes) => {
                for (const node of nodes) {
                    if (node.id === numId) return node;
                    if (node.children?.length) {
                        const found = search(node.children);
                        if (found) return found;
                    }
                }
                return null;
            };
            return search(state.tagTree);
        },
    },
    actions: {
        async loadTagsFromCache(memberId) {
            this.fetchError = false;
            this._activeMemberId = memberId;

            // 온라인 복귀 시 자동 갱신 리스너 등록 (1회)
            if (!onlineListenerRegistered) {
                onlineListenerRegistered = true;
                window.addEventListener('online', async () => {
                    // 오프라인 중 실패한 타이머 동작을 수동 재전송
                    await this.retryPendingTimerOp();
                    if (this._activeMemberId) {
                        this.refreshTags(this._activeMemberId);
                        // 재전송 완료 후 서버 상태를 반영하기 위한 지연 갱신
                        setTimeout(() => {
                            if (this._activeMemberId) this.refreshTags(this._activeMemberId);
                        }, 2000);
                    }
                });
            }

            // in-memory 데이터가 충분히 최신이면 IndexedDB 읽기 생략
            // (refreshTags 진행 중이거나 최근 30초 이내 갱신된 경우)
            const FRESH_THRESHOLD_MS = 30_000;
            if (
                this.isRefreshing ||
                (this.tagTree.length > 0 && this.lastFetchedAt && Date.now() - this.lastFetchedAt < FRESH_THRESHOLD_MS)
            ) {
                return;
            }

            // IndexedDB 캐시에서 즉시 로드
            try {
                const cached = await get(cacheKey(memberId));
                if (cached) {
                    this.tagTree = cached;
                }
            } catch (e) {
                console.warn('IndexedDB 캐시 읽기 실패:', e);
            }

            // IDB 로드 후 localStorage의 낙관적 타이머 상태로 오버라이드
            // IDB 비동기 쓰기 미완료, 또는 BackgroundSync 대기 중인 state와의 경쟁을 해소
            const localTimer = peekTimerState();
            if (localTimer) {
                const target = this.findTagById(localTimer.tagId);
                if (target) target.state = localTimer.isRunning;
            }
        },

        async loadTags(memberId) {
            await this.loadTagsFromCache(memberId);
            await this.refreshTags(memberId);
        },

        async refreshTags(memberId) {
            // 진행 중인 요청이 있으면 완료 후 한 번 더 실행하도록 예약만 하고 반환
            if (this.isRefreshing) {
                this._pendingRefreshMemberId = memberId;
                return;
            }
            this._pendingRefreshMemberId = null;
            this.isRefreshing = true;
            try {
                const response = await apiClient.get(`/api/v1/tags?memberId=${Number(memberId)}`);
                this.tagTree = response.data;
                this.lastFetchedAt = Date.now();
                this.fetchError = false;

                // IndexedDB에 캐시 저장
                try {
                    await set(cacheKey(memberId), response.data);
                } catch (e) {
                    console.warn('IndexedDB 캐시 저장 실패:', e);
                }
            } catch (error) {
                console.error('태그 목록 네트워크 조회 실패:', error);
                if (!this.hasCachedData) {
                    this.fetchError = true;
                }
                // 401→clearAuth→clearCache로 tagTree가 비워졌을 경우 IndexedDB에서 재복구
                if (this.tagTree.length === 0) {
                    try {
                        const cached = await get(cacheKey(memberId));
                        if (cached) {
                            this.tagTree = cached;
                        }
                    } catch (e) {
                        console.warn('IndexedDB 재복구 실패:', e);
                    }
                }
            } finally {
                this.isRefreshing = false;
                // 대기 중인 갱신 요청이 있으면 한 번만 재실행
                if (this._pendingRefreshMemberId) {
                    const pending = this._pendingRefreshMemberId;
                    this._pendingRefreshMemberId = null;
                    this.refreshTags(pending);
                }
            }
        },

        setTagState(tagId, state) {
            const target = this.findTagById(tagId);
            if (target) {
                target.state = state;
                // lastFetchedAt 갱신 → freshness guard가 IndexedDB 덮어쓰기를 30초간 차단
                this.lastFetchedAt = Date.now();
                // IndexedDB도 낙관적으로 갱신
                if (this._activeMemberId) {
                    // Vue reactive proxy는 Structured Clone 불가 → toRaw + JSON 직렬화
                    set(cacheKey(this._activeMemberId), JSON.parse(JSON.stringify(toRaw(this.tagTree)))).catch((e) =>
                        console.warn('IndexedDB optimistic update 실패:', e)
                    );
                }
            }
        },

        // 오프라인 중 실패한 타이머 동작(stop/start)을 온라인 복귀 시 수동 재전송
        // BackgroundSync 대신 사용: SW 제어 여부와 무관하게 동작하며 record 이중 생성 방지
        async retryPendingTimerOp() {
            const saved = peekTimerState();
            if (!saved) return;

            try {
                if (!saved.isRunning && saved.latestEndTime) {
                    // 오프라인 stop 재전송
                    await apiClient.post(
                        `/api/v1/tags/${saved.tagId}/timer/stop`,
                        {
                            elapsedTime: saved.elapsedTime,
                            timestamps: {
                                startTime: new Date(saved.latestStartTime).toISOString(),
                                endTime: new Date(saved.latestEndTime).toISOString(),
                            },
                        },
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                    clearTimerState();
                    console.log('[tagStore] 오프라인 stop 재전송 완료:', saved.tagId);
                } else if (saved.isRunning && saved.latestStartTime) {
                    // 오프라인 start 재전송
                    await apiClient.post(
                        `/api/v1/tags/${saved.tagId}/timer/start`,
                        { startTime: new Date(saved.latestStartTime).toISOString() },
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                    console.log('[tagStore] 오프라인 start 재전송 완료:', saved.tagId);
                }
            } catch (e) {
                console.warn('[tagStore] 오프라인 타이머 재전송 실패:', e.message);
            }
        },

        async clearCache() {
            this.tagTree = [];
            this.lastFetchedAt = null;
            this.fetchError = false;
            // 모든 멤버의 캐시를 삭제하기 어려우므로, 상태만 초기화
            // (IndexedDB 캐시는 다음 로그인 시 덮어써짐)
        },
    },
});

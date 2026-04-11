import { defineStore } from 'pinia';
import { get, set, del } from 'idb-keyval';
import apiClient from '@/utils/apiClient';

const cacheKey = (memberId) => `tags-${memberId}`;

export const useTagStore = defineStore('tag', {
    state: () => ({
        tagTree: [],
        lastFetchedAt: null,
        isRefreshing: false,
        fetchError: false,
    }),
    getters: {
        rootTag: (state) => state.tagTree.find((t) => t.type === 'ROOT') ?? null,
        tagList() {
            return this.rootTag?.children ?? [];
        },
        hasCachedData: (state) => state.tagTree.length > 0,
    },
    actions: {
        async loadTags(memberId) {
            this.fetchError = false;

            // 1. IndexedDB 캐시에서 즉시 로드
            try {
                const cached = await get(cacheKey(memberId));
                if (cached) {
                    this.tagTree = cached;
                }
            } catch (e) {
                console.warn('IndexedDB 캐시 읽기 실패:', e);
            }

            // 2. 네트워크에서 최신 데이터 가져오기
            await this.refreshTags(memberId);
        },

        async refreshTags(memberId) {
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
            } finally {
                this.isRefreshing = false;
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

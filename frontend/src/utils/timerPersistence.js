const STORAGE_KEY = 'timer-state';

export function saveTimerState(tagId, state) {
    try {
        const data = {
            tagId,
            isRunning: state.isRunning,
            latestStartTime: state.latestStartTime,
            latestEndTime: state.latestEndTime,
            elapsedTime: state.elapsedTime,
            dailyTotalTime: state.dailyTotalTime,
            dailyGoalTime: state.dailyGoalTime,
            tagTotalTime: state.tagTotalTime,
            totalTime: state.totalTime,
            savedAt: Date.now(),
            savedDate: new Date().toLocaleDateString('sv'),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('타이머 상태 저장 실패:', e);
    }
}

export function loadTimerState(tagId) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data.tagId !== tagId) return null;
        return data;
    } catch (e) {
        console.warn('타이머 상태 읽기 실패:', e);
        return null;
    }
}

export function clearTimerState() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.warn('타이머 상태 삭제 실패:', e);
    }
}

// tagId 필터 없이 localStorage의 타이머 상태를 그대로 반환
// tagStore에서 IDB 로드 후 낙관적 상태 오버라이드에 사용
export function peekTimerState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

// 재전송 시도 여부를 localStorage에 영속화
// 페이지 재로드 시 모듈 레벨 변수가 초기화되는 문제를 해결
export function markRetryAttempted() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        data.retryAttempted = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('타이머 재전송 마킹 실패:', e);
    }
}

// API 호출이 네트워크 오류로 실패했을 때 retryAttempted 마킹을 해제
// 다음 온라인 복귀 시 재전송을 허용하기 위해 retryAttempted 필드만 제거
export function clearRetryAttempted() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        delete data.retryAttempted;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('타이머 재전송 마킹 해제 실패:', e);
    }
}

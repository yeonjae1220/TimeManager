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

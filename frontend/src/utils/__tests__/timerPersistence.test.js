import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    saveTimerState,
    loadTimerState,
    clearTimerState,
    peekTimerState,
    markRetryAttempted,
    clearRetryAttempted,
} from '../timerPersistence.js';

const STORAGE_KEY = 'timer-state';

const makeState = (overrides = {}) => ({
    isRunning: true,
    latestStartTime: Date.now() - 5000,
    latestEndTime: 0,
    elapsedTime: 5,
    dailyTotalTime: 100,
    dailyGoalTime: 3600,
    tagTotalTime: 200,
    totalTime: 500,
    ...overrides,
});

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    localStorage.clear();
});

// ── peekTimerState ──────────────────────────────────────────────────────────

describe('peekTimerState', () => {
    it('returns null when localStorage is empty', () => {
        expect(peekTimerState()).toBeNull();
    });

    it('returns parsed data without tagId filter', () => {
        saveTimerState(42, makeState());
        const result = peekTimerState();
        expect(result).not.toBeNull();
        expect(result.tagId).toBe(42);
    });

    it('returns null on malformed JSON', () => {
        localStorage.setItem(STORAGE_KEY, 'not-json{{{');
        expect(peekTimerState()).toBeNull();
    });
});

// ── clearTimerState ─────────────────────────────────────────────────────────

describe('clearTimerState', () => {
    it('removes the stored timer state', () => {
        saveTimerState(1, makeState());
        clearTimerState();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('is a no-op when nothing is stored', () => {
        expect(() => clearTimerState()).not.toThrow();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
});

// ── markRetryAttempted ──────────────────────────────────────────────────────

describe('markRetryAttempted', () => {
    it('sets retryAttempted: true on existing localStorage data', () => {
        saveTimerState(7, makeState());

        markRetryAttempted();

        const result = peekTimerState();
        expect(result).not.toBeNull();
        expect(result.retryAttempted).toBe(true);
    });

    it('preserves all other fields when marking retry', () => {
        saveTimerState(7, makeState({ isRunning: false, elapsedTime: 99 }));

        markRetryAttempted();

        const result = peekTimerState();
        expect(result.tagId).toBe(7);
        expect(result.isRunning).toBe(false);
        expect(result.elapsedTime).toBe(99);
    });

    it('is a no-op when localStorage is empty (does not throw)', () => {
        expect(() => markRetryAttempted()).not.toThrow();
        expect(peekTimerState()).toBeNull();
    });

    it('peekTimerState reflects retryAttempted: true after markRetryAttempted', () => {
        saveTimerState(3, makeState());
        expect(peekTimerState().retryAttempted).toBeUndefined();

        markRetryAttempted();

        expect(peekTimerState().retryAttempted).toBe(true);
    });

    it('calling markRetryAttempted twice keeps retryAttempted: true', () => {
        saveTimerState(3, makeState());
        markRetryAttempted();
        markRetryAttempted();
        expect(peekTimerState().retryAttempted).toBe(true);
    });
});

// ── clearRetryAttempted ─────────────────────────────────────────────────────

describe('clearRetryAttempted', () => {
    it('removes only the retryAttempted field, preserving other state', () => {
        saveTimerState(1, makeState());
        markRetryAttempted();
        expect(peekTimerState().retryAttempted).toBe(true);

        clearRetryAttempted();

        const result = peekTimerState();
        expect(result.retryAttempted).toBeUndefined();
        expect(result.tagId).toBe(1);       // 나머지 필드 보존
        expect(result.elapsedTime).toBe(5);
    });

    it('is a no-op when localStorage is empty', () => {
        expect(() => clearRetryAttempted()).not.toThrow();
        expect(peekTimerState()).toBeNull();
    });

    it('clearTimerState after markRetryAttempted removes entire state including retryAttempted', () => {
        saveTimerState(1, makeState());
        markRetryAttempted();
        clearTimerState();
        expect(peekTimerState()).toBeNull(); // retryAttempted도 함께 사라짐
    });

    it('allows re-marking after clearRetryAttempted', () => {
        saveTimerState(1, makeState());
        markRetryAttempted();
        clearRetryAttempted();
        markRetryAttempted();
        expect(peekTimerState().retryAttempted).toBe(true);
    });
});

// ── saveTimerState + loadTimerState round-trip ──────────────────────────────

describe('saveTimerState / loadTimerState', () => {
    it('round-trips all fields for the correct tagId', () => {
        const state = makeState({ isRunning: false, elapsedTime: 42 });
        saveTimerState(5, state);
        const loaded = loadTimerState(5);
        expect(loaded.tagId).toBe(5);
        expect(loaded.elapsedTime).toBe(42);
        expect(loaded.isRunning).toBe(false);
    });

    it('returns null for a different tagId', () => {
        saveTimerState(5, makeState());
        expect(loadTimerState(99)).toBeNull();
    });

    it('stores savedAt as a recent timestamp', () => {
        const before = Date.now();
        saveTimerState(1, makeState());
        const after = Date.now();
        const loaded = loadTimerState(1);
        expect(loaded.savedAt).toBeGreaterThanOrEqual(before);
        expect(loaded.savedAt).toBeLessThanOrEqual(after);
    });

    it('stores savedDate in sv locale format (YYYY-MM-DD)', () => {
        saveTimerState(1, makeState());
        const loaded = loadTimerState(1);
        expect(loaded.savedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

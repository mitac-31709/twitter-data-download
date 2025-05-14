const fs = require('fs-extra');
const path = require('path');

// 共通の設定
const CONFIG = {
    stateFile: path.join(__dirname, 'shared-state.json'),
    downloadsDir: path.join(__dirname, '..', 'downloads'),
    // 状態の種類
    STATUS: {
        SUCCESS: 'success',
        FAILED: 'failed',
        NO_MEDIA: 'no_media',
        ERROR: 'error',
        PENDING: 'pending',
        PARTIAL: 'partial'
    }
};

// 初期状態
const initialState = {
    tweets: {}, // tweetIdをキーとして、状態とタイムスタンプを保存
    lastUpdate: null,
    stats: {
        total: 0,
        successful: 0,
        failed: 0,
        noMedia: 0,
        error: 0,
        pending: 0,
        partial: 0
    }
};

// メモリ上の状態キャッシュ
let stateCache = null;
let lastLoadTime = 0;
const CACHE_TTL = 5000; // キャッシュの有効期間（ミリ秒）

// 状態の読み込み（キャッシュ対応）
async function loadState(forceReload = false) {
    const now = Date.now();
    
    // キャッシュが有効な場合はキャッシュを返す
    if (!forceReload && stateCache && (now - lastLoadTime) < CACHE_TTL) {
        return stateCache;
    }

    try {
        if (await fs.pathExists(CONFIG.stateFile)) {
            const state = await fs.readJSON(CONFIG.stateFile);
            // 必要なフィールドが存在することを確認
            stateCache = {
                ...initialState,
                ...state,
                tweets: { ...initialState.tweets, ...state.tweets }
            };
            lastLoadTime = now;
            return stateCache;
        }
    } catch (error) {
        console.error(`状態ファイルの読み込みに失敗しました: ${error.message}`);
    }
    stateCache = { ...initialState };
    lastLoadTime = now;
    return stateCache;
}

// 状態の保存（キャッシュも更新）
async function saveState(state) {
    try {
        state.lastUpdate = new Date().toISOString();
        stateCache = state; // キャッシュを更新
        lastLoadTime = Date.now();
        await fs.writeJSON(CONFIG.stateFile, state, { spaces: 2 });
    } catch (error) {
        console.error(`状態ファイルの保存に失敗しました: ${error.message}`);
    }
}

// ツイートの状態を更新（キャッシュ対応）
async function updateTweetStatus(tweetId, status, metadata = {}) {
    const state = await loadState();
    const timestamp = new Date().toISOString();

    // 既存の状態を取得
    const existingStatus = state.tweets[tweetId]?.status;

    // 状態を更新
    state.tweets[tweetId] = {
        status,
        timestamp,
        metadata,
        lastUpdate: timestamp
    };

    // 統計情報を更新
    if (existingStatus) {
        state.stats[existingStatus]--;
    }
    state.stats[status]++;
    state.stats.total = Object.keys(state.tweets).length;

    await saveState(state);
    return state;
}

// ツイートの状態を取得（キャッシュ対応）
async function getTweetStatus(tweetId) {
    const state = await loadState();
    return state.tweets[tweetId] || { status: CONFIG.STATUS.PENDING };
}

// 未処理のツイートIDを取得
async function getPendingTweetIds() {
    const state = await loadState();
    return Object.entries(state.tweets)
        .filter(([_, data]) => data.status === CONFIG.STATUS.PENDING)
        .map(([tweetId]) => tweetId);
}

// 統計情報を取得
async function getStats() {
    const state = await loadState();
    return state.stats;
}

module.exports = {
    CONFIG,
    loadState,
    saveState,
    updateTweetStatus,
    getTweetStatus,
    getPendingTweetIds,
    getStats
}; 
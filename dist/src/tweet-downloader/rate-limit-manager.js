"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitManager = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
class RateLimitManager {
    constructor(stateFile, logger, config) {
        this.stateFile = stateFile;
        this.logger = logger;
        this.config = config;
        this.state = {
            lastRateLimitTimestamp: null,
            rateLimitHistory: [],
            successHistory: [],
            startTime: null
        };
    }
    async loadState() {
        try {
            if (await fs_extra_1.default.pathExists(this.stateFile)) {
                this.state = await fs_extra_1.default.readJSON(this.stateFile);
            }
        }
        catch (error) {
            this.logger.error('レート制限状態の読み込みに失敗しました', error instanceof Error ? error : undefined);
            throw error;
        }
    }
    async saveState() {
        try {
            await fs_extra_1.default.ensureDir(path_1.default.dirname(this.stateFile));
            await fs_extra_1.default.writeJSON(this.stateFile, this.state, { spaces: 2 });
        }
        catch (error) {
            this.logger.error('レート制限状態の保存に失敗しました', error instanceof Error ? error : undefined);
            throw error;
        }
    }
    checkRateLimit(result, error) {
        const now = Date.now();
        const isRateLimited = this.isRateLimitError(result, error);
        if (isRateLimited) {
            this.state.lastRateLimitTimestamp = now;
            this.state.rateLimitHistory.push({
                timestamp: now,
                reason: error?.message || result?.message || '不明な理由'
            });
            // 履歴の制限
            const historyLimit = this.config.get('historyLimit');
            if (this.state.rateLimitHistory.length > historyLimit) {
                this.state.rateLimitHistory = this.state.rateLimitHistory.slice(-historyLimit);
            }
        }
        return isRateLimited;
    }
    addSuccess(tweetId) {
        const now = Date.now();
        this.state.successHistory.push({
            timestamp: now,
            tweetId
        });
        // 履歴の制限
        const historyLimit = this.config.get('historyLimit');
        if (this.state.successHistory.length > historyLimit) {
            this.state.successHistory = this.state.successHistory.slice(-historyLimit);
        }
    }
    shouldWait() {
        if (!this.state.lastRateLimitTimestamp)
            return false;
        const now = Date.now();
        const rateLimitDelay = this.config.get('rateLimitDelay');
        return now - this.state.lastRateLimitTimestamp < rateLimitDelay;
    }
    getRemainingWaitTime() {
        if (!this.state.lastRateLimitTimestamp)
            return 0;
        const now = Date.now();
        const rateLimitDelay = this.config.get('rateLimitDelay');
        const elapsed = now - this.state.lastRateLimitTimestamp;
        return Math.max(0, rateLimitDelay - elapsed);
    }
    isRateLimitError(result, error) {
        if (error) {
            return error.message.includes('rate limit') ||
                error.message.includes('Too Many Requests') ||
                error.message.includes('429');
        }
        if (result?.status === 'error') {
            return result.message?.includes('rate limit') ||
                result.message?.includes('Too Many Requests') ||
                result.message?.includes('429') ||
                false;
        }
        return false;
    }
    getState() {
        return { ...this.state };
    }
}
exports.RateLimitManager = RateLimitManager;
//# sourceMappingURL=rate-limit-manager.js.map
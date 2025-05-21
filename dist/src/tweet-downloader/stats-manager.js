"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsManager = void 0;
const tweet_1 = require("../core/types/tweet");
class StatsManager {
    constructor(logger) {
        this.logger = logger;
        this.stats = {
            total: 0,
            skipped: 0,
            downloaded: 0,
            remaining: 0,
            successRate: '0%',
            rateLimitHistory: [],
            successHistory: []
        };
    }
    initialize(total) {
        this.stats = {
            total,
            skipped: 0,
            downloaded: 0,
            remaining: total,
            successRate: '0%',
            rateLimitHistory: [],
            successHistory: []
        };
    }
    updateStats(status) {
        switch (status) {
            case tweet_1.TWEET_STATUS.SUCCESS:
                this.stats.downloaded++;
                break;
            case tweet_1.TWEET_STATUS.PARTIAL:
                this.stats.downloaded++;
                break;
            case tweet_1.TWEET_STATUS.FAILED:
            case tweet_1.TWEET_STATUS.NO_MEDIA:
                this.stats.skipped++;
                break;
        }
        this.stats.remaining = this.stats.total - this.stats.downloaded - this.stats.skipped;
        this.stats.successRate = this.calculateSuccessRate();
    }
    updateRateLimitState(rateLimitState) {
        this.stats.rateLimitHistory = [...rateLimitState.rateLimitHistory];
        this.stats.successHistory = [...rateLimitState.successHistory];
    }
    displayStats() {
        const { total, skipped, downloaded, remaining, successRate, rateLimitHistory, successHistory } = this.stats;
        this.logger.info('=== ダウンロード統計 ===');
        this.logger.info(`総ツイート数: ${total}`);
        this.logger.info(`スキップ済み: ${skipped}`);
        this.logger.info(`ダウンロード済み: ${downloaded}`);
        this.logger.info(`残り: ${remaining}`);
        this.logger.info(`成功率: ${successRate}`);
        if (rateLimitHistory.length > 0) {
            this.logger.info('\n=== レート制限履歴 ===');
            rateLimitHistory.forEach(entry => {
                const date = new Date(entry.timestamp).toLocaleString();
                this.logger.info(`${date}: ${entry.reason}`);
            });
        }
        if (successHistory.length > 0) {
            this.logger.info('\n=== 成功履歴 ===');
            const recentSuccesses = successHistory.slice(-5);
            recentSuccesses.forEach(entry => {
                const date = new Date(entry.timestamp).toLocaleString();
                this.logger.info(`${date}: ${entry.tweetId}`);
            });
        }
    }
    calculateSuccessRate() {
        const totalProcessed = this.stats.downloaded + this.stats.skipped;
        if (totalProcessed === 0)
            return '0%';
        const rate = (this.stats.downloaded / totalProcessed) * 100;
        return `${rate.toFixed(1)}%`;
    }
    getStats() {
        return { ...this.stats };
    }
}
exports.StatsManager = StatsManager;
//# sourceMappingURL=stats-manager.js.map
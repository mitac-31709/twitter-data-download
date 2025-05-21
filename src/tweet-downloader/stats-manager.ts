import { Logger } from '../core/utils/logger';
import { TweetStatusType, TWEET_STATUS } from '../core/types/tweet';
import { DownloadStats } from '../core/types/stats';
import { RateLimitState } from '../core/types/tweet';

export class StatsManager {
    private readonly logger: Logger;
    private stats: DownloadStats;

    constructor(logger: Logger) {
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

    public initialize(total: number): void {
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

    public updateStats(status: TweetStatusType): void {
        switch (status) {
            case TWEET_STATUS.SUCCESS:
                this.stats.downloaded++;
                break;
            case TWEET_STATUS.PARTIAL:
                this.stats.downloaded++;
                break;
            case TWEET_STATUS.FAILED:
            case TWEET_STATUS.NO_MEDIA:
                this.stats.skipped++;
                break;
        }
        this.stats.remaining = this.stats.total - this.stats.downloaded - this.stats.skipped;
        this.stats.successRate = this.calculateSuccessRate();
    }

    public updateRateLimitState(rateLimitState: RateLimitState): void {
        this.stats.rateLimitHistory = [...rateLimitState.rateLimitHistory];
        this.stats.successHistory = [...rateLimitState.successHistory];
    }

    public displayStats(): void {
        const {
            total,
            skipped,
            downloaded,
            remaining,
            successRate,
            rateLimitHistory,
            successHistory
        } = this.stats;

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

    private calculateSuccessRate(): string {
        const totalProcessed = this.stats.downloaded + this.stats.skipped;
        if (totalProcessed === 0) return '0%';
        const rate = (this.stats.downloaded / totalProcessed) * 100;
        return `${rate.toFixed(1)}%`;
    }

    public getStats(): DownloadStats {
        return { ...this.stats };
    }
} 
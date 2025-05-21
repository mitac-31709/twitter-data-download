import { Logger } from '../core/utils/logger';
import { TweetStatusType } from '../core/types/tweet';
import { DownloadStats } from '../core/types/stats';
import { RateLimitState } from '../core/types/tweet';
export declare class StatsManager {
    private readonly logger;
    private stats;
    constructor(logger: Logger);
    initialize(total: number): void;
    updateStats(status: TweetStatusType): void;
    updateRateLimitState(rateLimitState: RateLimitState): void;
    displayStats(): void;
    private calculateSuccessRate;
    getStats(): DownloadStats;
}

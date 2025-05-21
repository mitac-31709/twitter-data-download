import { Logger } from '../core/utils/logger';
import { DownloadStats } from '../core/types/stats';
export declare class ProgressManager {
    private readonly logger;
    private progressBar;
    private total;
    constructor(logger: Logger);
    initialize(total: number): void;
    update(stats: DownloadStats): void;
    stop(): void;
    logError(tweetId: string, error: Error): void;
    logSuccess(tweetId: string): void;
    logSkipped(tweetId: string, reason: string): void;
    logRateLimit(waitTime: number): void;
}

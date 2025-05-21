import { Logger } from '../core/utils/logger';
import { RateLimitState, TwitterDLResult } from '../core/types/tweet';
import { ConfigManager } from '../core/utils/config-manager';
export declare class RateLimitManager {
    private readonly stateFile;
    private readonly logger;
    private readonly config;
    private state;
    constructor(stateFile: string, logger: Logger, config: ConfigManager);
    loadState(): Promise<void>;
    saveState(): Promise<void>;
    checkRateLimit(result: TwitterDLResult | null, error: Error | null): boolean;
    addSuccess(tweetId: string): void;
    shouldWait(): boolean;
    getRemainingWaitTime(): number;
    private isRateLimitError;
    getState(): RateLimitState;
}

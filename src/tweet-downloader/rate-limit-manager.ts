import fs from 'fs-extra';
import path from 'path';
import { Logger } from '../core/utils/logger';
import { RateLimitState, TwitterDLResult } from '../core/types/tweet';
import { ConfigManager } from '../core/utils/config-manager';

export class RateLimitManager {
    private readonly stateFile: string;
    private readonly logger: Logger;
    private readonly config: ConfigManager;
    private state: RateLimitState;

    constructor(stateFile: string, logger: Logger, config: ConfigManager) {
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

    public async loadState(): Promise<void> {
        try {
            if (await fs.pathExists(this.stateFile)) {
                this.state = await fs.readJSON(this.stateFile);
            }
        } catch (error) {
            this.logger.error('レート制限状態の読み込みに失敗しました', error instanceof Error ? error : undefined);
            throw error;
        }
    }

    public async saveState(): Promise<void> {
        try {
            await fs.ensureDir(path.dirname(this.stateFile));
            await fs.writeJSON(this.stateFile, this.state, { spaces: 2 });
        } catch (error) {
            this.logger.error('レート制限状態の保存に失敗しました', error instanceof Error ? error : undefined);
            throw error;
        }
    }

    public checkRateLimit(result: TwitterDLResult | null, error: Error | null): boolean {
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

    public addSuccess(tweetId: string): void {
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

    public shouldWait(): boolean {
        if (!this.state.lastRateLimitTimestamp) return false;

        const now = Date.now();
        const rateLimitDelay = this.config.get('rateLimitDelay');
        return now - this.state.lastRateLimitTimestamp < rateLimitDelay;
    }

    public getRemainingWaitTime(): number {
        if (!this.state.lastRateLimitTimestamp) return 0;

        const now = Date.now();
        const rateLimitDelay = this.config.get('rateLimitDelay');
        const elapsed = now - this.state.lastRateLimitTimestamp;
        return Math.max(0, rateLimitDelay - elapsed);
    }

    private isRateLimitError(result: TwitterDLResult | null, error: Error | null): boolean {
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

    public getState(): RateLimitState {
        return { ...this.state };
    }
} 
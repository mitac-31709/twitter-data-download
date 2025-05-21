import { DEFAULT_CONFIG } from '../core/types/config';
export declare class TweetDownloader {
    private config;
    private logger;
    private twitterDL;
    private progressBar;
    private stats;
    constructor(config?: Partial<typeof DEFAULT_CONFIG>);
    downloadTweets(tweetIds?: string[]): Promise<void>;
    private getTweetIdsFromInput;
    private downloadTweet;
    private handleRateLimit;
    private updateStats;
    private getStatsSummary;
}

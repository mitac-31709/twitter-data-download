import { type MediaInfo as TweetMediaInfo } from '../tweet-downloader/download-tweets';
interface Config {
    outputDir: string;
    logFile: string;
    batchSize: number;
    batchDelay: number;
    rateLimitWaitTime: number;
    maxRateLimitRetries: number;
    twitterCookie: string;
}
type MediaInfo = TweetMediaInfo;
interface TweetStatus {
    status: string;
    metadata: {
        reason?: string;
        error?: string;
        mediaCount?: number;
        downloadedCount?: number;
    };
}
declare let CONFIG: Config;
declare const STATUS: {
    PENDING: string;
    SUCCESS: string;
    PARTIAL: string;
    FAILED: string;
    NO_MEDIA: string;
};
declare function loadConfig(): Promise<boolean>;
export { loadConfig, CONFIG, STATUS, type Config, type MediaInfo, type TweetStatus };

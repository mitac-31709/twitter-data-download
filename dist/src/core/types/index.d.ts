export interface TweetStatus {
    status: string;
    metadata: {
        reason?: string;
        error?: string;
        mediaCount?: number;
        downloadedCount?: number;
        [key: string]: any;
    };
}
export interface Stats {
    total: number;
    successful: number;
    partial: number;
    failed: number;
    noMedia: number;
    pending: number;
    error: number;
}
export interface MediaInfo {
    tweetId: string;
    media: {
        type: string;
        image?: string;
        videoUrl?: string;
    };
    filePath: string;
    videoUrl?: string;
}
export interface Config {
    outputDir: string;
    logFile: string;
    batchSize: number;
    batchDelay: number;
    rateLimitWaitTime: number;
    maxRateLimitRetries: number;
    twitterCookie: string;
}
export interface RateLimitState {
    lastRateLimitTimestamp: number | null;
    rateLimitHistory: Array<{
        timestamp: number;
        reason: string;
    }>;
    successHistory: Array<{
        timestamp: number;
        tweetId: string;
    }>;
    startTime: number | null;
}
export interface TwitterDLResult {
    status: string;
    message?: string;
    data?: any;
}
export declare const STATUS: {
    readonly PENDING: "pending";
    readonly SUCCESS: "success";
    readonly PARTIAL: "partial";
    readonly FAILED: "failed";
    readonly NO_MEDIA: "no_media";
};

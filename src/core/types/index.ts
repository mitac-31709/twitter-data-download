// ツイートの状態
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

// 統計情報
export interface Stats {
    total: number;
    successful: number;
    partial: number;
    failed: number;
    noMedia: number;
    pending: number;
    error: number;
}

// メディア情報
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

// 設定
export interface Config {
    outputDir: string;
    logFile: string;
    batchSize: number;
    batchDelay: number;
    rateLimitWaitTime: number;
    maxRateLimitRetries: number;
    twitterCookie: string;
}

// レート制限状態
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

// Twitterダウンロード結果
export interface TwitterDLResult {
    status: string;
    message?: string;
    data?: any;
}

// 状態定数
export const STATUS = {
    PENDING: 'pending',
    SUCCESS: 'success',
    PARTIAL: 'partial',
    FAILED: 'failed',
    NO_MEDIA: 'no_media'
} as const; 
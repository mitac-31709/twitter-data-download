export interface Stats {
    total: number;
    successful: number;
    partial: number;
    failed: number;
    noMedia: number;
    pending: number;
    error: number;
}

export interface DownloadStats {
    total: number;
    skipped: number;
    downloaded: number;
    remaining: number;
    successRate: string;
    rateLimitHistory: Array<{
        timestamp: number;
        reason: string;
    }>;
    successHistory: Array<{
        timestamp: number;
        tweetId: string;
    }>;
} 
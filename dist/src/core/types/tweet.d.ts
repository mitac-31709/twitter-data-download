export declare const TWEET_STATUS: {
    readonly PENDING: "pending";
    readonly SUCCESS: "success";
    readonly PARTIAL: "partial";
    readonly FAILED: "failed";
    readonly NO_MEDIA: "no_media";
};
export type TweetStatusType = typeof TWEET_STATUS[keyof typeof TWEET_STATUS];
export interface TweetStatus {
    status: TweetStatusType;
    metadata: {
        hasMetadata: boolean;
        hasMedia?: boolean;
        downloadedMedia: number;
        expectedMedia?: number;
    };
}
export interface TweetMetadata {
    tweetId: string;
    text?: string;
    media?: Array<{
        url: string;
        type: string;
    }>;
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
    status: 'success' | 'error';
    message?: string;
    text?: string;
    media?: Array<{
        url: string;
        type: string;
    }>;
    tweetId?: string;
}

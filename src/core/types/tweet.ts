export const TWEET_STATUS = {
    PENDING: 'pending',
    SUCCESS: 'success',
    PARTIAL: 'partial',
    FAILED: 'failed',
    NO_MEDIA: 'no_media'
} as const;

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
} 
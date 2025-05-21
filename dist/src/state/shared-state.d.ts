export interface TweetMetadata {
    [key: string]: any;
}
export interface TweetState {
    status: string;
    timestamp: string;
    metadata: TweetMetadata;
    lastUpdate: string;
}
export interface Stats {
    total: number;
    successful: number;
    failed: number;
    noMedia: number;
    error: number;
    pending: number;
    partial: number;
}
export interface State {
    tweets: {
        [tweetId: string]: TweetState;
    };
    lastUpdate: string | null;
    stats: Stats;
}
export declare const CONFIG: {
    readonly stateFile: string;
    readonly downloadsDir: string;
    readonly STATUS: {
        readonly SUCCESS: "success";
        readonly FAILED: "failed";
        readonly NO_MEDIA: "no_media";
        readonly ERROR: "error";
        readonly PENDING: "pending";
        readonly PARTIAL: "partial";
    };
};
export declare function loadState(forceReload?: boolean): Promise<State>;
export declare function saveState(state: State): Promise<void>;
export declare function updateTweetStatus(tweetId: string, status: string, metadata?: TweetMetadata): Promise<State>;
export declare function getTweetStatus(tweetId: string): Promise<TweetState>;
export declare function getPendingTweetIds(): Promise<string[]>;
export declare function getStats(): Promise<Stats>;

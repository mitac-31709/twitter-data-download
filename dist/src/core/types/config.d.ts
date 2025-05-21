export interface Config {
    outputDir: string;
    logFile: string;
    twitterCookie: string;
    batchDelay: number;
    maxRetries: number;
    retryDelay: number;
    rateLimitDelay: number;
    historyLimit: number;
}
export declare const DEFAULT_CONFIG: Config;

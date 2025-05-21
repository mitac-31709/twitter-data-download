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

export const DEFAULT_CONFIG: Config = {
    outputDir: 'downloads',
    logFile: 'downloads/download.log',
    twitterCookie: '',
    batchDelay: 1000,
    maxRetries: 3,
    retryDelay: 5000,
    rateLimitDelay: 15 * 60 * 1000, // 15分
    historyLimit: 50
}; 
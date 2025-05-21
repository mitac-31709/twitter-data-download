import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import { TwitterDL } from 'twitter-downloader';
import cliProgress from 'cli-progress';
import dotenv from 'dotenv';
import { ConfigManager } from '../core/utils/config-manager';
import { Logger } from '../core/utils/logger';
import { TweetStatus, TweetStatusType, TWEET_STATUS, RateLimitState, TwitterDLResult } from '../core/types/tweet';
import { DownloadStats } from '../core/types/stats';
import { DEFAULT_CONFIG } from '../core/types/config';

// 環境変数の読み込み
dotenv.config({ path: path.join(process.cwd(), '.env') });

// TwitterDLResultの型定義を拡張
interface ExtendedTwitterDLResult extends TwitterDLResult {
    text?: string;
    media?: Array<{
        url: string;
        type: string;
    }>;
}

// TwitterDLの型定義を拡張
interface TwitterDLOptions {
    cookie?: string;
}

export class TweetDownloader {
    // ... existing code ...
} 
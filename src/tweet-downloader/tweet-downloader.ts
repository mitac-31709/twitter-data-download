import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
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

// ダミーのTwitterDLクラス
class DummyTwitterDL {
    private cookie: string;

    constructor(cookie: string) {
        this.cookie = cookie;
    }

    async download(tweetId: string): Promise<ExtendedTwitterDLResult> {
        // ダミーの実装
        return {
            status: 'success',
            tweetId,
            text: 'ダミーのツイート',
            media: [
                {
                    url: 'https://example.com/image.jpg',
                    type: 'image'
                }
            ]
        };
    }
}

export class TweetDownloader {
    private config: typeof DEFAULT_CONFIG;
    private logger: Logger;
    private twitterDL: DummyTwitterDL;
    private progressBar: cliProgress.SingleBar;
    private stats: DownloadStats;

    constructor(config: Partial<typeof DEFAULT_CONFIG> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.logger = new Logger(this.config.logFile);
        this.twitterDL = new DummyTwitterDL(this.config.twitterCookie);
        this.progressBar = new cliProgress.SingleBar({
            format: 'ダウンロード進捗 |{bar}| {percentage}% | {value}/{total} ツイート',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });
        this.stats = {
            total: 0,
            downloaded: 0,
            skipped: 0,
            remaining: 0,
            successRate: '0%',
            rateLimitHistory: [],
            successHistory: []
        };
    }

    public async downloadTweets(tweetIds: string[] = []): Promise<void> {
        try {
            // ツイートIDの取得
            if (tweetIds.length === 0) {
                tweetIds = await this.getTweetIdsFromInput();
            }

            this.stats.total = tweetIds.length;
            this.stats.remaining = tweetIds.length;
            this.progressBar.start(tweetIds.length, 0);

            // ツイートのダウンロード
            for (const tweetId of tweetIds) {
                try {
                    await this.downloadTweet(tweetId);
                    this.stats.downloaded++;
                    this.stats.successHistory.push({
                        timestamp: Date.now(),
                        tweetId
                    });
                } catch (error) {
                    if (error instanceof Error && error.message.includes('Rate limit')) {
                        this.stats.rateLimitHistory.push({
                            timestamp: Date.now(),
                            reason: error.message
                        });
                        await this.handleRateLimit();
                    } else {
                        this.logger.error(`ツイート ${tweetId} のダウンロードに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
                        this.stats.skipped++;
                    }
                } finally {
                    this.stats.remaining--;
                    this.updateStats();
                    this.progressBar.increment();
                }
            }
        } finally {
            this.progressBar.stop();
            this.logger.info('ダウンロード処理が完了しました');
            this.logger.info(this.getStatsSummary());
        }
    }

    private async getTweetIdsFromInput(): Promise<string[]> {
        const tweetIds: string[] = [];
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question('ツイートIDを入力してください（複数の場合はカンマ区切り）: ', (answer) => {
                rl.close();
                resolve(answer.split(',').map(id => id.trim()).filter(id => id));
            });
        });
    }

    private async downloadTweet(tweetId: string): Promise<void> {
        const tweetDir = path.join(this.config.outputDir, tweetId);
        const tweetFile = path.join(tweetDir, `${tweetId}.json`);

        // 既にダウンロード済みの場合はスキップ
        if (await fs.pathExists(tweetFile)) {
            const data = await fs.readJSON(tweetFile);
            if (data.status === TWEET_STATUS.SUCCESS) {
                this.logger.info(`ツイート ${tweetId} は既にダウンロード済みです`);
                return;
            }
        }

        // ツイートのダウンロード
        const result = await this.twitterDL.download(tweetId) as ExtendedTwitterDLResult;
        
        // ディレクトリの作成
        await fs.ensureDir(tweetDir);

        // メタデータの保存
        const metadata = {
            tweetId,
            text: result.text,
            media: result.media,
            status: TWEET_STATUS.SUCCESS,
            downloadedAt: new Date().toISOString()
        };

        await fs.writeJSON(tweetFile, metadata, { spaces: 2 });
        this.logger.info(`ツイート ${tweetId} をダウンロードしました`);
    }

    private async handleRateLimit(): Promise<void> {
        const waitTime = this.config.rateLimitDelay;
        this.logger.warn(`レート制限を検出しました。${waitTime / 1000}秒待機します...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    private updateStats(): void {
        const total = this.stats.total;
        const downloaded = this.stats.downloaded;
        const skipped = this.stats.skipped;
        const successRate = total > 0 ? (downloaded / total * 100).toFixed(1) : '0';
        this.stats.successRate = `${successRate}%`;
    }

    private getStatsSummary(): string {
        return `
ダウンロード統計:
- 合計: ${this.stats.total}ツイート
- 成功: ${this.stats.downloaded}ツイート
- スキップ: ${this.stats.skipped}ツイート
- 残り: ${this.stats.remaining}ツイート
- 成功率: ${this.stats.successRate}
- レート制限: ${this.stats.rateLimitHistory.length}回
`;
    }
} 
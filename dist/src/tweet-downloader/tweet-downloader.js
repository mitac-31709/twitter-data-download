"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TweetDownloader = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
const cli_progress_1 = __importDefault(require("cli-progress"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("../core/utils/logger");
const tweet_1 = require("../core/types/tweet");
const config_1 = require("../core/types/config");
// 環境変数の読み込み
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), '.env') });
// ダミーのTwitterDLクラス
class DummyTwitterDL {
    constructor(cookie) {
        this.cookie = cookie;
    }
    async download(tweetId) {
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
class TweetDownloader {
    constructor(config = {}) {
        this.config = { ...config_1.DEFAULT_CONFIG, ...config };
        this.logger = new logger_1.Logger(this.config.logFile);
        this.twitterDL = new DummyTwitterDL(this.config.twitterCookie);
        this.progressBar = new cli_progress_1.default.SingleBar({
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
    async downloadTweets(tweetIds = []) {
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
                }
                catch (error) {
                    if (error instanceof Error && error.message.includes('Rate limit')) {
                        this.stats.rateLimitHistory.push({
                            timestamp: Date.now(),
                            reason: error.message
                        });
                        await this.handleRateLimit();
                    }
                    else {
                        this.logger.error(`ツイート ${tweetId} のダウンロードに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
                        this.stats.skipped++;
                    }
                }
                finally {
                    this.stats.remaining--;
                    this.updateStats();
                    this.progressBar.increment();
                }
            }
        }
        finally {
            this.progressBar.stop();
            this.logger.info('ダウンロード処理が完了しました');
            this.logger.info(this.getStatsSummary());
        }
    }
    async getTweetIdsFromInput() {
        const tweetIds = [];
        const rl = readline_1.default.createInterface({
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
    async downloadTweet(tweetId) {
        const tweetDir = path_1.default.join(this.config.outputDir, tweetId);
        const tweetFile = path_1.default.join(tweetDir, `${tweetId}.json`);
        // 既にダウンロード済みの場合はスキップ
        if (await fs_extra_1.default.pathExists(tweetFile)) {
            const data = await fs_extra_1.default.readJSON(tweetFile);
            if (data.status === tweet_1.TWEET_STATUS.SUCCESS) {
                this.logger.info(`ツイート ${tweetId} は既にダウンロード済みです`);
                return;
            }
        }
        // ツイートのダウンロード
        const result = await this.twitterDL.download(tweetId);
        // ディレクトリの作成
        await fs_extra_1.default.ensureDir(tweetDir);
        // メタデータの保存
        const metadata = {
            tweetId,
            text: result.text,
            media: result.media,
            status: tweet_1.TWEET_STATUS.SUCCESS,
            downloadedAt: new Date().toISOString()
        };
        await fs_extra_1.default.writeJSON(tweetFile, metadata, { spaces: 2 });
        this.logger.info(`ツイート ${tweetId} をダウンロードしました`);
    }
    async handleRateLimit() {
        const waitTime = this.config.rateLimitDelay;
        this.logger.warn(`レート制限を検出しました。${waitTime / 1000}秒待機します...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    updateStats() {
        const total = this.stats.total;
        const downloaded = this.stats.downloaded;
        const skipped = this.stats.skipped;
        const successRate = total > 0 ? (downloaded / total * 100).toFixed(1) : '0';
        this.stats.successRate = `${successRate}%`;
    }
    getStatsSummary() {
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
exports.TweetDownloader = TweetDownloader;
//# sourceMappingURL=tweet-downloader.js.map
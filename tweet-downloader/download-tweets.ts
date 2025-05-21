import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import { TwitterDL } from 'twitter-downloader';
import cliProgress from 'cli-progress';
import dotenv from 'dotenv';
import { CONFIG as SHARED_CONFIG, updateTweetStatus as updateSharedTweetStatus, Stats } from '../shared/shared-state';

// 環境変数の読み込み
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// --- 設定 ---
const LIKES_FILE_PATH = path.join(__dirname, '..', 'shared', 'like.js');
const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads');
const ERROR_TWEETS_FILE = path.join(__dirname, 'error_tweets.json');
const STATE_FILE = path.join(__dirname, 'rate_limit_state.json');
const FIXED_WAIT_TIME_MS = 0;
const RATE_LIMIT_WAIT_TIME_MS = 15 * 60 * 1000;
const TWITTER_COOKIE = process.env.TWITTER_COOKIE || '';
const HISTORY_LIMIT = 50;

// 型定義
interface TweetStatus {
    status: string;
    metadata: {
        reason?: string;
        error?: string;
        mediaCount?: number;
        downloadedCount?: number;
        [key: string]: any;
    };
}

interface RateLimitState {
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

interface TwitterDLResult {
    status: string;
    message?: string;
    data?: any;
}

// ツイートの状態定数
const STATUS = {
    PENDING: 'pending',
    SUCCESS: 'success',
    PARTIAL: 'partial',
    FAILED: 'failed',
    NO_MEDIA: 'no_media'
} as const;

// --- グローバル状態変数 ---
let errorTweetIds = new Set<string>();
let rateLimitState: RateLimitState = {
    lastRateLimitTimestamp: null,
    rateLimitHistory: [],
    successHistory: [],
    startTime: null,
};
let downloadStartTime: number | null = null;

// ツイートの状態を取得
async function getTweetStatus(tweetId: string): Promise<TweetStatus> {
    const tweetDir = path.join(DOWNLOADS_DIR, tweetId);
    const tweetFile = path.join(tweetDir, `${tweetId}.json`);

    // ディレクトリが存在しない場合
    if (!fs.existsSync(tweetDir)) {
        return { status: STATUS.PENDING, metadata: { reason: 'ディレクトリが存在しません' } };
    }

    // JSONファイルが存在しない場合
    if (!fs.existsSync(tweetFile)) {
        return { status: STATUS.PENDING, metadata: { reason: 'JSONファイルが存在しません' } };
    }

    try {
        const data = JSON.parse(fs.readFileSync(tweetFile, 'utf8'));
        const files = fs.readdirSync(tweetDir).filter(file => 
            file !== `${tweetId}.json` && 
            !file.endsWith('.txt')
        );

        // メディアの有無を確認
        if (!data.media || !Array.isArray(data.media) || data.media.length === 0) {
            return { status: STATUS.NO_MEDIA, metadata: { reason: 'メディアが含まれていません' } };
        }

        // メディアファイルの存在を確認
        const mediaCount = data.media.length;
        const downloadedCount = files.length;

        if (downloadedCount === 0) {
            return { status: STATUS.PENDING, metadata: { reason: 'メディアファイルがダウンロードされていません' } };
        } else if (downloadedCount < mediaCount) {
            return { status: STATUS.PARTIAL, metadata: { reason: '一部のメディアファイルがダウンロードされていません' } };
        }

        return { status: STATUS.SUCCESS, metadata: { mediaCount, downloadedCount } };
    } catch (error) {
        return { 
            status: STATUS.FAILED, 
            metadata: { error: error instanceof Error ? error.message : String(error) } 
        };
    }
}

// 統計情報を取得
async function getStats(): Promise<Stats> {
    const stats: Stats = {
        total: 0,
        successful: 0,
        partial: 0,
        failed: 0,
        noMedia: 0,
        pending: 0,
        error: 0
    };

    try {
        const dirs = fs.readdirSync(DOWNLOADS_DIR)
            .filter(item => {
                const fullPath = path.join(DOWNLOADS_DIR, item);
                return fs.statSync(fullPath).isDirectory();
            });

        stats.total = dirs.length;

        for (const tweetId of dirs) {
            const status = await getTweetStatus(tweetId);
            switch (status.status) {
                case STATUS.SUCCESS:
                    stats.successful++;
                    break;
                case STATUS.PARTIAL:
                    stats.partial++;
                    break;
                case STATUS.FAILED:
                    stats.failed++;
                    break;
                case STATUS.NO_MEDIA:
                    stats.noMedia++;
                    break;
                case STATUS.PENDING:
                    stats.pending++;
                    break;
                default:
                    stats.error++;
            }
        }
    } catch (error) {
        console.error(`統計情報の取得中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }

    return stats;
}

// エラーが発生したツイートIDのリストをロード
if (fs.existsSync(ERROR_TWEETS_FILE)) {
    try {
        const data = fs.readFileSync(ERROR_TWEETS_FILE, 'utf-8');
        const ids = JSON.parse(data) as string[];
        errorTweetIds = new Set(ids);
        console.log(`エラーが発生したツイートIDを${errorTweetIds.size}件読み込みました。`);
    } catch (err) {
        console.error(`エラーリストの読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    }
}

// エラーが発生したツイートIDのリストを保存
function saveErrorTweetIds(): void {
    try {
        fs.writeFileSync(ERROR_TWEETS_FILE, JSON.stringify([...errorTweetIds]));
    } catch (err) {
        console.error(`エラーリストの保存に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    }
}

// レート制限状態をロードする関数
function loadRateLimitState(): void {
    if (fs.existsSync(STATE_FILE)) {
        try {
            const data = fs.readFileSync(STATE_FILE, 'utf-8');
            let loadedState = JSON.parse(data) as RateLimitState;

            // 必要な情報のみを保持
            rateLimitState = {
                lastRateLimitTimestamp: loadedState.lastRateLimitTimestamp || null,
                rateLimitHistory: loadedState.rateLimitHistory || [],
                successHistory: loadedState.successHistory || [],
                startTime: loadedState.startTime || null
            };

            console.log(`レート制限状態を読み込みました。`);
            if (rateLimitState.lastRateLimitTimestamp) {
                console.log(`前回のレート制限は ${new Date(rateLimitState.lastRateLimitTimestamp).toLocaleString()} に発生しました。`);
            }
        } catch (err) {
            console.error(`レート制限状態ファイルの読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}。デフォルト値で開始します。`);
            rateLimitState = {
                lastRateLimitTimestamp: null,
                rateLimitHistory: [],
                successHistory: [],
                startTime: null
            };
        }
    } else {
        console.log("レート制限状態ファイルが見つかりません。初期状態で開始します。");
        rateLimitState = {
            lastRateLimitTimestamp: null,
            rateLimitHistory: [],
            successHistory: [],
            startTime: null
        };
    }
}

// レート制限状態を保存する関数
function saveRateLimitState(): void {
    try {
        // 履歴が長くなりすぎないように制限
        if (rateLimitState.rateLimitHistory.length > HISTORY_LIMIT) {
            rateLimitState.rateLimitHistory = rateLimitState.rateLimitHistory.slice(-HISTORY_LIMIT);
        }
        if (rateLimitState.successHistory.length > HISTORY_LIMIT) {
            rateLimitState.successHistory = rateLimitState.successHistory.slice(-HISTORY_LIMIT);
        }

        fs.writeFileSync(STATE_FILE, JSON.stringify(rateLimitState, null, 2));
    } catch (err) {
        console.error(`レート制限状態ファイルの保存に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    }
}

// like.js からツイートIDを抽出する関数 (ストリーム処理)
async function extractTweetIds(filePath: string): Promise<string[]> {
    const tweetIds: string[] = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const tweetIdRegex = /"tweetId"\s*:\s*"(\d+)"/;

    for await (const line of rl) {
        const match = line.match(tweetIdRegex);
        if (match && match[1]) {
            tweetIds.push(match[1]);
        }
    }
    console.log(`${filePath} からツイートIDを${tweetIds.length}件抽出しました。`);
    return tweetIds;
}

// 指定時間待機する関数
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// レート制限かどうかを判定する関数
function checkRateLimit(result: TwitterDLResult | null, error: Error | null): { isRateLimit: boolean; reason: string } {
    let isRateLimit = false;
    let reason = '';

    // 1. result オブジェクトから判定 (TwitterDLがエラーを返した場合)
    if (result && result.status === 'error') {
        if (result.message === 'Failed to get Guest Token. Authorization is invalid!') {
            isRateLimit = true;
            reason = result.message;
        }
    }

    // 2. error オブジェクトから判定 (例外が発生した場合)
    if (error) {
        const errorMessage = error.message.toLowerCase();
        if (
            errorMessage.includes('rate limit') ||
            errorMessage.includes('too many requests') ||
            errorMessage.includes('429') ||
            errorMessage.includes('authorization is invalid')
        ) {
            isRateLimit = true;
            reason = error.message;
        }
    }

    return { isRateLimit, reason };
}

// 統計情報を表示する関数
function displayStatistics(
    tweetIds: string[],
    skippedDownloaded: number,
    skippedError: number,
    downloadedCount: number,
    rateLimitState: RateLimitState
): void {
    const total = tweetIds.length;
    const remaining = total - skippedDownloaded - skippedError - downloadedCount;
    const successRate = total > 0 ? ((downloadedCount + skippedDownloaded) / total * 100).toFixed(1) : '0.0';

    console.log('\n=== ダウンロード統計 ===');
    console.log(`総ツイート数: ${total}`);
    console.log(`既にダウンロード済み: ${skippedDownloaded}`);
    console.log(`エラーでスキップ: ${skippedError}`);
    console.log(`今回ダウンロード: ${downloadedCount}`);
    console.log(`残り: ${remaining}`);
    console.log(`成功率: ${successRate}%`);

    if (rateLimitState.rateLimitHistory.length > 0) {
        const lastRateLimit = rateLimitState.rateLimitHistory[rateLimitState.rateLimitHistory.length - 1];
        console.log(`\n最後のレート制限: ${new Date(lastRateLimit.timestamp).toLocaleString()}`);
        console.log(`理由: ${lastRateLimit.reason}`);
    }

    if (rateLimitState.startTime) {
        const elapsed = Date.now() - rateLimitState.startTime;
        const hours = Math.floor(elapsed / (1000 * 60 * 60));
        const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`\n実行時間: ${hours}時間${minutes}分`);
    }
}

// ツイートの状態を更新する関数
async function updateTweetStatus(tweetId: string, status: string, metadata: Record<string, any> = {}): Promise<void> {
    try {
        // 共有状態を更新
        await updateSharedTweetStatus(tweetId, status, metadata);

        // エラーリストの更新
        if (status === STATUS.FAILED) {
            errorTweetIds.add(tweetId);
        } else {
            errorTweetIds.delete(tweetId);
        }
        saveErrorTweetIds();

        // 成功履歴の更新
        if (status === STATUS.SUCCESS) {
            rateLimitState.successHistory.push({
                timestamp: Date.now(),
                tweetId
            });
            saveRateLimitState();
        }
    } catch (error) {
        console.error(`ツイート状態の更新に失敗しました (${tweetId}): ${error instanceof Error ? error.message : String(error)}`);
    }
}

// メインのダウンロード処理
async function downloadTweets(): Promise<void> {
    try {
        // 初期化
        downloadStartTime = Date.now();
        rateLimitState.startTime = downloadStartTime;
        saveRateLimitState();

        // ツイートIDの抽出
        const tweetIds = await extractTweetIds(LIKES_FILE_PATH);
        if (tweetIds.length === 0) {
            console.log('ダウンロード対象のツイートが見つかりませんでした。');
            return;
        }

        // プログレスバーの設定
        const progressBar = new cliProgress.SingleBar({
            format: 'ダウンロード進捗 |{bar}| {percentage}% | {value}/{total} ツイート | 残り: {eta}s',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });

        let skippedDownloaded = 0;
        let skippedError = 0;
        let downloadedCount = 0;

        progressBar.start(tweetIds.length, 0);

        // ツイートのダウンロード
        for (const tweetId of tweetIds) {
            try {
                // 既にダウンロード済みかチェック
                const status = await getTweetStatus(tweetId);
                if (status.status === STATUS.SUCCESS) {
                    skippedDownloaded++;
                    progressBar.increment();
                    continue;
                }

                // エラーリストに含まれている場合はスキップ
                if (errorTweetIds.has(tweetId)) {
                    skippedError++;
                    progressBar.increment();
                    continue;
                }

                // ツイートのダウンロード
                const result = await TwitterDL(tweetId, {
                    cookie: TWITTER_COOKIE
                });

                // レート制限のチェック
                const { isRateLimit, reason } = checkRateLimit(result, null);
                if (isRateLimit) {
                    console.log(`\nレート制限が検出されました: ${reason}`);
                    rateLimitState.lastRateLimitTimestamp = Date.now();
                    rateLimitState.rateLimitHistory.push({
                        timestamp: Date.now(),
                        reason
                    });
                    saveRateLimitState();

                    // レート制限待機
                    console.log(`${RATE_LIMIT_WAIT_TIME_MS / 1000}秒待機します...`);
                    await sleep(RATE_LIMIT_WAIT_TIME_MS);
                    continue;
                }

                // ダウンロード結果の処理
                if (result.status === 'success' && result.data) {
                    const tweetDir = path.join(DOWNLOADS_DIR, tweetId);
                    await fs.ensureDir(tweetDir);

                    // メタデータの保存
                    await fs.writeJSON(
                        path.join(tweetDir, `${tweetId}.json`),
                        result.data,
                        { spaces: 2 }
                    );

                    // メディアのダウンロード
                    if (result.data.media && Array.isArray(result.data.media)) {
                        for (const media of result.data.media) {
                            if (media.url) {
                                const response = await fetch(media.url);
                                const buffer = await response.arrayBuffer();
                                const filename = path.basename(media.url);
                                await fs.writeFile(path.join(tweetDir, filename), Buffer.from(buffer));
                            }
                        }
                    }

                    await updateTweetStatus(tweetId, STATUS.SUCCESS, {
                        mediaCount: result.data.media?.length || 0
                    });
                    downloadedCount++;
                } else {
                    await updateTweetStatus(tweetId, STATUS.FAILED, {
                        error: result.message || '不明なエラー'
                    });
                }

                // 固定待機時間
                if (FIXED_WAIT_TIME_MS > 0) {
                    await sleep(FIXED_WAIT_TIME_MS);
                }

            } catch (error) {
                const { isRateLimit, reason } = checkRateLimit(null, error as Error);
                if (isRateLimit) {
                    console.log(`\nレート制限が検出されました: ${reason}`);
                    rateLimitState.lastRateLimitTimestamp = Date.now();
                    rateLimitState.rateLimitHistory.push({
                        timestamp: Date.now(),
                        reason
                    });
                    saveRateLimitState();

                    // レート制限待機
                    console.log(`${RATE_LIMIT_WAIT_TIME_MS / 1000}秒待機します...`);
                    await sleep(RATE_LIMIT_WAIT_TIME_MS);
                    continue;
                }

                await updateTweetStatus(tweetId, STATUS.FAILED, {
                    error: error instanceof Error ? error.message : String(error)
                });
            }

            progressBar.increment();
        }

        progressBar.stop();

        // 最終統計の表示
        displayStatistics(tweetIds, skippedDownloaded, skippedError, downloadedCount, rateLimitState);

    } catch (error) {
        console.error(`ダウンロード処理中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

// スクリプトの実行
if (require.main === module) {
    loadRateLimitState();
    downloadTweets().catch(error => {
        console.error(`致命的なエラーが発生しました: ${error instanceof Error ? error.stack || error.message : String(error)}`);
        process.exit(1);
    });
} 
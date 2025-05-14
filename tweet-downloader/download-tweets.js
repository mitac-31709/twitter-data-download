const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { TwitterDL } = require('twitter-downloader');
const { CONFIG: SHARED_CONFIG, updateTweetStatus, getTweetStatus, getStats } = require(path.join(__dirname, '..', 'shared', 'shared-state'));
const cliProgress = require('cli-progress');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); // .env ファイルを読み込む

// --- 設定 ---
const LIKES_FILE_PATH = path.join(__dirname, '..', 'shared', 'like.js'); // like.js ファイルへのパス
const DOWNLOADS_DIR = SHARED_CONFIG.downloadsDir; // 保存先ディレクトリ
const ERROR_TWEETS_FILE = path.join(__dirname, 'error_tweets.json'); // エラーが発生したツイートIDリストの保存先
const STATE_FILE = path.join(__dirname, 'rate_limit_state.json'); // レート制限状態の保存先
const FIXED_WAIT_TIME_MS = 0; // 固定待機時間 (0ミリ秒)
const RATE_LIMIT_WAIT_TIME_MS = 15 * 60 * 1000; // レート制限時の待機時間 (15分)
const TWITTER_COOKIE = process.env.TWITTER_COOKIE || ''; // TwitterのCookie
const HISTORY_LIMIT = 50; // 保持する履歴の最大件数
// --- 設定ここまで ---

// --- グローバル状態変数 ---
let errorTweetIds = new Set();
let rateLimitState = {
    lastRateLimitTimestamp: null, // 最後にレート制限が発生した時刻
    rateLimitHistory: [], // レート制限発生時の履歴 [{ timestamp }]
    successHistory: [], // 成功時の履歴 [{ timestamp }]
    startTime: null, // 開始時刻を追加
};
let downloadStartTime = null;
// --- グローバル状態変数ここまで ---

// --- より正確な待機時間計算用 ---
// （削除済み: 直近N回のリクエスト履歴による平均計算）
// --- より正確な待機時間計算用ここまで ---

// エラーが発生したツイートIDのリストをロード
if (fs.existsSync(ERROR_TWEETS_FILE)) {
    try {
        const data = fs.readFileSync(ERROR_TWEETS_FILE, 'utf-8');
        const ids = JSON.parse(data);
        errorTweetIds = new Set(ids);
        console.log(`エラーが発生したツイートIDを${errorTweetIds.size}件読み込みました。`);
    } catch (err) {
        console.error(`エラーリストの読み込みに失敗しました: ${err.message}`);
    }
}

// エラーが発生したツイートIDのリストを保存
function saveErrorTweetIds() {
    try {
        fs.writeFileSync(ERROR_TWEETS_FILE, JSON.stringify([...errorTweetIds]));
    } catch (err) {
        console.error(`エラーリストの保存に失敗しました: ${err.message}`);
    }
}

// レート制限状態をロードする関数
function loadRateLimitState() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            const data = fs.readFileSync(STATE_FILE, 'utf-8');
            let loadedState = JSON.parse(data);

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
            console.error(`レート制限状態ファイルの読み込みに失敗しました: ${err.message}。デフォルト値で開始します。`);
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
function saveRateLimitState() {
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
        console.error(`レート制限状態ファイルの保存に失敗しました: ${err.message}`);
    }
}

// like.js からツイートIDを抽出する関数 (ストリーム処理)
async function extractTweetIds(filePath) {
    const tweetIds = [];
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
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// レート制限かどうかを判定する関数
function checkRateLimit(result, error) {
	let isRateLimit = false;
	let reason = '';

	// 1. result オブジェクトから判定 (TwitterDLがエラーを返した場合)
	if (result && result.status === 'error') {
			if (result.message === 'Failed to get Guest Token. Authorization is invalid!') {
					isRateLimit = true;
					reason = result.message;
			}
			// 他にも result ベースで判定したいレート制限メッセージがあればここに追加
			// else if (result.message && result.message.toLowerCase().includes('some other rate limit message')) {
			//     isRateLimit = true;
			//     reason = result.message;
			// }
	}

	// 2. error オブジェクトから判定 (例外が発生した場合)
	// result でレート制限と判定されなかった場合のみ、error をチェック
	if (!isRateLimit && error) {
			if ((error.message && error.message.toLowerCase().includes('rate limit'))) {
					isRateLimit = true;
					reason = error.message;
			} else if (error.statusCode === 429) {
					isRateLimit = true;
					reason = `Status code ${error.statusCode}`;
			}
			// Failed to get Guest Token は result で判定するので、ここでは不要
	}

	return { isRateLimit, reason };
}

// 統計情報を表示する関数
function displayStatistics(tweetIds, skippedDownloaded, skippedError, downloadedCount, rateLimitState) {
    console.log("\n=== ダウンロード統計情報 ===");
    console.log(`総ツイート数: ${tweetIds.length}件`);
    console.log(`ダウンロード成功: ${downloadedCount}件`);
    console.log(`既にダウンロード済み: ${skippedDownloaded}件`);
    console.log(`エラーでスキップ: ${skippedError}件`);
    console.log(`成功率: ${((downloadedCount / (tweetIds.length - skippedDownloaded)) * 100).toFixed(1)}%`);

    // レート制限の統計
    const rateLimitCount = rateLimitState.rateLimitHistory.length;
    if (rateLimitCount > 0) {
        const firstRateLimit = new Date(rateLimitState.rateLimitHistory[0].timestamp);
        const lastRateLimit = new Date(rateLimitState.rateLimitHistory[rateLimitCount - 1].timestamp);
        const totalTime = (lastRateLimit - firstRateLimit) / 1000 / 60; // 分単位
        const rateLimitInterval = totalTime / (rateLimitCount - 1); // レート制限間隔（分）

        console.log("\n=== レート制限統計 ===");
        console.log(`レート制限発生回数: ${rateLimitCount}回`);
        console.log(`最初のレート制限: ${firstRateLimit.toLocaleString()}`);
        console.log(`最後のレート制限: ${lastRateLimit.toLocaleString()}`);
        console.log(`平均レート制限間隔: ${rateLimitInterval.toFixed(1)}分`);

        // 直近24時間のレート制限回数
        const now = Date.now();
        const recentRateLimits = rateLimitState.rateLimitHistory.filter(
            h => now - h.timestamp < 24 * 60 * 60 * 1000
        );
        console.log(`直近24時間のレート制限回数: ${recentRateLimits.length}回`);
    }

    // 成功履歴の統計
    const successCount = rateLimitState.successHistory.length;
    if (successCount > 0) {
        const firstSuccess = new Date(rateLimitState.successHistory[0].timestamp);
        const lastSuccess = new Date(rateLimitState.successHistory[successCount - 1].timestamp);
        const totalSuccessTime = (lastSuccess - firstSuccess) / 1000 / 60; // 分単位
        const successRate = successCount / totalSuccessTime; // 1分あたりの成功数

        console.log("\n=== 成功統計 ===");
        console.log(`成功リクエスト数: ${successCount}回`);
        console.log(`最初の成功: ${firstSuccess.toLocaleString()}`);
        console.log(`最後の成功: ${lastSuccess.toLocaleString()}`);
        console.log(`平均処理速度: ${successRate.toFixed(2)}件/分`);

        // 直近24時間の成功数
        const now = Date.now();
        const recentSuccesses = rateLimitState.successHistory.filter(
            h => now - h.timestamp < 24 * 60 * 60 * 1000
        );
        console.log(`直近24時間の成功数: ${recentSuccesses.length}件`);
    }

    console.log("\n=== 実行時間 ===");
    const totalTime = (Date.now() - rateLimitState.startTime) / 1000 / 60; // 分単位
    console.log(`総実行時間: ${totalTime.toFixed(1)}分`);
    console.log("===================");
}

// メインのダウンロード処理関数
async function downloadTweets() {
    if (!TWITTER_COOKIE) {
        console.error("エラー: TWITTER_COOKIE が設定されていません。");
        return;
    }

    downloadStartTime = Date.now(); // 処理開始時刻を記録

    loadRateLimitState(); // 状態をロード
    rateLimitState.startTime = downloadStartTime; // 開始時刻を記録

    const tweetIds = await extractTweetIds(LIKES_FILE_PATH);
    let skippedDownloaded = 0;
    let skippedError = 0;
    let downloadedCount = 0;

    // プログレスバーの初期化
    const progressBar = new cliProgress.SingleBar({ 
        format: '進捗状況 |{bar}| {percentage}% | {value}/{total} ツイート | 現在: {currentTweet} | ダウンロード: {download} | スキップ: {skipped} | レート: {rate} ツイート/分',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    });
    progressBar.start(tweetIds.length, 0, { currentTweet: '---', download: 0, skipped: 0, rate: 0 });

    for (let i = 0; i < tweetIds.length; i++) {
        const tweetId = tweetIds[i];
        const tweetDir = path.join(DOWNLOADS_DIR, tweetId);
        const tweetFile = path.join(tweetDir, `${tweetId}.json`);

        // 既存の状態を確認
        const tweetStatus = await getTweetStatus(tweetId);
        if (tweetStatus.status === SHARED_CONFIG.STATUS.SUCCESS || 
            tweetStatus.status === SHARED_CONFIG.STATUS.PARTIAL) {
            skippedDownloaded++;
            progressBar.update(i + 1, { currentTweet: tweetId, download: downloadedCount, skipped: (skippedDownloaded + skippedError), rate: (i + 1) / ((Date.now() - downloadStartTime) / 60000) });
            continue;
        }

        // エラーリストの確認
        const isInErrorList = errorTweetIds.has(tweetId);

        if (isInErrorList) {
            skippedError++;
            progressBar.update(i + 1, { currentTweet: tweetId, download: downloadedCount, skipped: (skippedDownloaded + skippedError), rate: (i + 1) / ((Date.now() - downloadStartTime) / 60000) });
            continue;
        }

        try {
            const result = await TwitterDL.download(tweetId, {
                cookie: TWITTER_COOKIE,
                output: tweetDir
            });

            // メタデータの取得状態を確認
            const hasMetadata = fs.existsSync(tweetFile);
            const metadata = hasMetadata ? JSON.parse(fs.readFileSync(tweetFile, 'utf8')) : null;
            const hasMedia = metadata?.media && metadata.media.length > 0;
            const downloadedMedia = fs.readdirSync(tweetDir).filter(file => 
                file !== `${tweetId}.json` && 
                !file.endsWith('.txt')
            ).length;

            let status;
            if (result.status === 'error') {
                const { isRateLimit, reason } = checkRateLimit(result);
                if (isRateLimit) {
                    status = SHARED_CONFIG.STATUS.PENDING;
                    // レート制限の記録
                    rateLimitState.lastRateLimitTimestamp = Date.now();
                    rateLimitState.rateLimitHistory.push({
                        timestamp: Date.now(),
                        reason
                    });
                    saveRateLimitState();
                } else if (hasMetadata && downloadedMedia > 0) {
                    status = SHARED_CONFIG.STATUS.PARTIAL;
                } else {
                    status = SHARED_CONFIG.STATUS.FAILED;
                    errorTweetIds.add(tweetId);
                    saveErrorTweetIds();
                }
            } else {
                if (hasMetadata && hasMedia) {
                    if (downloadedMedia === metadata.media.length) {
                        status = SHARED_CONFIG.STATUS.SUCCESS;
                    } else if (downloadedMedia > 0) {
                        status = SHARED_CONFIG.STATUS.PARTIAL;
                    } else {
                        status = SHARED_CONFIG.STATUS.FAILED;
                    }
                } else {
                    status = SHARED_CONFIG.STATUS.NO_MEDIA;
                }
            }

            await updateTweetStatus(tweetId, status, {
                hasMetadata,
                hasMedia,
                downloadedMedia,
                expectedMedia: metadata?.media?.length || 0,
                error: result.status === 'error' ? result.message : null
            });

            if (status === SHARED_CONFIG.STATUS.SUCCESS || status === SHARED_CONFIG.STATUS.PARTIAL) {
                downloadedCount++;
                rateLimitState.successHistory.push({
                    timestamp: Date.now()
                });
                saveRateLimitState();
            }

            // 固定待機時間
            if (FIXED_WAIT_TIME_MS > 0) {
                await sleep(FIXED_WAIT_TIME_MS);
            }

            // プログレスバー更新（ダウンロード・スキップ・レートを更新）
            progressBar.update(i + 1, { currentTweet: tweetId, download: downloadedCount, skipped: skippedDownloaded, skippedError, rate: (i + 1) / ((Date.now() - downloadStartTime) / 60000) });

        } catch (error) {
            const { isRateLimit, reason } = checkRateLimit(null, error);
            let status;
            
            if (isRateLimit) {
                status = SHARED_CONFIG.STATUS.PENDING;
                // レート制限の記録
                rateLimitState.lastRateLimitTimestamp = Date.now();
                rateLimitState.rateLimitHistory.push({
                    timestamp: Date.now(),
                    reason
                });
                saveRateLimitState();
            } else {
                // エラーでも一部のメディアがダウンロードされている可能性がある
                const hasMetadata = fs.existsSync(tweetFile);
                const downloadedMedia = fs.readdirSync(tweetDir).filter(file => 
                    file !== `${tweetId}.json` && 
                    !file.endsWith('.txt')
                ).length;

                if (hasMetadata && downloadedMedia > 0) {
                    status = SHARED_CONFIG.STATUS.PARTIAL;
                } else {
                    status = SHARED_CONFIG.STATUS.FAILED;
                    errorTweetIds.add(tweetId);
                    saveErrorTweetIds();
                }
            }

            await updateTweetStatus(tweetId, status, {
                error: error.message,
                hasMetadata: fs.existsSync(tweetFile),
                downloadedMedia: fs.existsSync(tweetDir) ? 
                    fs.readdirSync(tweetDir).filter(file => 
                        file !== `${tweetId}.json` && 
                        !file.endsWith('.txt')
                    ).length : 0
            });
            progressBar.update(i + 1, { currentTweet: tweetId, download: downloadedCount, skipped: skippedDownloaded, skippedError, rate: (i + 1) / ((Date.now() - downloadStartTime) / 60000) });
        }
    }
    progressBar.stop();

    // 統計情報の表示
    const stats = await getStats();
    console.log("\n=== ダウンロード統計情報 ===");
    console.log(`総ツイート数: ${stats.total}件`);
    console.log(`ダウンロード成功: ${stats.successful}件`);
    console.log(`既にダウンロード済み: ${skippedDownloaded}件`);
    console.log(`エラーでスキップ: ${skippedError}件`);
    console.log(`成功率: ${((stats.successful / (stats.total - skippedDownloaded)) * 100).toFixed(1)}%`);

    // レート制限の統計
    displayStatistics(tweetIds, skippedDownloaded, skippedError, downloadedCount, rateLimitState);

    console.log("\nダウンロード処理が完了しました。");
    saveRateLimitState();
}

// スクリプト実行
downloadTweets().catch(err => {
    console.error("予期しないエラーが発生しました:", err);
    // 予期せぬエラー発生時も状態を保存しておく
    saveRateLimitState();
});
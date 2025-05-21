const { CONFIG: SHARED_CONFIG, getStats, getTweetStatus, updateTweetStatus } = require('./shared/shared-state');
const TwitterDL = require('twitter-downloader');
const fs = require('fs-extra');
const path = require('path');
const cliProgress = require('cli-progress');
require('dotenv').config();

// 設定
const DOWNLOADS_DIR = SHARED_CONFIG.downloadsDir;
const TWITTER_COOKIE = process.env.TWITTER_COOKIE || '';
const RATE_LIMIT_WAIT_TIME_MS = 15 * 60 * 1000; // 15分
const FIXED_WAIT_TIME_MS = 0; // 固定待機時間

// 再試行対象のステータス
const RETRY_STATUSES = [
    SHARED_CONFIG.STATUS.FAILED,
    SHARED_CONFIG.STATUS.ERROR,
    SHARED_CONFIG.STATUS.NO_MEDIA,
    SHARED_CONFIG.STATUS.PENDING
];

// 指定時間待機する関数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// レート制限かどうかを判定する関数
function checkRateLimit(result, error) {
    let isRateLimit = false;
    let reason = '';

    if (result && result.status === 'error') {
        if (result.message === 'Failed to get Guest Token. Authorization is invalid!') {
            isRateLimit = true;
            reason = result.message;
        }
    }

    if (!isRateLimit && error) {
        if (error.message && error.message.toLowerCase().includes('rate limit')) {
            isRateLimit = true;
            reason = error.message;
        } else if (error.statusCode === 429) {
            isRateLimit = true;
            reason = `Status code ${error.statusCode}`;
        }
    }

    return { isRateLimit, reason };
}

// メイン処理
async function retryFailedTweets() {
    if (!TWITTER_COOKIE) {
        console.error("エラー: TWITTER_COOKIE が設定されていません。");
        return;
    }

    // 現在の状態を取得
    const stats = await getStats();
    console.log("\n=== 現在の状態 ===");
    console.log(`総ツイート数: ${stats.total}件`);
    console.log(`成功: ${stats.successful}件`);
    console.log(`部分的成功: ${stats.partial}件`);
    console.log(`失敗: ${stats.failed}件`);
    console.log(`エラー: ${stats.error}件`);
    console.log(`メディアなし: ${stats.noMedia}件`);
    console.log(`保留中: ${stats.pending}件`);

    // 再試行対象のツイートを取得
    const allTweets = await fs.readJSON(path.join(__dirname, 'shared', 'shared-state.json'));
    const retryTweets = Object.entries(allTweets.tweets)
        .filter(([_, data]) => RETRY_STATUSES.includes(data.status))
        .map(([tweetId]) => tweetId);

    console.log(`\n再試行対象のツイート: ${retryTweets.length}件`);

    if (retryTweets.length === 0) {
        console.log("再試行対象のツイートはありません。");
        return;
    }

    // プログレスバーの初期化
    const progressBar = new cliProgress.SingleBar({
        format: '進捗状況 |{bar}| {percentage}% | {value}/{total} ツイート | 現在: {currentTweet} | 成功: {success} | 失敗: {failed} | スキップ: {skipped} | レート: {rate} ツイート/分',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    });

    progressBar.start(retryTweets.length, 0, {
        currentTweet: '開始待機中',
        success: 0,
        failed: 0,
        skipped: 0,
        rate: 0
    });

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let lastUpdateTime = Date.now();
    let lastSuccessCount = 0;

    for (const tweetId of retryTweets) {
        try {
            // ツイートのダウンロードを試行
            console.log(`\nツイート ${tweetId} のダウンロードを開始します...`);
            try {
                const outputDir = path.join(DOWNLOADS_DIR, tweetId);
                await fs.ensureDir(outputDir);

                const tweetUrl = `https://twitter.com/i/status/${tweetId}`;
                const result = await TwitterDL(tweetUrl, {
                    cookie: TWITTER_COOKIE
                });

                if (result.status === 'error') {
                    const { isRateLimit, reason } = checkRateLimit(result);
                    if (isRateLimit) {
                        console.log(`\nレート制限が発生しました: ${reason}`);
                        console.log(`${RATE_LIMIT_WAIT_TIME_MS / 1000 / 60}分待機します...`);
                        await sleep(RATE_LIMIT_WAIT_TIME_MS);
                        continue;
                    }
                    
                    // その他のエラー
                    console.error(`\nツイート ${tweetId} のダウンロードに失敗しました:`, result.message);
                    await updateTweetStatus(tweetId, SHARED_CONFIG.STATUS.FAILED, {
                        error: result.message,
                        hasMetadata: false,
                        downloadedMedia: 0
                    });
                    
                    failedCount++;
                } else {
                    // 成功時の処理
                    console.log(`\nツイート ${tweetId} のダウンロードに成功しました。`);
                    
                    // メタデータを保存
                    await fs.writeJSON(path.join(outputDir, `${tweetId}.json`), result.result, { spaces: 2 });
                    
                    // メディアファイルのダウンロード
                    const mediaFiles = [];
                    if (result.result?.media) {
                        for (const media of result.result.media) {
                            if (media.type === 'image') {
                                // 画像のダウンロード
                                const imageUrl = media.image;
                                const imageExt = path.extname(new URL(imageUrl).pathname) || '.jpg';
                                const imagePath = path.join(outputDir, `image_${mediaFiles.length + 1}${imageExt}`);
                                await downloadFile(imageUrl, imagePath);
                                mediaFiles.push(imagePath);
                            } else if (media.type === 'video') {
                                // 動画のダウンロード（最高品質）
                                const video = media.videos.sort((a, b) => b.bitrate - a.bitrate)[0];
                                if (video) {
                                    const videoExt = '.mp4';
                                    const videoPath = path.join(outputDir, `video_${mediaFiles.length + 1}${videoExt}`);
                                    await downloadFile(video.url, videoPath);
                                    mediaFiles.push(videoPath);
                                }
                            }
                        }
                    }
                    
                    // 状態を更新
                    const status = mediaFiles.length > 0 ? 
                        SHARED_CONFIG.STATUS.SUCCESS : 
                        SHARED_CONFIG.STATUS.NO_MEDIA;
                    
                    await updateTweetStatus(tweetId, status, {
                        hasMetadata: true,
                        downloadedMedia: mediaFiles.length,
                        expectedMedia: result.result?.media?.length || 0
                    });
                    
                    if (status === SHARED_CONFIG.STATUS.SUCCESS) {
                        successCount++;
                    }
                }

            } catch (error) {
                const { isRateLimit, reason } = checkRateLimit(null, error);
                
                if (isRateLimit) {
                    console.log(`\nレート制限が発生しました: ${reason}`);
                    console.log(`${RATE_LIMIT_WAIT_TIME_MS / 1000 / 60}分待機します...`);
                    await sleep(RATE_LIMIT_WAIT_TIME_MS);
                    continue;
                }
                
                // その他のエラー
                console.error(`\nツイート ${tweetId} のダウンロード中に予期しないエラーが発生しました:`);
                console.error(`エラータイプ: ${error.name}`);
                console.error(`エラーメッセージ: ${error.message}`);
                if (error.stack) {
                    console.error(`スタックトレース:\n${error.stack}`);
                }
                
                await updateTweetStatus(tweetId, SHARED_CONFIG.STATUS.ERROR, {
                    error: error.message,
                    hasMetadata: false,
                    downloadedMedia: 0
                });
                
                failedCount++;
            }

            // 進捗バーを更新
            const now = Date.now();
            if (now - lastUpdateTime >= 1000) {
                progressBar.update(successCount + failedCount + skippedCount, {
                    currentTweet: tweetId,
                    success: successCount,
                    failed: failedCount,
                    skipped: skippedCount,
                    rate: ((successCount - lastSuccessCount) / ((now - lastUpdateTime) / 1000 / 60)).toFixed(1)
                });
                lastUpdateTime = now;
                lastSuccessCount = successCount;
            }

            // 固定待機時間
            if (FIXED_WAIT_TIME_MS > 0) {
                await sleep(FIXED_WAIT_TIME_MS);
            }

        } catch (error) {
            const { isRateLimit, reason } = checkRateLimit(null, error);
            
            if (isRateLimit) {
                console.log(`\nレート制限が発生しました: ${reason}`);
                console.log(`${RATE_LIMIT_WAIT_TIME_MS / 1000 / 60}分待機します...`);
                await sleep(RATE_LIMIT_WAIT_TIME_MS);
                continue;
            }
            
            // その他のエラー
            console.error(`\nツイート ${tweetId} のダウンロード中に予期しないエラーが発生しました:`);
            console.error(`エラータイプ: ${error.name}`);
            console.error(`エラーメッセージ: ${error.message}`);
            if (error.stack) {
                console.error(`スタックトレース:\n${error.stack}`);
            }
            
            await updateTweetStatus(tweetId, SHARED_CONFIG.STATUS.ERROR, {
                error: error.message,
                hasMetadata: false,
                downloadedMedia: 0
            });
            
            failedCount++;
        }
    }

    progressBar.stop();

    // 最終結果の表示
    const finalStats = await getStats();
    console.log("\n=== 再試行結果 ===");
    console.log(`総ツイート数: ${finalStats.total}件`);
    console.log(`成功: ${finalStats.successful}件 (${((finalStats.successful / finalStats.total) * 100).toFixed(1)}%)`);
    console.log(`部分的成功: ${finalStats.partial}件 (${((finalStats.partial / finalStats.total) * 100).toFixed(1)}%)`);
    console.log(`失敗: ${finalStats.failed}件 (${((finalStats.failed / finalStats.total) * 100).toFixed(1)}%)`);
    console.log(`エラー: ${finalStats.error}件 (${((finalStats.error / finalStats.total) * 100).toFixed(1)}%)`);
    console.log(`メディアなし: ${finalStats.noMedia}件 (${((finalStats.noMedia / finalStats.total) * 100).toFixed(1)}%)`);
    console.log(`保留中: ${finalStats.pending}件 (${((finalStats.pending / finalStats.total) * 100).toFixed(1)}%)`);
    console.log(`\n処理内訳:`);
    console.log(`- 新規ダウンロード成功: ${successCount}件`);
    console.log(`- 新規ダウンロード失敗: ${failedCount}件`);
    console.log(`- 既存メタデータをスキップ: ${skippedCount}件`);
}

// ファイルをダウンロードする関数
async function downloadFile(url, outputPath) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
    }
    const buffer = await response.buffer();
    await fs.writeFile(outputPath, buffer);
}

// スクリプト実行
retryFailedTweets().catch(error => {
    console.error("予期しないエラーが発生しました:", error);
    process.exit(1);
}); 
const fs = require('fs-extra');
const path = require('path');
const { CONFIG: SHARED_CONFIG, updateTweetStatus, getStats, getTweetStatus } = require('./shared/shared-state');
const cliProgress = require('cli-progress');
const { default: ora } = require('ora');

// コマンドライン引数の解析
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        newOnly: false,
        help: false
    };

    for (const arg of args) {
        switch (arg) {
            case '--new-only':
            case '-n':
                options.newOnly = true;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
        }
    }

    return options;
}

// ヘルプメッセージの表示
function showHelp() {
    console.log(`
使用方法: node update-state.js [オプション]

オプション:
  -n, --new-only    新規ツイート（shared-state.jsonに未記録のもの）のみを処理
  -h, --help        このヘルプメッセージを表示

例:
  node update-state.js          # すべてのツイートを処理
  node update-state.js --new-only  # 新規ツイートのみを処理
`);
}

// ログ関数
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
}

// メディアファイルの情報を取得
function getMediaInfoFromJson(tweetFile) {
    try {
        const data = fs.readJSONSync(tweetFile);
        // mediaフィールドが存在しない、または空の配列の場合
        if (!data.media || !Array.isArray(data.media) || data.media.length === 0) {
            return { 
                hasMedia: false, 
                mediaCount: 0, 
                downloadedCount: 0,
                reason: 'メディアが含まれていません'
            };
        }

        const mediaInfo = {
            hasMedia: true,
            mediaCount: data.media.length,
            downloadedCount: 0,
            mediaDetails: []
        };

        // 各メディアの情報を収集
        for (const media of data.media) {
            // メディアのtypeが存在しない、または無効な場合はスキップ
            if (!media.type || (media.type !== 'photo' && media.type !== 'video')) {
                continue;
            }

            const mediaDetail = {
                type: media.type,
                downloaded: false,
                expectedFiles: []
            };

            if (media.type === 'photo') {
                // 画像の場合
                if (!media.image) {
                    continue; // 画像URLが存在しない場合はスキップ
                }
                const imageUrl = media.image;
                const fileName = path.basename(imageUrl.split('?')[0]); // URLからファイル名を抽出
                mediaDetail.expectedFiles.push(fileName);
            } else if (media.type === 'video') {
                // 動画の場合
                if (!media.cover) {
                    continue; // カバー画像が存在しない場合はスキップ
                }
                const coverUrl = media.cover;
                const coverFileName = path.basename(coverUrl.split('?')[0]);
                mediaDetail.expectedFiles.push(coverFileName);

                // 最高品質の動画を選択
                if (media.videos && media.videos.length > 0) {
                    const highestQuality = media.videos.reduce((prev, current) => {
                        return (prev.bitrate > current.bitrate) ? prev : current;
                    });
                    const videoFileName = path.basename(highestQuality.url.split('?')[0]);
                    mediaDetail.expectedFiles.push(videoFileName);
                } else {
                    continue; // 動画URLが存在しない場合はスキップ
                }
            }

            mediaInfo.mediaDetails.push(mediaDetail);
        }

        // 有効なメディアが1つも存在しない場合
        if (mediaInfo.mediaDetails.length === 0) {
            return { 
                hasMedia: false, 
                mediaCount: 0, 
                downloadedCount: 0,
                reason: '有効なメディアが含まれていません'
            };
        }

        // メディア数とメディア詳細を更新
        mediaInfo.mediaCount = mediaInfo.mediaDetails.length;
        return mediaInfo;
    } catch (error) {
        log(`JSONファイルの読み込みに失敗しました: ${error.message}`);
        return { 
            hasMedia: false, 
            mediaCount: 0, 
            downloadedCount: 0,
            reason: `JSONファイルの読み込みエラー: ${error.message}`
        };
    }
}

// メディアファイルの存在をチェック
function checkMediaFiles(dirPath, mediaInfo) {
    try {
        const files = fs.readdirSync(dirPath);
        let downloadedCount = 0;

        // 各メディアのファイルをチェック
        for (const mediaDetail of mediaInfo.mediaDetails) {
            const allFilesExist = mediaDetail.expectedFiles.every(expectedFile => 
                files.some(file => file === expectedFile)
            );
            if (allFilesExist) {
                mediaDetail.downloaded = true;
                downloadedCount++;
            }
        }

        return {
            hasMedia: mediaInfo.hasMedia,
            mediaCount: mediaInfo.mediaCount,
            downloadedCount,
            mediaDetails: mediaInfo.mediaDetails
        };
    } catch (error) {
        return { hasMedia: false, mediaCount: 0, downloadedCount: 0, mediaDetails: [] };
    }
}

// ツイートの状態を判定
async function determineTweetStatus(tweetId) {
    const tweetDir = path.join(SHARED_CONFIG.downloadsDir, tweetId);
    const tweetFile = path.join(tweetDir, `${tweetId}.json`);

    // ディレクトリが存在しない場合
    if (!fs.existsSync(tweetDir)) {
        return { status: SHARED_CONFIG.STATUS.PENDING, metadata: { reason: 'ディレクトリが存在しません' } };
    }

    // ツイートのJSONファイルが存在しない場合
    if (!fs.existsSync(tweetFile)) {
        return { status: SHARED_CONFIG.STATUS.PENDING, metadata: { reason: 'JSONファイルが存在しません' } };
    }

    // メディア情報を取得
    const mediaInfo = getMediaInfoFromJson(tweetFile);
    if (!mediaInfo.hasMedia) {
        return { 
            status: SHARED_CONFIG.STATUS.NO_MEDIA, 
            metadata: { 
                reason: mediaInfo.reason || 'メディアが含まれていません',
                mediaCount: 0,
                downloadedCount: 0
            } 
        };
    }

    // メディアファイルの存在をチェック
    const checkResult = checkMediaFiles(tweetDir, mediaInfo);
    
    // メディアのダウンロード状態に基づいて状態を判定
    if (checkResult.downloadedCount === 0) {
        return { 
            status: SHARED_CONFIG.STATUS.PENDING, 
            metadata: { 
                reason: 'メディアファイルがダウンロードされていません',
                mediaCount: checkResult.mediaCount,
                downloadedCount: 0
            } 
        };
    } else if (checkResult.downloadedCount < checkResult.mediaCount) {
        return { 
            status: SHARED_CONFIG.STATUS.PARTIAL, 
            metadata: { 
                reason: '一部のメディアファイルがダウンロードされていません',
                mediaCount: checkResult.mediaCount,
                downloadedCount: checkResult.downloadedCount,
                mediaDetails: checkResult.mediaDetails
            } 
        };
    }

    // すべてのメディアがダウンロードされている場合
    return { 
        status: SHARED_CONFIG.STATUS.SUCCESS, 
        metadata: { 
            mediaCount: checkResult.mediaCount,
            downloadedCount: checkResult.downloadedCount,
            mediaDetails: checkResult.mediaDetails
        } 
    };
}

// 状態更新のキュー
class StatusUpdateQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    async add(tweetId, status, metadata) {
        return new Promise((resolve, reject) => {
            this.queue.push({ tweetId, status, metadata, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        while (this.queue.length > 0) {
            const { tweetId, status, metadata, resolve, reject } = this.queue.shift();
            try {
                await updateTweetStatus(tweetId, status, metadata);
                resolve();
            } catch (error) {
                reject(error);
            }
        }
        this.processing = false;
    }
}

// メイン処理
async function main() {
    const options = parseArgs();
    
    if (options.help) {
        showHelp();
        return;
    }

    const spinner = ora('状態の更新を準備中...').start();
    const statusQueue = new StatusUpdateQueue();
    
    try {
        // downloadsディレクトリの存在確認
        if (!fs.existsSync(SHARED_CONFIG.downloadsDir)) {
            spinner.fail('downloadsディレクトリが見つかりません。');
            return;
        }

        // ディレクトリ一覧を取得
        let dirs = fs.readdirSync(SHARED_CONFIG.downloadsDir)
            .filter(item => {
                const fullPath = path.join(SHARED_CONFIG.downloadsDir, item);
                return fs.statSync(fullPath).isDirectory();
            });

        // 新規ツイートのみを処理するモードの場合
        if (options.newOnly) {
            spinner.text = '新規ツイートを検索中...';
            const existingTweets = new Set();
            
            // 既存のツイートIDを取得
            const stats = await getStats();
            if (stats.tweets) {
                Object.keys(stats.tweets).forEach(id => existingTweets.add(id));
            }

            // 新規ツイートのみをフィルタリング
            const originalCount = dirs.length;
            dirs = dirs.filter(id => !existingTweets.has(id));
            
            spinner.succeed(`新規ツイートを検出: ${dirs.length}件（既存: ${originalCount - dirs.length}件）`);
            
            if (dirs.length === 0) {
                spinner.succeed('処理対象の新規ツイートはありません。');
                return;
            }
        } else {
            spinner.succeed(`${dirs.length}件のツイートディレクトリを処理します...`);
        }

        // プログレスバーの設定
        const progressBar = new cliProgress.SingleBar({
            format: '進捗状況 |{bar}| {percentage}% | {value}/{total} ツイート | 現在: {currentTweet} | 残り時間: {eta}s',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });

        progressBar.start(dirs.length, 0, {
            currentTweet: '準備中...'
        });

        // 並列処理のためのバッチサイズ
        const BATCH_SIZE = 20;
        let updatedCount = 0;
        let pendingCount = 0;
        let successCount = 0;
        let noMediaCount = 0;
        let partialCount = 0;

        // バッチ処理
        for (let i = 0; i < dirs.length; i += BATCH_SIZE) {
            const batch = dirs.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (tweetId) => {
                const result = await determineTweetStatus(tweetId);
                await statusQueue.add(tweetId, result.status, {
                    ...result.metadata,
                    timestamp: new Date().toISOString(),
                    updatedBy: 'update-state.js'
                });

                switch (result.status) {
                    case SHARED_CONFIG.STATUS.PENDING:
                        pendingCount++;
                        break;
                    case SHARED_CONFIG.STATUS.SUCCESS:
                        successCount++;
                        break;
                    case SHARED_CONFIG.STATUS.NO_MEDIA:
                        noMediaCount++;
                        break;
                    case SHARED_CONFIG.STATUS.PARTIAL:
                        partialCount++;
                        break;
                }

                progressBar.update(++updatedCount, {
                    currentTweet: tweetId
                });

                return result;
            });

            await Promise.all(batchPromises);
        }

        // キューに残っている更新を処理
        while (statusQueue.queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        progressBar.stop();

        // 統計情報の表示
        const stats = await getStats();
        console.log('\n=== 更新結果 ===');
        console.log(`処理したツイート数: ${updatedCount}件`);
        console.log(`- 成功: ${successCount}件`);
        console.log(`- 一部成功: ${partialCount}件`);
        console.log(`- メディアなし: ${noMediaCount}件`);
        console.log(`- 保留中: ${pendingCount}件`);
        console.log('\n=== 全体の統計 ===');
        console.log(`- 成功: ${stats.successful}件`);
        console.log(`- 一部成功: ${stats.partial || 0}件`);
        console.log(`- 失敗: ${stats.failed}件`);
        console.log(`- メディアなし: ${stats.noMedia}件`);
        console.log(`- エラー: ${stats.error}件`);
        console.log(`- 保留中: ${stats.pending}件`);
        console.log(`- 合計: ${stats.total}件`);

        spinner.succeed('状態の更新が完了しました。');

    } catch (error) {
        spinner.fail(`エラーが発生しました: ${error.message}`);
        process.exit(1);
    }
}

// スクリプト実行
main().catch(error => {
    log(`致命的なエラーが発生しました: ${error.stack || error.message}`);
    process.exit(1);
}); 
const fs = require('fs-extra');
const path = require('path');
const cliProgress = require('cli-progress');
const { default: ora } = require('ora');

// ツイートの状態定数
const STATUS = {
    PENDING: 'pending',
    SUCCESS: 'success',
    PARTIAL: 'partial',
    FAILED: 'failed',
    NO_MEDIA: 'no_media'
};

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

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

// URLからファイル名を抽出
function extractFilenameFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        return pathParts[pathParts.length - 1];
    } catch (error) {
        log(`URLからのファイル名抽出に失敗しました: ${url} - ${error.message}`);
        return null;
    }
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
                const filename = extractFilenameFromUrl(media.image);
                if (filename) {
                    mediaDetail.expectedFiles.push(filename);
                }
            } else if (media.type === 'video') {
                // 動画の場合
                if (!media.videos || !Array.isArray(media.videos) || media.videos.length === 0) {
                    continue; // 動画情報が存在しない場合はスキップ
                }

                // 最高品質の動画を選択
                const highestQuality = media.videos.reduce((prev, current) => {
                    return (prev.bitrate > current.bitrate) ? prev : current;
                });
                
                const filename = extractFilenameFromUrl(highestQuality.url);
                if (filename) {
                    mediaDetail.expectedFiles.push(filename);
                }

                // カバー画像がある場合は追加
                if (media.cover) {
                    const coverFilename = extractFilenameFromUrl(media.cover);
                    if (coverFilename) {
                        mediaDetail.expectedFiles.push(coverFilename);
                    }
                }
            }

            // 期待されるファイルが1つでもある場合のみ追加
            if (mediaDetail.expectedFiles.length > 0) {
                mediaInfo.mediaDetails.push(mediaDetail);
            }
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
            // すべての期待されるファイルが存在するかチェック
            const allFilesExist = mediaDetail.expectedFiles.every(expectedFile => {
                const exists = files.some(file => file === expectedFile);
                if (!exists) {
                    log(`ファイルが見つかりません: ${dirPath}/${expectedFile}`);
                }
                return exists;
            });

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
        log(`メディアファイルのチェック中にエラーが発生しました: ${error.message}`);
        return { 
            hasMedia: false, 
            mediaCount: 0, 
            downloadedCount: 0, 
            mediaDetails: [],
            error: error.message
        };
    }
}

// ツイートの状態を判定
async function determineTweetStatus(tweetId) {
    const tweetDir = path.join(DOWNLOADS_DIR, tweetId);
    const tweetFile = path.join(tweetDir, `${tweetId}.json`);

    // ディレクトリが存在しない場合
    if (!await fs.pathExists(tweetDir)) {
        return { status: STATUS.PENDING, metadata: { reason: 'ディレクトリが存在しません' } };
    }

    // ツイートのJSONファイルが存在しない場合
    if (!await fs.pathExists(tweetFile)) {
        return { status: STATUS.PENDING, metadata: { reason: 'JSONファイルが存在しません' } };
    }

    // メディア情報を取得
    const mediaInfo = getMediaInfoFromJson(tweetFile);
    if (!mediaInfo.hasMedia) {
        return { 
            status: STATUS.NO_MEDIA, 
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
            status: STATUS.PENDING, 
            metadata: { 
                reason: 'メディアファイルがダウンロードされていません',
                mediaCount: checkResult.mediaCount,
                downloadedCount: 0
            } 
        };
    } else if (checkResult.downloadedCount < checkResult.mediaCount) {
        return { 
            status: STATUS.PARTIAL, 
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
        status: STATUS.SUCCESS, 
        metadata: { 
            mediaCount: checkResult.mediaCount,
            downloadedCount: checkResult.downloadedCount,
            mediaDetails: checkResult.mediaDetails
        } 
    };
}

// メイン処理
async function main() {
    const options = parseArgs();
    
    if (options.help) {
        showHelp();
        return;
    }

    const spinner = ora('状態の更新を準備中...').start();
    
    try {
        // downloadsディレクトリの存在確認
        if (!await fs.pathExists(DOWNLOADS_DIR)) {
            spinner.fail('downloadsディレクトリが見つかりません。');
            return;
        }

        // ディレクトリ一覧を取得
        let dirs = (await fs.readdir(DOWNLOADS_DIR))
            .filter(async item => {
                const fullPath = path.join(DOWNLOADS_DIR, item);
                const stats = await fs.stat(fullPath);
                return stats.isDirectory();
            });

        spinner.succeed(`${dirs.length}件のツイートディレクトリを処理します...`);

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

        // 統計情報
        let stats = {
            total: dirs.length,
            successful: 0,
            partial: 0,
            failed: 0,
            noMedia: 0,
            pending: 0,
            error: 0
        };

        // バッチ処理
        const BATCH_SIZE = 20;
        let updatedCount = 0;

        for (let i = 0; i < dirs.length; i += BATCH_SIZE) {
            const batch = dirs.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (tweetId) => {
                const result = await determineTweetStatus(tweetId);
                
                // 状態に応じて統計を更新
                switch (result.status) {
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

                progressBar.update(++updatedCount, {
                    currentTweet: tweetId
                });

                return result;
            });

            await Promise.all(batchPromises);
        }

        progressBar.stop();

        // 統計情報の表示
        console.log('\n=== 更新結果 ===');
        console.log(`処理したツイート数: ${updatedCount}件`);
        console.log(`- 成功: ${stats.successful}件`);
        console.log(`- 一部成功: ${stats.partial}件`);
        console.log(`- メディアなし: ${stats.noMedia}件`);
        console.log(`- 保留中: ${stats.pending}件`);
        console.log(`- 失敗: ${stats.failed}件`);
        console.log(`- エラー: ${stats.error}件`);
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
import fs from 'fs-extra';
import path from 'path';
import cliProgress from 'cli-progress';
import ora from 'ora';

// 型定義
interface CommandLineOptions {
    newOnly: boolean;
    help: boolean;
}

interface MediaDetail {
    type: string;
    downloaded: boolean;
    expectedFiles: string[];
}

interface MediaInfo {
    hasMedia: boolean;
    mediaCount: number;
    downloadedCount: number;
    mediaDetails?: MediaDetail[];
    reason?: string;
    error?: string;
}

interface TweetStatus {
    status: string;
    metadata: {
        reason?: string;
        mediaCount?: number;
        downloadedCount?: number;
        error?: string;
    };
}

interface TweetData {
    media?: Array<{
        type: string;
        image?: string;
        videos?: Array<{
            url: string;
            bitrate: number;
        }>;
        cover?: string;
    }>;
}

// ツイートの状態定数
const STATUS = {
    PENDING: 'pending',
    SUCCESS: 'success',
    PARTIAL: 'partial',
    FAILED: 'failed',
    NO_MEDIA: 'no_media'
} as const;

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

// コマンドライン引数の解析
function parseArgs(): CommandLineOptions {
    const args = process.argv.slice(2);
    const options: CommandLineOptions = {
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
function showHelp(): void {
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
function log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
}

// URLからファイル名を抽出
function extractFilenameFromUrl(url: string): string | null {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        return pathParts[pathParts.length - 1];
    } catch (error) {
        log(`URLからのファイル名抽出に失敗しました: ${url} - ${(error as Error).message}`);
        return null;
    }
}

// メディアファイルの情報を取得
function getMediaInfoFromJson(tweetFile: string): MediaInfo {
    try {
        const data = fs.readJSONSync(tweetFile) as TweetData;
        // mediaフィールドが存在しない、または空の配列の場合
        if (!data.media || !Array.isArray(data.media) || data.media.length === 0) {
            return { 
                hasMedia: false, 
                mediaCount: 0, 
                downloadedCount: 0,
                reason: 'メディアが含まれていません'
            };
        }

        const mediaInfo: MediaInfo = {
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

            const mediaDetail: MediaDetail = {
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
                mediaInfo.mediaDetails?.push(mediaDetail);
            }
        }

        // 有効なメディアが1つも存在しない場合
        if (!mediaInfo.mediaDetails || mediaInfo.mediaDetails.length === 0) {
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
        log(`JSONファイルの読み込みに失敗しました: ${(error as Error).message}`);
        return { 
            hasMedia: false, 
            mediaCount: 0, 
            downloadedCount: 0,
            reason: `JSONファイルの読み込みエラー: ${(error as Error).message}`
        };
    }
}

// メディアファイルの存在をチェック
function checkMediaFiles(dirPath: string, mediaInfo: MediaInfo): MediaInfo {
    try {
        const files = fs.readdirSync(dirPath);
        let downloadedCount = 0;

        // 各メディアのファイルをチェック
        for (const mediaDetail of mediaInfo.mediaDetails || []) {
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
        log(`メディアファイルのチェック中にエラーが発生しました: ${(error as Error).message}`);
        return { 
            hasMedia: false, 
            mediaCount: 0, 
            downloadedCount: 0, 
            mediaDetails: [],
            error: (error as Error).message
        };
    }
}

// ツイートの状態を判定
async function determineTweetStatus(tweetId: string): Promise<TweetStatus> {
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
                downloadedCount: checkResult.downloadedCount
            } 
        };
    } else {
        return { 
            status: STATUS.SUCCESS, 
            metadata: { 
                mediaCount: checkResult.mediaCount,
                downloadedCount: checkResult.downloadedCount
            } 
        };
    }
}

// メイン処理
async function main(): Promise<void> {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        return;
    }

    const spinner = ora('ツイートの状態を更新中...').start();

    try {
        // ダウンロードディレクトリの存在確認
        if (!await fs.pathExists(DOWNLOADS_DIR)) {
            spinner.fail('ダウンロードディレクトリが存在しません。');
            return;
        }

        // ツイートディレクトリの一覧を取得
        const tweetDirs = await fs.readdir(DOWNLOADS_DIR);
        const tweetIds = tweetDirs.filter(dir => /^\d+$/.test(dir));

        if (tweetIds.length === 0) {
            spinner.succeed('処理対象のツイートはありません。');
            return;
        }

        // プログレスバーの初期化
        const progressBar = new cliProgress.SingleBar({
            format: '進捗状況 |{bar}| {percentage}% | {value}/{total} ツイート | 現在: {currentTweet}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });

        progressBar.start(tweetIds.length, 0, {
            currentTweet: '開始待機中'
        });

        // 状態ファイルの読み込み
        const stateFile = path.join(__dirname, 'shared', 'shared-state.json');
        let state;
        try {
            state = await fs.readJSON(stateFile);
        } catch (error) {
            state = { tweets: {} };
        }

        // 各ツイートの状態を更新
        let updatedCount = 0;
        for (const tweetId of tweetIds) {
            progressBar.update(updatedCount, {
                currentTweet: tweetId
            });

            // 新規ツイートのみを処理する場合、既存のツイートはスキップ
            if (options.newOnly && state.tweets[tweetId]) {
                updatedCount++;
                continue;
            }

            const status = await determineTweetStatus(tweetId);
            state.tweets[tweetId] = status;
            updatedCount++;
        }

        // 状態ファイルを保存
        await fs.writeJSON(stateFile, state, { spaces: 2 });

        progressBar.stop();
        spinner.succeed(`ツイートの状態を更新しました（${updatedCount}件）`);

    } catch (error) {
        spinner.fail(`エラーが発生しました: ${(error as Error).message}`);
        process.exit(1);
    }
}

// メイン処理を実行
main().catch(error => {
    console.error("予期しないエラーが発生しました:", error);
    process.exit(1);
}); 
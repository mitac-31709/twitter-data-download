const { spawn } = require('child_process');
const path = require('path');
const { CONFIG: SHARED_CONFIG, getStats } = require('./shared/shared-state');
const { findUndownloadedMedia } = require('./tweet-downloader/download-tweets');

// ログ関数
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
}

// 子プロセスを実行する関数
function runScript(scriptPath, args = []) {
    return new Promise((resolve, reject) => {
        const process = spawn('node', [scriptPath, ...args], {
            stdio: 'inherit', // 子プロセスの出力を親プロセスに表示
            cwd: path.dirname(scriptPath) // スクリプトのディレクトリをカレントディレクトリとして設定
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`スクリプトが終了コード ${code} で終了しました`));
            }
        });

        process.on('error', (err) => {
            reject(err);
        });
    });
}

// メイン処理
async function main() {
    try {
        log('ツイートダウンロード処理を開始します...');

        // 1. ツイートのメタデータをダウンロード
        log('ステップ1: ツイートのメタデータをダウンロード中...');
        await runScript(path.join(__dirname, 'tweet-downloader', 'download-tweets.js'));
        
        // 統計情報を表示
        const statsAfterTweets = await getStats();
        log('\n=== ツイートメタデータのダウンロード結果 ===');
        log(`- 成功: ${statsAfterTweets.successful}件`);
        log(`- 失敗: ${statsAfterTweets.failed}件`);
        log(`- メディアなし: ${statsAfterTweets.noMedia}件`);
        log(`- エラー: ${statsAfterTweets.error}件`);
        log(`- 保留中: ${statsAfterTweets.pending}件`);
        log(`- 合計: ${statsAfterTweets.total}件`);

        // 2. メディアファイルをダウンロード
        log('\nステップ2: メディアファイルをダウンロード中...');
        
        // 設定ファイルの確認
        const configLoaded = require('./image-downloader/download-images').loadConfig();
        if (!configLoaded) {
            log('設定ファイルが見つからないため、デフォルト設定で実行します');
        }

        // Twitter Cookieの確認
        if (!process.env.TWITTER_COOKIE) {
            log('警告: Twitter Cookieが設定されていません。一部のツイートがダウンロードできない可能性があります');
        }

        // 未ダウンロードのメディアを検出
        log('未ダウンロードのメディアを検出中...');
        const undownloadedMedia = await findUndownloadedMedia();
        log(`未ダウンロードのメディア: ${undownloadedMedia.length}件`);

        if (undownloadedMedia.length > 0) {
            await runScript(path.join(__dirname, 'image-downloader', 'download-images.js'));
        } else {
            log('未ダウンロードのメディアはありません。');
        }

        // 最終的な統計情報を表示
        const finalStats = await getStats();
        log('\n=== 最終的なダウンロード結果 ===');
        log(`- 成功: ${finalStats.successful}件`);
        log(`- 失敗: ${finalStats.failed}件`);
        log(`- メディアなし: ${finalStats.noMedia}件`);
        log(`- エラー: ${finalStats.error}件`);
        log(`- 保留中: ${finalStats.pending}件`);
        log(`- 合計: ${finalStats.total}件`);

        log('\nすべてのダウンロード処理が完了しました。');

    } catch (error) {
        log(`エラーが発生しました: ${error.message}`);
        process.exit(1);
    }
}

// スクリプト実行
main().catch(error => {
    log(`致命的なエラーが発生しました: ${error.stack || error.message}`);
    process.exit(1);
}); 
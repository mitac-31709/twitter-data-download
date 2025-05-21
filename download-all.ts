import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { CONFIG as SHARED_CONFIG, getStats, Stats } from './shared/shared-state';

// ログ関数
function log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
}

// 子プロセスを実行する関数
function runScript(scriptPath: string, args: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        const process: ChildProcess = spawn('ts-node', [scriptPath, ...args], {
            stdio: 'inherit', // 子プロセスの出力を親プロセスに表示
            cwd: path.dirname(scriptPath) // スクリプトのディレクトリをカレントディレクトリとして設定
        });

        process.on('close', (code: number | null) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`スクリプトが終了コード ${code} で終了しました`));
            }
        });

        process.on('error', (err: Error) => {
            reject(err);
        });
    });
}

// メイン処理
async function main(): Promise<void> {
    try {
        log('ツイートダウンロード処理を開始します...');

        // 1. ツイートのメタデータをダウンロード
        log('ステップ1: ツイートのメタデータをダウンロード中...');
        await runScript(path.join(__dirname, 'tweet-downloader', 'download-tweets.ts'));
        
        // 統計情報を表示
        const statsAfterTweets: Stats = await getStats();
        log('\n=== ツイートメタデータのダウンロード結果 ===');
        log(`- 成功: ${statsAfterTweets.successful}件`);
        log(`- 失敗: ${statsAfterTweets.failed}件`);
        log(`- メディアなし: ${statsAfterTweets.noMedia}件`);
        log(`- エラー: ${statsAfterTweets.error}件`);
        log(`- 保留中: ${statsAfterTweets.pending}件`);
        log(`- 合計: ${statsAfterTweets.total}件`);

        // 2. メディアファイルをダウンロード
        log('\nステップ2: メディアファイルをダウンロード中...');
        await runScript(path.join(__dirname, 'image-downloader', 'download-images.ts'));

        // 最終的な統計情報を表示
        const finalStats: Stats = await getStats();
        log('\n=== 最終的なダウンロード結果 ===');
        log(`- 成功: ${finalStats.successful}件`);
        log(`- 失敗: ${finalStats.failed}件`);
        log(`- メディアなし: ${finalStats.noMedia}件`);
        log(`- エラー: ${finalStats.error}件`);
        log(`- 保留中: ${finalStats.pending}件`);
        log(`- 合計: ${finalStats.total}件`);

        log('\nすべてのダウンロード処理が完了しました。');

    } catch (error) {
        if (error instanceof Error) {
            log(`エラーが発生しました: ${error.message}`);
        } else {
            log(`エラーが発生しました: ${String(error)}`);
        }
        process.exit(1);
    }
}

// スクリプト実行
main().catch((error: unknown) => {
    if (error instanceof Error) {
        log(`致命的なエラーが発生しました: ${error.stack || error.message}`);
    } else {
        log(`致命的なエラーが発生しました: ${String(error)}`);
    }
    process.exit(1);
}); 
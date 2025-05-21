import { TweetDownloader } from '../src/tweet-downloader/tweet-downloader';

async function main(): Promise<void> {
    try {
        const downloader = new TweetDownloader();
        await downloader.downloadTweets();
    } catch (error) {
        console.error('ダウンロード処理中にエラーが発生しました', error instanceof Error ? error : new Error(String(error)));
        process.exit(1);
    }
}

// スクリプトとして実行された場合のみmain()を実行
if (require.main === module) {
    main();
} 
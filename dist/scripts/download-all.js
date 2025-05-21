"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tweet_downloader_1 = require("../src/tweet-downloader/tweet-downloader");
async function main() {
    try {
        const downloader = new tweet_downloader_1.TweetDownloader();
        await downloader.downloadTweets();
    }
    catch (error) {
        console.error('ダウンロード処理中にエラーが発生しました', error instanceof Error ? error : new Error(String(error)));
        process.exit(1);
    }
}
// スクリプトとして実行された場合のみmain()を実行
if (require.main === module) {
    main();
}
//# sourceMappingURL=download-all.js.map
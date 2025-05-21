"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUndownloadedMedia = findUndownloadedMedia;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
async function findUndownloadedMedia() {
    const downloadsDir = path_1.default.join(__dirname, '..', 'downloads');
    const tweets = [];
    try {
        // ダウンロードディレクトリが存在しない場合は空の配列を返す
        if (!await fs_extra_1.default.pathExists(downloadsDir)) {
            return [];
        }
        // ツイートディレクトリを取得
        const tweetDirs = await fs_extra_1.default.readdir(downloadsDir);
        for (const tweetId of tweetDirs) {
            const tweetDir = path_1.default.join(downloadsDir, tweetId);
            const tweetFile = path_1.default.join(tweetDir, `${tweetId}.json`);
            // ディレクトリとJSONファイルの存在確認
            if (!await fs_extra_1.default.pathExists(tweetDir) || !await fs_extra_1.default.pathExists(tweetFile)) {
                continue;
            }
            try {
                const data = await fs_extra_1.default.readJSON(tweetFile);
                // メディア情報の確認
                if (!data.media || !Array.isArray(data.media) || data.media.length === 0) {
                    continue;
                }
                // 既存のメディアファイルを取得
                const files = await fs_extra_1.default.readdir(tweetDir);
                const mediaFiles = files.filter(file => file !== `${tweetId}.json` &&
                    !file.endsWith('.txt'));
                // 未ダウンロードのメディアを検出
                for (const media of data.media) {
                    const mediaType = media.type || 'image';
                    const mediaUrl = mediaType === 'image' ? media.url : media.videoUrl;
                    if (!mediaUrl)
                        continue;
                    const filename = path_1.default.basename(mediaUrl);
                    const filePath = path_1.default.join(tweetDir, filename);
                    // ファイルが存在しない場合は未ダウンロードとして追加
                    if (!mediaFiles.includes(filename)) {
                        tweets.push({
                            tweetId,
                            media: {
                                type: mediaType,
                                image: mediaType === 'image' ? mediaUrl : undefined
                            },
                            videoUrl: mediaType === 'video' ? mediaUrl : undefined,
                            filePath
                        });
                    }
                }
            }
            catch (error) {
                console.error(`ツイート ${tweetId} の処理中にエラーが発生しました:`, error);
                continue;
            }
        }
    }
    catch (error) {
        console.error('未ダウンロードのメディア検出中にエラーが発生しました:', error);
    }
    return tweets;
}
//# sourceMappingURL=download-tweets.js.map
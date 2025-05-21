"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressManager = void 0;
const cli_progress_1 = __importDefault(require("cli-progress"));
class ProgressManager {
    constructor(logger) {
        this.logger = logger;
        this.total = 0;
        this.progressBar = new cli_progress_1.default.SingleBar({
            format: 'ダウンロード進捗 |{bar}| {percentage}% | {value}/{total} ツイート | 成功: {success} | スキップ: {skipped}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });
    }
    initialize(total) {
        this.total = total;
        this.progressBar.start(total, 0, {
            success: 0,
            skipped: 0
        });
    }
    update(stats) {
        const processed = stats.downloaded + stats.skipped;
        this.progressBar.update(processed, {
            success: stats.downloaded,
            skipped: stats.skipped
        });
    }
    stop() {
        this.progressBar.stop();
    }
    logError(tweetId, error) {
        this.logger.error(`ツイート ${tweetId} のダウンロードに失敗しました: ${error.message}`);
    }
    logSuccess(tweetId) {
        this.logger.debug(`ツイート ${tweetId} のダウンロードに成功しました`);
    }
    logSkipped(tweetId, reason) {
        this.logger.debug(`ツイート ${tweetId} をスキップしました: ${reason}`);
    }
    logRateLimit(waitTime) {
        const minutes = Math.ceil(waitTime / 60000);
        this.logger.warn(`レート制限により ${minutes} 分待機します`);
    }
}
exports.ProgressManager = ProgressManager;
//# sourceMappingURL=progress-manager.js.map
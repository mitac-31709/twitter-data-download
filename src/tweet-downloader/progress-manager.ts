import cliProgress from 'cli-progress';
import { Logger } from '../core/utils/logger';
import { DownloadStats } from '../core/types/stats';

export class ProgressManager {
    private readonly logger: Logger;
    private progressBar: cliProgress.SingleBar;
    private total: number;

    constructor(logger: Logger) {
        this.logger = logger;
        this.total = 0;
        this.progressBar = new cliProgress.SingleBar({
            format: 'ダウンロード進捗 |{bar}| {percentage}% | {value}/{total} ツイート | 成功: {success} | スキップ: {skipped}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });
    }

    public initialize(total: number): void {
        this.total = total;
        this.progressBar.start(total, 0, {
            success: 0,
            skipped: 0
        });
    }

    public update(stats: DownloadStats): void {
        const processed = stats.downloaded + stats.skipped;
        this.progressBar.update(processed, {
            success: stats.downloaded,
            skipped: stats.skipped
        });
    }

    public stop(): void {
        this.progressBar.stop();
    }

    public logError(tweetId: string, error: Error): void {
        this.logger.error(`ツイート ${tweetId} のダウンロードに失敗しました: ${error.message}`);
    }

    public logSuccess(tweetId: string): void {
        this.logger.debug(`ツイート ${tweetId} のダウンロードに成功しました`);
    }

    public logSkipped(tweetId: string, reason: string): void {
        this.logger.debug(`ツイート ${tweetId} をスキップしました: ${reason}`);
    }

    public logRateLimit(waitTime: number): void {
        const minutes = Math.ceil(waitTime / 60000);
        this.logger.warn(`レート制限により ${minutes} 分待機します`);
    }
} 
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { findUndownloadedMedia, type MediaInfo as TweetMediaInfo } from '../tweet-downloader/download-tweets';

dotenv.config();

// 設定ファイルのパス
const CONFIG_FILE_PATH = path.join(__dirname, '..', 'config.json');
const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads');

interface Config {
  outputDir: string;
  logFile: string;
  batchSize: number;
  batchDelay: number;
  rateLimitWaitTime: number;
  maxRateLimitRetries: number;
  twitterCookie: string;
}

// MediaInfoの型をTweetMediaInfoから継承
type MediaInfo = TweetMediaInfo;

interface TweetStatus {
  status: string;
  metadata: {
    reason?: string;
    error?: string;
    mediaCount?: number;
    downloadedCount?: number;
  };
}

// 設定
let CONFIG: Config = {
  outputDir: DOWNLOADS_DIR,
  logFile: path.join(__dirname, 'download-log.txt'),
  // 一度に処理するツイート数の制限（レート制限対策）
  batchSize: 50,
  // バッチ間の待機時間（ミリ秒）
  batchDelay: 5000,
  // レート制限時の待機時間（ミリ秒）- デフォルトで15分
  rateLimitWaitTime: 15 * 60 * 1000,
  // レート制限時の最大再試行回数
  maxRateLimitRetries: 3,
  // Twitter認証情報
  twitterCookie: process.env.TWITTER_COOKIE || ''
};

// ツイートの状態定数
const STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  PARTIAL: 'partial',
  FAILED: 'failed',
  NO_MEDIA: 'no_media'
};

// 設定ファイルから設定を読み込む関数
async function loadConfig(): Promise<boolean> {
  try {
    if (await fs.pathExists(CONFIG_FILE_PATH)) {
      const configData = await fs.readJSON(CONFIG_FILE_PATH);
      
      // ダウンロード設定を適用
      if (configData.downloadSettings) {
        CONFIG.batchSize = configData.downloadSettings.batchSize || CONFIG.batchSize;
        CONFIG.batchDelay = configData.downloadSettings.batchDelay || CONFIG.batchDelay;
        CONFIG.rateLimitWaitTime = configData.downloadSettings.rateLimitWaitTime || CONFIG.rateLimitWaitTime;
        CONFIG.maxRateLimitRetries = configData.downloadSettings.maxRateLimitRetries || CONFIG.maxRateLimitRetries;
      }
      
      // 認証情報を適用
      if (configData.twitterCookie) {
        CONFIG.twitterCookie = configData.twitterCookie;
      }
      
      return true;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`設定ファイルの読み込みに失敗しました: ${errorMessage}`);
  }
  return false;
}

// Twitter Cookieの確認
if (!CONFIG.twitterCookie) {
  console.warn('警告: Twitter Cookieが設定されていません。一部のツイートがダウンロードできない可能性があります');
}

// ログ関数
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFile(CONFIG.logFile, logMessage).catch(console.error);
}

// URLからファイル名を抽出
function extractFilenameFromUrl(url: string): string {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  return pathParts[pathParts.length - 1];
}

// ツイートの状態を取得
async function getTweetStatus(tweetId: string): Promise<TweetStatus> {
  const tweetDir = path.join(CONFIG.outputDir, tweetId);
  const tweetFile = path.join(tweetDir, `${tweetId}.json`);

  // ディレクトリが存在しない場合
  if (!await fs.pathExists(tweetDir)) {
    return { status: STATUS.PENDING, metadata: { reason: 'ディレクトリが存在しません' } };
  }

  // JSONファイルが存在しない場合
  if (!await fs.pathExists(tweetFile)) {
    return { status: STATUS.PENDING, metadata: { reason: 'JSONファイルが存在しません' } };
  }

  try {
    const data = await fs.readJSON(tweetFile);
    const files = await fs.readdir(tweetDir);
    const mediaFiles = files.filter(file => 
      file !== `${tweetId}.json` && 
      !file.endsWith('.txt')
    );

    // メディアの有無を確認
    if (!data.media || !Array.isArray(data.media) || data.media.length === 0) {
      return { status: STATUS.NO_MEDIA, metadata: { reason: 'メディアが含まれていません' } };
    }

    // メディアファイルの存在を確認
    const mediaCount = data.media.length;
    const downloadedCount = mediaFiles.length;

    if (downloadedCount === 0) {
      return { status: STATUS.PENDING, metadata: { reason: 'メディアファイルがダウンロードされていません' } };
    } else if (downloadedCount < mediaCount) {
      return { status: STATUS.PARTIAL, metadata: { reason: '一部のメディアファイルがダウンロードされていません' } };
    }

    return { status: STATUS.SUCCESS, metadata: { mediaCount, downloadedCount } };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { status: STATUS.FAILED, metadata: { error: errorMessage } };
  }
}

// ファイルをダウンロードする関数
async function downloadFile(url: string, outputPath: string): Promise<void> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(outputPath, buffer);
  } catch (error: unknown) {
    if (error instanceof Error && ('code' in error)) {
      const err = error as { code?: string };
      if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return downloadFile(url, outputPath);
      }
    }
    throw error;
  }
}

// メディアのダウンロード
async function downloadMedia(mediaInfo: MediaInfo): Promise<boolean> {
  try {
    const url = mediaInfo.media.type === 'image' ? mediaInfo.media.image : mediaInfo.videoUrl;
    if (!url) {
      throw new Error('URL is undefined');
    }
    await downloadFile(url, mediaInfo.filePath);
    log(`メディアファイルをダウンロードしました: ${mediaInfo.tweetId} - ${path.basename(mediaInfo.filePath)}`);
    
    const tweetStatus = await getTweetStatus(mediaInfo.tweetId);
    if (tweetStatus.status === STATUS.SUCCESS) {
      log(`ツイート ${mediaInfo.tweetId} のすべてのメディアがダウンロードされました`);
    } else if (tweetStatus.status === STATUS.PARTIAL) {
      log(`ツイート ${mediaInfo.tweetId} の一部のメディアがダウンロードされました`);
    }
    
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`メディアファイルのダウンロードに失敗しました: ${mediaInfo.tweetId} - ${errorMessage}`);
    return false;
  }
}

// メイン処理
async function main() {
  try {
    // 設定ファイルの読み込み
    const configLoaded = await loadConfig();
    if (configLoaded) {
      log('設定ファイルから設定を読み込みました');
    } else {
      log('設定ファイルが見つからないため、デフォルト設定で実行します');
    }

    // 認証情報の確認
    if (CONFIG.twitterCookie) {
      log('Twitter Cookieが設定されています');
    } else {
      log('警告: Twitter Cookieが設定されていません。一部のツイートがダウンロードできない可能性があります');
    }

    // 出力ディレクトリの作成
    await fs.ensureDir(CONFIG.outputDir);

    // 未ダウンロードのメディアを検出
    log('未ダウンロードのメディアを検出中...');
    const undownloadedMedia = await findUndownloadedMedia();
    log(`未ダウンロードのメディア: ${undownloadedMedia.length}件`);

    // バッチ処理
    for (let i = 0; i < undownloadedMedia.length; i += CONFIG.batchSize) {
      const batch = undownloadedMedia.slice(i, i + CONFIG.batchSize);
      log(`バッチ処理開始: ${i+1}～${Math.min(i+CONFIG.batchSize, undownloadedMedia.length)}/${undownloadedMedia.length}`);
      
      let successCount = 0;
      let failureCount = 0;
      
      for (const mediaInfo of batch) {
        const success = await downloadMedia(mediaInfo);
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }
      }
      
      // バッチの結果を表示
      log(`バッチ処理完了: 成功 ${successCount}件, 失敗 ${failureCount}件`);
      
      // バッチ間の待機（最後のバッチ以外）
      if (i + CONFIG.batchSize < undownloadedMedia.length) {
        log(`次のバッチまで${CONFIG.batchDelay}ミリ秒待機します...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.batchDelay));
      }
    }
    
    log('処理完了');
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`予期せぬエラーが発生しました: ${errorMessage}`);
    process.exit(1);
  }
}

// スクリプト実行
main().catch(error => {
  log(`致命的なエラーが発生しました: ${error.stack || error.message}`);
  process.exit(1);
});

// エクスポート
export {
  loadConfig,
  CONFIG,
  STATUS,
  type Config,
  type MediaInfo,
  type TweetStatus
};
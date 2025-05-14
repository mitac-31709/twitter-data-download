const fs = require('fs-extra');
const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const StreamValues = require('stream-json/streamers/StreamValues');
const { CONFIG: SHARED_CONFIG, updateTweetStatus, getTweetStatus, getStats } = require(path.join(__dirname, '..', 'shared', 'shared-state'));

// 設定ファイルのパス
const CONFIG_FILE_PATH = path.join(__dirname, '..', 'config.json');

// 設定
let CONFIG = {
  likeJsPath: path.join(__dirname, '..', 'shared', 'like.js'),
  processedTweetsFile: path.join(__dirname, '..', 'processed-tweets.json'),
  outputDir: SHARED_CONFIG.downloadsDir,
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
  twitterCredentials: {
    username: '',
    password: ''
  }
};

// 設定ファイルから設定を読み込む
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const configData = fs.readJSONSync(CONFIG_FILE_PATH);
      
      // ダウンロード設定を適用
      if (configData.downloadSettings) {
        CONFIG.batchSize = configData.downloadSettings.batchSize || CONFIG.batchSize;
        CONFIG.batchDelay = configData.downloadSettings.batchDelay || CONFIG.batchDelay;
        CONFIG.rateLimitWaitTime = configData.downloadSettings.rateLimitWaitTime || CONFIG.rateLimitWaitTime;
        CONFIG.maxRateLimitRetries = configData.downloadSettings.maxRateLimitRetries || CONFIG.maxRateLimitRetries;
      }
      
      // 認証情報を適用
      if (configData.twitterCredentials) {
        CONFIG.twitterCredentials = configData.twitterCredentials;
      }
      
      return true;
    }
  } catch (error) {
    console.error(`設定ファイルの読み込みに失敗しました: ${error.message}`);
  }
  return false;
}

// ログ関数
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(CONFIG.logFile, logMessage);
}

// 処理済みツイートの読み込み
async function loadProcessedTweets() {
  try {
    if (await fs.pathExists(CONFIG.processedTweetsFile)) {
      return await fs.readJSON(CONFIG.processedTweetsFile);
    }
  } catch (error) {
    log(`処理済みツイートファイルの読み込みに失敗しました: ${error.message}`);
  }
  return { successful: {}, failed: {}, noMedia: {} };
}

// 処理済みツイートの保存
async function saveProcessedTweets(processed) {
  try {
    await fs.writeJSON(CONFIG.processedTweetsFile, processed, { spaces: 2 });
  } catch (error) {
    log(`処理済みツイートファイルの保存に失敗しました: ${error.message}`);
  }
}

// ツイートのダウンロード
async function downloadTweet(tweetId, retryCount = 0) {
  // 既存の状態を確認
  const tweetStatus = await getTweetStatus(tweetId);
  if (tweetStatus.status === SHARED_CONFIG.STATUS.SUCCESS) {
    return { success: true, noMedia: false, rateLimit: false, authError: false, output: 'Already downloaded' };
  }

  return new Promise((resolve) => {
    const twmdPath = path.join(__dirname, 'twitter-media-downloader.exe');
    const outputPath = path.join(CONFIG.outputDir, tweetId);

    // フォルダがなければ作成
    fs.ensureDirSync(outputPath);

    // コマンドライン引数の準備
    const args = ['-t', tweetId, '-o', outputPath, '-a'];
    
    // 認証情報があれば追加
    if (CONFIG.twitterCredentials && CONFIG.twitterCredentials.username && CONFIG.twitterCredentials.password) {
      args.push('-u', CONFIG.twitterCredentials.username);
      args.push('-p', CONFIG.twitterCredentials.password);
    }

    const process = spawn(twmdPath, args);

    let output = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      output += data.toString();
    });

    process.on('close', async (code) => {
      const hasError = code !== 0;
      const hasNoMedia = output.includes('No media found') || output.includes('contains no media');
      const isRateLimit = output.includes('response status 429 Too Many Requests') || 
                        output.includes('Rate limit exceeded');
      const isAuthError = output.includes('Authentication failed') || 
                       output.includes('Login failed') ||
                       output.includes('Unauthorized') ||
                       output.includes('Invalid credentials');
      
      // メディアファイルの存在確認
      const mediaFiles = fs.readdirSync(outputPath).filter(file => 
        file !== `${tweetId}.json` && 
        !file.endsWith('.txt')
      );
      
      let status;
      if (isAuthError) {
        status = SHARED_CONFIG.STATUS.ERROR;
      } else if (isRateLimit && retryCount < CONFIG.maxRateLimitRetries) {
        status = SHARED_CONFIG.STATUS.PENDING;
      } else if (hasNoMedia) {
        status = SHARED_CONFIG.STATUS.NO_MEDIA;
      } else if (hasError) {
        // エラーでも一部のメディアがダウンロードされている可能性がある
        if (mediaFiles.length > 0) {
          status = SHARED_CONFIG.STATUS.PARTIAL;
        } else {
          status = SHARED_CONFIG.STATUS.FAILED;
        }
      } else {
        // 成功の場合でも、すべてのメディアがダウンロードされているか確認
        const tweetData = JSON.parse(fs.readFileSync(path.join(outputPath, `${tweetId}.json`), 'utf8'));
        const expectedMediaCount = tweetData.media ? tweetData.media.length : 0;
        if (mediaFiles.length > 0 && mediaFiles.length < expectedMediaCount) {
          status = SHARED_CONFIG.STATUS.PARTIAL;
        } else {
          status = SHARED_CONFIG.STATUS.SUCCESS;
        }
      }

      await updateTweetStatus(tweetId, status, {
        retryCount,
        output,
        hasError,
        hasNoMedia,
        isRateLimit,
        isAuthError,
        mediaFiles: mediaFiles.length,
        expectedMediaCount: tweetData?.media?.length || 0
      });

      resolve({ 
        success: status === SHARED_CONFIG.STATUS.SUCCESS || status === SHARED_CONFIG.STATUS.PARTIAL, 
        noMedia: status === SHARED_CONFIG.STATUS.NO_MEDIA, 
        rateLimit: isRateLimit,
        authError: isAuthError,
        partial: status === SHARED_CONFIG.STATUS.PARTIAL,
        output 
      });
    });
  });
}

// like.jsからツイートIDを抽出
async function extractTweetIds() {
  log('like.jsファイルを読み込み中...');
  
  // ファイル全体を読み込む
  const content = await fs.readFile(CONFIG.likeJsPath, 'utf8');
  
  // "window.YTD.like.part0 = " の部分を取り除く
  let jsonContent;
  try {
    // JavaScriptの代入式からJSONデータ部分を抽出
    const match = content.match(/^window\.YTD\.like\.part0\s*=\s*(.+)/s);
    if (match && match[1]) {
      jsonContent = match[1].trim();
      // 末尾にセミコロンがある場合は削除
      if (jsonContent.endsWith(';')) {
        jsonContent = jsonContent.slice(0, -1);
      }
    } else {
      throw new Error('期待されるフォーマットではありません');
    }
    
    // JSONとして解析
    const data = JSON.parse(jsonContent);
    
    // ツイートIDを抽出
    const tweetIds = [];
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && item.like && item.like.tweetId) {
          tweetIds.push(item.like.tweetId);
        }
      }
    }
    
    log(`${tweetIds.length}件のツイートIDを抽出しました`);
    return tweetIds;
    
  } catch (error) {
    log(`JSONデータの解析に失敗しました: ${error.message}`);
    throw error;
  }
}

// メイン処理
async function main() {
  try {
    // 設定ファイルの読み込み
    const configLoaded = loadConfig();
    if (configLoaded) {
      log('設定ファイルから設定を読み込みました');
      
      // 認証情報の確認
      if (CONFIG.twitterCredentials.username && CONFIG.twitterCredentials.password) {
        log(`ユーザー "${CONFIG.twitterCredentials.username}" としてログインします`);
      } else {
        log('認証情報が設定されていません。匿名モードで実行します');
      }
    } else {
      log('設定ファイルが見つからないため、デフォルト設定で実行します');
    }

    // 出力ディレクトリの作成
    await fs.ensureDir(CONFIG.outputDir);

    // 処理済みツイートの読み込み
    const processed = await loadProcessedTweets();
    
    log('ツイートIDの抽出を開始します...');
    
    // ツイートIDの抽出
    const allTweetIds = await extractTweetIds();
    
    // 未処理のツイートをフィルタリング
    const tweetIds = [];
    for (const tweetId of allTweetIds) {
      const status = await getTweetStatus(tweetId);
      if (status.status === SHARED_CONFIG.STATUS.PENDING) {
        tweetIds.push(tweetId);
      }
    }
    
    log(`未処理のツイート: ${tweetIds.length}件`);
    
    // バッチ処理
    for (let i = 0; i < tweetIds.length; i += CONFIG.batchSize) {
      const batch = tweetIds.slice(i, i + CONFIG.batchSize);
      log(`バッチ処理開始: ${i+1}～${Math.min(i+CONFIG.batchSize, tweetIds.length)}/${tweetIds.length}`);
      
      for (const tweetId of batch) {
        log(`ツイート処理開始: ${tweetId}`);
        
        try {
          const result = await downloadTweet(tweetId);
          
          if (result.success) {
            processed.successful[tweetId] = new Date().toISOString();
            log(`成功: ${tweetId}`);
          } else if (result.noMedia) {
            processed.noMedia[tweetId] = new Date().toISOString();
            log(`メディアなし: ${tweetId}`);
          } else if (result.authError) {
            log(`認証エラー: ${tweetId} - ${result.output}`);
            log('Twitter認証に失敗しました。config.jsonの認証情報を確認してください');
            processed.failed[tweetId] = new Date().toISOString();
            // 認証エラーが発生した場合は処理を中止
            return;
          } else if (result.rateLimit) {
            log(`レート制限: ${tweetId} - ${result.output}`);
            log(`レート制限のため${CONFIG.rateLimitWaitTime}ミリ秒待機します...`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimitWaitTime));
            log(`再試行: ${tweetId} (${result.retryCount}/${CONFIG.maxRateLimitRetries})`);
            const retryResult = await downloadTweet(tweetId, result.retryCount);
            if (retryResult.success) {
              processed.successful[tweetId] = new Date().toISOString();
              log(`成功: ${tweetId}`);
            } else if (retryResult.noMedia) {
              processed.noMedia[tweetId] = new Date().toISOString();
              log(`メディアなし: ${tweetId}`);
            } else {
              processed.failed[tweetId] = new Date().toISOString();
              log(`失敗: ${tweetId} - ${retryResult.output}`);
            }
          } else {
            processed.failed[tweetId] = new Date().toISOString();
            log(`失敗: ${tweetId} - ${result.output}`);
          }
        } catch (error) {
          processed.failed[tweetId] = new Date().toISOString();
          log(`エラー: ${tweetId} - ${error.message}`);
        }
        
        // 各ダウンロード後に処理済みツイートを保存
        await saveProcessedTweets(processed);
      }
      
      // バッチ間の待機（最後のバッチ以外）
      if (i + CONFIG.batchSize < tweetIds.length) {
        log(`次のバッチまで${CONFIG.batchDelay}ミリ秒待機します...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.batchDelay));
      }
    }
    
    // 統計情報の表示
    const stats = await getStats();
    log('処理完了:');
    log(`- 成功: ${stats.successful}件`);
    log(`- 失敗: ${stats.failed}件`);
    log(`- メディアなし: ${stats.noMedia}件`);
    log(`- エラー: ${stats.error}件`);
    log(`- 保留中: ${stats.pending}件`);
    log(`- 合計: ${stats.total}件`);
    
  } catch (error) {
    log(`予期せぬエラーが発生しました: ${error.message}`);
    process.exit(1);
  }
}

// スクリプト実行
main().catch(error => {
  log(`致命的なエラーが発生しました: ${error.stack || error.message}`);
  process.exit(1);
});
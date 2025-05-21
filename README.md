# Twitter Data Downloader

TwitterのツイートとメディアをダウンロードするためのTypeScriptライブラリです。

## 機能

- ツイートのダウンロードとメディアの保存
- レート制限の自動検出と待機
- 進捗状況の表示
- 詳細な統計情報
- エラーハンドリングとログ記録
- 設定のカスタマイズ

## インストール

```bash
npm install twitter-data-download
```

## 使用方法

### 基本的な使用例

```typescript
import { TweetDownloader } from 'twitter-data-download';

const downloader = new TweetDownloader({
    outputDir: './downloads',
    twitterCookie: 'your_twitter_cookie'
});

await downloader.downloadTweets(['tweet_id1', 'tweet_id2']);
```

### 設定

`config.json`または環境変数で設定をカスタマイズできます：

```json
{
    "outputDir": "downloads",
    "logFile": "downloads/download.log",
    "twitterCookie": "",
    "batchDelay": 1000,
    "maxRetries": 3,
    "retryDelay": 5000,
    "rateLimitDelay": 900000,
    "historyLimit": 50
}
```

## アーキテクチャ

### コアコンポーネント

1. **TweetDownloader** (`src/tweet-downloader/tweet-downloader.ts`)
   - メインのダウンロードロジック
   - 他のマネージャークラスの統合
   - ダウンロードプロセスの制御

2. **TweetStatusManager** (`src/tweet-downloader/tweet-status-manager.ts`)
   - ツイートのステータス管理
   - メタデータの保存
   - ダウンロード状態の追跡

3. **RateLimitManager** (`src/tweet-downloader/rate-limit-manager.ts`)
   - レート制限の検出と管理
   - 待機時間の計算
   - レート制限履歴の記録

4. **StatsManager** (`src/tweet-downloader/stats-manager.ts`)
   - ダウンロード統計の管理
   - 成功率の計算
   - 統計情報の表示

5. **ProgressManager** (`src/tweet-downloader/progress-manager.ts`)
   - プログレスバーの表示
   - 進捗状況の更新
   - ログメッセージの出力

### ユーティリティ

1. **Logger** (`src/core/utils/logger.ts`)
   - ログレベルの管理
   - ファイルへのログ出力
   - エラーハンドリング

2. **ConfigManager** (`src/core/utils/config-manager.ts`)
   - 設定の読み込みと保存
   - デフォルト値の管理
   - 環境変数の統合

## 型定義

### ツイート関連 (`src/core/types/tweet.ts`)

```typescript
interface TweetStatus {
    status: TweetStatusType;
    metadata: {
        hasMetadata: boolean;
        hasMedia?: boolean;
        downloadedMedia: number;
        expectedMedia?: number;
    };
}

interface RateLimitState {
    lastRateLimitTimestamp: number | null;
    rateLimitHistory: Array<{
        timestamp: number;
        reason: string;
    }>;
    successHistory: Array<{
        timestamp: number;
        tweetId: string;
    }>;
    startTime: number | null;
}
```

### 統計情報 (`src/core/types/stats.ts`)

```typescript
interface DownloadStats {
    total: number;
    skipped: number;
    downloaded: number;
    remaining: number;
    successRate: string;
    rateLimitHistory: Array<{
        timestamp: number;
        reason: string;
    }>;
    successHistory: Array<{
        timestamp: number;
        tweetId: string;
    }>;
}
```

## エラーハンドリング

- レート制限の自動検出と待機
- ダウンロード失敗時のリトライ
- 詳細なエラーログ
- エラー状態の永続化

## 開発者向け情報

### テスト

```bash
npm test
```

### ビルド

```bash
npm run build
```

### コード品質

```bash
npm run lint
npm run format
```

## ライセンス

MIT

## 貢献

1. フォーク
2. 機能ブランチの作成
3. 変更のコミット
4. ブランチのプッシュ
5. プルリクエストの作成
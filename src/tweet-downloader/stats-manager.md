# StatsManager

ダウンロードの統計情報を管理するクラスです。

## 概要

`StatsManager`は、ツイートのダウンロードに関する統計情報を収集し、管理します。ダウンロードの成功率、スキップ数、残りのツイート数などの情報を追跡し、必要に応じて表示します。

## 主な機能

- ダウンロード統計の管理
- 成功率の計算
- 統計情報の表示
- レート制限状態の統合
- 成功履歴の管理

## 使用方法

```typescript
import { StatsManager } from './stats-manager';
import { Logger } from '../core/utils/logger';

// インスタンスの作成
const logger = new Logger('downloads/download.log');
const statsManager = new StatsManager(logger);

// 統計情報の初期化
statsManager.initialize(totalTweets);

// 統計情報の更新
statsManager.updateStats(TWEET_STATUS.SUCCESS);
statsManager.updateStats(TWEET_STATUS.FAILED);

// レート制限状態の更新
statsManager.updateRateLimitState(rateLimitState);

// 統計情報の表示
statsManager.displayStats();
```

## API

### コンストラクタ

```typescript
constructor(logger: Logger)
```

- `logger`: ログ出力用のLoggerインスタンス

### メソッド

#### `initialize(total: number): void`

統計情報を初期化します。

- `total`: 処理対象の総ツイート数

#### `updateStats(status: TweetStatusType): void`

統計情報を更新します。

- `status`: ツイートのステータス（SUCCESS, PARTIAL, FAILED, NO_MEDIA）

#### `updateRateLimitState(rateLimitState: RateLimitState): void`

レート制限状態を更新します。

- `rateLimitState`: 現在のレート制限状態

#### `displayStats(): void`

現在の統計情報を表示します。

#### `getStats(): DownloadStats`

現在の統計情報を取得します。

- 戻り値: 現在の統計情報

## 内部状態

```typescript
interface DownloadStats {
    total: number;          // 総ツイート数
    skipped: number;        // スキップ数
    downloaded: number;     // ダウンロード成功数
    remaining: number;      // 残りのツイート数
    successRate: string;    // 成功率（パーセント）
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

- エラーは`Logger`を通じて記録されます
- 不正なステータス値は無視されます

## 使用例

### 基本的な統計情報の管理

```typescript
async function processTweets(tweetIds: string[]) {
    const statsManager = new StatsManager(logger);
    statsManager.initialize(tweetIds.length);

    for (const tweetId of tweetIds) {
        try {
            const result = await downloadTweet(tweetId);
            statsManager.updateStats(TWEET_STATUS.SUCCESS);
        } catch (error) {
            statsManager.updateStats(TWEET_STATUS.FAILED);
        }
    }

    statsManager.displayStats();
}
```

### レート制限状態との統合

```typescript
function updateStatistics(rateLimitManager: RateLimitManager) {
    const rateLimitState = rateLimitManager.getState();
    statsManager.updateRateLimitState(rateLimitState);
    statsManager.displayStats();
}
```

### 定期的な統計情報の表示

```typescript
function startPeriodicStatsDisplay(interval: number) {
    setInterval(() => {
        statsManager.displayStats();
    }, interval);
}
```

## 表示形式

統計情報は以下のような形式で表示されます：

```
=== ダウンロード統計 ===
総ツイート数: 100
スキップ済み: 5
ダウンロード済み: 90
残り: 5
成功率: 94.7%

=== レート制限履歴 ===
2024-03-20 10:30:15: Too Many Requests
2024-03-20 11:45:22: Rate limit exceeded

=== 成功履歴 ===
2024-03-20 12:00:01: 1234567890
2024-03-20 12:00:02: 2345678901
2024-03-20 12:00:03: 3456789012
``` 
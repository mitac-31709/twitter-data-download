# ProgressManager

ダウンロードの進捗状況を表示するクラスです。

## 概要

`ProgressManager`は、ツイートのダウンロード進捗を視覚的に表示し、ユーザーに現在の状態を伝えます。プログレスバーを使用して進捗を表示し、同時にログメッセージも出力します。

## 主な機能

- プログレスバーの表示
- 進捗状況の更新
- エラーメッセージの表示
- 成功メッセージの表示
- レート制限通知の表示

## 使用方法

```typescript
import { ProgressManager } from './progress-manager';
import { Logger } from '../core/utils/logger';

// インスタンスの作成
const logger = new Logger('downloads/download.log');
const progressManager = new ProgressManager(logger);

// プログレスバーの初期化
progressManager.initialize(totalTweets);

// 進捗状況の更新
progressManager.update(stats);

// 各種メッセージの表示
progressManager.logError(tweetId, error);
progressManager.logSuccess(tweetId);
progressManager.logSkipped(tweetId, 'メディアなし');
progressManager.logRateLimit(waitTime);

// プログレスバーの停止
progressManager.stop();
```

## API

### コンストラクタ

```typescript
constructor(logger: Logger)
```

- `logger`: ログ出力用のLoggerインスタンス

### メソッド

#### `initialize(total: number): void`

プログレスバーを初期化します。

- `total`: 処理対象の総ツイート数

#### `update(stats: DownloadStats): void`

進捗状況を更新します。

- `stats`: 現在の統計情報

#### `stop(): void`

プログレスバーを停止します。

#### `logError(tweetId: string, error: Error): void`

エラーメッセージを表示します。

- `tweetId`: エラーが発生したツイートのID
- `error`: 発生したエラー

#### `logSuccess(tweetId: string): void`

成功メッセージを表示します。

- `tweetId`: 成功したツイートのID

#### `logSkipped(tweetId: string, reason: string): void`

スキップメッセージを表示します。

- `tweetId`: スキップされたツイートのID
- `reason`: スキップの理由

#### `logRateLimit(waitTime: number): void`

レート制限通知を表示します。

- `waitTime`: 待機時間（ミリ秒）

## プログレスバーの表示形式

プログレスバーは以下のような形式で表示されます：

```
ダウンロード進捗 |████████████████████████████████████████| 100% | 100/100 ツイート | 成功: 95 | スキップ: 5
```

## エラーハンドリング

- エラーメッセージは`Logger`を通じて記録されます
- プログレスバーの更新に失敗した場合は無視されます

## 使用例

### 基本的な進捗表示

```typescript
async function downloadTweets(tweetIds: string[]) {
    const progressManager = new ProgressManager(logger);
    progressManager.initialize(tweetIds.length);

    for (const tweetId of tweetIds) {
        try {
            await downloadTweet(tweetId);
            progressManager.logSuccess(tweetId);
        } catch (error) {
            progressManager.logError(tweetId, error);
        }
        progressManager.update(stats);
    }

    progressManager.stop();
}
```

### レート制限との統合

```typescript
async function handleRateLimit(waitTime: number) {
    progressManager.logRateLimit(waitTime);
    await new Promise(resolve => setTimeout(resolve, waitTime));
}
```

### スキップ処理

```typescript
function processTweet(tweetId: string, hasMedia: boolean) {
    if (!hasMedia) {
        progressManager.logSkipped(tweetId, 'メディアなし');
        return;
    }
    // ダウンロード処理
}
```

## カスタマイズ

プログレスバーの表示形式は、コンストラクタでカスタマイズできます：

```typescript
const progressBar = new cliProgress.SingleBar({
    format: 'カスタムフォーマット |{bar}| {percentage}% | {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});
```

## 注意事項

- プログレスバーは端末の出力に依存するため、CI/CD環境では適切に表示されない場合があります
- 大量のログメッセージを出力する場合は、ログレベルを適切に設定してください
- プログレスバーの更新頻度は、パフォーマンスに影響を与える可能性があります 
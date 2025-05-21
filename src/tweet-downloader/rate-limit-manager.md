# RateLimitManager

Twitterのレート制限を管理するクラスです。

## 概要

`RateLimitManager`は、Twitterのレート制限を検出し、適切な待機時間を管理します。また、レート制限の履歴と成功履歴を記録し、統計情報の生成に貢献します。

## 主な機能

- レート制限の検出
- 待機時間の計算
- レート制限履歴の記録
- 成功履歴の記録
- 状態の永続化

## 使用方法

```typescript
import { RateLimitManager } from './rate-limit-manager';
import { Logger } from '../core/utils/logger';
import { ConfigManager } from '../core/utils/config-manager';

// インスタンスの作成
const logger = new Logger('downloads/download.log');
const config = new ConfigManager('config.json');
const rateLimitManager = new RateLimitManager(
    'downloads/rate-limit-state.json',
    logger,
    config
);

// 状態の読み込み
await rateLimitManager.loadState();

// レート制限のチェック
const isRateLimited = rateLimitManager.checkRateLimit(result, error);
if (isRateLimited) {
    const waitTime = rateLimitManager.getRemainingWaitTime();
    // 待機処理
}

// 成功の記録
rateLimitManager.addSuccess(tweetId);

// 状態の保存
await rateLimitManager.saveState();
```

## API

### コンストラクタ

```typescript
constructor(
    stateFile: string,
    logger: Logger,
    config: ConfigManager
)
```

- `stateFile`: レート制限状態を保存するファイルのパス
- `logger`: ログ出力用のLoggerインスタンス
- `config`: 設定管理用のConfigManagerインスタンス

### メソッド

#### `loadState(): Promise<void>`

レート制限状態をファイルから読み込みます。

#### `saveState(): Promise<void>`

現在のレート制限状態をファイルに保存します。

#### `checkRateLimit(result: TwitterDLResult | null, error: Error | null): boolean`

レート制限が発生しているかどうかをチェックします。

- 戻り値: レート制限が発生している場合は`true`

#### `addSuccess(tweetId: string): void`

成功したツイートのIDを履歴に追加します。

#### `shouldWait(): boolean`

レート制限による待機が必要かどうかを判定します。

- 戻り値: 待機が必要な場合は`true`

#### `getRemainingWaitTime(): number`

残りの待機時間をミリ秒で取得します。

- 戻り値: 残りの待機時間（ミリ秒）

#### `getState(): RateLimitState`

現在のレート制限状態を取得します。

- 戻り値: 現在のレート制限状態

## エラーハンドリング

- ファイル操作のエラーは`Logger`を通じて記録されます
- エラーが発生した場合は例外がスローされます

## 内部状態

```typescript
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

## 使用例

### レート制限の検出と待機

```typescript
async function downloadTweet(tweetId: string) {
    try {
        const result = await twitterDL.download(tweetId);
        if (rateLimitManager.checkRateLimit(result, null)) {
            const waitTime = rateLimitManager.getRemainingWaitTime();
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return downloadTweet(tweetId); // リトライ
        }
        rateLimitManager.addSuccess(tweetId);
        await rateLimitManager.saveState();
    } catch (error) {
        if (rateLimitManager.checkRateLimit(null, error)) {
            // レート制限によるエラーの場合の処理
        }
        throw error;
    }
}
```

### 統計情報の生成

```typescript
function generateStats() {
    const state = rateLimitManager.getState();
    return {
        rateLimitCount: state.rateLimitHistory.length,
        lastRateLimit: state.lastRateLimitTimestamp,
        successCount: state.successHistory.length
    };
}
``` 
# Twitter データダウンローダ

このプロジェクトは、Twitter のツイート（ツイートID のリスト）をダウンロードし、ツイートのメタデータや添付メディア（画像・動画）をローカルに保存するためのツールです。  
（※ ツイートのダウンロードには Twitter の Cookie が必要です。）

## セットアップ

1. リポジトリをクローン（またはダウンロード）します。
2. プロジェクトのルートディレクトリに、Twitter の Cookie を設定した `.env` ファイルを配置します。  
   （例: TWITTER_COOKIE="your_cookie_string")
3. 以下のコマンドで依存モジュールをインストールします。  
   npm install

## 使い方

- ツイートID のリスト（例: shared/like.js 内の "tweetId" キー）を用意し、  
  tweet-downloader/download-tweets.js を実行します。  
  （例: node tweet-downloader/download-tweets.js）

- ダウンロード中は、プログレスバーで進捗状況（ダウンロード数、スキップ数、処理レート）が表示されます。

## 注意事項

- Twitter の Cookie は、Twitter の利用規約に従って取得・利用してください。  
- ダウンロードしたツイートのメタデータやメディアファイルは、プロジェクトルートの "downloads" ディレクトリに保存されます。  
- エラーリストやレート制限状態の JSON ファイル（例: tweet-downloader/error_tweets.json、tweet-downloader/rate_limit_state.json、shared/shared-state.json、processed-tweets.json）は、.gitignore により無視されます。  
- 本ツールは、Twitter の API やレート制限に依存するため、Twitter の仕様変更やレート制限により動作が変わる可能性があります。

## ライセンス

（※ ライセンス情報は、プロジェクトのポリシーに従って記述してください。） 
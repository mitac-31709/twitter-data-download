import fs from 'fs-extra';
import path from 'path';

export interface MediaInfo {
  tweetId: string;
  media: {
    type: 'image' | 'video';
    image?: string;
  };
  videoUrl?: string;
  filePath: string;
}

export async function findUndownloadedMedia(): Promise<MediaInfo[]> {
  const downloadsDir = path.join(__dirname, '..', 'downloads');
  const tweets: MediaInfo[] = [];

  try {
    // ダウンロードディレクトリが存在しない場合は空の配列を返す
    if (!await fs.pathExists(downloadsDir)) {
      return [];
    }

    // ツイートディレクトリを取得
    const tweetDirs = await fs.readdir(downloadsDir);
    
    for (const tweetId of tweetDirs) {
      const tweetDir = path.join(downloadsDir, tweetId);
      const tweetFile = path.join(tweetDir, `${tweetId}.json`);

      // ディレクトリとJSONファイルの存在確認
      if (!await fs.pathExists(tweetDir) || !await fs.pathExists(tweetFile)) {
        continue;
      }

      try {
        const data = await fs.readJSON(tweetFile);
        
        // メディア情報の確認
        if (!data.media || !Array.isArray(data.media) || data.media.length === 0) {
          continue;
        }

        // 既存のメディアファイルを取得
        const files = await fs.readdir(tweetDir);
        const mediaFiles = files.filter(file => 
          file !== `${tweetId}.json` && 
          !file.endsWith('.txt')
        );

        // 未ダウンロードのメディアを検出
        for (const media of data.media) {
          const mediaType = media.type || 'image';
          const mediaUrl = mediaType === 'image' ? media.url : media.videoUrl;
          
          if (!mediaUrl) continue;

          const filename = path.basename(mediaUrl);
          const filePath = path.join(tweetDir, filename);

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
      } catch (error) {
        console.error(`ツイート ${tweetId} の処理中にエラーが発生しました:`, error);
        continue;
      }
    }
  } catch (error) {
    console.error('未ダウンロードのメディア検出中にエラーが発生しました:', error);
  }

  return tweets;
} 
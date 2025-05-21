export interface MediaInfo {
    tweetId: string;
    media: {
        type: 'image' | 'video';
        image?: string;
    };
    videoUrl?: string;
    filePath: string;
}
export declare function findUndownloadedMedia(): Promise<MediaInfo[]>;

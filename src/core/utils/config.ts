import path from 'path';
import { readJsonFile, writeJsonFile } from './file';
import { Config } from '../types';

export class ConfigManager {
    private configPath: string;
    private config: Config;

    constructor(configPath: string, defaultConfig: Config) {
        this.configPath = configPath;
        this.config = defaultConfig;
    }

    async load(): Promise<boolean> {
        try {
            if (await this.fileExists()) {
                const loadedConfig = await readJsonFile<Partial<Config>>(this.configPath);
                this.config = { ...this.config, ...loadedConfig };
                return true;
            }
        } catch (error) {
            console.error(`設定ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
        }
        return false;
    }

    async save(): Promise<void> {
        try {
            await writeJsonFile(this.configPath, this.config);
        } catch (error) {
            throw new Error(`設定ファイルの保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async fileExists(): Promise<boolean> {
        try {
            const { fileExists } = await import('./file');
            return await fileExists(this.configPath);
        } catch {
            return false;
        }
    }

    get<K extends keyof Config>(key: K): Config[K] {
        return this.config[key];
    }

    set<K extends keyof Config>(key: K, value: Config[K]): void {
        this.config[key] = value;
    }

    getAll(): Config {
        return { ...this.config };
    }

    update(updates: Partial<Config>): void {
        this.config = { ...this.config, ...updates };
    }
}

// デフォルト設定
export const DEFAULT_CONFIG: Config = {
    outputDir: path.join(process.cwd(), 'downloads'),
    logFile: path.join(process.cwd(), 'download-log.txt'),
    batchSize: 50,
    batchDelay: 5000,
    rateLimitWaitTime: 15 * 60 * 1000,
    maxRateLimitRetries: 3,
    twitterCookie: process.env.TWITTER_COOKIE || ''
}; 
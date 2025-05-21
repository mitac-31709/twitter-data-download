import fs from 'fs-extra';
import path from 'path';
import { Config, DEFAULT_CONFIG } from '../types/config';

export class ConfigManager {
    private configPath: string;
    private config: Config;
    private defaultConfig: Config;

    constructor(configPath: string, defaultConfig: Config = DEFAULT_CONFIG) {
        this.configPath = configPath;
        this.defaultConfig = defaultConfig;
        this.config = { ...defaultConfig };
    }

    public async load(): Promise<void> {
        try {
            if (await fs.pathExists(this.configPath)) {
                const loadedConfig = await fs.readJSON(this.configPath) as Config;
                this.config = {
                    ...this.defaultConfig,
                    ...loadedConfig
                };
            } else {
                await this.save();
            }
        } catch (error) {
            throw new Error(`設定ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async save(): Promise<void> {
        try {
            await fs.ensureDir(path.dirname(this.configPath));
            await fs.writeJSON(this.configPath, this.config, { spaces: 2 });
        } catch (error) {
            throw new Error(`設定ファイルの保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public get<K extends keyof Config>(key: K): Config[K] {
        return this.config[key];
    }

    public set<K extends keyof Config>(key: K, value: Config[K]): void {
        this.config[key] = value;
    }

    public getAll(): Config {
        return { ...this.config };
    }

    public reset(): void {
        this.config = { ...this.defaultConfig };
    }
} 
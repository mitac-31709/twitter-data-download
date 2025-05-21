import { Config } from '../types';
export declare class ConfigManager {
    private configPath;
    private config;
    constructor(configPath: string, defaultConfig: Config);
    load(): Promise<boolean>;
    save(): Promise<void>;
    fileExists(): Promise<boolean>;
    get<K extends keyof Config>(key: K): Config[K];
    set<K extends keyof Config>(key: K, value: Config[K]): void;
    getAll(): Config;
    update(updates: Partial<Config>): void;
}
export declare const DEFAULT_CONFIG: Config;

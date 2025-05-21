import { Config } from '../types/config';
export declare class ConfigManager {
    private configPath;
    private config;
    private defaultConfig;
    constructor(configPath: string, defaultConfig?: Config);
    load(): Promise<void>;
    save(): Promise<void>;
    get<K extends keyof Config>(key: K): Config[K];
    set<K extends keyof Config>(key: K, value: Config[K]): void;
    getAll(): Config;
    reset(): void;
}

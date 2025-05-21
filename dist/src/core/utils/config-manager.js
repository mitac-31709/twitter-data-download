"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../types/config");
class ConfigManager {
    constructor(configPath, defaultConfig = config_1.DEFAULT_CONFIG) {
        this.configPath = configPath;
        this.defaultConfig = defaultConfig;
        this.config = { ...defaultConfig };
    }
    async load() {
        try {
            if (await fs_extra_1.default.pathExists(this.configPath)) {
                const loadedConfig = await fs_extra_1.default.readJSON(this.configPath);
                this.config = {
                    ...this.defaultConfig,
                    ...loadedConfig
                };
            }
            else {
                await this.save();
            }
        }
        catch (error) {
            throw new Error(`設定ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async save() {
        try {
            await fs_extra_1.default.ensureDir(path_1.default.dirname(this.configPath));
            await fs_extra_1.default.writeJSON(this.configPath, this.config, { spaces: 2 });
        }
        catch (error) {
            throw new Error(`設定ファイルの保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    get(key) {
        return this.config[key];
    }
    set(key, value) {
        this.config[key] = value;
    }
    getAll() {
        return { ...this.config };
    }
    reset() {
        this.config = { ...this.defaultConfig };
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=config-manager.js.map
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.ConfigManager = void 0;
const path_1 = __importDefault(require("path"));
const file_1 = require("./file");
class ConfigManager {
    constructor(configPath, defaultConfig) {
        this.configPath = configPath;
        this.config = defaultConfig;
    }
    async load() {
        try {
            if (await this.fileExists()) {
                const loadedConfig = await (0, file_1.readJsonFile)(this.configPath);
                this.config = { ...this.config, ...loadedConfig };
                return true;
            }
        }
        catch (error) {
            console.error(`設定ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
        }
        return false;
    }
    async save() {
        try {
            await (0, file_1.writeJsonFile)(this.configPath, this.config);
        }
        catch (error) {
            throw new Error(`設定ファイルの保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async fileExists() {
        try {
            const { fileExists } = await Promise.resolve().then(() => __importStar(require('./file')));
            return await fileExists(this.configPath);
        }
        catch {
            return false;
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
    update(updates) {
        this.config = { ...this.config, ...updates };
    }
}
exports.ConfigManager = ConfigManager;
// デフォルト設定
exports.DEFAULT_CONFIG = {
    outputDir: path_1.default.join(process.cwd(), 'downloads'),
    logFile: path_1.default.join(process.cwd(), 'download-log.txt'),
    batchSize: 50,
    batchDelay: 5000,
    rateLimitWaitTime: 15 * 60 * 1000,
    maxRateLimitRetries: 3,
    twitterCookie: process.env.TWITTER_COOKIE || ''
};
//# sourceMappingURL=config.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
class Logger {
    constructor(logFile) {
        this.logFile = logFile;
        this.ensureLogDirectory();
    }
    ensureLogDirectory() {
        const logDir = path_1.default.dirname(this.logFile);
        if (!fs_extra_1.default.existsSync(logDir)) {
            fs_extra_1.default.mkdirpSync(logDir);
        }
    }
    formatMessage(level, message, error) {
        const timestamp = new Date().toISOString();
        const errorDetails = error ? `\n${error.stack || error.message}` : '';
        return `[${timestamp}] [${level}] ${message}${errorDetails}\n`;
    }
    writeToFile(message) {
        try {
            fs_extra_1.default.appendFileSync(this.logFile, message);
        }
        catch (error) {
            console.error('ログファイルへの書き込みに失敗しました:', error);
        }
    }
    info(message) {
        const formattedMessage = this.formatMessage('INFO', message);
        console.log(message);
        this.writeToFile(formattedMessage);
    }
    error(message, error) {
        const formattedMessage = this.formatMessage('ERROR', message, error);
        console.error(message, error);
        this.writeToFile(formattedMessage);
    }
    warn(message) {
        const formattedMessage = this.formatMessage('WARN', message);
        console.warn(message);
        this.writeToFile(formattedMessage);
    }
    debug(message) {
        const formattedMessage = this.formatMessage('DEBUG', message);
        console.debug(message);
        this.writeToFile(formattedMessage);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map
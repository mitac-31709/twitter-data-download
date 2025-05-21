import fs from 'fs-extra';
import path from 'path';

export class Logger {
    private logFile: string;

    constructor(logFile: string) {
        this.logFile = logFile;
        this.ensureLogDirectory();
    }

    private ensureLogDirectory(): void {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirpSync(logDir);
        }
    }

    private formatMessage(level: string, message: string, error?: Error): string {
        const timestamp = new Date().toISOString();
        const errorDetails = error ? `\n${error.stack || error.message}` : '';
        return `[${timestamp}] [${level}] ${message}${errorDetails}\n`;
    }

    private writeToFile(message: string): void {
        try {
            fs.appendFileSync(this.logFile, message);
        } catch (error) {
            console.error('ログファイルへの書き込みに失敗しました:', error);
        }
    }

    info(message: string): void {
        const formattedMessage = this.formatMessage('INFO', message);
        console.log(message);
        this.writeToFile(formattedMessage);
    }

    error(message: string, error?: Error): void {
        const formattedMessage = this.formatMessage('ERROR', message, error);
        console.error(message, error);
        this.writeToFile(formattedMessage);
    }

    warn(message: string): void {
        const formattedMessage = this.formatMessage('WARN', message);
        console.warn(message);
        this.writeToFile(formattedMessage);
    }

    debug(message: string): void {
        const formattedMessage = this.formatMessage('DEBUG', message);
        console.debug(message);
        this.writeToFile(formattedMessage);
    }
} 
export declare class Logger {
    private logFile;
    constructor(logFile: string);
    private ensureLogDirectory;
    private formatMessage;
    private writeToFile;
    info(message: string): void;
    error(message: string, error?: Error): void;
    warn(message: string): void;
    debug(message: string): void;
}

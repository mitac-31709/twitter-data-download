import fs from 'fs-extra';
import path from 'path';

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
    try {
        return await fs.readJSON(filePath);
    } catch (error) {
        throw new Error(`JSONファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    try {
        await fs.writeJSON(filePath, data, { spaces: 2 });
    } catch (error) {
        throw new Error(`JSONファイルの書き込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function fileExists(filePath: string): Promise<boolean> {
    return await fs.pathExists(filePath);
}

export async function directoryExists(dirPath: string): Promise<boolean> {
    try {
        const stats = await fs.stat(dirPath);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

export async function listFiles(dirPath: string, filter?: (file: string) => boolean): Promise<string[]> {
    try {
        const files = await fs.readdir(dirPath);
        return filter ? files.filter(filter) : files;
    } catch (error) {
        throw new Error(`ディレクトリの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function copyFile(src: string, dest: string): Promise<void> {
    try {
        await fs.copy(src, dest);
    } catch (error) {
        throw new Error(`ファイルのコピーに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function moveFile(src: string, dest: string): Promise<void> {
    try {
        await fs.move(src, dest);
    } catch (error) {
        throw new Error(`ファイルの移動に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function deleteFile(filePath: string): Promise<void> {
    try {
        await fs.remove(filePath);
    } catch (error) {
        throw new Error(`ファイルの削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
}

export function getFileNameWithoutExtension(filePath: string): string {
    const basename = path.basename(filePath);
    return basename.substring(0, basename.lastIndexOf('.'));
}

export async function createDirectoryIfNotExists(dirPath: string): Promise<void> {
    if (!await directoryExists(dirPath)) {
        await ensureDirectoryExists(dirPath);
    }
} 
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDirectoryExists = ensureDirectoryExists;
exports.readJsonFile = readJsonFile;
exports.writeJsonFile = writeJsonFile;
exports.fileExists = fileExists;
exports.directoryExists = directoryExists;
exports.listFiles = listFiles;
exports.copyFile = copyFile;
exports.moveFile = moveFile;
exports.deleteFile = deleteFile;
exports.getFileExtension = getFileExtension;
exports.getFileNameWithoutExtension = getFileNameWithoutExtension;
exports.createDirectoryIfNotExists = createDirectoryIfNotExists;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
async function ensureDirectoryExists(dirPath) {
    await fs_extra_1.default.ensureDir(dirPath);
}
async function readJsonFile(filePath) {
    try {
        return await fs_extra_1.default.readJSON(filePath);
    }
    catch (error) {
        throw new Error(`JSONファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function writeJsonFile(filePath, data) {
    try {
        await fs_extra_1.default.writeJSON(filePath, data, { spaces: 2 });
    }
    catch (error) {
        throw new Error(`JSONファイルの書き込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function fileExists(filePath) {
    return await fs_extra_1.default.pathExists(filePath);
}
async function directoryExists(dirPath) {
    try {
        const stats = await fs_extra_1.default.stat(dirPath);
        return stats.isDirectory();
    }
    catch {
        return false;
    }
}
async function listFiles(dirPath, filter) {
    try {
        const files = await fs_extra_1.default.readdir(dirPath);
        return filter ? files.filter(filter) : files;
    }
    catch (error) {
        throw new Error(`ディレクトリの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function copyFile(src, dest) {
    try {
        await fs_extra_1.default.copy(src, dest);
    }
    catch (error) {
        throw new Error(`ファイルのコピーに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function moveFile(src, dest) {
    try {
        await fs_extra_1.default.move(src, dest);
    }
    catch (error) {
        throw new Error(`ファイルの移動に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function deleteFile(filePath) {
    try {
        await fs_extra_1.default.remove(filePath);
    }
    catch (error) {
        throw new Error(`ファイルの削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function getFileExtension(filePath) {
    return path_1.default.extname(filePath).toLowerCase();
}
function getFileNameWithoutExtension(filePath) {
    const basename = path_1.default.basename(filePath);
    return basename.substring(0, basename.lastIndexOf('.'));
}
async function createDirectoryIfNotExists(dirPath) {
    if (!await directoryExists(dirPath)) {
        await ensureDirectoryExists(dirPath);
    }
}
//# sourceMappingURL=file.js.map
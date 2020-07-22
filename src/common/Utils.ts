import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';


export interface Progress {
    progress: vscode.Progress<{ message?: string; increment?: number }>
    progressResolve: (value?: unknown) => void
    progressReject: (value?: unknown) => void
}

export function getProgress(title = 'Uploading object'): Progress {
    let progressResolve, progressReject, progress;
    vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title
        },
        (p) => {
            return new Promise((resolve, reject) => {
                progressResolve = resolve;
                progressReject = reject;
                progress = p;
            });
        }
    );
    if (!progress || !progressResolve || !progressReject) { throw new Error('Failed to init vscode progress'); };
    return {
        progress,
        progressResolve,
        progressReject
    };
}


export function readFileList(dir: string, filesList: string[]) {
    const files = fs.readdirSync(dir);
    files.forEach((item: any) => {
        const fullPath: any = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            readFileList(path.join(dir, item), filesList);  //递归读取文件
        } else if (!fullPath.endsWith('.DS_Store')) {
            filesList.push(fullPath);
        }
    });
    return filesList;
}

export function isSupportTinyPng(file: string, size: number) {
    const ext = file.substr(file.lastIndexOf('.')).toLowerCase();
    return size <= 5200000 && /\.(png|jpg)$/.test(ext);
}
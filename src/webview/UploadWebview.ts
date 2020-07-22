import * as vscode from 'vscode';
import { BaseWebView } from './BaseWebView';
import { WebCommand } from '../common/WebCommand';
import { getSizeString } from '../common/Utils';
import { TinyPng } from '../service/TinyPng';
import * as fs from 'fs';

export class UploadWebview extends BaseWebView {

    public show(data: { ossPath: string, localPath: string, upFiles: string[], cb: Function }) {
        this.createWebview('./web/webview-upload.html', 'vscode-ali-oss:上传', vscode.ViewColumn.Active, true);
        this.onDidReceiveMessage(async (e) => {
            const vm = this;
            if (e.type === WebCommand.INIT_UPLOAD_FILES) {
                let fileSizes: String[] = [];
                let sizeArr: Number[] = [];
                data.upFiles.forEach((item: string) => {
                    const stat = fs.statSync(data.localPath + (data.localPath.indexOf(item) > -1 ? "" : item));
                    const size = getSizeString(stat.size);
                    fileSizes.push(size.toString());
                    sizeArr.push(stat.size);
                });
                this.postMessage(WebCommand.GET_UPLOAD_FILES, { ...data, fileSizes, sizeArr });
            } else if (e.type === WebCommand.CHOOSE_UPLOAD_FILES) {
                this.uploadBatch(vm, e, data);
            } else if (e.type === WebCommand.CHOOSE_UPLOAD_FILES_TINYPNG) {
                this.uploadBatch(vm, e, data);
            } else if (e.type === WebCommand.CLOSE_UPLOAD_WEBVIEW) {
                this.dispose('./web/webview-upload.html');
            }
        });
    }

    public uploadBatch(vm: any, e: any, data: any): void {
        const { ossPath, localPath, checkFiles } = e.data;
        let fileIndex: number = 0;
        const uploadSingle = async (file: string) => {
            const localFilePath = localPath + (localPath.indexOf(file) > -1 ? "" : file);
            TinyPng.uploadFileByApi(ossPath.slice(0, -1) + file, localFilePath, (res: any) => {
                if (res.code === 1) {
                    vm.postMessage(WebCommand.SUCCESS_UPLOAD_FILES_TINYPNG, { file: file, fIndex: fileIndex, ...res });
                } else if (res.code === 0) {
                    vm.postMessage(WebCommand.FAIL_UPLOAD_FILES_TINYPNG, { file: file, fIndex: fileIndex, ...res });
                }
                fileIndex++;
                if (fileIndex < checkFiles.length) {
                    uploadSingle(checkFiles[fileIndex]);
                } else {
                    data.cb();
                    vm.postMessage(WebCommand.SUCCESS_UPLOAD_FILES, null);
                }
            });
        };
        uploadSingle(checkFiles[0]);
    }
}
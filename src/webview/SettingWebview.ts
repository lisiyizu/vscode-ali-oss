import * as vscode from 'vscode';
import { BaseWebView } from './BaseWebView';
import { WebCommand } from '../common/WebCommand';
import { AliOssConfiguration } from '../common/AliOssConfiguration';

export class SettingWebview extends BaseWebView {
    public show(data: { ossPath: string, localPath: string, upFiles: string[], cb: Function }) {
        this.createWebview('./web/webview-setting.html', 'vscode-ali-oss:设置', vscode.ViewColumn.Active, true);
        this.onDidReceiveMessage((e) => {
            if (e.type === WebCommand.INIT_OSS_CONFIG) {
                this.postMessage(WebCommand.GET_OSS_CONFIG, { config: AliOssConfiguration.geConfig() });
            } else if (e.type === WebCommand.UPDATE_OSS_CONFIG) {
                data.cb(e.data, ((valid: boolean) => {
                    if (valid) {
                        AliOssConfiguration.updateConfig(e.data);
                        this.postMessage(WebCommand.UPDATE_OSS_CONFIG_SUCCESS, e.data);
                    } else {
                        this.postMessage(WebCommand.UPDATE_OSS_CONFIG_FAIL, e.data);
                    }
                }));
            }
        });
    }
}
import * as vscode from 'vscode';
import { AliOssConfiguration } from '../common/AliOssConfiguration';
const OSS = require('ali-oss');
import axios from 'axios';

export class AliOss {
    private static uploadedOssList: any[] = [];
    public static isClientConnection = false;
    // 实例化OSS配置地址：https://help.aliyun.com/document_detail/64097.html?spm=a2c4g.11186623.2.21.5ab510d51h3mk2
    public static client: any = {};

    // 初始化OSS连接
    public static async initOss(Oss?: any) {
        const isUserSetting = Oss || AliOssConfiguration.isUserSetConfig();
        let _configuration: any = Oss || AliOssConfiguration.geConfig();
        try {
            this.client = !isUserSetting ? {} : OSS({
                region: _configuration.region, // 节点
                accessKeyId: _configuration.accessKeyId,
                accessKeySecret: _configuration.accessKeySecret,
                bucket: _configuration.bucket, // 具体bucket
                // endpoint: _configuration.endpoint  //oss域名
            });
            this.isClientConnection = true;
            return true;
        } catch (e) {
            this.isClientConnection = false;
            vscode.window.showInformationMessage('连接失败，请确认OSS配置是否正确？', { modal: true });
            return false;
        }
    }

    // 流式下载
    public static async getBuffer(ossUrl: string) {
        return await this.client.get(ossUrl);
    }

    // 获取图片信息
    public static async getOssImageInfo(ossUrl: string, fileType: String): Promise<any> {
        return axios.get(`${ossUrl}?x-oss-process=${fileType}`);
    }

    // 获取OSS目录
    public static async getOssDir(dir: string): Promise<any> {
        try {
            let mapOssFile: any = {};

            let res = await this.client.list({
                prefix: dir,
                delimiter: '/'
            });

            if (res.prefixes) {
                res.prefixes.forEach((item: string) => {
                    mapOssFile[item.replace(dir, '')] = item.replace(dir, '');
                });
            }

            if (res.objects) {
                res.objects.forEach((item: any, index: number) => {
                    if (item.name !== dir) {
                        mapOssFile[item.name.replace(dir, '')] = '';
                    }
                });
            }

            return Promise.resolve({ data: mapOssFile, dirs: res.prefixes, code: 1 });
        } catch (e) {
            vscode.window.showErrorMessage(e.message);
            return Promise.resolve({ data: {}, dirs: [], code: 0 });
        }
    }

    // 复制操作
    public static async renameFile(rename: string, sourceName: string) {
        try {
            await this.client.copy(rename, sourceName);
            await this.client.delete(sourceName);
        } catch (e) {
            console.log(e);
        }

    }
    // Buffer方式上传
    public static async putBuffer(ossPath: string, buffer: Buffer) {
        return await this.client.put(ossPath, buffer);
    }

    // Buffer方式上传
    public static async ossUploadFile(ossPath: string, localFilePath: string) {
        return await this.client.put(ossPath, localFilePath);
    }

    // OSS文件删除
    public static async ossDeleteFiles(ossDir: string) {
        return await this.client.delete(ossDir);
    }

    // 前缀目录删除
    public static async ossDeletePrefix(ossDir: string) {
        const res = await this.client.list({
            prefix: ossDir,
            delimiter: '/'
        });
        res.objects = res.objects || [];
        await Promise.all(res.objects.map((v: any) => this.ossDeleteFiles(v.name)));
    }

}
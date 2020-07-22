#!/usr/bin/env node

/** 
 * 
 * 参考： https://segmentfault.com/a/1190000015467084
 * 优化：通过 X-Forwarded-For 添加了动态随机伪IP，绕过 tinypng 的上传数量限制
 * 
 *  */
import { AliOss } from './AliOss';
import { isSupportTinyPng, getSizeString } from '../common/Utils';
const fs = require('fs');
const https = require('https');
const { URL } = require('url');
const max = 5200000; // 5MB == 5242848.754299136

const options: any = {
    method: 'POST',
    hostname: 'tinypng.com',
    path: '/web/shrink',
    headers: {
        'rejectUnauthorized': false,
        'Postman-Token': Date.now(),
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
            'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'
    }
};

export class TinyPng {
    public static async uploadFileByApi(ossPath: string, localFilePath: string, cb: Function) {
        fs.stat(localFilePath, async (err: any, stats: any) => {
            if (err) { return console.error(err); }
            if (isSupportTinyPng(localFilePath, stats.size)) {
                // 通过 X-Forwarded-For 头部伪造客户端IP
                options.headers['X-Forwarded-For'] = getRandomIP();
                tpFileUpload(ossPath, localFilePath, cb); // console.log('可以压缩：' + file);
            } else {
                // 非 jpg|png 文件，直接走阿里云OSS上传
                let res = await AliOss.ossUploadFile(ossPath, localFilePath);
                cb({ code: 1, data: res, isTinyPng: 0 });
            }
        });
    }

    public static async uploadOssFile(ossPath: string, buff: Buffer, cb: Function) {
        // 通过 X-Forwarded-For 头部伪造客户端IP
        options.headers['X-Forwarded-For'] = getRandomIP();
        // 上传oss文件到TinyPng
        let req = https.request(options, function (res: any) {
            res.on('data', (buf: any) => {
                let obj = JSON.parse(buf.toString());
                let outputFileSize = getSizeString(obj.output.size);
                // 读取TinyPng图片压缩数据
                let options = new URL(obj.output.url);
                let reqTinyPng = https.request(options, (res: any) => {
                    let data = '';
                    res.setEncoding('binary');
                    res.on('data', function (chunk: any) {
                        data += chunk;
                    });
                    res.on('end', function () {
                        // 转成Buffer，然后将压缩的数据上传至阿里云OSS
                        AliOss.putBuffer(ossPath, Buffer.from(data, 'binary')).then(res => {
                            cb({ code: 1, outputFileSize, ...res });
                        });
                    });
                });
                reqTinyPng.on('error', (e: any) => {
                    console.error(e);
                });
                reqTinyPng.end();
            });
        });
        req.write(buff, 'buffer');
        req.on('error', (e: any) => {
            cb({ code: 0, data: e.message });
        });
        req.end();
    }
}

// 生成随机IP， 赋值给 X-Forwarded-For
function getRandomIP(): any {
    return Array.from(Array(4)).map(() => parseInt(Math.random() * 255 + '')).join('.');
}

// 异步API,压缩图片
// {"error":"Bad request","message":"Request is invalid"}
// {"input": { "size": 887, "type": "image/png" },"output": { "size": 785, "type": "image/png", "width": 81, "height": 81, "ratio": 0.885, "url": "https://tinypng.com/web/output/7aztz90nq5p9545zch8gjzqg5ubdatd6" }}
function tpFileUpload(ossPath: string, file: string, cb: Function) {
    let req = https.request(options, function (res: any) {
        res.on('data', (buf: any) => {
            let obj = JSON.parse(buf.toString());
            if (obj.error) {
                cb({ code: 0, data: `[${file}]：压缩失败！报错：${obj.message}`, isTinyPng: 1 });
            } else {
                fileUpdate(ossPath, file, obj, cb);
            }
        });
    });
    req.write(fs.readFileSync(file), 'binary');
    req.on('error', (e: any) => {
        cb({ code: 0, data: e.message });
    });
    req.end();
}

// 该方法被循环调用,请求图片数据
function fileUpdate(ossPath: string, imgPath: string, obj: any, cb: Function) {
    let options = new URL(obj.output.url);
    let outputSize = getSizeString(obj.output.size);
    let req = https.request(options, (res: any) => {
        let data = '';
        res.setEncoding('binary');
        res.on('data', function (chunk: any) {
            data += chunk;
        });
        res.on('end', function () {
            // 转成Buffer，然后将压缩的数据上传至阿里云OSS
            AliOss.putBuffer(ossPath, Buffer.from(data, 'binary')).then(res => {
                cb({ code: 1, data: { outputSize, ...res }, isTinyPng: 1 });
            });
        });
    });
    req.on('error', (e: any) => {
        cb({ code: 0, data: e.message });
    });
    req.end();
}
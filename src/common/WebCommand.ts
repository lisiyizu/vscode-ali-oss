/**
 * postMessage 中 command type 的定义，与 /web/config/command.js 中一一对应
 */
export class WebCommand {
    public static INIT_UPLOAD_FILES: string = "init.upload.files";
    public static GET_UPLOAD_FILES: string = "get.upload.files";
    public static CHOOSE_UPLOAD_FILES: string = "choose.upload.files";
    public static SUCCESS_UPLOAD_FILES: string = 'success.upload.files';
    public static CLOSE_UPLOAD_WEBVIEW: string = 'close.upload.webview';
    public static INIT_OSS_CONFIG: string = 'init.oss.config';
    public static GET_OSS_CONFIG: string = 'get.oss.config';
    public static UPDATE_OSS_CONFIG: string = 'update.oss.config';
    public static UPDATE_OSS_CONFIG_SUCCESS: string = 'update.oss.config.success';
    public static UPDATE_OSS_CONFIG_FAIL: string = 'update.oss.config.fail';
    public static CHOOSE_UPLOAD_FILES_TINYPNG: string = 'choose.upload.files.tinypng';
    public static SUCCESS_UPLOAD_FILES_TINYPNG: string = 'success.upload.files.tinypng';
    public static FAIL_UPLOAD_FILES_TINYPNG: string = 'fail.upload.files.tinypng';
}
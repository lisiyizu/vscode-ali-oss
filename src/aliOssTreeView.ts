import * as vscode from 'vscode';
import { AliOss } from './service/AliOss';
import { UploadWebview } from './webview/UploadWebview';
import { SettingWebview } from './webview/SettingWebview';
import { BaseWebView } from './webview/BaseWebView';
import { AliOssConfiguration } from './common/AliOssConfiguration';
import { getProgress, isSupportTinyPng, readFileList, getSizeString, writeActiveText } from './common/Utils';
import * as fs from 'fs';
import { TinyPng } from './service/TinyPng';
type State = 'uninitialized' | 'initialized';

let dirList: string[] = [];

let tree: any = {};

let nodes: any = {};

let createDirCur = '';

let createDirFull = '';

const emitter = new vscode.EventEmitter<{ key: string, dir: string } | null>();

export class AliOssTreeView {
	private _state: State = 'uninitialized';

	constructor(context: vscode.ExtensionContext) {
		// Panel
		let panelImageWebview: any = null;
		//
		const view =vscode.window.createTreeView('aliOssTreeView', { treeDataProvider: treeNodeWithIdTreeDataProvider(), showCollapseAll: true });
		// OSS配置页面
		vscode.commands.registerCommand('alioss.configuration', async (item: any) => {
			let webview: BaseWebView = new SettingWebview(context);
			webview.show({
				cb: (oss: any, validate: Function) => {
					AliOss.initOss(oss).then(isOss => {
						if (isOss) {
							this.setState('initialized');
							emitter.fire(null);
						} else {
							this.setState('uninitialized');
						}
						validate(isOss);
					});
				}
			});
		});
		// 图片查看
		vscode.commands.registerCommand('alioss.toWebview', async (item: any) => {
			const ext = item.substr(item.lastIndexOf('.')).toLowerCase();
			const configuration = AliOssConfiguration.geConfig();
			if (/\.(png|jpg|jpeg|webp|gif|bmp|tiff|ico)$/.test(ext)) {
				const imageInfo = await AliOss.getOssInfo(`https://${configuration.bucket}.${configuration.region}.aliyuncs.com/${encodeURI(item)}`, 'image/info');
				if (!panelImageWebview) {
					panelImageWebview = vscode.window.createWebviewPanel(
						'imagePreview',
						"vscode-ali-oss:图片预览",
						vscode.ViewColumn.One,
						{
							enableScripts: true, // 启用JS，默认禁用
							retainContextWhenHidden: true, // webview被隐藏时保持状态，避免被重置
						}
					);
				}
				panelImageWebview.onDidDispose(() => { panelImageWebview = null; });
				panelImageWebview.webview.html = `
				<html>
					<style>
						.main {
							width:100%;
							height:100%;
							display:flex;
							align-items:center;
							justify-content:center;
							flex-direction:column;
							margin-bottom:10px;
						}
						.info {
							margin:10px 0;
						}
					</style>
					<body>
						<div class='main'>
							<div class="info">图片大小：${getSizeString(imageInfo.data.FileSize.value)}，宽高：${imageInfo.data.ImageWidth.value} x ${imageInfo.data.ImageHeight.value}</div>
							<div class=""><img src="https://${configuration.bucket}.${configuration.region}.aliyuncs.com/${item}"></div>
						</div>
					</body>
				</html>`;
			} else if (/\.(svg)$/.test(ext)) {
				const svgInfo = await AliOss.getOssInfo(`https://${configuration.bucket}.${configuration.region}.aliyuncs.com/${encodeURI(item)}`, 'file/info');
				if (!panelImageWebview) {
					panelImageWebview = vscode.window.createWebviewPanel(
						'imagePreview',
						"vscode-ali-oss:图片预览",
						vscode.ViewColumn.One,
						{
							enableScripts: true, // 启用JS，默认禁用
							retainContextWhenHidden: true, // webview被隐藏时保持状态，避免被重置
						}
					);
				}
				panelImageWebview.onDidDispose(() => { panelImageWebview = null; });
				panelImageWebview.webview.html = `
				<html> <style> svg { margin: 10px;} </style> <body> ${svgInfo.data} </body> </html>`;
			}
		});
		// TinyPng压缩处理
		vscode.commands.registerCommand("alioss.toTinyPng", async (item: any) => {
			const pro = getProgress(`正在处理中，请稍等～`);
			const ret = await AliOss.getBuffer(item.dir);
			if (isSupportTinyPng(item.dir, ret.res.size)) {
				let oriFileSize = getSizeString(ret.res.size);
				TinyPng.uploadOssFile(item.dir, ret.content, (res: any) => {
					emitter.fire(null);
					pro.progressResolve(100);
					if (res.code === 1) {
						vscode.window.showInformationMessage(`上传成功：压缩前 - ${oriFileSize} ，压缩后 - ${res.outputFileSize} `);
					} else {
						vscode.window.showErrorMessage(`上传报错：${res.data} `);
					}
				});
			} else {
				pro.progressResolve(100);
				vscode.window.showErrorMessage('TinyPng只支持5M文件大小以内的压缩!');
			}
		});
		// OSS删除
		vscode.commands.registerCommand("alioss.deleteFile", async (item: any) => {
			const action = '确定';
			vscode.window.showInformationMessage(`你确定要做删除操作？`, { modal: true }, action).then(async selectedAction => {
				if (selectedAction === action) {
					const topDir = item.dir.split('/').slice(0, 1);
					if (item.key.slice(-1) === '/') {
						await AliOss.ossDeletePrefix(item.dir);
					} else {
						await AliOss.ossDeleteFiles(item.dir);
					}
					vscode.window.showInformationMessage('删除成功!');
					emitter.fire(null);
				}
			});
		});
		// OSS文件重命名
		vscode.commands.registerCommand("alioss.renameFile", async (item: any) => {
			const inputName: string | undefined = await vscode.window.showInputBox({
				ignoreFocusOut: true,
				prompt: `重命名：${item.key} `,
				placeHolder: "请输入",
				value: item.key
			});
			const topDirs = item.dir.replace(item.key, '');
			if (inputName) {
				AliOss.renameFile(`${topDirs}${inputName.trim()}`, item.dir);
				vscode.window.showInformationMessage('修改成功!');
				emitter.fire(null);
			}
		});
		// 打开上传弹框
		vscode.commands.registerCommand("alioss.promptFile", async (item: any) => {
			await promptForTargetDirectory(context, item.dir);
		});
		// OSS上传页面
		vscode.commands.registerCommand("alioss.toUploadWebview", async (item: any) => {
			let fileList: string[] = [];
			let localPathStr = item.fsPath;
			// 判断当前上传是不是目录的情况
			if (fs.statSync(localPathStr).isDirectory()) {
				readFileList(localPathStr, fileList);
				fileList = fileList.map(item => item.substr(localPathStr.length));
			} else {
				const fileItem: any = localPathStr.split('/').slice(-1).join('');
				fileList = ['/' + fileItem];
			}
			let webview: BaseWebView = new UploadWebview(context);
			webview.show({
				ossPath: '',
				localPath: localPathStr,
				upFiles: fileList,
				cb: (ossDir: string) => {
					createDirFull = ossDir;
					emitter.fire(null);
				}
			});
		});
		// OSS目录刷新
		vscode.commands.registerCommand("alioss.refreshOss", async (item: any) => {
			emitter.fire(item);
		});
		// vscode.open：打开OSS文件
		vscode.commands.registerCommand("alioss.openOssFileLink", async (item: any) => {
			const configuration = AliOssConfiguration.geConfig();
			vscode.commands.executeCommand(
				"vscode.open",
				vscode.Uri.parse(`https://${configuration.bucket}.${configuration.region}.aliyuncs.com/${item.dir}`)
			);
		});
		// 复制OSS目录
		vscode.commands.registerCommand("alioss.copyOssFolder", async (item: any) => {
			vscode.env.clipboard.writeText(item.dir);
			vscode.window.showInformationMessage('复制成功!');
		});
		// 复制OSS文件
		vscode.commands.registerCommand("alioss.copyOssFile", async (item: any) => {
			const configuration = AliOssConfiguration.geConfig();
			vscode.env.clipboard.writeText(`https://${configuration.bucket}.${configuration.region}.aliyuncs.com/${item.dir}`);
			vscode.window.showInformationMessage('复制成功!');
		});
		// 创建OSS目录
		vscode.commands.registerCommand("alioss.createOssDir", async (item?: any) => {
			createDirFull = item?.dir || '/';
			const inputDir: string | undefined = await vscode.window.showInputBox({
				ignoreFocusOut: true,
				prompt: `正在${createDirFull}下创建目录`,
				placeHolder: "请输入将要创建的OSS目录，比如：demo",
			});
			// 上传
			if (inputDir) {
				if (inputDir.split('/').filter(Boolean).length === 1) {
					createDirCur = inputDir.trim().split('/').filter(item => item.trim()) + '/';
					await AliOss.putBuffer(`${createDirFull}${createDirCur}`, Buffer.from(''));
					emitter.fire(item);
				} else {
					vscode.window.showErrorMessage('OSS目录格式有误，请以反斜杠结束。示例：demo/ 或 demo/dir/', { modal: true });
				}
			}
		});
		// 导出OSS数据
		vscode.commands.registerCommand("alioss.exportOssData", async (item?: any) => {
			const configuration = AliOssConfiguration.geConfig();
			const inputDir: string | undefined = await vscode.window.showInputBox({
				ignoreFocusOut: true,
				value: `https://${configuration.bucket}.${configuration.region}.aliyuncs.com`,
				prompt: `可以修改成私有域名，也可以不修改！`,
				placeHolder: "请输入域名",
			});
			if (inputDir) {
				const res = await AliOss.getOssDir(item.dir || '');
				let filesArr = Object.keys(res.data).map((key: string) => `${inputDir}/${item.dir}${key}`).filter(key => (key.slice(-1) !== '/'));
				writeActiveText(JSON.stringify(filesArr, null, '\t'), true);
			} else if (inputDir !== undefined) {
				vscode.window.showErrorMessage('域名不能为空！');
			}
		});
		//
		if (AliOssConfiguration.isUserSetConfig()) {
			AliOss.initOss().then(isOss => {
				if (isOss) {
					this.setState('initialized');
					emitter.fire(null);
				} else {
					this.setState('uninitialized');
				}
			});
		} else {
			this.setState('uninitialized');
		}
	}

	setState(state: State): void {
		this._state = state;
		vscode.commands.executeCommand('setContext', 'ali-oss-configuration.state', state);
	}
}

async function promptForTargetDirectory(context: vscode.ExtensionContext, dir: string): Promise<any | undefined> {
	const options: vscode.OpenDialogOptions = {
		openLabel: "选择",
		canSelectFiles: true,
		canSelectFolders: true
	};
	return vscode.window.showOpenDialog(options).then(uri => {
		if (uri) {
			let fileList: string[] = [];
			const localPathStr = (uri && uri[0]) ? uri[0].fsPath : '';
			// 判断当前上传是不是目录的情况
			if (fs.statSync(localPathStr).isDirectory()) {
				readFileList(localPathStr, fileList);
				fileList = fileList.map(item => item.substr(localPathStr.length));
			} else {
				const fileItem: any = localPathStr.split('/').slice(-1).join('');
				fileList = ['/' + fileItem];
			}
			// webview 操作
			let webview: BaseWebView = new UploadWebview(context);
			webview.show({
				ossPath: dir,
				localPath: localPathStr,
				upFiles: fileList,
				cb: () => {
					createDirFull = dir;
					emitter.fire(null);
				}
			});
		}
	});
}

function treeNodeWithIdTreeDataProvider(): vscode.TreeDataProvider<{ key: string, dir: string }> {
	return {
		onDidChangeTreeData: emitter.event,
		async getChildren(element: { key: string, dir: string }): Promise<any[]> {
			let data: any = await getChildren(element?.dir || '');
			Object.keys(data).map((k: string) => {
				if (element && element.key) {
					setTreeNodeByEval(element.dir, element.key, k, data);
				} else {
					data[k] = k.indexOf('/') > -1 ? {} : data[k];
				}
			});
			data = Object.keys(data).map((k: string) => getNode(k, `${element?.dir || ''}${k}`));
			const dataFolders = data.filter((item: any) => item.key.indexOf('/') > -1).sort((a: any, b: any) => a.key.charCodeAt(0) - b.key.charCodeAt(0));
			const dataFiles = data.filter((item: any) => item.key.indexOf('/') === -1).sort((a: any, b: any) => a.key.charCodeAt(0) - b.key.charCodeAt(0));
			return [...dataFolders, ...dataFiles];
		},
		getTreeItem: (element: { key: string, dir: string }): vscode.TreeItem => {
			return getTreeItem(element);
		}
	};
}

function setTreeNodeByEval(dir: string, key: string, val: string, map: any) {
	let evalStr = 'tree';
	let dirs = dir.split('/').filter(Boolean) || [];
	dirs.forEach((key: string) => {
		evalStr += `['${key}/']`;
	});
	evalStr += `['${val}']=${val.indexOf('/') > -1 ? '{}' : `'${map[val]}'`}`;
	eval(evalStr);
}

function getTreeNode(dir: string, key: string) {
	let evalStr = 'tree';
	let dirs = dir.split('/').filter(Boolean) || [];
	dirs.forEach((val: string) => {
		evalStr += `['${val}${val === key ? '' : '/'}']`;
	});
	return eval(evalStr);
}

async function getChildren(dir: string | undefined): Promise<any[]> {
	let res: any = { dirs: [], data: {}, code: 1 };
	if (AliOss.isClientConnection) {
		res = await AliOss.getOssDir(dir || '');
		if (res.code === 0) {
			vscode.commands.executeCommand('setContext', 'aliyun-oss-configuration.state', 'uninitialized');
		}
	}
	/******---------------*****/
	if (createDirCur) {
		res.data[createDirCur] = createDirCur;
		res.dirs = [`${dir}${createDirCur}`];
		createDirCur = '';
	}
	/******---------------*****/
	dirList = dirList.concat(res.dirs).filter(Boolean);
	if (!dir) {
		tree = res.data;
	}
	return res.data;
}

function getTreeItem(element: any): vscode.TreeItem {
	const { key, dir } = element;
	const treeElement = getTreeElement(key);
	const folder = dirList.find(k => k.endsWith(key));
	return {
		id: dir,
		command: {
			command: folder ? '' : 'alioss.toWebview',
			title: '',
			arguments: [dir]
		},
		label: <any>{ label: `${folder ? `${key.replace("/", "")}` : `[${getTreeNode(dir, key)}]   ${key}`}` },
		// tooltip: `文件大小：${getTreeNode(dir, key)}`,
		iconPath: "",
		contextValue: folder ? 'folder' : /\.(png|jpg)$/.test(key) ? 'tinypng' : 'file',
		collapsibleState: treeElement && Object.keys(treeElement).length || (folder === createDirFull) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
	};
}

function getTreeElement(element: any): any {
	if (!dirList.find(k => k.endsWith(element))) {
		return null;
	} else {
		return tree;
	};
}

function getNode(key: string, dir: string): { key: string, dir: string } {
	if (!nodes[dir ? dir : key]) {
		nodes[dir ? dir : key] = new Key(key, dir);
	}
	return nodes[dir ? dir : key];
}

class Key {
	constructor(readonly key: any, readonly dir?: any) { }
}

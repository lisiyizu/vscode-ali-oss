new Vue({
    el: '#app',
    data: function () {
        return {
            dialogVisible: false,
            loading: false,
            loadingText: '',
            data: {},
            ossPath: '',
            uploadWay: 0,
            checkList: [],
            tableList: [],
        };
    },
    watch: {
        ossPath (val) {
            this.data.ossPath = val;
        }
    },
    created: function () {
        window.addEventListener('message', event => {
            const { type, data } = event.data;
            const commandEvent = {
                [WEB_COMMAND.GET_UPLOAD_FILES]: () => {
                    this.data = data;
                    this.ossPath = data.ossPath || '';
                    this.tableList = data.upFiles.map((item, index) => ({
                        file: item,
                        uploadStatus: -1,
                        uploadMsg: '-',
                        outputSize: '-',
                        isTinyPng: this.isTinyPng(item, data.sizeArr[index]),
                        ossPath: data.ossPath,
                        localPath: data.localPath
                    }));
                    this.$nextTick(() => {
                        this.tableList.forEach(row => {
                            this.$refs.tableRef.toggleRowSelection(row);
                        })
                    })
                    this.checkList = JSON.parse(JSON.stringify(data.upFiles));
                },
                [WEB_COMMAND.SUCCESS_UPLOAD_FILES]: () => {
                    this.loading = false;
                    this.$confirm('上传完毕～', '操作提示', {
                        confirmButtonText: '确定并关闭窗口',
                        cancelButtonText: '继续',
                        lockScroll: true,
                        type: 'success'
                    }).then(() => {
                        VSCode.postMessage({ type: WEB_COMMAND.CLOSE_UPLOAD_WEBVIEW });
                    }).catch(() => { });
                },
                [WEB_COMMAND.SUCCESS_UPLOAD_FILES_TINYPNG]: () => {
                    this.reloadTableRow(data);
                },
                [WEB_COMMAND.FAIL_UPLOAD_FILES_TINYPNG]: () => {
                    this.reloadTableRow(data);
                }
            };
            commandEvent[type]();
        });
        VSCode.postMessage({ type: WEB_COMMAND.INIT_UPLOAD_FILES });
    },
    methods: {
        renderHeader (h, { column, $index }) {
            return [
                column.label,
                h(
                    'el-tooltip',
                    {
                        props: {
                            content: (function () {
                                let label = column.label;
                                switch (label) {
                                    case '是否支持压缩':
                                        return `只能上传 .png and .jpg, 最大不能超过 5MB (注意：超过5MB的文件不会被压缩，会直接走OSS上传)`;
                                }
                            })(),
                            placement: 'top'
                        }
                    },
                    [
                        h('span', {
                            class: {
                                'el-icon-info': true
                            }
                        })
                    ]
                )
            ];
        },
        handleSelectionChange (val) {
            this.checkList = val.map(item => item.file);
        },
        reloadTableRow (res) {
            this.tableList.forEach(item => {
                if (item.file === res.file) {
                    this.loadingText = `正在上传[${this.checkList.length}/${res.fIndex + 1}]···`;
                    item.uploadStatus = res.code;
                    item.outputSize = res.data.outputSize || '-';
                    item.uploadMsg = (res.code === 1) ? '上传成功' : res.data;
                }
            })
        },
        isTinyPng (file, size) {
            const ext = file.substr(file.lastIndexOf('.')).toLowerCase();
            return /\.(png|jpg)$/.test(ext) && size <= 5200000;
        },
        startUpload () {
            if (this.ossPath) {
                this.loading = true;
                this.loadingText = `正在上传[${this.checkList.length}/0]···`;
                this.tableList.forEach(item => { item.uploadStatus = -1; item.uploadMsg = '等待上传' });
                if (this.uploadWay === 0) {
                    VSCode.postMessage({ type: WEB_COMMAND.CHOOSE_UPLOAD_FILES, data: { ...this.data, checkFiles: this.checkList } });
                } else if (this.uploadWay === 1) {
                    VSCode.postMessage({ type: WEB_COMMAND.CHOOSE_UPLOAD_FILES_TINYPNG, data: { ...this.data, checkFiles: this.checkList } });
                }
            } else {
                this.$message({ type: 'warning', message: '请您先输入OSS上传目录！' })
            }
        },
        changeRadioGroup () {
            this.checkList = [];
            this.$refs.tableRef.clearSelection();
            this.tableList.forEach(item => {
                item.uploadStatus = -1;
                item.uploadMsg = '-';
                item.outputSize = '-';
            });
        }
    }
});
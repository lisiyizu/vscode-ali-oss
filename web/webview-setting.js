new Vue({
    el: '#app',
    data: function () {
        return {
            loading: false,
            dialogVisible: false,
            form: {
                region: 'oss-cn-beijing',
                accessKeyId: '',
                accessKeySecret: '',
                bucket: ''
                // endpoint: ''
            },
            ossRegionList: [
                'oss-cn-hangzhou',
                'oss-cn-shanghai',
                'oss-cn-qingdao',
                'oss-cn-beijing',
                'oss-cn-zhangjiakou',
                'oss-cn-huhehaote',
                'oss-cn-wulanchabu',
                'oss-cn-shenzhen',
                'oss-cn-heyuan',
                'oss-cn-chengdu',
                'oss-cn-hongkong',
                'oss-us-west-1',
                'oss-us-east-1',
                'oss-ap-southeast-1',
                'oss-ap-southeast-2',
                'oss-ap-southeast-3',
                'oss-ap-southeast-5',
                'oss-ap-northeast-1',
                'oss-ap-south-1',
                'oss-eu-central-1',
                'oss-eu-west-1',
                'oss-me-east-1'
            ]
        };
    },
    created: function () {
        window.addEventListener('message', event => {
            const { type, data } = event.data;
            const commandEvent = {
                [WEB_COMMAND.GET_OSS_CONFIG]: () => {
                    data.config.region = data.config.region || 'oss-cn-beijing';
                    this.form = data.config;
                },
                [WEB_COMMAND.UPDATE_OSS_CONFIG_SUCCESS]: () => {
                    this.loading = false;
                    this.$message({ type: 'success', message: '设置成功!' });
                },
                [WEB_COMMAND.UPDATE_OSS_CONFIG_FAIL]: () => {
                    this.loading = false;
                    this.$message({ type: 'warning', message: '更新失败，请确认OSS配置是否正确!' });
                }
            };
            commandEvent[type]();
        });
        VSCode.postMessage({ type: WEB_COMMAND.INIT_OSS_CONFIG });
    },
    methods: {
        updateConfig () {
            this.$refs['form'].validate(valid => {
                if (valid) {
                    this.loading = true;
                    VSCode.postMessage({ type: WEB_COMMAND.UPDATE_OSS_CONFIG, data: this.form });
                }
            });
        }
    }
});
var fs = require('fs'),
    path = require('path'),
    domain = require('domain'),
    url = require('url'),
    crypto = require('crypto');

const callsites = require('callsites');

var util = require('./lib/util.js'),
    stackTrace = require('stack-trace'),
    colors = require('colors'),
    mkdirp = require('mkdirp');

var data_path = __dirname + '/'; //模板地址默认在模块里
var log_path = __dirname + '/log';
var LOGGER_CACHE = {};
var LOGFILE_CACHE = {};

//日志等级
var LEVELS = {
    0: 'ACCESS',
    3: 'ACCESS_ERROR',
    //应用日志等级 ODP格式
    1: 'FATAL',
    2: 'WARNING',
    4: 'NOTICE',
    8: 'TRACE',
    16: 'DEBUG'
};

var LEVELS_REVERSE = {};

for (var num in LEVELS) {
    LEVELS_REVERSE[LEVELS[num]] = num;
}

//debug模式下应用日志等级对应的颜色
var COLORS = {
    1: 'red',
    2: 'yellow',
    3: 'magenta',
    4: 'grey',
    8: 'cyan',
    16: 'grey'
};

var Logger = function (opts, req) {
    //模板文件地址，可以不填
    if (opts && opts['data_path']) {
        data_path = opts['data_path'];
    }

    //用户只需要填写log_path配置
    if (opts && opts['log_path']) {
        log_path = opts['log_path'];
    }

    this.req = req || {
        headers: {}
    };

    this.opts = this.extend(
        {
            stdout_only: false, // 只输出 stdout，不写文件
            debug: 0,
            intLevel: 16,
            auto_rotate: 1,
            use_sub_dir: 1,
            IS_ODP: true,
            IS_OMP: 0,
            IS_JSON: false,
            log_path: log_path,
            access_log_path: log_path + '/access',
            access_error_log_path: log_path + '/access',
            data_path: data_path + 'data'
        },
        opts
    );

    //保存一次错误及请求的详情信息
    this.params = {};

    //var format_wf = '%L: %{%m-%d %H:%M:%S}t %{app}x * %{pid}x [logid=%l filename=%f lineno=%N errno=%{err_no}x %{encoded_str_array}x errmsg=%{u_err_msg}x]';

    //[10/Jun/2014:22:01:35 +0800]
    //应用日志格式，默认wf日志与default日志一样
    this.format = {
        ACCESS:
            this.opts['access'] ||
            '%h - - [%{%d/%b/%Y:%H:%M:%S %Z}t] "%m %U %H/%{http_version}i" %{status}i %b %{Referer}i %{Cookie}i %{User-Agent}i %D',
        ACCESS_ERROR:
            '%h - - [%{%d/%b/%Y:%H:%M:%S %Z}t] "%m %U %H/%{http_version}i" %{status}i %b %{Referer}i %{Cookie}i %{User-Agent}i %D',
        WF:
            this.opts['format_wf'] ||
            '%L: %t [%f:%N] errno[%E] logId[%l] uri[%U] user[%u] refer[%{referer}i] cookie[%{cookie}i] custom[%{encoded_str_array}x] %S %M',
        DEFAULT:
            this.opts['format'] ||
            '%L: %t [%f:%N] errno[%E] logId[%l] uri[%U] user[%u] refer[%{referer}i] cookie[%{cookie}i] custom[%{encoded_str_array}x] %S %M',
        STD: '%L: %{%m-%d %H:%M:%S}t %{app}x * %{pid}x [logid=%l filename=%f lineno=%N errno=%{err_no}x %{encoded_str_array}x errmsg=%{u_err_msg}x]',
        STD_DETAIL:
            '%L: %{%m-%d %H:%M:%S}t %{app}x * %{pid}x [logid=%l filename=%f lineno=%N errno=%{err_no}x %{encoded_str_array}x errmsg=%{u_err_msg}x cookie=%{u_cookie}x]'
    };
};

Logger.prototype = {
    fatal: function () {
        return this.log.call(this, 'FATAL', arguments[0]);
    },
    notice: function () {
        return this.log.call(this, 'NOTICE', arguments[0]);
    },
    trace: function () {
        return this.log.call(this, 'TRACE', arguments[0]);
    },
    warning: function () {
        return this.log.call(this, 'WARNING', arguments[0]);
    },
    debug: function () {
        return this.log.call(this, 'DEBUG', arguments[0]);
    },
    //level表示日志I等级，obj表示错误消息或者错误选项
    log: function (level, obj) {
        level = String(level).toUpperCase(); // WARNING格式
        var intLevel = this.getLogLevelInt(level); // 2格式
        var format = this.getLogFormat(level);
        if (intLevel < 0 || !format) {
            return false;
        }
        var option = {};
        if (obj) {
            if (typeof obj === 'string') {
                option['msg'] = obj;
            } else if (typeof obj === 'object') {
                option = obj;
            }
        }
        //解析错误堆栈信息
        this.parseStackInfo(option);
        //解析自定义字段，存放在对应ODP的 encoded_str_array中
        this.params['encoded_str_array'] = '';
        if (option['custom']) {
            this.parseCustomLog(option['custom']);
        }

        if (intLevel === 0 || intLevel === 3) {
            //访问日志
            this.writeLog(intLevel, option, format);
        } else {
            //IS_OMP等于0打印两种格式日志，等于1打印STD日志，等于2打印WF/Default日志
            if (this.opts['IS_OMP'] === 0 || this.opts['IS_OMP'] === 2) {
                option['filename_suffix'] = '';
                option['escape_msg'] = false; //错误消息不转义
                this.writeLog(intLevel, option, format);
            }

            if (this.opts['IS_OMP'] === 0 || this.opts['IS_OMP'] === 1) {
                option['filename_suffix'] = '.new';
                option['escape_msg'] = true; //错误消息转义
                this.writeLog(intLevel, option, this.format['STD']);
            }
        }
    },

    extend: function (destination, source) {
        for (var property in source) {
            if (source.hasOwnProperty(property)) {
                destination[property] = source[property];
            }
        }
        return destination;
    },

    getLogFormat: function (level) {
        level = level.toUpperCase();
        var formats = this.format;
        if (this.getLogLevelInt(level) < 0) {
            return false;
        }
        var format = formats['DEFAULT']; //默认格式，
        // ACCESS为访问格式
        if (level === 'ACCESS') {
            format = formats['ACCESS'];
        } else if (level === 'ACCESS_ERROR') {
            format = formats['ACCESS_ERROR']; //访问错误 404 301等单独存储
        } else {
            //warning和fatal格式不一样,且单独存储
            if (level === 'WARNING' || level === 'FATAL') {
                format = formats['WF'];
            }
        }

        return format;
    },
    /**
     * 解析错误信息，获取函数名文件行数等
     * @param  {[type]} option [description]
     * @return {[type]}        [description]
     */
    parseStackInfo: function (option) {
        this.params['errno'] = option['errno'] || 0; //错误号
        this.params['error_msg'] = option['msg'] || ''; //自定义错误信息,%M默认不转义
        this.params['TypeName'] = '';
        this.params['FunctionName'] = '';
        this.params['MethodName'] = '';
        this.params['FileName'] = '';
        this.params['LineNumber'] = '';
        this.params['isNative'] = '';
        if (option['stack']) {
            try {
                if (!option['msg']) {
                    this.params['error_msg'] = this.opts['debug']
                        ? option['stack']
                        : String(option['stack']).replace(/(\n)+|(\r\n)+/g, ' ');
                }
                var trace = stackTrace.parse(option['stack']);
                this.params['TypeName'] = trace[0].typeName;
                this.params['FunctionName'] = trace[0].functionName;
                this.params['MethodName'] = trace[0].methodName;
                this.params['FileName'] = trace[0].fileName;
                this.params['LineNumber'] = trace[0].lineNumber;
                this.params['isNative'] = trace[0].native;
            } catch (e) {
                //this.log('notice','wrong error obj');
            }
        }
    },

    //解析自定义字段，'custom'字段
    parseCustomLog: function (obj) {
        if ('object' !== typeof obj) {
            return false;
        }
        var items = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                items.push(escape(key) + '=' + escape(obj[key]));
            }
        }
        if (items.length > 0) {
            this.params['encoded_str_array'] = items.join(' ');
        }
    },

    //初始化请求相关的参数
    parseReqParams: function (req, res) {
        if (!req || !req.headers || !res) {
            return false;
        }
        this.params['CLIENT_IP'] =
            req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.headers['x-real-ip'];
        this.params['REFERER'] = req.headers['referer'];
        this.params['COOKIE'] = req.headers['cookie'];
        this.params['USER_AGENT'] = req.headers['user-agent'];
        this.params['SERVER_ADDR'] = req.headers.host;
        this.params['SERVER_PROTOCOL'] = String(req.protocol).toUpperCase();
        this.params['REQUEST_METHOD'] = req.method || '';
        this.params['SERVER_PORT'] = req.app.settings ? req.app.settings.port : '';
        this.params['QUERY_STRING'] = this.getQueryString(req.originalUrl);
        this.params['REQUEST_URI'] = req.originalUrl;
        this.params['REQUEST_PATHNAME'] = req._parsedUrl ? req._parsedUrl.pathname : '-';
        this.params['REQUEST_QUERY'] = req._parsedUrl ? req._parsedUrl.query : '-';
        this.params['HOSTNAME'] = req.hostname;
        this.params['HTTP_HOST'] = req.headers.host;
        this.params['HTTP_VERSION'] = req.httpVersionMajor + '.' + req.httpVersionMinor;
        this.params['STATUS'] = res._header ? res.statusCode : null;
        this.params['CONTENT_LENGTH'] = (res._headers || {})['content-length'] || '-';
        this.params['BYTES_SENT'] = res.socket ? res.socket.bytesRead : 0;
        this.params['HEADERS'] = req.headers;
        this.params['pid'] = process.pid;
    },

    /**
     * 获取请求的querystring
     *
     * @param {string} url 请求 url
     * @return {string} querystring
     */
    getQueryString(rawUrl) {
        try {
            var urlObj = url.parse(rawUrl);
            return urlObj.query || '';
        } catch (e) {
            console.log(e);
        }
        return '';
    },

    /**
     * ODP环境下日志的前缀为AppName，非ODP环境需要配置指定前缀
     * @return {[string]} [description]
     */
    getLogPrefix: function () {
        if (this.opts.autoAppName && this.req && this.req.CURRENT_APP) {
            return this.req.CURRENT_APP;
        }
        if (this.opts['IS_ODP'] === true) {
            return this.opts['app'];
        }
        return 'unknow';
    },

    //获取logID，如果没有生成唯一随机数
    getLogID: function (req, logIDName) {
        var logId = 0;

        if (this.params['LogId']) {
            return this.params['LogId'];
        }

        if (req) {
            if (req.headers[logIDName]) {
                logId = parseInt(req.headers[logIDName], 10);
            } else if (parseInt(req.query['logid'], 10) > 0) {
                logId = parseInt(req.query['logid'], 10);
            } else if (parseInt(this.getCookie('logid'), 10) > 0) {
                logId = parseInt(this.getCookie('logid'), 10);
            }
        }

        if (logId === 0) {
            var obj = util.gettimeofday();
            logId = (obj['sec'] * 100000 + obj['usec'] / 10 + Math.floor(Math.random() * 100)) & 0x7fffffff;
        }
        return logId;
    },

    //获取日志文件地址。注意访问日志与应用日志的差异
    getLogFile: function (intLevel) {
        var prefix = this.getLogPrefix() || 'yog';
        var logFile = '',
            log_path = '';
        switch (intLevel) {
            case '0': //访问日志前缀默认access
                logFile = this.opts['access_log_file'] || 'access'; //访问日志
                log_path = this.opts['access_log_path'] || this.opts['log_path'];
                break;
            case '3':
                logFile = this.opts['access_error_log_file'] || 'error'; //访问日志
                log_path = this.opts['access_error_log_path'] || this.opts['log_path'];
                break;
            default:
                //错误日志为app前缀
                //是否使用子目录，app区分
                log_path = this.opts['use_sub_dir'] ? this.opts['log_path'] + '/' + prefix : this.opts['log_path'];
                logFile = prefix;
        }

        return log_path + '/' + logFile + '.log';
    },

    /**
     * 写入信息到日志文件中，异步方式
     * @param  {[type]} intLevel   [日志等级，整数]
     * @param  {[type]} options    [写入选项]
     * @param  {[type]} log_format [日志格式]
     * @return {[type]}            [description]
     */
    writeLog: function (intLevel, options, log_format) {
        //日志等级高于配置则不输出日志
        if ((intLevel > this.opts['intLevel'] || !LEVELS[intLevel]) && !this.opts['debug']) {
            return false;
        }

        this.params['current_level'] = LEVELS[intLevel];

        //日志文件名称
        var logFile = this.getLogFile(intLevel),
            filename_suffix = options['filename_suffix'] || '',
            errno = options['errno'] || 0;

        if (this.getLogLevelInt('WARNING') === intLevel || this.getLogLevelInt('FATAL') === intLevel) {
            logFile += '.wf';
        }
        //文件后缀
        logFile += filename_suffix;
        var logFileType = logFile;
        //是否按小时自动切分
        if (this.opts['auto_rotate']) {
            logFile += '.' + util.strftime(new Date(), '%Y%m%d%H');
        }

        //STD日志需将错误日志转义
        if (this.params['error_msg'] && !this.opts['debug']) {
            this.params['error_msg'] =
                options['escape_msg'] === true ? escape(this.params['error_msg']) : unescape(this.params['error_msg']);
        }

        var format = log_format || this.format['DEFAULT'];
        var str = this.getLogString(format, options);
        if (!str) {
            return false;
        }

        // stdout_only 主要是给容器化部署用的，开启后也写入控制台，但没颜色
        if (this.opts['stdout_only']) {
            console.log(str);
            // debug 模式，console.log输出颜色标记的日志
        } else if (this.opts['debug'] && COLORS[intLevel]) {
            var color = COLORS[intLevel];
            var _str = unescape(str);
            console.log(_str[color]);
        }

        if (!LOGFILE_CACHE[logFileType]) {
            LOGFILE_CACHE[logFileType] = {};
        }

        // 获取此类文件的FD缓存
        var fdCache = LOGFILE_CACHE[logFileType];

        if (!fdCache[logFile] && !this.opts['stdout_only']) {
            // 关闭老的日志流
            for (var oldFile in fdCache) {
                if (fdCache.hasOwnProperty(oldFile)) {
                    try {
                        fdCache[oldFile].end();
                    } catch (e) {}
                    delete fdCache[oldFile];
                }
            }
            var pathname = path.dirname(logFile);
            if (!fs.existsSync(pathname)) {
                mkdirp.sync(pathname);
            }
            fdCache[logFile] = fs.createWriteStream(logFile, {
                flags: 'a'
            });
        }
        if (!this.opts['stdout_only']) {
            fdCache[logFile].write(str);
        }
    },

    //获取字符串标识对应的日志等级，没有返回-1
    getLogLevelInt: function (level) {
        return LEVELS_REVERSE[level] || -1;
    },

    /**
     * 获取日志字符串，,执行模板函数读取日志数据
     * @return {[type]} [description]
     */
    getLogString: function (format, options) {
        if (this.opts['IS_JSON']) {
            const caller = callsites()[3];
            const callerFileName = caller.getFileName();
            const callerFunctionName = caller.getFunctionName();
            return (
                JSON.stringify({
                    date: new Date().toJSON(),
                    level: this.params['current_level'],
                    msg: options['msg'],
                    file: callerFileName,
                    function: callerFunctionName,
                    uri: this.params['REQUEST_URI'] || ''
                }) + '\n'
            );
        }

        if (!format) {
            return false;
        }
        if (!LOGGER_CACHE[format]) {
            try {
                var jsStr = this.parseFormat(format); //获取各个format对应的js执行函数字符串
                LOGGER_CACHE[format] = requireFromString(jsStr);
            } catch (e) {
                console.error(e);
                //mail("生成日志模板js失败");
                return false;
            }
        }
        return LOGGER_CACHE[format](this, util) + '\n';
    },

    //生产环境是否应当使用
    md5: function (data, len) {
        var md5sum = crypto.createHash('md5'),
            encoding = typeof data === 'string' ? 'utf8' : 'binary';
        md5sum.update(data, encoding);
        len = len || 10;
        return md5sum.digest('hex').substring(0, len);
    },

    //解析日志配置，生成相应的模板函数
    parseFormat: function (format) {
        var regex = /%(?:{([^}]*)})?(.)/g;
        var m;
        var action = [];
        while ((m = regex.exec(format)) != null) {
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            var code = m[2],
                param = m[1];
            switch (code) {
                case 'h':
                    action.push("logger.getParams('CLIENT_IP')");
                    break;
                case 't':
                    var _act = "util.strftime(new Date(),'%y-%m-%d %H:%M:%S')";
                    if (param && param !== '') {
                        _act = "util.strftime(new Date(), '" + String(param) + "')";
                    }
                    action.push(_act);
                    break;
                case 'i':
                    var key = String(param).toUpperCase().replace(/-/g, '_');
                    action.push("logger.getParams('" + key + "')");
                    break;
                // 不转换参数格式, 方便获取自定义 header 参数
                case 'I':
                    action.push("logger.getParams('" + param + "')");
                    break;
                case 'a':
                    action.push("logger.getParams('CLIENT_IP')");
                    break;
                case 'A':
                    action.push("logger.getParams('SERVER_ADDR')");
                    break;
                case 'b':
                    action.push("logger.getParams('CONTENT_LENGTH')");
                    break;
                case 'C':
                    if (param === '') {
                        action.push("logger.getParams('HTTP_COOKIE')");
                    } else {
                        action.push("logger.getCookie('" + param + "')");
                    }
                    break;
                case 'D':
                    //暂不确定计算准确
                    action.push("logger.getParams('REQUEST_TIME')");
                    break;
                case 'e':
                    //TODO
                    action.push("''");
                    break;
                case 'f':
                    action.push("logger.getParams('FileName')");
                    break;
                case 'H':
                    action.push("logger.getParams('SERVER_PROTOCOL')");
                    break;
                case 'm':
                    action.push("logger.getParams('REQUEST_METHOD')");
                    break;
                case 'p':
                    action.push("logger.getParams('SERVER_PORT')");
                    break;
                case 'q':
                    action.push("logger.getParams('QUERY_STRING')");
                    break;
                case 'T':
                    //TODO
                    action.push("''");
                    break;
                case 'U':
                    action.push("logger.getParams('REQUEST_URI')");
                    break;
                case 'v':
                    action.push("logger.getParams('HOSTNAME')");
                    break;
                case 'V':
                    action.push("logger.getParams('HTTP_HOST')");
                    break;
                case 'L':
                    action.push("logger.getParams('current_level')");
                    break;
                case 'N':
                    action.push("logger.getParams('LineNumber')");
                    break;
                case 'E':
                    action.push("logger.getParams('errno')");
                    break;
                case 'l':
                    action.push("logger.getParams('LogId')");
                    break;
                case 'u':
                    //TODO 用户ID 用户名
                    action.push("logger.getParams('user')");
                    break;
                case 'S':
                    //TODO
                    action.push("''");
                    break;
                case 'M':
                    action.push("logger.getParams('error_msg')");
                    break;
                case 'x':
                    //TODO
                    if (param.indexOf('u_') == 0) {
                        param = param.substr(2);
                    }
                    switch (param) {
                        case 'log_level':
                            action.push("logger.getParams('current_level')");
                            break;
                        case 'line':
                            action.push("logger.getParams('LineNumber')");
                            break;
                        case 'function':
                            action.push("logger.getParams('FunctionName')");
                            break;
                        case 'err_no':
                            action.push("logger.getParams('errno')");
                            break;
                        case 'err_msg':
                            action.push("logger.getParams('error_msg')");
                            break;
                        case 'log_id':
                            action.push("logger.getParams('LogId')");
                            break;
                        case 'app':
                            action.push('logger.getLogPrefix()');
                            break;
                        /*case 'function_param':
                            $action[] = 'Bd_Log::flattenArgs(Bd_Log::$current_instance->current_function_param)';
                            break;*/
                        /*case 'argv':
                            $action[] = '(isset($GLOBALS["argv"])? Bd_Log::flattenArgs($GLOBALS["argv"]) : \'\')';
                            break;*/
                        case 'pid':
                            action.push("logger.getParams('pid')");
                            break;
                        case 'encoded_str_array':
                            action.push("logger.getParams('encoded_str_array')");
                            break;
                        case 'cookie':
                            action.push("logger.getParams('cookie')");
                            break;
                        default:
                            action.push("''");
                    }
                    break;
                case '%':
                    action.push("'%'");
                    break;
                default:
                    action.push("''");
            }
        }

        var strformat = util.preg_split(regex, format);
        var logCode = "'" + strformat[0] + "'";
        for (var i = 1; i < strformat.length; i++) {
            logCode = logCode + ' + ' + action[i - 1] + " + '" + strformat[i] + "'";
        }
        var cmt = '/* Used for app ' + this.opts['app'] + '\n';
        cmt += ' * Original format string:' + format.replace(/\*\//g, '* /');

        var str = cmt + '*/ \n module.exports=function(logger, util){\n return ' + logCode + '; \n}';
        return str;
    },

    getParams: function (name) {
        if (this.params.hasOwnProperty(name) && this.params[name] !== undefined && this.params[name] !== '') {
            return this.params[name];
        }
        name = name.toLowerCase();
        if (this.params.HEADERS && this.params.HEADERS.hasOwnProperty(name) && this.params.HEADERS[name]) {
            return this.params.HEADERS[name];
        }
        return '-';
    },

    setParams: function (name, value) {
        this.params[name] = value;
    },

    getCookie: function (name) {
        name = String(name).replace(/(^\s*)|(\s*$)/g, '');
        var match = String(this.getParams('COOKIE')).match(new RegExp(name + '=([^;]+)'));
        if (match) {
            return match[1];
        }
        return false;
    }
};

function requireFromString(src, filename) {
    var Module = module.constructor;
    var m = new Module();
    m._compile(src, filename || 'whatever');
    return m.exports;
}

module.exports = function (config) {
    config = config || {};

    return function (req, res, next) {
        var current;
        var logger;
        current = domain.create();
        logger = new Logger(config, req);
        current.add(logger);
        current.logger = logger; // Add request object to custom property

        function logRequest() {
            res.removeListener('finish', logRequest);
            res.removeListener('close', logRequest);
            //以下参数需要在response finish的时候计算
            logger.params['STATUS'] = res._header ? res.statusCode : null;
            logger.params['CONTENT_LENGTH'] = (res._headers || {})['content-length'] || '-';
            if (req._startAt) {
                var diff = process.hrtime(req._startAt);
                var ms = diff[0] * 1e3 + diff[1] * 1e-6;
                logger.params['REQUEST_TIME'] = ms.toFixed(3);
            }
            //不区分访问错误日志
            logger.log('ACCESS');
        }

        //只在请求过来的时候才设置LogId
        logger.params['LogId'] = logger.getLogID(req, config.LogIdName || 'x_bd_logid');
        logger.parseReqParams(req, res);

        //response-time启动埋点
        req._startAt = process.hrtime();

        res.once('finish', logRequest);
        res.once('close', logRequest);

        res.on('log', function (e, level) {
            var option = e || {};
            level = level || 'notice';
            // logger.parseReqParams(req, res);
            logger.log(level, option);
        });

        //只要url设置了_node_debug参数，则开启debug模式，console.log输出日志
        if (req.query && req.query._node_debug) {
            logger.opts['debug'] = 1;
        }

        current.run(next);
    };
};

module.exports.Logger = Logger;

module.exports.getLogger = function (config) {
    if (process.domain && process.domain.logger) {
        return process.domain.logger;
    }
    return new Logger(config);
};

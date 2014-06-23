var fs = require('fs'),
    path = require('path'),
    domain = require('domain'),
    crypto = require('crypto');

var util = require('./lib/util.js');
var stackTrace = require('stack-trace');
var mkdirp = require('mkdirp');

var data_path = __dirname + "/";

var Logger = function(opts){
    //日志等级
    this.levels = {
        0   : 'INFO',
        1   : 'FATAL',
        2   : 'WARNING',
        4   : 'NOTICE',
        8   : 'TRACE',
        16  : 'DEBUG'
    };
    
    this.opts = this.extend({
        'app' : 'unkown',
        'intLevel' : 16,
        'auto_rotate' : 1,
        'use_sub_dir' : 1,
        'IS_ODP' : true,
        'IS_OMP' : 1,
        'log_path': data_path+"log",
        'access_log_path' : data_path+"log/access",
        'data_path' : data_path
    },opts);

    //保存一次错误及请求的详情信息
    this.params = {};

    //[10/Jun/2014:22:01:35 +0800]
    //应用日志格式
    this.format = {
        'INFO' : '%h - - [%{%d/%b/%Y:%H:%M:%S %Z}t] "%m %U %H/%{http_version}i" %{status}i %b %{Referer}i %{Cookie}i %{User-Agent}i %D',
        'WF'   : '%L: %{%m-%d %H:%M:%S}t %{app}x * %{pid}x [logid=%l filename=%f lineno=%N errno=%{err_no}x %{encoded_str_array}x errmsg=%{u_err_msg}x]',
        'DEFAULT' : '%L: %t [%f:%N] errno[%E] logId[%l] uri[%U] user[%u] refer[%{referer}i] cookie[%{cookie}i] %S %M',
        'STD'     :  '%L: %{%m-%d %H:%M:%S}t %{app}x * %{pid}x [logid=%l filename=%f lineno=%N errno=%{err_no}x %{encoded_str_array}x errmsg=%{u_err_msg}x]',
        'STD_DETAIL' : '%L: %{%m-%d %H:%M:%S}t %{app}x * %{pid}x [logid=%l filename=%f lineno=%N errno=%{err_no}x %{encoded_str_array}x errmsg=%{u_err_msg}x cookie=%{u_cookie}x]'
    };

}


Logger.prototype = {
    fatal : function(){
        return this.log.call(this,'FATAL',arguments[0]);
    },
    notice : function(){
        return this.log.call(this,'NOTICE',arguments[0]);
    },
    trace : function(){
        return this.log.call(this,'TRACE',arguments[0]);
    },
    warning : function(){
        return this.log.call(this,'WARNING',arguments[0]);
    },
    debug : function(){
        return this.log.call(this,'DEBUG',arguments[0]);
    },
    info : function(){
        return this.log.call(this,'INFO',arguments[0]);
    },
    //level表示日志I等级，obj表示错误消息或者错误选项
    log : function(level,obj){
        var level      = String(level).toUpperCase(); // WARNING格式
        var intLevel   = this.getLogLevelInt(level); // 2格式
        var format     = this.getLogFormat(level);
        if(intLevel < 0 || !format){
            return false;
        }   
        var option =  {}; 
        if(obj){
            if(typeof obj == "string"){
                option['msg'] = obj;
            }else if(typeof obj == "object"){
                option = obj;
            }
        }
        //解析错误堆栈信息
        this.parseStackInfo(option);
        this.params['LogId'] = this.getLogID();      

        if(intLevel < 1){
            this.writeLog(intLevel,option,format);
        }else{
            //IS_OMP等于0打印两种格式日志，等于1打印STD日志，等于2打印WF/Default日志
            if(this.opts['IS_OMP'] == 0 || this.opts['IS_OMP'] == 1){
                option['filename_suffix'] = ".new";
                this.writeLog(intLevel,option,format);
            }

            if(this.opts['IS_OMP'] == 0 || this.opts['IS_OMP'] == 2){
                option['filename_suffix'] = "";
                this.writeLog(intLevel,option,format);
            }
        }        
    },

    extend :  function(destination, source) {
        for (var property in source) {
            destination[property] = source[property];
        }
        return destination;
    },

    getLogFormat : function(level){
        level = level.toUpperCase();
        var formats = this.format;
        if(this.getLogLevelInt(level) < 0 ){
            return false;
        }    
        var format = formats['DEFAULT']; //默认格式，
        // INFO为访问格式
        if(level == "INFO"){
            format = formats['INFO'];
        }else if(level == "SERVER"){
            //TODO server错误日志
        }else{
            //warning和fatal格式不一样,且单独存储
            if(level == "WARNING" || level == "FATAL"){
                format = formats['WF'];
            }
            //如果接入过OMP，则格式不一样
            if(this.opts['IS_OMP'] == 1){
                format = formats['STD'];

                //如果有cookie配置，则使用STD_DETAIL格式，暂不支持
                /*if ((boolean)Bd_Conf::getConf("/log/OMP/cookie")) {
                    $strFormat = self::DEFAULT_FORMAT_STD_DETAIL;
                }*/
            }
        }

        return format;

    },

    parseStackInfo : function(option){
        this.params['errno'] = option['errno'] || 0;
        this.params['error_msg'] = escape(option['msg'] || "");

        if(option['stack'] ){
            try{
                if(!option['msg']){
                    this.params['error_msg'] = escape(option['stack']);
                }
                var trace = stackTrace.parse(option['stack']);         
                this.params['TypeName'] = trace[0].typeName;
                this.params['FunctionName'] = trace[0].functionName;
                this.params['MethodName'] = trace[0].methodName;
                this.params['FileName'] = trace[0].fileName;
                this.params['LineNumber'] = trace[0].lineNumber;
                this.params['isNative'] = trace[0].native;
            }catch(e){
                //this.log('notice','wrong error obj');
            }
        }
        
    },

    //初始化请求相关的参数
    parseReqParams : function(req,res){
        this.params['CLIENT_IP'] = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.headers['x-real-ip'];
        this.params['REFERER'] = req.headers['referer'];
        this.params['COOKIE'] = req.headers['cookie'];
        this.params['USER_AGENT'] = req.headers['user-agent'];
        this.params['SERVER_ADDR'] = req.headers.host;
        this.params['SERVER_PROTOCOL'] = String(req.protocol).toUpperCase();
        this.params['REQUEST_METHOD'] = req.method || "";
        this.params['SERVER_PORT'] = req.app.settings.port || cfg.port;
        this.params['QUERY_STRING'] = req.query;
        this.params['REQUEST_URI'] = req.originalUrl;
        this.params['HOSTNAME'] = req.host;
        this.params['HTTP_HOST'] =req.headers.host; 
        this.params['HTTP_VERSION'] = req.httpVersionMajor + '.' + req.httpVersionMinor; 
        this.params['STATUS'] = res.statusCode;
        this.params['CONTENT_LENGTH'] = (res._headers || {})['content-length'] || "-";

        this.params['LogId'] = this.getLogID(req);
    },

    /**
     * ODP环境下日志的前缀为AppName，非ODP环境需要配置指定前缀
     * @return {[string]} [description]
     */
    getLogPrefix :  function(){
        if(this.opts['IS_ODP'] == true ){
            return this.opts['app'];
        }else{
            //TODO 获取模块名称
            return 'unknow';
        }
    },

    getLogID : function(req){
        var logId = 0;

        if(this.params['LogId']){
            return this.params['LogId'];
        }

        if(req){
            if(req.headers['HTTP_X_BD_LOGID']){
                logId = parseInt(req.headers['HTTP_X_BD_LOGID']);
            }else if( parseInt(req.query['logid']) > 0 ){
                logId = parseInt(req.query['logid']);
            }else if(parseInt(this.getCookie('logid')) > 0 ){
                logId = parseInt(this.getCookie('logid'));
            }
        }

        if(logId == 0){
            var obj = util.gettimeofday();
            logId = (((obj['sec']*100000 + obj['usec']/10) & 0x7FFFFFFF) | 0x80000000);
        }
        return logId;
    },

    getLogFile : function(intLevel){
        var prefix = this.getLogPrefix();
        var logFile = "" ,log_path = "";
        switch(intLevel){
            case '0' :  //访问日志前缀默认access
                logFile =  this.opts['access_log_file'] || "access"; //访问日志
                log_path = this.opts['access_log_path'] || this.opts['log_path'] ;
                break;               
            default : //错误日志为app前缀
                //是否使用子目录，app区分
                log_path = this.opts['use_sub_dir'] ? 
                        (this.opts['log_path'] + "/" + this.opts['app']) : this.opts['app'];
                logFile = prefix;
        }

        return log_path + "/" + logFile;
    },

    getLogPath : function(){
        if(this.opts['IS_ODP'] == true ){
            return this.opts['LOG_PATH'].replace(/\/$/,"");
        }else{
            //TODO 非ODP环境日志地址
            return false;
        }
    },

    getDataPath : function(){
        if(this.opts('IS_ODP') == true ){
            return this.opts['DATA_PATH'];
        }else{
            //TODO 非ODP环境数据地址
            return false;
        }
    },

    writeLog : function(intLevel, options , log_format){
        //日志等级高于配置则不输出日志
        if( intLevel > this.opts['intLevel'] || !this.levels[intLevel] ){
            return false;
        }

        this.params['current_level'] = this.levels[intLevel];

        //日志文件名称
        var logFile = this.getLogFile(intLevel),
            filename_suffix = options['filename_suffix'] || "",
            errno   = options['errno'] || 0;

        if(this.getLogLevelInt('WARNING') == intLevel || this.getLogLevelInt('FATAL') == intLevel){
            logFile += ".wf";
        }
        //文件后缀
        logFile += filename_suffix;

        if(this.opts['auto_rotate']){
            logFile += "." + util.strftime(new Date(),'%Y%m%d%H');
        }

        var format = log_format || this.getFormat(intLevel);
        var str = this.getLogString(format);
        if(!str){
            return false;
        }
        var pathname = path.dirname(logFile);
        fs.exists(pathname, function(exists) {
            if (!exists) {
                return mkdirp(pathname, function(err) {
                    if (err) {
                        //return mail('日志 writer失败');
                    }
                    return fs.appendFile(logFile, str, function(err) {
                        if (err) {
                            //return mail('日志append失败');
                        }
                    });
                });
            } else {
                return fs.appendFile(logFile, str, function(err) {
                    if (err) {
                        //return mail('日志append失败');
                    }
                });
            }
        });
    },

    /**
     * 获取不同级别日志的格式
     * @param  {[type]} intlevel [description]
     * @return {[type]}          [description]
     */
    getFormat  : function(intlevel){
        var format = this.format['DEFAULT'];
        if(this.getLogLevelInt('WARNING') == intLevel || this.getLogLevelInt('FATAL') == intLevel){
            format = this.opts['format_wf'];
        }
        return format;
    },

    getLogLevelInt : function(level){
        var levels = this.levels;
        for (var num in levels) {
            if(levels[num] == level){
                return num;
            }
        };
        return -1;
    },

    /**
     * 获取日志字符串
     * @return {[type]} [description]
     */
    getLogString : function(format){
        var _this = this;
        var md5Str = _this.md5(format);
        var func = "node_log_" + md5Str;
        if(_this[func]){
            return _this[func](util) + "\n";
        }
        var dataPath = this.opts['data_path'];
        var filename = dataPath + "/log/" + md5Str + ".js";
        
        //fs.unlinkSync(filename);
        if(!fs.existsSync(filename)){
            var time = +new Date();
            var tempFile = filename +  time + "." + Math.random();
            if(!fs.existsSync(dataPath + "/log")){
                try{
                    fs.mkdirSync(dataPath + "/log");
                }catch(e){
                    // mail("创建日志文件夹失败")
                }
            }
            try{
                var jsStr = _this.parseFormat(format);//获取各个format对应的js执行函数字符串
                fs.appendFileSync(tempFile,jsStr);
                fs.renameSync(tempFile,filename);
            }catch(e){
                //mail("生成日志模板js失败");
            }
        }
        
        try{
            var template = require(filename);
            _this[func] = template[func];
            return  _this[func](util) + "\n";
        }catch(e){
            //console.log(e.stack);
            return null;
        }
    },


    //生产环境是否应当使用
    md5 :  function(data, len){
        var md5sum = crypto.createHash('md5'),
            encoding = typeof data === 'string' ? 'utf8' : 'binary';
        md5sum.update(data, encoding);
        len = len || 7;
        return md5sum.digest('hex').substring(0, len);
    },


    parseFormat : function(format){
        var regex = /%(?:{([^}]*)})?(.)/g; 
        var m;
        var action = [];
        while ((m = regex.exec(format)) != null) {
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            var code = m[2],param = m[1];
            switch(code){
                case 'h':
                    action.push("this.getParams('CLIENT_IP')");
                    break;
                case 't':
                    var _act =  "util.strftime(new Date(),'%y-%m-%d %H:%M:%S')";
                    if(param && param!= ""){
                        _act = "util.strftime(new Date(), '" + String(param) + "')";
                    }
                    action.push(_act);
                    break;
                case 'i':
                    var key = String(param).toUpperCase().replace(/-/g,'_');
                    action.push("this.getParams('" + key +"')");
                    break;
                case 'a':
                    action.push("this.getParams('CLIENT_IP')");
                    break;
                case 'A':
                    action.push("this.getParams('SERVER_ADDR')");
                    break;
                case 'b':
                    action.push("this.getParams('CONTENT_LENGTH')");
                    break;
                case 'C':
                    if(param == ''){
                        action.push("this.getParams('HTTP_COOKIE')");
                    }else{
                        action.push("this.getCookie(' " + param + "')");                    
                    }
                    break;
                case 'D':
                    //暂未计算准确
                    action.push("this.getParams('REQUEST_TIME')");
                    break;
                case 'e':
                    //TODO
                    action.push("''");
                    break;
                case 'f':
                    action.push("this.getParams('FileName')");
                    break;
                case 'H':
                    action.push("this.getParams('SERVER_PROTOCOL')");
                    break;
                case 'm':
                    action.push("this.getParams('REQUEST_METHOD')");
                    break;
                case 'p':
                    action.push("this.getParams('SERVER_PORT')");
                    break;
                case 'q':
                    action.push("this.getParams('QUERY_STRING')");
                    break;
                case 'T':
                    //TODO
                    action.push("''");
                    break;
                case 'U':
                    action.push("this.getParams('REQUEST_URI')");
                    break;
                case 'v':
                    action.push("this.getParams('HOSTNAME')");
                    break;
                case 'V':
                    action.push("this.getParams('HTTP_HOST')");
                    break;
                case 'L':
                    action.push("this.getParams('current_level')");
                    break;
                case 'N':
                    action.push("this.getParams('LineNumber')");
                    break;
                case 'E':
                    action.push("this.getParams('errno')");
                    break;
                case 'l':
                    action.push("this.getParams('LogId')");
                    break;
                case 'u':
                    //TODO 用户ID 用户名
                    action.push("''");
                    break;
                case 'S':
                    //TODO
                    action.push("''");
                    break;
                case 'M':
                    action.push("this.getParams('error_msg')");
                    break;
                case 'x':
                    //TODO
                    if(param.indexOf("u_")  == 0 ){
                        param = param.substr(2);
                    }
                    switch(param) {
                        case 'log_level':
                            action.push("this.getParams('current_level')");
                            break;
                        case 'line':
                            action.push("this.getParams('LineNumber')");
                            break;
                        case 'function':
                            action.push("this.getParams('FunctionName')");
                            break;
                        case 'err_no':
                            action.push("this.getParams('errno')");
                            break;
                        case 'err_msg':
                            action.push("this.getParams('error_msg')");
                            break;
                        case 'log_id':
                            action.push("this.getParams('LogId')");
                            break;
                        case 'app':
                            action.push("this.getLogPrefix()");
                            break;
                        /*case 'function_param':
                            $action[] = 'Bd_Log::flattenArgs(Bd_Log::$current_instance->current_function_param)';
                            break;*/
                        /*case 'argv':
                            $action[] = '(isset($GLOBALS["argv"])? Bd_Log::flattenArgs($GLOBALS["argv"]) : \'\')';
                            break;*/
                        case 'pid':
                            action.push("this.getParams('pid')");
                            break;
                        case 'encoded_str_array':
                            action.push("this.getParams('encoded_str_array')");
                            break;
                        case 'cookie':
                            action.push("this.getParams('cookie')");
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

        var strformat = util.preg_split(regex,format);
        var code = "'" +  strformat[0] + "'";
        for (var i = 1; i < strformat.length; i++) {
            code = code +  ' + ' + action[i-1] + " + '"  + strformat[i] + "'";           
        };
        var cmt = "/* Used for app " + this.opts['app'] + "\n";
        cmt += " * Original format string:" + format.replace(/\*\//g,"* /");

        var md5Str = this.md5(format);
        var func = "node_log_" + md5Str;
        var str = cmt + "*/ \n exports." + func + "=function(util){\n return " + code +"; \n}";
        return str;

    },

    getParams : function(name){
        if(this.params.hasOwnProperty(name) && this.params[name]!='undefined'){
            return this.params[name];
        }
        return  "-";
    },

    setParams : function(name,value){
        this.params[name] = value;
    },

    getCookie : function(name){
        var match = this.getParams("COOKIE").match(new RegExp(name + '=([^;]+)'));
        if (match){
           return match[1]; 
        }         
        return false;
    },




}



module.exports = function(config){
    
    var config = config || {};
   /* if (config.mode === 'production') {
        process.on('uncaughtException', function(e) {
            if (config.mode === 'production') {
                console.log(config);
                logger.log("error2", e,"fatal");
                return process.exit(1);
            }
        });
    }*/

    return function (req, res, next) {

        function logRequest(){
            res.removeListener('finish', logRequest);
            res.removeListener('close', logRequest);
            logger.parseReqParams(req,res);
            logger.log("info");
        }

        var current = domain.create();   
        var logger = new Logger(config);

        current.add(logger);
        current.logger = logger; // Add request object to custom property
        
        //计算请求消耗时间
        /*var start = new Date().getTime() / 1000;
        res.on('header',function(){
            var time_request = new Date().getTime() / 1000 - start;
            Logger.setParams('REQUEST_TIME',time_request);//单位微秒
            console.log(time_request);
        });*/


        res.on('finish', logRequest);
        res.on('close',  logRequest);

        res.on('log',function(e,level){
            var option = e || {};
            var level = level ||  "notice";
            logger.parseReqParams(req,res);
            logger.log(level,option);
        });
      
        current.run(next);
    }    
};

module.exports.Logger = Logger;

module.exports.getLogger = function(){
    if(process.domain && process.domain.logger){
        return process.domain.logger;
    }else{
        return new Logger();
    }       
};

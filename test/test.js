
/**
 *  测试点归纳
 *  1. 没有配置时默认配置运行正常
 *  2. 配置错误时运行正常
 *  3. 写日志及种类类型(兼容OMP等)
 *  4. 获取日志格式错误
 *  5. 解析request和response对象，判断是否正常 todo
 *  6. 获取LogID是否正常
 **/
var Logger = require("../index.js");
var assert = require("assert");
var util   = require("../lib/util.js");
var fs     = require("fs");
var path   = require("path");
var http = require('http');
var app = require('express')();

//判断元素是否在数组中
function in_array(array,e) {
    for(i=0;i<array.length;i++)
    {
        if(array[i] == e)
            return true;
    }
    return false;
}


//同步删除非空文件夹
function deleteFolder(path) {
    var files = [];
    if( fs.existsSync(path) ) {
        files = fs.readdirSync(path);
        files.forEach(function(file,index){
            var curPath = path + "/" + file;
            if(fs.statSync(curPath).isDirectory()) { // recurse
                deleteFolder(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};


//测试Logger主要配置是否正常
describe('config', function(){

    describe('#API [log]', function(){
        //测试默认配置下Log接口是否正常
        it('should work using default config without error', function(){
            var logger = Logger.getLogger();
            //只传递消息
            logger.log('warning','test log');
            assert.equal('test%20log',logger.params['error_msg'] );
            assert.equal('WARNING', logger.params['current_level']);
            logger.warning("test warning method");
            logger.notice("test notice method");
            logger.debug("test debug method");
            logger.trace("test debug method");
            logger.fatal("test fatal method");

            //传递错误码，堆栈等
            logger.log('warning', {'stack' : new Error("error happened!"),'errno' : 123} );
            assert.equal(escape('Error: error happened!'),logger.params['error_msg'] );
            assert.equal(123,logger.params['errno']);

            //只传递等级保证不报错
            logger.log('warning');

            //错误使用保证不报错
            logger.log();
        })
    })

    describe('data_path',function(){
        var logger = Logger.getLogger({data_path : __dirname+'/'});
        it('data_path should equal to set',function(){
            assert.equal(__dirname+'/',logger.opts['data_path']);
        })
    })

    //测试应用名称及是否使用子文件夹配置
    describe('#app', function(){
        it('should use app name for log dir',function(){
            var app = 'apptest';
            var logger = Logger.getLogger({'app' : app,'is_omp':1});
            var logFile = logger.getLogFile();

            //使用use_sub_dir时需有子文件夹
            if(logger.opts['use_sub_dir']  && logFile.indexOf("/"+app+"/") < 0 ){
                assert.fail(logFile , '/'+app+'/xx.log','should use app subpath when use_sub_dir=1');
            }

            logger.opts['use_sub_dir'] = 0;
            logFile = logger.getLogFile();

            //使用use_sub_dir时需有子文件夹
            if(!logger.opts['use_sub_dir']  && logFile.indexOf("/"+app+"/") >= 0 ){
                assert.fail(logFile , '/xx.log','should not use app subpath when use_sub_dir=0');
            }

            //日志文件需包含app名称
            if(logFile.indexOf(app) < 0 ){
                assert.fail(logFile , 'apptest.log','should have app name');
            }
        })
    })


    //测试是否默认按小时切分设置
    describe('#auto_rotate', function(){
        it('should ratote log in hour',function(done){
            var logger = Logger.getLogger();
            var logFile = logger.getLogFile() + ".wf." + util.strftime(new Date(),'%Y%m%d%H');
            logger.log('warning', {'stack' : new Error("error happened!"),'errno' : 1234} );
            var t=setInterval(function(){
                if(fs.existsSync(logFile)){
                    clearInterval(t);
                    done();
                }
            },50);
        })
    })

    //测试访问日志地址配置
    describe('#access_log_path', function(){
        it('should use access_log_path setting',function(){
            var app = 'access',access_log_path = '/access/test2/';
            var logger = Logger.getLogger({'app' : app,'access_log_path' : access_log_path });
            var intLevel = logger.getLogLevelInt('ACCESS'); //访问日志等级编号
            var logFile = logger.getLogFile(intLevel) ;
            //如果日志路径中不包含自定义路径则不通过
            if(logFile.indexOf(access_log_path) < 0 ){
                assert.fail(logFile , access_log_path + ".xxx",'should use custom access log path');
            }

        })
    })


    //测试访问日志地址配置错误情况
    describe('#access_log_path', function(){
        it('should work without error when path setting is wrong',function(){
            var app = 'access',access_log_path = '/acdess^*%&%*(&())//test2/';
            var logger = Logger.getLogger({'app' : app,'access_log_path' : access_log_path ,'is_omp':2});
            logger.log("ACCESS");
            var pathname = path.dirname(access_log_path);
        })

        it('log_path',function(){
            var app = 'access',log_path = '/test/test2/';
            var logger = Logger.getLogger({'app' : app,'log_path' : log_path });
            logger.log("ACCESS");
            logger.log("ACCESS_ERROR");
            logger.warning("test");
        })
    })
})



//测试日志类型及日志ID是否正常
describe('Log', function(){
    var logger = Logger.getLogger({'app':'log_test'});
    this.timeout(5000);

    before(function(){
        deleteFolder(logger.opts['log_path']);
    })


    //测试兼容OMP的日志类型是否正常
    it('should have two type of log where IS_OMP=0', function(done){
        var log_path = logger.opts['log_path'] + "/" + logger.opts['app'];
        logger.log('warning', {'stack' : new Error("error happened!"),'errno' : 1234} );
        var t = setInterval(function(){
            if(fs.existsSync(log_path)){
                var logs = fs.readdirSync(log_path).sort();
                if(logs.length > 0){
                    //排序后第一个是.wf.日志 最后一个是.wf.new日志
                    if(logs[0].indexOf(".wf.") < 0 || logs[logs.length - 1].indexOf(".wf.new") < 0){
                        assert.fail(logs , ".wf.xx and .wf.new.xx",'should have two type of log when is_omp = 0');
                    }
                    done();
                    clearInterval(t);
                }
            }
        },50);

    })


    //测试默认的应用日志是否生成
    it('should have default app log', function(done){
        logger.opts['app'] = "log_test2";
        var log_path = logger.opts['log_path'] + "/" + logger.opts['app'];
        deleteFolder(log_path);
        logger.log('notice', {'stack' : new Error("error happened!"),'errno' : 1234} );
        var t = setInterval(function(){
            if(fs.existsSync(log_path)){
                var logs = fs.readdirSync(log_path);
                if(logs.length > 0){
                    var stats = fs.statSync(log_path + "/" +logs[0]);
                    var fileSize = stats["size"];
                    if(fileSize < 10){
                        throw new Error("no log record in file");
                    }
                    done();
                    clearInterval(t);
                }
            }
        },50);

    })

    //测试是否有访问日志生成
    it("should have access log ",function(done){
        logger.log('ACCESS');
        var log_path = logger.opts['log_path'] + "/access/";
        deleteFolder(log_path);
        //存在访问日志文件且日志文件有记录
        var t = setInterval(function(){
            if(fs.existsSync(log_path)){
                var logs = fs.readdirSync(log_path);
                if(logs.length > 0){
                    var stats = fs.statSync(log_path + "/" +logs[0]);
                    var fileSize = stats["size"];
                    if(fileSize < 10){
                        throw new Error("no log record in file");
                    }
                    done();
                    clearInterval(t);
                }
            }
        },50);
    })

    //测试LogID是否正常
    it('should generator unique LogID', function(){

        //js暂时没找到毫秒级别内生成10位不重复随机数的办法
        /*var IDList = [];
         //一万个随机数判断是否唯一
         for (var i = 0 ; i <= 10000; i++) {
         var id = logger.getLogID();
         if(in_array(IDList,id) ) {
         throw new Error("logID is not unique");
         }else if( id < 0 ){
         throw new Error("logID should > 0");
         }
         IDList.push(id);
         };
         */
    })

    //测试LogID是否正常
    it('LogId should equal to set',function(){
        var req = {
            'headers' : {
                'x-forwarded-for' : '127.0.0.1',
                'referer' : 'http://www.baidu.com',
                'user-agent' : 'chrome',
                'host' : 'host.baidu.com',
                'HTTP_X_BD_LOGID' :'456'
            },
            query :{
                'logid' : '789'
            },
            'app' : {
                'setting' : {
                    'port' : 80
                }
            },
            'method' : 'GET',
            'protocol' : 'http'
        };
        var logger = Logger.getLogger();
        logger.params['LogId']=123;
        assert.equal(123,logger.getLogID());
        delete logger.params['LogId'];
        assert.equal(456,logger.getLogID(req));
        delete req.headers.HTTP_X_BD_LOGID;
        assert.equal(789,logger.getLogID(req));
        delete req.query.logid;
        logger.params['COOKIE'] = "name=app_test;logid=111;SECURE";
        assert.equal(111,logger.getLogID(req));
        delete logger.params['COOKIE'];
        var logid = logger.getLogID();
    })

    //默认的日志格式配置及错误的配置下不报错
    it("#getLogString should work without error",function(){
        var format = logger.format;
        format['test1'] = '%L: %t [%f:%N] errno[%E] logId[%l] uri[%U] user[%u] refer[%{referer}i] cookie[%{cookie}i] %S %M';
        format['test2'] = '%L: %t [%f:%N] errno[%E]logId[%l uri[%U] user[%u] refer[%{referer}i] cookie[%{cookie}i] %S %M';
        format['test3'] = '%L: %t [%fN] errno[%E] logId[%l] uri[%U] user[%u] refer[%{referer}i] cookie[%{cookiei] %S M';
        for(var f in format){
            var str = logger.getLogString(format[f]);
        }
    })

})


//测试日志配置格式化主要参数是否正常
describe('LogFomatter', function(){



    var logger = Logger.getLogger();

    //测试参数
    logger.params['CLIENT_IP'] = '127.0.0.1';
    logger.params['REFERER'] = 'http://www.baidu.com';
    logger.params['COOKIE'] = 'c1=cookie1;c2=cookie2';
    logger.params['USER_AGENT'] = 'chrome' ;
    logger.params['SERVER_ADDR'] = '34.23.56.67' ;
    logger.params['SERVER_PROTOCOL'] = 'http';
    logger.params['REQUEST_METHOD'] = 'get';
    logger.params['SERVER_PORT'] = "80";
    logger.params['QUERY_STRING'] = "?query=params";
    logger.params['REQUEST_URI'] = "/test/test2";
    logger.params['HOSTNAME'] = "hostname";
    logger.params['HTTP_HOST'] = 'http_host';
    logger.params['HTTP_VERSION'] = '1.1';
    logger.params['STATUS'] = 200;
    logger.params['CONTENT_LENGTH'] = 500;
    logger.params['current_level'] = "NOTICE";
    logger.params['errno'] = "123";
    logger.params['error_msg'] = "error";


    // 默认配置'%L: %t [%f:%N] errno[%E] logId[%l] uri[%U] user[%u] refer[%{referer}i] cookie[%{cookie}i] %S %M';   
    it('default app log format ',function(){
        //默认配置去除时间
        var format = '%L: [%f:%N] errno[%E] logId[%l] uri[%U] user[%u] refer[%{referer}i] cookie[%{cookie}i] %S %M';
        var str ="NOTICE: [-:-] errno[123] logId[-] uri[/test/test2] user[-] refer[http://www.baidu.com] cookie[c1=cookie1;c2=cookie2]  error\n";
        assert.equal(str,logger.getLogString(format));
    })

    //日期配置，支持灵活自定义
    it("#t time format",function(){
        var format = '[%{%y/%m-%d %H:%M %Z}t]';
        var util_time = util.strftime(new Date,'%y/%m-%d %H:%M %Z');
        assert.equal("["+ util_time + "]\n",logger.getLogString(format));
    })

    //测试获取单个cookie的配置
    it("#C cookie format",function(){
        var format = '[%{c1}C]';
        assert.equal("[cookie1]\n",logger.getLogString(format));
    })

    //测试获取默认自定义项的配置
    it("#{u_xx}x custom item format",function(){
        var format = '%{u_err_msg}x';
        assert.equal("error\n",logger.getLogString(format));
    })


    //测试获取custom自定义字段的支持
    it("#custom log filed",function(){
        var logger2 = Logger.getLogger();
        var format = "%L: %{app}x * %{pid}x [logid=%l filename=%f lineno=%N errno=%{err_no}x %{encoded_str_array}x errmsg=%{u_err_msg}x]";
        logger2.warning({'custom':{'key1':'value1','key2':'value2'},'errno' : '123','msg' : 'test_error'});
        var str = "WARNING: unkown * - [logid=- filename=- lineno=- errno=123 key1=value1 key2=value2 errmsg=test_error]\n";
        assert.equal(str,logger2.getLogString(format));
        logger2.warning({'custom' : 'test','errno' : '456','msg' : 'test_error'});
        str="WARNING: unkown * - [logid=- filename=- lineno=- errno=456 - errmsg=test_error]\n";
        assert.equal(str,logger2.getLogString(format));
    })
})


describe('method', function(){
    var request = {
        'headers' : {
            'x-forwarded-for' : '127.0.0.1',
            'referer' : 'http://www.baidu.com',
            'user-agent' : 'chrome',
            'host' : 'host.baidu.com',
            'HTTP_X_BD_LOGID' : '456',
            'cookie' : 'test=1;'
        },
        query :{
            'logid' : '789'
        },
        'app' : {
            'setting' : {
                'port' : 80
            }
        },
        'method' : 'GET',
        'protocol' : 'http'
    };
    var response = {
        '_headers' : {
            'content-length' : 20
        },
        '_header' : {'test':1},
        'statusCode' : 200
    };
    var logger = Logger.getLogger();

    describe("#parseReqParams",function(){
        logger.parseReqParams(request,response);
        it('content_length',function(){
            assert.equal(20,logger.params['CONTENT_LENGTH']);
        })
        it('status',function(){
            assert.equal(200,logger.params['STATUS']);
        })
        it('http_host',function(){
            assert.equal('host.baidu.com',logger.params['HTTP_HOST']);
        })

        respose = null;
        it('parseReqParams should return false',function(){
            assert.equal(false,logger.parseReqParams(request,respose));
        })
    })

    //测试LogID是否正常
    describe('#getLogID',function(){
        it('params Logid',function(){
            logger.params['LogId']=123;
            assert.equal(123,logger.getLogID());
        })

        it('http_x_bd_logid',function(){
            delete logger.params['LogId'];
            assert.equal(456,logger.getLogID(request));
        })

        it('query.logid',function(){
            delete request.headers.HTTP_X_BD_LOGID;
            assert.equal(789,logger.getLogID(request));
        })

        it('cookie logid',function(){
            delete request.query.logid;
            logger.params['COOKIE'] = "name=app_test;logid=111;SECURE";
            assert.equal(111,logger.getLogID(request));
        })

        it('random logid',function(){
            delete logger.params['COOKIE'];
            var logid = logger.getLogID();
        })
    })

    describe('#setParams',function(){
        logger.setParams('name','wfg');
        it('set params',function(){
            assert.equal('wfg',logger.params['name']);
        })
    })

    describe('#getLogPrefix',function(){
        logger.opts['IS_ODP']=false;
        it('should unkonw',function(){
            assert.equal('unknow',logger.getLogPrefix());
        })
    })

    describe('#writeLog',function(){
        it('test writeLog',function(){
            var options = {'custom':{'key1':'value1','key2':'value2'},'errno' : '123','msg' : 'shouldbereplace'};
            var intLevel = logger.getLogLevelInt('abc');
            var format;
            assert.equal(false,logger.writeLog(intLevel,options,format));
            intLevel = logger.getLogLevelInt('WARNING');
            delete logger.format['DEFAULT'];
            assert.equal(false,logger.writeLog(intLevel,options,format));
            format = "%{u_err_msg}x";
            var str = 'shouldbereplace\n';
            logger.warning(options);
            logger.opts['debug']=1;
            logger.writeLog(intLevel,options,format);
            assert.equal(str,logger.getLogString(format));
        })
    })

    describe('#parseFormat',function(){
        it('test parseFormat',function(){
            logger.params['CLIENT_IP']="127.0.0.1";
            logger.params['SERVER_ADDR'] = 'server addr';
            logger.params['HTTP_COOKIE'] = request.headers['cookie'];
            logger.params['SERVER_PORT'] = '8000';
            logger.params['QUERY_STRING'] = 'debug=1';
            logger.params['HOSTNAME'] = 'wfg';
            logger.params['HTTP_HOST'] = 'http_host';
            logger.params['LineNumber'] = 1;
            logger.params['FunctionName'] = 'myFunction';
            logger.params['log_level'] = 'warning';
            var format = "%{log_level}x %e %T: [logid=%{log_id}x client_ip=%a server_addr=%A %{}C server_port=%p query_string=%q hostname=%v http_host=%V LineNumber=%{line}x FunctionName=%{function}x]"
            var str = 'WARNING  : [logid=- client_ip=127.0.0.1 server_addr=server addr test=1; server_port=8000 query_string=debug=1 hostname=wfg http_host=http_host LineNumber=1 FunctionName=myFunction]\n';
            assert.equal(str,logger.getLogString(format));
        })
    })
})

//测试yog-log应用于express框架
describe('module', function(){
    it('test express',function(done){
        var conf = {"level" : 16, //线上一般填4，参见配置项说明
            "app": "app_name", //app名称，产品线或项目名称等
            "log_path": __dirname+"/data/log",//日志存放地址'
            "data_path" :__dirname+ "/"
        };
        app.use(Logger(conf));
        app.use(function(req,res){
            res.send('hello');
            done();
        });
        app.listen(8827);
        var options = {
            hostname: '127.0.0.1',
            port: 8827,
            path: '/',
            method: 'POST'
        };
        var req = http.request(options, function(res) {
        });
        req.on('error', function(e) {
        });
        req.write('data\n');
        req.write('data\n');
        req.end();
    })
})
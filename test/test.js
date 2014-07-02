
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
            assert.equal(escape('test log'),logger.params['error_msg'] );
            assert.equal('WARNING', logger.params['current_level']);

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


    //测试应用名称及是否使用子文件夹配置
    describe('#app', function(){
        it('should use app name for log dir',function(){
            var app = 'apptest';
            var logger = Logger.getLogger({'app' : app});
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
            var logger = Logger.getLogger({'app' : app,'access_log_path' : access_log_path });
            logger.log("ACCESS"); 
            var pathname = path.dirname(access_log_path);   
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
        var str ="NOTICE: [-:-] errno[123] logId[-] uri[/test/test2] user[] refer[http://www.baidu.com] cookie[c1=cookie1;c2=cookie2]  error\n";
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

    //测试获取自定义项的配置
    it("#{u_xx}x custom item format",function(){
        var format = '%{u_err_msg}x'; 
        assert.equal("error\n",logger.getLogString(format));
    })
})
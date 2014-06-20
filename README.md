# Node Log 统计方案
---
## 这是什么

基于Node.js的日志统计方案，兼容ODP日志格式与配置。关于ODP的日志方案调研可查看[此文档](./doc/odp-log.md).

统计日志类型包括：

### server日志
 - access_log: web访问日志，按小时分日志
 - error_log: web错误日志，按小时分日志

访问日志统计方式为请求返还才触发。

### 应用日志
 - 每个app有各自独立的日志，日志名为app的名称，例如demo.log和demo.log.wf。
 - 可配置每个app是否使用独立的子目录存放自身日志，例如demo/demo.log。
 - 可配置每个app是否按小时切分日志。
 - 可配置每个app的日志级别。
 - 对于不属于任何app的php程序，日志名为unknown-app.log。

应用日志包括主动触发的统计以及未捕获的错误。

## 快速开始

1 npm全局安装yog-log,`npm install -g yog-log`

2 Node启动脚本中通过中间件方式使用yog-log,并传入日志配置参数。如下DEMO所示：
```javascript
var Logger = require('yog-log');
var app = express();
//...此处省去代码
app.use(Logger(config));//config为读取的日志配置参数
```

3 代码中res对象通过emit方式触发log事件，传递日志参数
```
//router层使用
try{
    //do something
}catch(e){
    res.emit('log',{'stack':e,'errno':120,'msg' :'error happened!'},'warning');
    //or res.emit('log',{'stack':e});//日志等级不写默认为notice
    //or res.emit('log','error!');//只写字符串不会解析错误堆栈
}

//model或其他没有res的地方使用
var logger = Logger.getLogger();
logger.log('warning','msg');//or logger.warning('msg');


```

## 日志配置

**默认配置**

默认配置与ODP日志保持一致，如下所示：


```
    # 日志级别
	#  1：打印FATAL
	#  2：打印FATAL和WARNING
	#  4：打印FATAL、WARNING、NOTICE（线上程序正常运行时的配置）
	#  8：打印FATAL、WARNING、NOTICE、TRACE（线上程序异常时使用该配置）
	# 16：打印FATAL、WARNING、NOTICE、TRACE、DEBUG（测试环境配置）
	level: 16

	# 是否按小时自动分日志，设置为1时，日志被打在some-app.log.2011010101
	auto_rotate: 1

	# 日志文件路径是否增加一个基于app名称的子目录，例如：log/some-app/some-app.log
	# 该配置对于unknown-app同样生效
	use_sub_dir: 1

	format: format: %L: %t [%f:%N] errno[%E] logId[%l] uri[%U] refer[%{referer}i] cookie[%{cookie}i] %S %M

	# 提供绝对路径，日志存放的根目录，只有非odp环境下有效
	log_path: /home/user/odp/log/
	# 提供绝对路径，日志格式数据存放的根目录，只有非odp环境下有效
	data_path: /home/user/odp/data/
	# 是否开启Omp日志, 0默认值（两个日志文件都开启），1，只打印omp的new日志，2只打印老日志
	is_omp: 0
```

**配置项说明**

配置项		| 默认值	| 说明
--------------- | ----- | ---------------
format		| 见下	| 参照format string格式
format_wf	| 见下	| 参照format string格式
level		| 16	| log日志级别
auto_rotate	| 1	| 是否自动切分
use_sub_dir	| 1	| 日志是否在二级目录打印，目录名为 `${APP_NAME}`
log_path	| 无	| 日志存放目录
data_path	| 无	| 格式数据存放的目录
is_omp		| 0	| 是否开启omp日志，如果不接入omp，建议置为2

注意 ： `is_omp`日志格式不完全兼容

完整日志格式配置项参考ODP LOG调研文档，部分指标支持不全，初期请勿修改格式配置参数

## 联系我们

邮件组： oak@baidu.com
联系人： zhangtao07@baidu.com、wangcheng@biadu.com


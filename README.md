# Node Log 统计方案
---
## 这是什么

这是yog框架的log统计模块，支持中间件或者单独使用等方式，兼容ODP日志格式与配置。关于ODP的日志方案调研可查看[此文档](./doc/odp-log.md).

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
 - 对于不属于任何app的node.js程序，日志名为unknown.log。


## 快速开始

### 1 初始化配置
```
var YLogger = require('yog-log');
var path = require('path');

var conf = {
  app: 'yog', //app名称，产品线或项目名称等
  log_path: path.join(__dirname, 'log'), //日志存放地址
  intLevel: 16 //线上一般填4，参见配置项说明
}

app.use(YLogger(conf));
```

填写此配置之后yog-log就开始统计访问日志。

### 2 调用接口统计应用日志

使用`getLogger`方法获取到日志模块实例，然后调用接口统计日志。

```javascript
var YLogger = require('yog-log');
var logger = YLogger.getLogger(); //默认通过domain获取，单独使用请传递config
logger.log('warning','msg');//or logger.warning('msg');
```


## 日志初始化配置项

配置项均有默认值，理论上不需要配置也能工作。推荐设置配置有：`level`、`app`、`log_path` 三项。

配置项		| 默认值	| 说明
--------------- | ----- | ---------------
app         | unknown    | app名称，推荐填写
format		| 见下	| 默认应用日志格式
format_wf	| 见下	| 默认的应用日志warning及fatal日志格式
intLevel		| 16	| log日志级别，高于此级别的日志不会输出
auto_rotate	| 1	| 是否自动切分
use_sub_dir	| 1	| 日志是否在二级目录打印，目录名为 `APP_NAME`
log_path	| 插件安装地址/log	| 日志存放目录，注意需要设置
data_path	| 插件安装地址/data	| 格式数据存放的目录，可不用设置
IS_OMP		| 0	| 是否开启omp日志，如果不接入omp，建议置为2
debug     | 0 | 是否使用debug模式直接在控制台输出日志

```

默认`format`:
%L: %t [%f:%N] errno[%E] logId[%l] uri[%U] user[%u] refer[%{referer}i] cookie[%{cookie}i] %S %M

默认的`format_wf `：
%L: %{%m-%d %H:%M:%S}t %{app}x * %{pid}x [logid=%l filename=%f lineno=%N errno=%{err_no}x %{encoded_str_array}x errmsg=%{u_err_msg}x]

```

## 应用日志等级

|    日志等级   |   数据编号  |    统计说明  |
|   ----      |     ----          |      ----          |
|  FATAL      |   1        | 打印FATAL |
| WARNING     |     2       | 打印FATAL和WARNING |
| NOTICE      |     4      | 打印FATAL、WARNING、NOTICE（线上程序正常运行时的配置） |
| TRACE       |    8      | 打印FATAL、WARNING、NOTICE、TRACE（线上程序异常时使用该配置）|
| DEBUG       |   16       | 打印FATAL、WARNING、NOTICE、TRACE、DEBUG（测试环境配 |

## response.emit(name,obj,level)

在router层使用emit方式可以避免每个文件都引入logger和获取实例。参数说明：

  - name ：日志事件名称，固定为'log'
  - obj： string或者object格式。如果是string，认为是错误消息。如果是object，请认为是详细信息。正确格式为{'stack':e,'msg':'msg','errno':'010'}，分别代表`错误堆栈`、`错误消息`、`错误码`。错误消息如果不填将使用错误堆栈的消息。
  - level ： 日志等级字符串，见上。不区分大小写，不写默认为notice

如下所示：

```javascript
res.emit('log',{'stack':e,'errno':120,'msg' :'error happened!'},'warning');
```

## getLogger(config)

当框架接收请求时，yog-log会新建一个实例，并保存到domain中，确保单次请求流程中调用的getLogger获取到的是同一个实例。

如果单独使用log不经过请求, getLogger会新建一个实例，此时应当传递config配置参数。

## log(level,obj)

提供统一的log方法打印日志。参数说明同response.emit。另外针对各个应用日志等级提供了相对应的方法。

请确保使用快捷方法时名称准确，否则程序将报错。

 - fatal   :  logger.fatal(obj)
 - warning : logger.warning(obj)
 - notice : logger.notice(obj)
 - trace : logger.trace(obj)
 - debug : logger.debug(obj)

`注意` ： logger为通过getLogger获取到的日志模块实例 。

**自定义错误消息**

如果想在日志中填写自定义的日志字段用于追查错误，请在obj中加入custom对象，然后按照键值对应放在custom中。如下所示：

```
 //router层
 res.emit('log',{
   'stack':e, //错误堆栈
   'errno':120,  //错误码
   'msg' :'error happened!',  //错误消息
   'custom':{'key1' :'value1','key2':'value2'} //自定义消息
 });

 //其他地方
 logger.log('warning', {
   'stack':e, //错误堆栈
   'errno':120,  //错误码
   'msg' :'error happened!',  //错误消息
   'custom':{'key1' :'value1','key2':'value2'} //自定义消息
 });

```
`注意`custom字段默认只会在`warning`和`fatal`日志中展现

生成的错误日志将会类似于下面的格式。其中可以看到custom字段已自动添加到日志中：

```
WARNING: 07-03 16:44:55 yd * - [logid=868855481 filename=D:\fis\test\models\doc.js lineno=25 errno=120 key1=value1 key2=value2 errmsg=error%20happened!]
```

## Debug支持

处于debug模式下Log将在控制台输出错误日志，并根据错误日志类型显示不同的颜色，方便开发人员调试(debug模式下依旧会写日志到文件)。有两种方法开启debug模式：

 - **开发时** ：yog的config.json的yogLogger `arguments`添加参数debug : 1 即开启debug模式
 - **线上** ： 无论在线上还是线下都可以在url中添加query参数`_node_debug=1` 开启debug模式


## 日志格式配置

yog-log兼容ODP支持灵活的日志格式配置，以满足不同系统对日志的格式要求。如接入OMP时warning日志格式配置：

```
%L: %{%m-%d %H:%M:%S}t %{app}x * %{pid}x [logid=%l filename=%f lineno=%N errno=%{err_no}x %{encoded_str_array}x errmsg=%{u_err_msg}x]
```

除非特殊情况，不建议随意修改日志格式配置。

格式配置方法如下：

字段	| 描述
------- | ----------------
%%	| 百分比字符串
%h	| name or address of remote-host
%t	| 时间戳，支持自定义格式如`%{%d/%b/%Y:%H:%M:%S %Z}t`
%i	| HTTP-header字段
%a	| 客户端IP
%A	| server address
%C	| 单个或全部cookie
%D	| 请求消耗时间/ms
%f	| 物理文件名称
%H	| 请求协议
%m	| 请求方法
%p	| 服务端端口
%q	| 请求query
%U	| 请求URL
%v	| HOSTNAME
%V	| HTTP_HOST
%L	| 当前日志等级
%N	| 错误发生行数
%E	| 错误码
%l	| LogID
%M	| 错误消息
%x	| 内置的自定义数据，有pid、cookie、encoded_str_array等


## 测试说明

单元测试说明详见[此文档](./test/README.md)

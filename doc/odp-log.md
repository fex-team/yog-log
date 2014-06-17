# Node Log方案调研
---

参考ODP日志类型，node方案中主要需要实现以下三类日志

## 日志类型

### server日志
 1. access_log: web访问日志，按小时分日志
 2. error_log: web错误日志，按小时分日志
 3. xx.log: 上次的启动错误信息，成功则清空

### node日志
注： node运行日志在server中自主添加，此处不作说明

### 应用日志
 - 每个app有各自独立的日志，日志名为app的名称，例如demo.log和demo.log.wf。
 - 可配置每个app是否使用独立的子目录存放自身日志，例如demo/demo.log。
 - 可配置每个app是否按小时切分日志。
 - 可配置每个app的日志级别。
 - 对于不属于任何app的php程序，日志名为unknown-app.log。

## server日志说明

server日志通过Node中间件实现，做一层简单的封装，暂时不支持格式配置，访问日志采用与现有方式统一的格式，错误日志格式待定。

### web访问日志

ODP默认lighttpd访问日志格式为：

```
"%h %l %u %t \"%r\" %>s %b \"%{Referer}i\" \"%{Cookie}i\" \"%{User-Agent}i\" %D"
```

nginx日志格式为：
```
'$remote_addr - $remote_user [$time_local] "$request" '
'$status $body_bytes_sent "$http_referer" "$http_cookie" "$http_user_agent" ' '$request_time $logid $tracecode'
```

两种服务器日志格式基本一致，按小时生成存放，日志示例如下：

```
127.0.0.1 - - [10/Jun/2014:22:01:34 +0800] "GET /question/149487428.html?fr=ala&word=%E6%AC%A7%E7%90%B3%E6%A9%B1%E6%9F%9C&bd_ts=1876010&bd_framework=1&bd_vip=1 HTTP/1.0" 200 164258 "-" "-" "mozila firefox 1.0.7" 0.232 0093913545 00939135452783909642061022
```



访问日志可采用express默认的log[中间件](https://github.com/expressjs/morgan)。支持格式配置，如下所示：

```javascript
exports.format('default', ':remote-addr - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"');

```


### web错误日志

如下所示：

```
2014/06/10 22:01:33 [notice] 15084#0: *67319 "^/+question/(\w+).*?$" matches "/question/93573827.html", client: 127.0.0.1, -,  -,  server: tc-iknow-fmon23.tc.baidu.com,  request: "GET /question/93573827.html?mzl=qb_xg_6&word=%E5%AD%95%E5%A6%87%E5%AD%95%E5%90%8C%E4%BD%8E&ssid=0&uid=0&fr=solved&step=4 HTTP/1.0",  -,  -,  host: "tc-iknow-fmon23.tc.baidu.com",  -,  -,  -,  -, 
```

对于错误日志，一些保证node服务零宕机的模块支持输出错误日志。如forever：

```bash
forever start -e err.log app.js //-e制定错误日志输出
```


## 应用日志说明

应用日志兼容现有ODP日志方案，初期实现其关键配置（全部日志配置及部分格式配置）。

### 配置项说明

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

ODP默认配置如下：

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


### 日志格式配置项

format string 格式字符串，取自 lighttpd 文档，第一个表格是ODP目前支持的配置。第二个表格，是 ODP Log 库扩展的功能

Option	| Description
------- | ----------------
%%	| a percent sign
%h	| name or address of remote-host
%t	| timestamp of the end-time of the request //param, show current time, param specifies strftime format
%i	| HTTP-header field //param
%a	| remote address
%A	| local address
%C	| cookie field (not supported) //param
%D	| time used in ms
%e	| environment variable //param
%f	| physical filename
%H	| request protocol (HTTP/1.0, ...)
%m	| request method (GET, POST, ...)
%p	| server port
%q	| query string
%T	| time used in seconds //support param, s, ms, us, default to s
%U	| request URL
%v	| server-name
%V	| HTTP request host name


ODP Log 库扩展的功能

Option	| Description
------- | --------------
%L	| Log level
%N	| line number
%E	| err_no
%l	| log_id
%u	| user
%S	| strArray, support param, takes a key and removes the key from %S
%M	| error message
%x	| ODP extension, supports various param, like log_level, line_number etc.

目前支持的 %x 扩展参数:

log_level, line, class, function, err_no, err_msg, log_id, app, function_param, argv, encoded_str_array in %x, prepend u_ to key to urlencode before its value

### 必须实现的配置(默认配置)

Option	| Description
------- | ----------------
%L	| 日志级别
%t	| 时间戳
%f      | 物理文件
%N      | 日志行数
%E      | 错误码
%l      | LogID
%U      | 请求URL
%S      | strArray, support param, takes a key and removes the key from %S
%M      | error message
%referer      | 请求referer
%cookie      | cookie

示例日志：
```
WARNING: 14-01-17 16:24:22 [/home/iknow/odp/php/phplib/bd/db/ConnMgr.php:336] errno[10007] logId[1462671896] uri[/uhome/api/answertask?req=status&ids=1178216,1178395,1178464,1178533,1178217,1178382,1178431,1178197,1178454,1178219,1178401,1178182,1178472,1178223,1178385,1178215,1178387,1178249,1178192,1178194,1178586,1178193,1178187,1178337,1178183,1178565,1178527&t=1389947063538] refer[http://tc-iknow-fmon23.tc.baidu.com:8080/uhome/task/answer] cookie[BAIDUID=569C327905368FD551D5B2A75FAB0528:FG=1; bdshare_firstime=1383557648820; Hm_lvt_b8a6bc2d9b2c98aa6f831e2a2eaefa7c=1384419205,1384771816,1385445007,1386654952; MCITY=-%3A; noah_magic_user_name=wangbibo; USER_NOAH=wangbibo; EXPIRE_NOAH=1390276643; SIG_NOAH=a568c3fd66d1d6a41171a7387e73992f; BDRCVFR[feWj1Vr5u3D]=I67x6TjHwwYf0; BDUSS=2hlVXZ2dERVcU5GTDdNeS1XSEhPOVZUUDdMSzhwVnJIOTlSQVljUWljRmQ4fjFTQVFBQUFBJCQAAAAAAAAAAAEAAADeuR43d2FuZ2JpYm82NgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAF1m1lJdZtZST; IK_USERVIEW=1; IK_CID_77=1; IK_CID_83=1; IK_CID_74=1; IK_CID_1031=2; IK_569C327905368FD551D5B2A75FAB0528=44; IK_CID_80=1; H_PS_PSSID=1462_4261_4759_4888_5047_5031; IM_old=0|hqj6ky88]  db_cluster[nik/pgc] db_host[10.38.120.57] db_port[5400] default_db[pgc] Connect to Mysql failed
```

### 接口说明

主要需要实现的接口如下

API	| Description
------- | ----------------
init	| 根据提供参数进行初始化
debug	| 日志接口
trace	| 日志接口
notice	| 日志接口
warning	| 日志接口
fatal	| 日志接口
addNotice	| 添加需要监视查看的变量或者数组，暂不实现
genLogID	| 获取日志ID，暂不实现
getClientIp     | 获取客户端IP，暂不实现

日志接口参数说明

参数	| 说明
------- | ----------------
str	| 必填，用户想要打印在 log 中的特定字符串
errno	| 错误码，默认值0 
arrArgs	| 用户想要打印在 log 中的和上下文有关的数组,默认为null
depth	| 深度，不实现




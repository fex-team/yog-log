#!/bin/bash

#三天内保存小时，一周之前的删除，三天到一周的保存天

logDir=/home/webspeed/test/access    #日志文件夹地址
start=`date +%Y%m%d -d '7 days ago'` #7天前
end=`date +%Y%m%d -d '3 days ago'`   #3天前

date=$start

tomo()
{
	echo  `date  +%Y%m%d  -d "$1 1 days"`;
}
end="`tomo $end`"

#删除7天前的日志
cd $logDir
find . -type f -mtime +7 -name "access.*" -exec rm -f {} \;


#3天到7天前的日志合成为一个文件删除小时数据

while [ "$date" != "$end" ] 
do
	#合并小时文件，天级别文件名为access.$date
	find -name "access.log.$date*" | sort | xargs cat > "access.$date"
	find -name "access.log.$date*" -exec rm -f {} \;
	date="`tomo $date`"
done
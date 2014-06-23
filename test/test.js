
var util = require('../lib/util.js');

console.log(util.strftime(new Date,'%Y-%m-%d %H:%M:%S %Z'));

util.strftime(new Date(),"%Y%m%d%H");

var obj = util.gettimeofday();
console.log(obj);
var logId = (((obj['sec']*100000 + obj['usec']/10) & 0x7FFFFFFF) || 0x80000000);


console.log(logId);

var util = require('../lib/util.js');

console.log(util.strftime(new Date,'%Y-%m-%d %H:%M:%S %Z'));

util.strftime(new Date(),"%Y%m%d%H");

var obj = util.gettimeofday();
var logId = (((obj['sec']*100000 + obj['usec']/10) & 0x7FFFFFFF) || 0x80000000);
console.log(logId);


Object.defineProperty(global, '__stack', {
  get: function(){
    var orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(_, stack){ return stack; };
    var err = new Error;
    Error.captureStackTrace(err, arguments.callee);
    var stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
  }
});

Object.defineProperty(global, '__line', {
  get: function(){
    return __stack[1].getLineNumber();
  }
});

console.log(__line);
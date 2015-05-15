var util = module.exports = function () {};


/**
 * Date#strftime(format) -> String
 * - format (String): Formats time according to the directives in the given format string. Any text not listed as a directive will be passed through to the output string.
 *
 * Ruby-style date formatting. Format matchers:
 *
 * %a - The abbreviated weekday name (``Sun'')
 * %A - The  full  weekday  name (``Sunday'')
 * %b - The abbreviated month name (``Jan'')
 * %B - The  full  month  name (``January'')
 * %c - The preferred local date and time representation
 * %d - Day of the month (01..31)
 * %e - Day of the month without leading zeroes (1..31)
 * %H - Hour of the day, 24-hour clock (00..23)
 * %I - Hour of the day, 12-hour clock (01..12)
 * %j - Day of the year (001..366)
 * %k - Hour of the day, 24-hour clock w/o leading zeroes (0..23)
 * %l - Hour of the day, 12-hour clock w/o leading zeroes (1..12)
 * %m - Month of the year (01..12)
 * %M - Minute of the hour (00..59)
 * %p - Meridian indicator (``AM''  or  ``PM'')
 * %P - Meridian indicator (``am''  or  ``pm'')
 * %S - Second of the minute (00..60)
 * %U - Week  number  of the current year,
 *      starting with the first Sunday as the first
 *      day of the first week (00..53)
 * %W - Week  number  of the current year,
 *      starting with the first Monday as the first
 *      day of the first week (00..53)
 * %w - Day of the week (Sunday is 0, 0..6)
 * %x - Preferred representation for the date alone, no time
 * %X - Preferred representation for the time alone, no date
 * %y - Year without a century (00..99)
 * %Y - Year with century
 * %Z - Time zone name
 * %z - Time zone expressed as a UTC offset (``-04:00'')
 * %% - Literal ``%'' character
 *
 * http://www.ruby-doc.org/core/classes/Time.html#M000298
 *
 **/
var strftime = require('fast-strftime');

util.strftime = function (date, format) {
    return strftime(format, date);
};

//javascript版本的preg_split
util.preg_split = function (pattern, subject, limit, flags) {
    // http://kevin.vanzonneveld.net
    // + original by: Marco Marchi??
    // * example 1: preg_split(/[\s,]+/, 'hypertext language, programming');
    // * returns 1: ['hypertext', 'language', 'programming']
    // * example 2: preg_split('//', 'string', -1, 'PREG_SPLIT_NO_EMPTY');
    // * returns 2: ['s', 't', 'r', 'i', 'n', 'g']
    // * example 3: var str = 'hypertext language programming';
    // * example 3: preg_split('/ /', str, -1, 'PREG_SPLIT_OFFSET_CAPTURE');
    // * returns 3: [['hypertext', 0], ['language', 10], ['programming', 19]]
    // * example 4: preg_split('/( )/', '1 2 3 4 5 6 7 8', 4, 'PREG_SPLIT_DELIM_CAPTURE');
    // * returns 4: ['1', ' ', '2', ' ', '3', ' ', '4 5 6 7 8']
    // * example 5: preg_split('/( )/', '1 2 3 4 5 6 7 8', 4, (2 | 4));
    // * returns 5: [['1', 0], [' ', 1], ['2', 2], [' ', 3], ['3', 4], [' ', 5], ['4 5 6 7 8', 6]]

    limit = limit || 0;
    flags = flags || ''; // Limit and flags are optional

    var result, ret = [],
        index = 0,
        i = 0,
        noEmpty = false,
        delim = false,
        offset = false,
        OPTS = {},
        optTemp = 0,
        regexpBody = /^\/(.*)\/\w*$/.exec(pattern.toString())[1],
        regexpFlags = /^\/.*\/(\w*)$/.exec(pattern.toString())[1];
    // Non-global regexp causes an infinite loop when executing the while,
    // so if it's not global, copy the regexp and add the "g" modifier.
    pattern = pattern.global && typeof pattern !== 'string' ? pattern :
        new RegExp(regexpBody, regexpFlags + (regexpFlags.indexOf('g') !== -1 ? '' : 'g'));

    OPTS = {
        'PREG_SPLIT_NO_EMPTY': 1,
        'PREG_SPLIT_DELIM_CAPTURE': 2,
        'PREG_SPLIT_OFFSET_CAPTURE': 4
    };
    if (typeof flags !== 'number') { // Allow for a single string or an array of string flags
        flags = [].concat(flags);
        for (i = 0; i < flags.length; i++) {
            // Resolve string input to bitwise e.g. 'PREG_SPLIT_OFFSET_CAPTURE' becomes 4
            if (OPTS[flags[i]]) {
                optTemp = optTemp | OPTS[flags[i]];
            }
        }
        flags = optTemp;
    }
    noEmpty = flags & OPTS.PREG_SPLIT_NO_EMPTY;
    delim = flags & OPTS.PREG_SPLIT_DELIM_CAPTURE;
    offset = flags & OPTS.PREG_SPLIT_OFFSET_CAPTURE;

    var _filter = function (str, strindex) {
        // If the match is empty and the PREG_SPLIT_NO_EMPTY flag is set don't add it
        if (noEmpty && !str.length) {
            return;
        }
        // If the PREG_SPLIT_OFFSET_CAPTURE flag is set
        //      transform the match into an array and add the index at position 1
        if (offset) {
            str = [str, strindex];
        }
        ret.push(str);
    };
    // Special case for empty regexp
    if (!regexpBody) {
        result = subject.split('');
        for (i = 0; i < result.length; i++) {
            _filter(result[i], i);
        }
        return ret;
    }
    // Exec the pattern and get the result
    while (result = pattern.exec(subject)) {
        // Stop if the limit is 1
        if (limit === 1) {
            break;
        }
        // Take the correct portion of the string and filter the match
        _filter(subject.slice(index, result.index), index);
        index = result.index + result[0].length;
        // If the PREG_SPLIT_DELIM_CAPTURE flag is set, every capture match must be included in the results array
        if (delim) {
            // Convert the regexp result into a normal array
            var resarr = Array.prototype.slice.call(result);
            for (i = 1; i < resarr.length; i++) {
                if (result[i] !== undefined) {
                    _filter(result[i], result.index + result[0].indexOf(result[i]));
                }
            }
        }
        limit--;
    }
    // Filter last match
    _filter(subject.slice(index, subject.length), index);
    return ret;
}

util.microtime = function (get_as_float) {
    //  discuss at: http://phpjs.org/functions/microtime/
    // original by: Paulo Freitas
    //   example 1: timeStamp = microtime(true);
    //   example 1: timeStamp > 1000000000 && timeStamp < 2000000000
    //   returns 1: true

    var now = new Date()
        .getTime() / 1000;
    var s = parseInt(now, 10);

    return (get_as_float) ? now : (Math.round((now - s) * 1000) / 1000) + ' ' + s;
}


util.gettimeofday = function (return_float) {
    //  discuss at: http://phpjs.org/functions/gettimeofday/
    // original by: Brett Zamir (http://brett-zamir.me)
    // original by: Josh Fraser (http://onlineaspect.com/2007/06/08/auto-detect-a-time-zone-with-javascript/)
    //    parts by: Breaking Par Consulting Inc (http://www.breakingpar.com/bkp/home.nsf/0/87256B280015193F87256CFB006C45F7)
    //  revised by: Theriault
    //   example 1: gettimeofday();
    //   returns 1: {sec: 12, usec: 153000, minuteswest: -480, dsttime: 0}
    //   example 2: gettimeofday(true);
    //   returns 2: 1238748978.49

    var t = new Date(),
        y = 0;

    if (return_float) {
        return t.getTime() / 1000;
    }

    // Store current year.
    y = t.getFullYear();
    return {
        //sec: t.getUTCSeconds(),
        sec: parseInt(t / 1000),
        usec: t.getMilliseconds(),
        minuteswest: t.getTimezoneOffset(),
        // Compare Jan 1 minus Jan 1 UTC to Jul 1 minus Jul 1 UTC to see if DST is observed.
        dsttime: 0 + (((new Date(y, 0)) - Date.UTC(y, 0)) !== ((new Date(y, 6)) - Date.UTC(y, 6)))
    };
}

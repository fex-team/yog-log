

var util = module.exports = function(){};


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
  
  util.strftime = function(date,format){
    var cache = {'start_of_year': new Date("Jan 1 " + (new Date()).getFullYear())},
        regexp = /%([a-z]|%)/mig,
        day_in_ms = 1000 * 60 * 60 * 24,
        days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        abbr_days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        abbr_months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        formats = {
          'a': weekday_name_abbr,
          'A': weekday_name,
          'b': month_name_abbr,
          'B': month_name,
          'c': default_local,
          'd': day_padded,
          'e': day,
          'H': hour_24_padded,
          'I': hour_padded,
          'j': day_of_year,
          'k': hour_24,
          'l': hour,
          'm': month,
          'M': minute,
          'p': meridian_upcase,
          'P': meridian,
          'S': second,
          'U': week_number_from_sunday,
          //'W': week_number_from_monday,
          'w': day_of_week,
          'x': default_local_date,
          'X': default_local_time,
          'y': year_abbr,
          'Y': year,
          'Z': time_zone_name,
          'z': time_zone_offset,
          '%': function() { return '%'; }
        };
    
    // day
    function day(date) {
      return date.getDate() + '';
    }
    
    // day_of_week
    function day_of_week(date) {
      return date.getDay() + '';
    }
    
    // day_of_year
    function day_of_year(date) {
      return (((date.getTime() - cache['start_of_year'].getTime()) / day_in_ms + 1) + '').split(/\./)[0];
    }
    
    // day_padded
    function day_padded(date) {
      return ('0' + day(date)).slice(-2);
    }
    
    // default_local
    function default_local(date) {
      return date.toLocaleString();
    }
    
    // default_local_date
    function default_local_date(date) {
      return date.toLocaleDateString();
    }
    
    // default_local_time
    function default_local_time(date) {
      return date.toLocaleTimeString();
    }
    
    // hour
    function hour(date) {
      var hour = date.getHours();
      
      if (hour === 0) hour = 12;
      else if (hour > 12) hour -= 12;
      
      return hour + '';
    }
    
    // hour_24
    function hour_24(date) {
      return date.getHours();
    }
    
    // hour_24_padded
    function hour_24_padded(date) {
      return ('0' + hour_24(date)).slice(-2);
    }
    
    // hour_padded
    function hour_padded(date) {
      return ('0' + hour(date)).slice(-2);
    }
    
    // meridian
    function meridian(date) {
      return date.getHours() >= 12 ? 'pm' : 'am';
    }
    
    // meridian_upcase
    function meridian_upcase(date) {
      return meridian(date).toUpperCase();
    }
    
    // minute
    function minute(date) {
      return ('0' + date.getMinutes()).slice(-2);
    }
    
    // month
    function month(date) {
      return ('0'+(date.getMonth()+1)).slice(-2);
    }
    
    // month_name
    function month_name(date) {
      return months[date.getMonth()];
    }
    
    // month_name_abbr
    function month_name_abbr(date) {
      return abbr_months[date.getMonth()];
    }
    
    // second
    function second(date) {
      return ('0' + date.getSeconds()).slice(-2);
    }

    var _xPad = function(x, pad, r) {
      if (typeof r === 'undefined') {
        r = 10;
      }
      for (; parseInt(x, 10) < r && r > 1; r /= 10) {
        x = pad.toString() + x;
      }
      return x.toString();
    }

    function time_zone_name(date){
      var o = date.getTimezoneOffset();
      var H = _xPad(parseInt(Math.abs(o / 60), 10), 0);
      var M = _xPad(o % 60, 0);
      return (o > 0 ? '-' : '+') + H + M;
    }
    
    // time_zone_offset
    function time_zone_offset(date) {
      var tz_offset = date.getTimezoneOffset();
      //return (tz_offset >= 0 ? '-' : '') + ('0' + (tz_offset / 60)).slice(-2) + ':' + ('0' + (tz_offset % 60)).slice(-2);
      return date.toString().match(/([-\+][0-9]+)\s/)[1];
    }
    
    // week_number_from_sunday
    function week_number_from_sunday(date) {
      return ('0' + Math.round(parseInt(day_of_year(date), 10) / 7)).slice(-2);
    }
    
    // weekday_name
    function weekday_name(date) {
      return days[date.getDay()];
    }
    
    // weekday_name_abbr
    function weekday_name_abbr(date) {
      return abbr_days[date.getDay()];
    }
    
    // year
    function year(date) {
      return date.getFullYear() + '';
    }
    
    // year_abbr
    function year_abbr(date) {
      return year(date).slice(-2);
    }
    
    /*------------------------------ Main ------------------------------*/
    if(!format){
      format = '%Y-%m-%d %H:%M:%S';
    }
    var match, output = format;
    cache['start_of_year'] = new Date("Jan 1 " + date.getFullYear());
    
    while (match = regexp.exec(format)) {
      if (match[1] in formats) output = output.replace(new RegExp(match[0], 'mg'), formats[match[1]](date));
    }
    
    return output;
    
  }


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

    limit = limit || 0; flags = flags || ''; // Limit and flags are optional

    var result, ret=[], index=0, i = 0,
        noEmpty = false, delim = false, offset = false,
        OPTS = {}, optTemp = 0,
        regexpBody = /^\/(.*)\/\w*$/.exec(pattern.toString())[1],
        regexpFlags = /^\/.*\/(\w*)$/.exec(pattern.toString())[1];
        // Non-global regexp causes an infinite loop when executing the while,
        // so if it's not global, copy the regexp and add the "g" modifier.
        pattern = pattern.global && typeof pattern !== 'string' ? pattern :
            new RegExp(regexpBody, regexpFlags+(regexpFlags.indexOf('g') !==-1 ? '' :'g'));

    OPTS = {
        'PREG_SPLIT_NO_EMPTY': 1,
        'PREG_SPLIT_DELIM_CAPTURE': 2,
        'PREG_SPLIT_OFFSET_CAPTURE': 4
    };
    if (typeof flags !== 'number') { // Allow for a single string or an array of string flags
        flags = [].concat(flags);
        for (i=0; i < flags.length; i++) {
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

    var _filter = function(str, strindex) {
        // If the match is empty and the PREG_SPLIT_NO_EMPTY flag is set don't add it
        if (noEmpty && !str.length) {return;}
        // If the PREG_SPLIT_OFFSET_CAPTURE flag is set
        //      transform the match into an array and add the index at position 1
        if (offset) {str = [str, strindex];}
        ret.push(str);
    };
    // Special case for empty regexp
    if (!regexpBody){
        result=subject.split('');
        for (i=0; i < result.length; i++) {
            _filter(result[i], i);
        }
        return ret;
    }
    // Exec the pattern and get the result
    while (result = pattern.exec(subject)) {
        // Stop if the limit is 1
        if (limit === 1) {break;}
        // Take the correct portion of the string and filter the match
        _filter(subject.slice(index, result.index), index);
        index = result.index+result[0].length;
        // If the PREG_SPLIT_DELIM_CAPTURE flag is set, every capture match must be included in the results array
        if (delim) {
            // Convert the regexp result into a normal array
            var resarr = Array.prototype.slice.call(result);
            for (i = 1; i < resarr.length; i++) {
                if (result[i] !== undefined) {
                    _filter(result[i], result.index+result[0].indexOf(result[i]));
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

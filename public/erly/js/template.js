/*!
 * Date formatting
 */

(function(erly) {
  /**
   * @private
   * @const
   */
  var DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];

  /**
   * @private
   * @const
   */
  var SHORT_DAYS = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat"
  ];

  /**
   * @private
   * @const
   */
  var SHORT_MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];

  /**
   * @private
   * @const
   */
  var MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  var dateUtil = {};
  dateUtil.MILLISECOND = 1;
  dateUtil.SECOND      = 1000 * dateUtil.MILLISECOND;
  dateUtil.MINUTE      = 60 * dateUtil.SECOND;
  dateUtil.HOUR        = 60 * dateUtil.MINUTE;
  dateUtil.DAY         = 24 * dateUtil.HOUR;

  dateUtil.getNextDay = function(date) {
    var nextDay = new Date(date.getTime() + dateUtil.DAY);
    nextDay.setHours(0, 0, 0, 0);
    return nextDay;
  };

  erly.dateUtil = dateUtil;

  $.fn.prettyDate = function(now) {
    return this.each(function() {
      var date = erly.dateFormatters.prettyDate(erly.normalizeDate(this.title), now);

      if (date) {
        jQuery(this).text(date);
      }
    });
  };

  var dateFormatters = {};
  dateFormatters.gallery = function(date) {
    date = erly.normalizeDate(date);
    return MONTHS[date.getMonth()] + " " + date.getFullYear();
  };

  dateFormatters.isoUTCFormat = function(date) {
    return [
      [
        date.getUTCFullYear(),
        erly.util.pad(date.getUTCMonth() + 1),
        erly.util.pad(date.getUTCDate())
      ].join('-'),
      [
        erly.util.pad(date.getUTCHours()),
        erly.util.pad(date.getUTCSeconds()),
        erly.util.pad(date.getUTCMinutes())
      ].join(':')
    ].join('T') + 'Z';
  };

  /*
   * JavaScript Pretty Date
   * Copyright (c) 2008 John Resig (jquery.com)
   * Licensed under the MIT license.
   * Modified to take a date instead of an ISO time as a string
   */
  dateFormatters.prettyDate = function(date, now) {
    now = now || erly.now;

    var diff = (((now).getTime() - date.getTime()) / 1000),
        day_diff = Math.floor(diff / 86400);

    if ( isNaN(day_diff) || day_diff < 0) {
      return;
    }

    return day_diff === 0 && (
           diff < 60 && "just now" ||
           diff < 120 && "1 minute ago" ||
           diff < 3600 && Math.floor( diff / 60 ) + " minutes ago" ||
           diff < 7200 && "1 hour ago" ||
           diff < 86400 && Math.floor( diff / 3600 ) + " hours ago") ||
           day_diff === 1 && "Yesterday" ||
           day_diff < 7 && day_diff + " days ago" ||
           day_diff === 7 && "1 week ago" ||
           day_diff < 31 && Math.ceil( day_diff / 7 ) + " weeks ago" ||
           erly.dateFormatters.formatDate(date);
  };

  /**
   * Formats a date span using the the shortest of the following:
   *
   *  - Month D, YYYY - Month D, YYYY
   *  - Month D - Month D, YYYY
   *  - Month D - D, YYYY
   *
   * @param {Date} from
   * @param {Date} to
   * @returns {String}
   */
  dateFormatters.dateSpan = function(from, to) {
    from = {
      y: from.getFullYear(),
      m: from.getMonth(),
      d: from.getDate()
    };
    to = {
      y: to.getFullYear(),
      m: to.getMonth(),
      d: to.getDate()
    };

    if (from.m !== to.m || to.y !== from.y) {

      if (to.y !== from.y) {
        // Month D, YYYY - Month D, YYYY
        return [
          MONTHS[from.m], ' ', from.d, ', ', from.y,
          ' - ',
          MONTHS[to.m], ' ', to.d, ', ', to.y
        ].join('');
      }
      else {
        // Month D - Month D, YYYY
        return [
          MONTHS[from.m], ' ', from.d,
          ' - ',
          MONTHS[to.m], ' ', to.d, ', ',
          from.y
        ].join('');
      }
    }
    else {
      // Month D - D, YYYY
      return [
        MONTHS[from.m], ' ', from.d, ' - ', to.d, ', ', from.y
      ].join('');
    }
  };

  dateFormatters.fullMonthAndYear = function(date) {
    date = erly.normalizeDate(date);
    return MONTHS[date.getMonth()] + " " + date.getFullYear();
  };

  /*
   * Template helpers
   */
  erly.formatDuration = function(seconds) {
    seconds = parseInt(seconds, 10);
    if (isNaN(seconds)) { return null; }
    var sec = seconds % 60;
    var minutes = Math.floor(seconds / 60) % 60;
    var hours = Math.floor(seconds / 3600);
    var durationString = "";
    if (sec < 10) {
      durationString = ":0" + sec;
    } else {
      durationString = ":" + sec;
    }
    if (minutes < 10) {
      durationString = "0" + minutes + durationString;
    } else {
      durationString = minutes + durationString;
    }
    if (hours > 0) {
      durationString = hours + ":" + durationString;
    }
    return '(' + durationString + ')';
  };

  /*
   * Formats for display in the 'Source:' portion of a link card
   */
  erly.getLinkSource = function(url) {
    var lastSlashIndex = url.indexOf("/", 8);
    if (lastSlashIndex === -1) {
      return url;
    }

    return url.substring(0, lastSlashIndex);
  };

  dateFormatters.formatDate = function(date) {
    date = erly.normalizeDate(date);

    return DAYS[date.getDay()] + ", " + MONTHS[date.getMonth()] + " " +
      date.getDate() + ", " + date.getFullYear();
  };

  dateFormatters.formatDateTime = function(date) {
    date = erly.normalizeDate(date);

    return DAYS[date.getDay()] + ", " + MONTHS[date.getMonth()] + " " +
      date.getDate() + ", " + date.getFullYear() + ' at ' +
      dateFormatters.formatAlarmClock(date);
  };

  dateFormatters.formatDateMedium = function(date) {
    date = erly.normalizeDate(date);
    return MONTHS[date.getMonth()] + " " + date.getDate() +
      ", " + date.getFullYear();
  };

  dateFormatters.formatDateShort = function(date) {
    date = erly.normalizeDate(date);
    return SHORT_MONTHS[date.getMonth()] + " " +
           date.getDate() + ", " +
           date.getFullYear();
  };

  dateFormatters.formatDateShortDayShortMonth = function(date) {
    date = erly.normalizeDate(date);

    return SHORT_DAYS[date.getDay()] + ", " + SHORT_MONTHS[date.getMonth()] + " " +
      date.getDate() + ", " + date.getFullYear();
  };

  dateFormatters.getShortMonth = function(date) {
    date = erly.normalizeDate(date);
    return SHORT_MONTHS[date.getMonth()];
  };

  dateFormatters.formatDateShortNoYear = function(date) {
    date = erly.normalizeDate(date);
    return SHORT_MONTHS[date.getMonth()] + " " + date.getDate();
  };

  dateFormatters.formatDateShortNoYearTimespans = function(date1, date2) {
    date1 = erly.normalizeDate(date1);
    date2 = erly.normalizeDate(date2);

    if (date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth()) {
      // don't duplicate the month
      return erly.dateFormatters.formatDateShortNoYear(date1) + " - " + date2.getDate();
    } else {
      return erly.dateFormatters.formatDateShortNoYear(date1) + " - " + erly.dateFormatters.formatDateShortNoYear(date2);
    }
  };

  dateFormatters.formatDateSlashes = function(date) {
    date = erly.normalizeDate(date);
    return date.getMonth() + 1 + "/" + date.getDate() + "/" + date.getFullYear();
  };

  dateFormatters.formatAlarmClock = function(date) {
    date = erly.normalizeDate(date);

    var hour = date.getHours();
    var minute = date.getMinutes();
    var meridian;

    if (hour === 12) {
      hour = 12;
      meridian = "pm";
    } else if (hour === 24 || hour === 0) {
      hour = 12;
      meridian = "am";
    } else if (hour >= 12) {
      hour -= 12;
      meridian = "pm";
    } else {
      meridian = "am";
    }

    minute = minute.toString();

    if (minute.length === 1) {
      minute = "0" + minute;
    }

    return hour + ":" + minute + " " + meridian;
  };

  dateFormatters.countDaysInFuture = function(date, now) {
    var diff = date - now;

    if (diff < 0) {
      return 0;
    }

    var meridianAddition = 0;
    var numberOfDays = diff / dateUtil.DAY;
    var nextDay = dateUtil.getNextDay(now);
    var endOfToday = new Date(nextDay.getTime() - 1);

    // We need to add an extra day if our remainder
    // is greater than the amount of the day left.
    // This way, if we are looking at an event less than
    // 24 hours later (but truely tomorrow), we'll see
    // that it is tomorrow
    if ((numberOfDays - Math.floor(numberOfDays)) >
        (endOfToday - now) / dateUtil.DAY) {
      meridianAddition = 1;
    }

    return Math.floor(numberOfDays) + meridianAddition;
  };

  /*
   * Return true if the dates are on the same day.
   */
  dateFormatters.sameDay = function(date1, date2) {
    date1 = erly.normalizeDate(date1);
    date2 = erly.normalizeDate(date2);
    return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  };

  erly.dateFormatters = dateFormatters;
}(erly));

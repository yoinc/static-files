/*global global: true, exports: true */
/*!
 * Utility functions
 */

(function(erly) {
  var util = {};

  /**
   * Pad `num` to `n` characters using `c`.
   *
   * @param {Object} num
   * @param {Number} n (optional, defaults to 2)
   * @param {String} c (optional, defaults to 0)
   * @returns {String}
   */
  util.pad = function(num, n, c) {
    c = c || '0';
    n = n || 2;

    var s = num.toString();
    // if n <= 0, the loop never executes
    n = n - s.length;
    var i = 0;
    for (; i < n; i++) {
      s = c + s;
    }

    return s;
  };

  util.favicon = function(url) {
    if (/^(https?:\/\/[^\/]+)/.test(url)) {
      var ico = RegExp.$1 + '/favicon.ico';
      return '<img class="favicon" onerror="$(this).hide()" src="' + ico + '" alt="photo" />';
    }
    return '';
  };

  /**
   * Filters things in photo captions.  Right now it removes captions which
   * start with IMG and have length less than 20 chars.  But we can expand
   * this to do potty mouth filtering, etc
   * @param {String} caption
   * @returns {String}
   */
  util.filterCaption = function(caption) {
    if (!caption) { return ''; }
    caption = $.trim(caption);
    if (caption.length < 20) {
      if (caption.indexOf('IMG') === 0) { return ''; }
      if (caption.indexOf('IMAG') === 0) { return ''; }
      if (/^.?DSC/.test(caption)) { return ''; }
      if (/^PICT\d+/i.test(caption)) { return ''; }
      if (/^Picture\s+\d+/i.test(caption)) { return ''; }
      if (/^_MG_/i.test(caption)) { return ''; }
      if (/^MVI_/i.test(caption)) { return ''; }
      if (/^P_?\d+$/i.test(caption)) { return ''; }
      if (/^L\d+$/i.test(caption)) { return ''; }
      if (/\.JPG$/i.test(caption)) { return ''; }
      if (/\.MOV$/i.test(caption)) { return ''; }
      if (/\.AVI$/i.test(caption)) { return ''; }
      if (/^\d+_\d+$/i.test(caption)) { return ''; }
      if (/img_\d+/i.test(caption)) { return ''; }
    }
    return caption;
  };

  /**
   * Converts `geouri` (in format described by
   * http://tools.ietf.org/html/rfc5870#section-3.1) to a Google staticmap with
   * the given height/width.  If `geouri` doesn't match spec, the empty string
   * is returned.
   *
   * @param {String} geouri
   * @param {Number} w
   * @param {Number} h
   * @returns {String}
   */
  util.convertGeoUriToUrl = function(geouri, w, h) {
    if (!/^geo:([0-9\.]+),([0-9\.]+);?/.test(geouri)) {
      var size = encodeURIComponent([w, h].join('x'));
      var latlng = encodeURIComponent([RegExp.$1, RegExp.$2].join(','));

      return [
        'http://maps.googleapis.com/maps/api/staticmap?zoom=14&sensor=false',
        '&size=', size,
        '&markers=', latlng,
        '&center=', latlng
      ].join('');
    }
    else {
      return '';
    }
  };

  util.cssPixels = {};
  util.cssPixels.get = function(jq, propName) {
    jq = $(jq);
    var val = jq.css(propName);

    if (val) {
      return parseInt(jq.css(propName).replace('px', ''), 10);
    }

    return 0;
  };

  util.cssPixels.set = function(obj, attr, val) {
    return $(obj).css(attr, val + 'px');
  };

  erly.cssPixels = util.cssPixels.get;

  /**
   * http://daringfireball.net/2010/07/improved_regex_for_matching_urls
   *
   * @const
   * @api public
   */
  util.URL_REGEX = new RegExp(
    '\\b((?:[a-z][a-z0-9_\\-]+:(?:/{1,3}|[a-z0-9%])|www[0-9]{0,3}\\.|' +
    '[a-z0-9.\\-]+\\.[a-z]{2,4}/)(?:[^ ()<>]+|\\(([^ ()<>]' +
    '+|(\\([^ ()<>]+\\)))*\\))+(?:\\(([^ ()<>]+|(\\([^ ()<>]' +
    '+\\)))*\\)|[^ `!()\\[\\]{};:\'".,<>?«»“”‘’]))', 'gi');

  /**
   * Replaces all matching links in `text` with html links
   *
   * @param {String} text
   * @returns {String}
   */
  util.linkify = function(text) {
    var result = text.replace(util.URL_REGEX, function(str, p1) {
      var href = p1.indexOf('http') === -1 ? 'http://' + p1 : p1;

      return '<a target="blank" href="' + href + '">' + p1 + '</a>';
    });
    return result;
  };


  /**
   * Returns `'{n} {singular or plural}'`.  If `plural` isn't given, `singular`
   * will be used with an 's' added to the end.
   *
   * @param {Number} n
   * @param {String} singular
   * @param {String} plural
   * @returns {String}
   */
  util.pluralize = function(n, singular, plural) {
    plural = typeof plural === 'undefined' ? singular + 's' : plural;
    return [
      n.toString(10),
      n === 1 ? singular : plural
    ].join(' ');
  };

  /**
   * @private
   * @const
   */
  var FORMATS = [
    'D, M d, yy',
    'd M y', 'd M yy', 'd MM y', 'd MM yy',
    'd m/y', 'd m/yy', 'd mm/yy', 'd mm/yy',
    'm/d/y', 'm/d/yy', 'yy'
  ];

  /**
   * Attempts to parse `value` according to multiple date formats and returns
   * a `Date` if successful, `null` otherwise.  Only works on *dates*, it does
   * not currently parse times.
   *
   * @param {String} value
   * @returns {Date}
   * @api public
   */
  util.parseDate = function(value, count) {
    var date = null;
    var i = 0;
    for (; i < FORMATS.length; i++) {
      try {
        date = $.datepicker.parseDate(FORMATS[i], value);
        break;
      }
      catch(e) {
        date = null;
      }
    }

    if (!date) {
      count = typeof count === 'undefined' ? 0 : count;
      if (count === 0) {
        return util.parseDate('1 ' + value, count + 1);
      }
      else if (count === 1) {
        value = value.split(' ');
        value = value[value.length - 1];
        return util.parseDate('1 Jan ' + value, count + 1);
      }
    }

    return date;
  };

  /**
   * Sets common focus/keypress events for datepicker-enabled inputs.
   *
   * @param {Object} date
   * @api public
   */
  util.setCommonDatePickerEvents = function(date) {
    date.focus(_(function() {
      $(this).select();
    }).debounce(100));

    date.keypress(_(function() {
      var value = $(this).val();
      var date = util.parseDate(value);
      if (date) {
        $(this).datepicker('setDate', date);
      }
    }).debounce(1500));
  };

  /**
   * Class that implements an incremental barrier: constructor takes a done
   * callback.  Any number of callbacks may be added with GetCallback(), which
   * returns a callback.  After Prepare() is called, the done callback is run
   * after all callbacks added with GetCallback() have completed (or immediately
   * if no callbacks have been added).
   * Sample usage:
   *   ib = new IncrementalBarrier(done);
   *   asyncCall1(ib.GetCallback());
   *   asyncCall2(ib.GetCallback());
   *   ib.Prepare();  // runs done after asyncCall1 and asyncCall2 are done
   */
  util.IncrementalBarrier = function(done) {
    this._done = done;
    this._count = 1;
    this._prepared = false;
    var _self = this;

    this._DecrementMaybeRun = function() {
      _self._count--;
      if (_self._count === 0) {
        _self._done();
        _self._done = null;
      }
    };

    this.Prepare = function() {
      if (_self._prepared) {
        console.log('cannot call Prepare twice');
      }
      _self._prepared = true;
      _self._DecrementMaybeRun();
    };

    this.GetCallback = function() {
      if (_self._prepared) {
        console.log('cannot call GetCallback once prepared');
        return null;
      }
      _self._count++;
      return _self._DecrementMaybeRun;
    };
  };

  // Helper, see comment below.  This function is shared between client and
  // server.  'dateField' is usually a Date on the server and client (the
  // client immediately calls normalize when it receives the event from the
  // server).
  function getDateForDisplay(event, dateField, offsetMin) {
    var ms;
    if (typeof dateField === 'number') {
      ms = dateField;
    } else if (dateField instanceof Date) {
      ms = dateField.getTime();
    } else {
      ms = (new Date(dateField)).getTime();
    }

    // Account for the UTC offset.
    if (typeof offsetMin !== 'undefined') {
      // Offset in minutes.
      ms -= offsetMin * 60 * 1000;
    } else if (event.hasOwnProperty('utcOffset')) {
      // Deprecated offset in negative hours. TODO(walt): remove later.
      ms += event.utcOffset * 60 * 60 * 1000;
    } else {
      // No offset; must be a legacy event.  Log an error if it was created
      // after Dec 1, when we first supported offsets, and then display in
      // the user's local timezone.
      if (erly.normalizeDate && erly.trackException) {
        if (erly.normalizeDate(event.createdAt) > new Date(2011, 11, 1)) {
          erly.trackException(new Error(
            'Event ' + (event.id || '?') + ' has no UTC offset'),
            'util.js@getDateForDisplay');
        }
      }

      return new Date(ms);
    }

    // 'd' now has the values we want in UTC; convert so they are in the local
    // time.
    var d = new Date(ms);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
                    d.getUTCHours(), d.getUTCMinutes());
  }

  /**
   * Get the start date of an event for display. The date is always
   * displayed in the event's local time, regardless of the user's
   * timezone.
   */
  util.getEventDisplayStartDate = function(event) {
    return !event || !event.startDate ? null :
      getDateForDisplay(event, event.startDate, event.startDateOffsetMin);
  };

  /**
   * Same as above, but for end date.
   */
  util.getEventDisplayEndDate = function(event) {
    return !event || !event.endDate ? null :
      getDateForDisplay(event, event.endDate, event.endDateOffsetMin);
  };

  erly.util = util;
}(typeof exports !== 'undefined' ? exports : erly));

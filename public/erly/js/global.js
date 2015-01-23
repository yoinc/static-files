/*!
 * Globally applicable javascript.
 */

/* Temporary.  This may fix IE issues. */
if (typeof console === 'undefined') {
  console = {
    log: function() {},
    error: function() {},
    warn: function() {}
  };
}

/**
 * Random patches
 */

/**
 * indexOf polyfill
 */
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function(obj) {
    for (var i = 0; i < this.length; i++) {
      if (this[i] === obj) {
        return i;
      }
    }
    return -1;
  };
}

/*
 * "Safe" jQuery selector - doesn't accept falsy selectors or selectors that
 * return nothing
 */
function $$(selector) {
  if (!selector) {
    throw new Error('Invalid falsy selector.');
  }

  var result = $(selector);
  if (result.length === 0) {
    throw new Error('No elements selected for ' + selector);
  }

  return result;
}

(function(erly) {
  /**
   * Login
   */
  erly.addCss3Rule = function(target, name, value) {
    $.each(['-webkit-', '-moz-', ''], function(i, prefix) {
      target.css(prefix + name, value);
    });
  };

  erly.showLoginLoader = function() {
    erly.shouldShowLoginLoader = true;
    setTimeout(function() {
      if (erly.shouldShowLoginLoader) {
        $('.login-loader .content').show();
        $('.login-loader').fadeIn();
      }
    }, 500);
  };
  erly.hideLoginLoader = function() {
    erly.shouldShowLoginLoader = false;
    $('.login-loader .content').hide();
    $('.login-loader').hide();
  };

  erly.sample = function(arr, numSamples) {
    var result = [];
    while (numSamples > 0 && arr.length > 0) {
      var index = Math.floor(Math.random() * arr.length);

      result.push(arr.splice(index, 1)[0]);

      numSamples--;
    }

    return result;
  };

  erly.checkBrowserRequirements = function() {
    $.ajaxSetup({cache: false});

    erly.browserSupport.showWarningIfRequired();
    erly.browserSupport.addBrowserCssOverrides();

    var browserName = erly.browserSupport.detect().name;
    if (browserName === 'iPad' || browserName === 'iPhone') {
      window.scrollTo(0, 1);
    }
  };
  $(window).load(erly.checkBrowserRequirements);

  /**
   * Client side validations
   */
  erly.validate = {};

  /**
   * Email matching regular expression.
   * Source: http://www.regular-expressions.info/email.html
   *
   * @const
   */
  erly.validate.EMAIL_REGEX = /[a-z0-9!#$%&'*+\/=?\^_`{|}~\-]+(?:\.[a-z0-9!#$%&'*+\/=?\^_`{|}~\-]+)*@(?:[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?/;

  /**
   * Anchored email regex.
   * @const
   */
  erly.validate.ANCHORED_EMAIL_REGEX = /^[a-z0-9!#$%&'*+\/=?\^_`{|}~\-]+(?:\.[a-z0-9!#$%&'*+\/=?\^_`{|}~\-]+)*@(?:[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?$/;

  erly.validate.emailFormat = function(value, fieldName, errors) {
    if (!erly.validate.EMAIL_REGEX.test(value)) {
      errors.push({
        field: fieldName,
        message: 'is not a valid email'
      });
      return false;
    }
    else {
      return true;
    }
  };

  erly.validate.dateFormat = function(value, fieldName, errors) {
    var seconds = Date.parse(value);

    if (_.isNaN(seconds)) {
      if (errors) {
        errors.push({
          field: fieldName,
          message: 'is not a valid date'
        });
      }

      return false;
    }
    else {
      return true;
    }
  };

  /**
   * Miscellaneous
   */
  erly.chance = function(prob) {
    return (Math.random() < prob);
  };

  erly.randInt = function(max) {
    return Math.floor(max * (Math.min(Math.random(), 0.9999999999999999)));
  };

  erly.choose = function(arr) {
    return arr[erly.randInt(arr.length)];
  };

  erly.grouped = function(list, n) {
    return _(list).reduce(function(groups, item) {
      if (groups[groups.length - 1].length >= n) {
        groups.push([]);
      }
      groups[groups.length - 1].push(item);
      return groups;
    }, [[]]);
  };

  erly.chooseNew = function(choices, last) {
    return erly.choose(_.filter(choices, function(v) {
      if (last === '') {
        return true;
      }

      return (v !== last);
    }));
  };

  /**
   * Returns the formatted title.  If `wirTitleData` contains expected data it
   * will generate the proper date span at the end if the title is still the
   * default.
   *
   * @param {String} title
   * @param {Object} wirTitleData
   * @api public
   */
  erly.formatTitle = function(title, wirTitleData) {
    if (wirTitleData && title === wirTitleData.defaultTitle) {
      return title + ' (' + erly.dateFormatters.dateSpan(
        erly.normalizeDate(wirTitleData.weekStart),
        erly.normalizeDate(wirTitleData.weekEnd)
      ) + ')';
    }
    return title;
  };

  /**
   * Parses a string according to the ISO8601 format.
   *
   * taken from: http://anentropic.wordpress.com/2009/06/25/javascript-iso8601-parser-and-pretty-dates/
   * @private
   */
  var parseISO8601 = function(str) {
    // we assume str is a UTC date ending in 'Z'
    try {
      var parts        = str.split('T'),
          dateParts    = parts[0].split('-'),
          timeParts    = parts[1].split('Z'),
          timeSubParts = timeParts[0].split(':'),
          timeSecParts = timeSubParts[2].split('.'),
          timeHours    = Number(timeSubParts[0]),
          _date        = new Date();

      _date.setUTCFullYear(Number(dateParts[0]));
      _date.setUTCMonth(Number(dateParts[1])-1);
      _date.setUTCDate(Number(dateParts[2]));
      _date.setUTCHours(Number(timeHours));
      _date.setUTCMinutes(Number(timeSubParts[1]));
      _date.setUTCSeconds(Number(timeSecParts[0]));

      if (timeSecParts[1]) {
        _date.setUTCMilliseconds(Number(timeSecParts[1]));
      }

      // by using setUTC methods the date has already been converted to local
      // time(?)
      return _date;
    } catch(e) {
      return null;
    }
  };

  /**
   * Attempts to convert the `obj` into a `Date` instance.  Strings are
   * normalized and parsed with `stringParseDate`, numbers are assumed to be in
   * milliseconds, and dates are copied.  Everything else generates an exception.
   * XXX - maybe return null instead?
   *
   * @param {Object} obj
   * @returns {Date}
   * @api public
   */
  erly.normalizeDate = function(obj) {
    if (!obj) {
      // Treat null/undefined dates as now
      return new Date();
    }
    else if (_.isDate(obj)) {
      // copy it
      return new Date(obj.getTime());
    }
    else if (_.isString(obj)) {
      return erly.stringParseDate(obj);
    }
    else if (_.isNumber(obj)) {
      return new Date(obj);
    }
    else {
      throw new Error("Couldn't figure out what the object given is  (" +
        obj.toString() + ')');
    }
  };

  var TIME_WITH_MERIDIAN = /^(0?[0-9]|1[0-2])(\:([0-5][0-9]))?\s*(AM|PM)$/i;
  var TWENTY_FOUR_HOUR_WITHOUT_MERIDIAN = /^([0-1]?[0-9]|2[0-3])(\:([0-5][0-9]))?$/;

  /**
   * Attempts to parse a time specified as a string
   * into its component parts
   *
   * @returns {hour, minute, meridian}
   **/
  erly.parseTime = function(str) {
    var meridian;
    var match;
    var hour;
    var minute;

    str = $.trim(str);

    match = str.match(TIME_WITH_MERIDIAN);
    match = match || str.match(TWENTY_FOUR_HOUR_WITHOUT_MERIDIAN);

    if (match) {
      hour = parseInt(match[1], 10);

      if (match[3]) {
        minute = parseInt(match[3], 10);
      } else {
        minute = 0;
      }

      if (match[4]) {
        meridian = match[4].toUpperCase();
      }
    } else {
      throw new Error('Cannot parse time string: `' + str + "`");
    }

    return {
      hour: hour,
      minute: minute,
      meridian: meridian
    };
  };

  /*
   * Same as erly.parseTime, but doesn't
   * return a meridian.  Instead, it returns a 24
   * hour normalized time time (based on the meridian) +
   * a minute, if provided
   */
  erly.normalizedParseTime = function(str) {
    var result = erly.parseTime(str);

    if (result.meridian === "PM") {
      if (result.hour < 12) {
        result.hour += 12;
      }
    } else if (result.meridian === "AM") {
      if (result.hour === 12) {
        result.hour = 0;
      }
    }

    return {
      hour: result.hour,
      minute: result.minute
    };
  };

  /**
   * Attempts to convert `str` into a `Date` instance.  Attempts to work around
   * known browser limitations with `Date.parse` and throws if nothing could be
   * made of the string.
   *
   * XXX - maybe return null instead?
   *
   * @param {Object} obj
   * @returns {Date}
   */
  erly.stringParseDate = function(str) {
    // Simple case
    var num = Date.parse(str);
    if (_.isNumber(num)) {
      return new Date(num);
    }

    // Assume Firefox
    str = str.replace(/\s*\+0000\s*$/, 'Z');
    num = Date.parse(str);
    if (_.isNumber(num)) {
       // that worked...
      return new Date(num);
    }

    // Maybe Safari?
    var date = parseISO8601(str);
    if (date && _.isDate(date)) {
      return date;
    }

    // Uh, not sure...
    num = Date.apply(this, str.split(/\/\:/));
    if (num) {
      date = new Date(num);
    }
    if (num && date && _.isDate(date)) {
      return date;
    }

    // Give up, XXX - consider returning null
    throw new Error("Couldn't parse date string: " + str);
  };

  erly.enableWatermarks = function(scope) {
    var watermark = function(index, element) {
      element = $(element);
      element.watermark(element.attr('placeholder'));
    };

    scope = scope || $('body');
    $.each(scope.find('input[placeholder]'), watermark);
    $.each(scope.find('textarea[placeholder]'), watermark);
  };

  // Tries to get real height/width measurements for an image
  erly.getNaturalDimensions = function(img, callback) {
    var cached = img.data("naturalDimensions");
    if (!cached && img.data("width") && img.data("height")) {
      cached = {
        w: parseInt(img.data("width"), 10),
        h: parseInt(img.data("height"), 10)
      };
    }

    if (cached) {
      img.imagesLoadedTimeout(30000, function() {
        callback(cached);
      });
      return;
    }

    var measureImage = $('<img src="' + img.attr('src') + '" />');
    $("#image_measure").append(measureImage);
    var getDimensions = function() {
      var w = measureImage.width();
      var h = measureImage.height();

      return {
        w: w,
        h: h
      };
    };

    var retryCount = 0;
    var validate;
    validate = function() {
      var dims = getDimensions();
      // NOTE: Chrome reports 0x0 if it isn't loaded, FF reports 1x1 or 30x18
      // or 30x20, IE8 reports 28x30 (?), IE9 reports 63x30 (?)
      if (dims.w === 0 || dims.h === 0 ||
          (dims.w === 1 && dims.h === 1) ||
          (dims.w === 28 && dims.h === 30) ||
          (dims.w === 30 && dims.h === 18) ||
          (dims.w === 30 && dims.h === 20) ||
          (dims.w === 63 && dims.h === 30)) {
        retryCount++;
        if (retryCount < 10) {
          measureImage.imagesLoadedTimeout(retryCount * 1000, validate);
        }
        else {
          callback({
            w: 0,
            h: 0
          });
        }
      }
      else {
        measureImage.remove();
        img.data("naturalDimensions", dims);
        callback(dims);
      }
    };

    validate();
  };

  erly.linebreaks = function(s) {
    if (!s) {
      return '';
    }

    var contents = "";
    _.each(s.split("\n"), function(t) {
      contents += "<div>";
      if ($.trim(t).length > 0) {
        var htmlDecoded = $('<div/>').html(t).text();
        contents += erly.util.linkify(htmlDecoded);
      }
      else {
        contents += "&nbsp;";
      }
      contents += "</div>";
    });
    return contents;
  };

  erly.getRGBA = function(color, opacity) {
    if (!erly.browserSupport.hasCssColors()) {
      var bgFilename = 'url(/pngpixel/' + color || 'ffffff';
      if (opacity || opacity === 0) {
        bgFilename += '-' + opacity;
      }
      bgFilename += '.png)';
      return bgFilename;
    } else {
      var red = parseInt(color.substring(0,2), 16);
      var green = parseInt(color.substring(2,4), 16);
      var blue = parseInt(color.substring(4,6), 16);
      if (opacity !== 0) {
        opacity = 0.01 * (opacity || 100);
      }
      return "rgba(" + red + ', ' + green + ', ' + blue + ', ' +
        opacity + ")";
    }
  };

  /**
   * Reduces the length of URLs by inner ellipsizing each one.  This does not
   * turn these URLs into clickable links unless `linkify` is `true`.
   *
   * @params {Object} target
   */
  erly.shortenUrls = function(target, max, linkify) {
    max = max || 18;

    var text = $.trim($(target).text());
    if (erly.util.URL_REGEX.test(text)) {
      text = text.replace(erly.util.URL_REGEX, function(match) {
        // If the entire text is a URL, don't shorten
        if (arguments[1] === arguments[7]) {
          return match;
        }

        var url = match;
        if (match.length > max) {
          match = match.substr(0, max - 2) + '&#8230;';
        }
        if (linkify === true) {
          return '<a target="blank" href="' + url + '">' + match + '</a>';
        }
        else {
          return match;
        }
      });
      $(target).html(text);
    }
  };

  var _textCache = erly.__tc = [];

  var _getTextCacheId = function(target) {
    return parseInt(
      target.data('textcacheid') || target.attr('data-textcacheid'), 10);
  };

  var _updateTextCache = function(target, text) {
    var id = _getTextCacheId(target);
    if (typeof id === 'number' && id < _textCache.length && id >= 0) {
      _textCache[id] = text;
    }
  };

  erly.addToTextCache = function(text) {
    _textCache.push(text);
    // Boolean('0') -> true
    // Boolean(0) -> false
    // yay
    return (_textCache.length - 1).toString();
  };

  erly.clearEllipsis = function(target) {
    var originalText = _textCache[_getTextCacheId(target)];
    if (originalText) {
      target.html(erly.linebreaks(originalText));
    }
  };

  erly.checkEllipsis = function(target, fillHeight, lineHeight, showMoreLink) {
    if (erly.oldIE) {
      // Try to truncate an integer number of lines
      target.css("max-height",
        Math.floor(fillHeight / lineHeight) * lineHeight + "px");
      target.css("overflow", "hidden");
      return;
    }

    if (target.length === 0) {
      return;
    }

    var applyHtml = function(s) {
      target.html(erly.linebreaks($.trim(s)));
    };

    var estimatedLineHeight = lineHeight;
    if (!fillHeight) {
      var nextSibling = target.parents('.post').find('.metadata');
      if (nextSibling.length === 0) {
        // Don't do anything if we can't get a reasonable fill height
        return;
      }
      fillHeight = nextSibling.offset().top - target.offset().top - 16;
    }

    // Binary search for a description that is 1-line larger than the fillSize
    var originalText = _textCache[_getTextCacheId(target)];
    if (typeof originalText === 'undefined') {
      originalText = target.text();
      target.data('textcacheid', erly.addToTextCache(originalText));
    }

    var addMoreLink = function() {
      if (showMoreLink) {
        var lastSection = target.find("div:last");
        if (lastSection.length === 0) {
          lastSection = target;
        }
        lastSection.append($(
          '<span> <a href="javascript:void(0)" class="details-link">' +
          '(more)</a></span>'));
      }
    };

    var text = originalText;
    var startIndex = 0;
    var endIndex = text.length * 2;
    var currentHeight;

    while (startIndex < endIndex) {
      var midIndex = Math.round((startIndex + endIndex) / 2);
      text = originalText.slice(0, midIndex);
      applyHtml(text);
      addMoreLink();

      currentHeight = target.height();

      if (currentHeight <= fillHeight) {
        startIndex = midIndex + 1;
      }
      else if (currentHeight > fillHeight + estimatedLineHeight) {
        endIndex = midIndex - 1;
      }
      else {
        endIndex = midIndex;
        break;
      }
    }

    // Now take it in to the previous line
    if (currentHeight > fillHeight || text !== originalText) {
      do {
        text = originalText.slice(0, endIndex) + '...';
        applyHtml(text);
        addMoreLink();

        currentHeight = target.height();

        endIndex -= 2;
        while (endIndex > 0 && originalText[endIndex - 1] === " ") {
          endIndex--;
        }
      } while (currentHeight > fillHeight && currentHeight > estimatedLineHeight && endIndex >= 0);

      if (endIndex < 0) {
        applyHtml("");
      }
      _updateTextCache(target, originalText);
      target.parent().addClass("has-ellipsis");

      return true;
    }
    else {
      applyHtml(originalText);
      target.parent().removeClass("has-ellipsis");

      return false;
    }
  };

  /**
   * Updates `window.location` to the URL defined by `objectType`'s URL
   * generator given `data`.
   *
   * @param {String} objectType
   * @param {Object} data
   */
  erly.redirectTo = function(objectType, data) {
    var urlFor = erly.urlFor[objectType];
    if (urlFor) {
      window.location = erly.BASE_URL + urlFor(data);
    }
    else {
      if (data) {
        throw Error("Unknown objectType '" + objectType + "'.");
      }
      window.location = erly.BASE_URL + objectType;
    }
  };

  /**
   * Fake ken burns effect
   */
  erly.DEFAULT_COVER_PHOTO = erly.PUB_URL +
    '/erly/img/placeholders/placeholder-landscape-1.jpg';

  erly.canKenBurns = function(coverPhoto, callback) {
    if (coverPhoto && coverPhoto.url) {
      if (coverPhoto.dimensions) {
        callback(coverPhoto.dimensions.width >= 300 &&
          coverPhoto.dimensions.height >= 200);
      }
      else {
        var img = new Image();
        $(img).load(function() {
          callback(img.width >= 300 && img.height >= 200);
        }).error(function() {
          callback(false);
        });
        img.src = coverPhoto.url;
      }
    }
    else {
      callback(false);
    }
  };

  erly.fakeKenBurns = function(imageContainer, coverPhoto, additionalHoverZones) {
    var images = [];

    var backupPlan = {
      src: erly.DEFAULT_COVER_PHOTO,
      startScale: 1.2,
      endScale: 1.5,
      centerX: 320,
      centerY: 240,
      w: 640,
      h: 480,
      time: 10000,
      easing: "linear",
      dimensions: {
        width: 640,
        height: 480
      }
    };

    if (coverPhoto && coverPhoto.faces && coverPhoto.faces.length > 0) {
      // Sort by confidence
      coverPhoto.faces.sort(function(a, b) {
        return b.confidence - a.confidence;
      });

      // Randomize start position
      var scaleChoices = [1.1, 1.5];
      var startScale = erly.choose(scaleChoices);
      var endScale = erly.chooseNew(scaleChoices, startScale);

      var plan = {
        src: coverPhoto.url,
        dimensions: coverPhoto.dimensions,
        startScale: startScale,
        endScale: endScale,
        centerX: coverPhoto.faces[0].x + coverPhoto.faces[0].width / 2,
        centerY: coverPhoto.faces[0].y + coverPhoto.faces[0].height / 2,
        time: 10000
      };

      // Pick the direction based on the closest corner
      if (plan.centerY < coverPhoto.dimensions.height / 2) {
        plan.direction = "t";
      }
      else {
        plan.direction = "b";
      }

      if (plan.centerX < coverPhoto.dimensions.width / 2) {
        plan.direction += "l";
      }
      else {
        plan.direction += "r";
      }

      // Start with the highest confidence face centered
      images.push(plan);
    }
    else if (coverPhoto && coverPhoto.url) {
      var sets = [{
        top: "-8%",
        left: "-6%",
        startScale: 1.1,
        endScale: 1.5
      }, {
        top: "-8%",
        left: "-6%",
        startScale: 1.5,
        endScale: 1.1
      }];

      // Firefox only looks good with the top-left corner pinned, so only
      // add these options if we're on something else
      if (!$.browser.mozilla) {
        sets = sets.concat([{
          top: "-8%",
          right: "-6%",
          startScale: 1.1,
          endScale: 1.5
        }, {
          top: "-8%",
          right: "-6%",
          startScale: 1.5,
          endScale: 1.1
        }, {
          bottom: "-8%",
          left: "-6%",
          startScale: 1.1,
          endScale: 1.5
        }, {
          bottom: "-8%",
          left: "-6%",
          startScale: 1.5,
          endScale: 1.1
        }, {
          bottom: "-8%",
          right: "-6%",
          startScale: 1.1,
          endScale: 1.5
        }, {
          bottom: "-8%",
          right: "-6%",
          startScale: 1.5,
          endScale: 1.1
        }]);
      }

      // Use 4 different KB effects on the same photo for variety
      $.each([coverPhoto.url, coverPhoto.url, coverPhoto.url, coverPhoto.url],
          function(i, img) {
        var kbSet = $.extend({
          dimensions: coverPhoto.dimensions,
          src: img,
          time: 10000
        }, erly.choose(sets));

        images.push(kbSet);
      });
      // ensure that we start zoomed out initially.
      var shiftCnt = 0;
      while(images[0].startScale === 1.5 && shiftCnt++ < images.length) {
        images.push(images.shift());
      }
      // if there were no 1.1 startScales picked, force one
      if (images[0].startScale === 1.5) {
        images[0] = $.extend({ src: coverPhoto.url, time: 10000 }, sets[0]);
      }
    } else {
      images.push(backupPlan);
    }

    if (Math.random() < 0.5 || $.browser.mozilla) {
      backupPlan.top = "-20%";
    }
    else {
      backupPlan.bottom = "-15%";
    }

    if (Math.random() < 0.5 || $.browser.mozilla) {
      backupPlan.left = "-5%";
    }
    else {
      backupPlan.right = "0%";
    }

    imageContainer.fakekenburns(images, {
      fadeTime: 1000,
      backupPlan: backupPlan,
      additionalHoverZones: additionalHoverZones
    });
  };


  erly.setActiveTab = function() {
    var path = window.location.pathname;
    var navBar = $(".navbar");
    var el;

    if ((/(timeline)|(collection)/).test(path)) {
      el = navBar.find(".gallery-tab");
    } else if ((/about/).test(path)) {
      el = navBar.find(".about-tab");
    }

    if (el) {
      el.addClass("selected");
    }
  };

  erly.showProductVideo = function(onClose) {
    var video = $('#tmplProductVideo').tmpl({});
    var options;
    options = {
      html: video,
      scrolling: false,
      onComplete: function() {
        $(".product-video-container").find('.remove').click(function() {
          $('.product-video-container').colorbox.close();
        });
      },
      onClosed: function() {
        if (typeof onClose === "function") {
          onClose();
        }
      }
    };

    var w = 960;
    var h = 540;
    video.width(w);
    video.height(h);

    options.innerWidth = w + 24;
    options.innerHeight = h + 24;
    options.transition = 'none';

    $.colorbox(options);
  };

  // Tweaks some animation per browser
  jQuery.fx.interval = erly.browserSupport.getJQueryFxInterval();

  erly.showTopNotification = function(configure, onClose) {
    var div = $('<div class="top-notification"></div>');
    var span = $('<span></span>');

    var a = $('<a></a>');
    a.text('Hide');
    a.attr('href', ['javascript', 'void(0)'].join(':'));

    div.append(span).append(a);
    var container = $('body');
    if ($('.viewer').length > 0) {
      // position a little differently on the viewer page
      div.css({
        position: 'fixed',
        top: '45px',
        opacity: 0.7,
        filter: 'alpha(opacity=70)'
      }).css('z-index', 9999);
    }
    container.prepend(div);

    a.click(function() {
      $(div).slideUp('fast');
      if (typeof onClose === 'function') {
        onClose();
      }
    });

    configure(div);
  };

  /**
   * How long to wait for facebookReady in ms.
   * @const
   * @private
   */
  var FACEBOOK_WAIT_THRESHOLD = 5000;

  /**
   * Executes the batch against the Facebook API and invokes `callback` with
   * the an array of results.  Each result is parsed using `JSON.parse` if the
   * response code is `200`.  If the parse fails or a code other than `200` is
   * returned for that result, `null` will be inserted for that result.
   * If there is an OAuth error, we pop up a dialog prompting the user to
   * log back in or reauth us, and we do NOT call the callback.
   *
   * `callback` is wrapped in a `try`/`catch` which will send errors as
   * required.
   *
   * @param {Array} batch
   * @param {String} token (optional)
   * @param {Function} callback
   * @public
   */
  erly.facebookBatchCall = function(batch, token, callback, skipReadyWait) {
    if (typeof token === 'function') {
      callback = token;
      token = null;
    }
    token = token || erly.oauthToken;

    if (!erly.session.facebookReady) {
      if (skipReadyWait) {
        return callback(new Error(
          'FB did not load after waiting ' + FACEBOOK_WAIT_THRESHOLD + 'ms'));
      }
      // wait threshold seconds and re-invoke ourselves unless skipReadyWait is
      // set
      setTimeout(function() {
        erly.facebookBatchCall(batch, token, callback, true);
      }, FACEBOOK_WAIT_THRESHOLD);
    }

    var request = {access_token: token, batch: batch};
    FB.api('/', 'POST', request, function(response) {
      erly.debugLog('FB.api, request=' + JSON.stringify(request) +
                    ', reply=' + JSON.stringify(response));
      if (response.error && response.error.type === 'OAuthException') {
        erly.debugLog('Facebook OAuthException: ' + JSON.stringify(response));
        erly.showFacebookExpiredModal();
        return;
      } else if (response.error) {
        callback(response.error, null);
        return;
      }
      else {
        var result = [];
        if (response) {
          _(response).each(function(res) {
            if (!res || res.code !== 200) {
              result.push(null);
            }
            else {
              try {
                // HACK to get around int overflows
                result.push(JSON.parse(res.body.replace(
                  new RegExp('object_id":([0-9]+)', 'g'),
                    function(match, one) {
                      return ['object_id":"', one, '"'].join('');
                    }
                  ))
                );
              }
              catch(e) {
                result.push(null);
              }
            }
          });
        }
        try {
          callback(null, result);
        }
        catch(e) {
          erly.trackException(e, 'global.js@facebookBatchCall');
        }
      }
    });
  };

  /**
   * Performs a Facebook API get for `url` with `token`.
   *
   * `callback` is wrapped in a `try`/`catch` which will send errors as
   * required.
   *
   * @param {String} url
   * @param {String} token (optional)
   * @param {Function} callback
   * @public
   */
  erly.facebookSingleCall = function(url, token, callback) {
    if (typeof token === 'function') {
      callback = token;
      token = null;
    }
    erly.facebookBatchCall([{relative_url: url, method: 'GET'}], token,
      function(err, res) {
        if (err) {
          callback(err);
        }
        else if (res.length !== 1 || !res[0]) {
          callback(new Error('No valid data found for: ' + url));
        }
        else {
          callback(null, res[0]);
        }
      }
    );
  };

  /**
   * Show an error and prompt the user to log back in with facebook if
   * the user's facebook token expired.
   */
  erly.showFacebookExpiredModal = function() {
    var div = $('#tmplFacebookExpiredError').tmpl();
    erly.modal.showConfirmWithTemplate(
      div, function() {} /* confirmFunc: do nothing */,
      function() {
        // onComplete.
        div.find('.facebook-signup').click(function() {
          erly.session.facebookLogin();
        });
      }
    );
  };

  /**
   * Adjusts textfield classes based on focusness.
   *
   * @private
   */
  erly.enterTextField = function() {
    $(this).addClass('normal-text').removeClass('empty-text error-shadow');
  };

  /**
   * Adjusts textfield classes based on focusness and emptiness.
   *
   * @private
   */
  erly.leaveTextField = function() {
    if (!$.trim($(this).val())) {
      $(this).addClass('empty-text').removeClass('normal-text');
    }
  };

  erly.keycodes = {};

  erly.keycodes.BACKSPACE = 8;
  erly.keycodes.SPACE     = 32;

  erly.keycodes.isAlphaNumeric = function(keycode) {
    return erly.keycode.isAlphaChar(keycode) ||
           erly.keycode.isNumeric(keycode);
  };

  erly.keycodes.isAlphaChar = function(keycode) {
    return keycode >= 65 && keycode <= 90 ||
           keycode >= 97 && keycode <= 122;
  };

  erly.keycodes.isNumeric = function(keycode) {
    return keycode >= 48 && keycode <= 57;
  };

  /**
   * Resend email verification for the current user.
   */
  erly.resendEmailVerification = function(email) {
    $.ajax({
      type: 'POST',
      url: erly.urlFor.session('resend_verification'),
      data: email ? {email: email} : {},
      complete: function() {
        erly.modal.showAlert(
          'Sent', 'Email verification has been resent to your address.');
      }
    });
  };

  (function() {
    var range = function(i, n) {
      var a = [];
      for (; i <= n; i++) a.push(i);
      return _(a);
    };
    var pathify = function(path) {
      if (path) path = /\/$/.test(path) ? path : path + '/';
      return function(i) {
        return ['/erly/img/flagstone-backgrounds/', path || '', i, '.jpg'].join('');
      };
    };
    erly.STOCK_BACKGROUNDS = {
      General: range(0, 16).map(pathify()),
      Birthday: range(1, 8).map(pathify('birthday')),
      Dinner: range(1, 8).map(pathify('dinner')),
      // Holiday: range(1, 7).map(pathify('holiday')),
      Outdoor: range(1, 8).map(pathify('outdoor')),
      Party: range(1, 7).map(pathify('party')).concat(
              range(1, 6).map(pathify('wedding'))
            ),
      Seasonal: _(range(1, 10).map(function(i) {
        return ['100_', i < 10 ? '0' + i : i].join('');
      })).map(pathify('seasonal'))
    };
    erly.STOCK_BACKGROUND_COVERS = {
      General: 6,
      Birthday: 7,
      Dinner: 3,
      Outdoor: 0,
      Party: 4,
      Seasonal: 8
    };
  }());

  erly.STATIC_HOST = 'http://c1264939.r39.cf2.rackcdn.com';

  erly.resolveStaticUrl = function(path) {
    path = $.trim(path);
    if (path.indexOf('http') === 0) return path;
    return [erly.STATIC_HOST, path].join(path.indexOf('/') === 0 ? '' : '/');
  };

  $(function() {
    erly.STOCK_AVATARS = _.map([
      'adced8',
      'eaca98',
      'caddb7',
      'ceb5cf',
      'a4afdf',
      'add8d0',
      'ddd0b7',
      'c6ecbc',
      'e2bca7',
      'ea9898',
      'c8c4ce',
      '99b9ed',
      'c5d38f',
      '98dcea',
      'e6b3c5'
    ], function(c) {
      return erly.PUB_URL + '/erly/img/color-avatars/avatar-' + c + '.png';
    });
  });

  erly.avatarLoadFail = function(ev) {
    $(ev.srcElement).attr('src', erly.PUB_URL + '/erly/img/face-bg-large.png');
  };

  /**
   * Parse `qs` as an encoded query string.
   *
   * @param {String} qs
   * @returns {Object}
   * @api public
   */
  erly.parseQueryString = function(qs) {
    return _((qs || '').split('&')).reduce(function(query, pair) {
      pair = _.map(pair.split('='), decodeURIComponent);
      if (pair.length === 2) {
        query[pair[0]] = pair[1];
      }
      return query;
    }, {});
  };

  erly.onScrollNearFooter = function(callback) {
    var fn = function(ev) {
      var y = ($('.footer').offset() || {}).top;
      if (!top) { return; }

      if (y - $(this).scrollTop() < $(this).height() * 2) {
        callback();
      }
    };
    $(window).scroll(fn);
    $(window).resize(fn);
  };

  /**
   * Returns a link to Google maps for the given location.
   */
  erly.googleMapsLink = function(locationName) {
    return 'http://maps.google.com/?q=' + encodeURIComponent(locationName);
  };

  /**
   * Returns a link to Google Calendar for the given collection.
   */
  erly.gcalLink = function(collection) {
    // Copy and paste from app/data/formats/ics.js
    var pad = function(x) {
      x = $.trim(x.toString());
      return (
        x.length === 2 ? x :
        x.length === 1 ? '0' + x : '00'
      );
    };

    var gcalDate = function(date, preserveTime) {
      var components = [
        date.getUTCFullYear(),
        pad(date.getUTCMonth()+1),
        pad(date.getUTCDate())
      ];

      if (preserveTime) {
        components = _(components).concat([
          'T',
          pad(date.getUTCHours()),
          pad(date.getUTCMinutes()),
          pad(date.getUTCSeconds()),
          'Z'
        ]);
      }

      return components.join('');
    };

    var start = erly.normalizeDate(collection.startDate);
    var end = collection.endDate;
    var hasTime = collection.hasTime;
    if (!end) {
      // Default to one hour durations
      end = new Date(start.getTime() + 3600 * 1000);
    }
    end = erly.normalizeDate(end);

    return 'https://www.google.com/calendar/event?' + $.param({
      action: 'TEMPLATE',
      text: collection.title,
      dates: gcalDate(start, hasTime) + '/' + gcalDate(end, hasTime),
      details: collection.description,
      location: _.filter([collection.locationName, collection.streetAddress],
        Boolean).join(' - '),
      sprop: [window.location.hostname, 'name:Erly'],
      trp: true
    }, true);
  };

  /**
   * Strips the first part of the streetAddress if it matches the location. If
   * `prefixDash` is `true`, the address will be prefixed with ' - ' if the
   * formatted streetAddress is not an exact match of the locationName.
   */
  erly.getFormattedStreetAddress = function(collection, prefixDash) {
    var loc = $.trim(collection.locationName);
    var street = $.trim(collection.streetAddress);
    if (!street || street.indexOf(loc) !== 0) {
      return prefixDash ? [' - ', street].join('') : street;
    }
    var formatted = $.trim(street.substr(loc.length).replace(/^[ ,\-]*/, ''));
    if (formatted) {
      return formatted !== loc && loc && prefixDash ?
        [' - ', formatted].join('') :
        formatted;
    }
    else {
      return '';
    }
  };

  /**
   * Add any calculated fields to the event after it is fetched from the server.
   * TODO(walt): change startDate/endDate to int instead of Date.
   */
  erly.updateEventWithCalculatedFields = function(data) {
    if (data.startDate) {
      data.startDate = erly.normalizeDate(data.startDate);
      data.displayStartDate = erly.util.getEventDisplayStartDate(data);
    }

    if (data.endDate) {
      data.endDate = erly.normalizeDate(data.endDate);
      data.displayEndDate = erly.util.getEventDisplayEndDate(data);
    }

    if (data.startDate < erly.now) {
      data.pastEvent = true;
    }
  };

  /**
   * Returns the given dictionary as a string of CSS.  Does no escaping of any
   * kind.
   */
  erly.jsonToCSS = function(json) {
    return _(_(json || {}).keys()).map(function(k) {
      return [k, json[k]].join(':');
    }).join(';');
  };

  /**
   * Returns `true` if the address can be shown for `collection`.
   * @api public
   */
  erly.canShowAddress = function(collection) {
    return !!collection.streetAddress;
  };

  erly.canShowLocation = function(collection) {
    return collection.userRole.member || !collection.pastEvent ||
      collection.isAlbum || erly.viewer.exported;
  };

  erly.domInit = function() {
    $(function() {
      var oldDatePicker = $.fn.datepicker;

      $.fn.datepicker = function() {
        var obj = this;
        if (typeof arguments[0] === 'string') {
          var args = Array.prototype.slice.call(arguments);
          return oldDatePicker.apply(this, args);
        }
        else {
          return oldDatePicker.apply(this, [$.extend({
            dayNamesMin: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            selectOtherMonths: true,
            showOtherMonths: true,
            dateFormat: 'm/d/yy',
            constrainInput: false
          }, arguments[0])]);
        }
      };

      erly.enableWatermarks();
      erly.setActiveTab();
    });
  };

  /**
   * Log message to console only if deb= is in query string.
   * 'obj' is an optional JavaScript object that will be serialized.
   */
  var debugLogOn = function(msg, opt_obj) {
    if (typeof opt_obj === 'object') {
      msg += '; ' + JSON.stringify(opt_obj);
    }
    console.log(msg);
  };
  var debugLogOff = function(msg, opt_obj) {};

  var debugOn = false;
  if (document && document.location && document.location.search) {
    // search looks like '?k1=v1&k2=v2...
    var arr = document.location.search.slice(1).split('&');
    var deb = _.filter(arr, function(x) { return x.slice(0, 4) === 'deb='; });
    debugOn = deb.length > 0;
  }

  erly.debugLog = debugOn ? debugLogOn : debugLogOff;
}(erly));

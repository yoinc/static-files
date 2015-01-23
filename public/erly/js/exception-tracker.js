/*!
 * Exception tracking
 */

(function(erly) {
  /**
   * Time to wait between sending exceptions in ms.  Anything that occurs in
   * this time period is ignored.
   *
   * @const
   * @private
   */
  var SEND_RATE_INTERVAL = 30 * 1000;

  /**
   * Ignored scripts
   *
   * @const
   * @private
   */
  var IGNORED_EXCEPTIONS_FILES = [
    'chrome/RendererExtensionBindings',
    /graph\.facebook\.com/,
    /connect\.facebook\.net\/en_US\/all.js/,
    /www\.google-analytics\.com\/ga\.js/,
    /extensions\/renderer_extension_bindings\.js/,
    /feather\.aviary\.com\/js\/feather.js/,
    '',
    'undefined'
  ];

  var IGNORED_EXCEPTIONS_MESSAGES = [
    /The first argument must be a beforeLoad event object/,
    // Firefox session restore errors
    /attempt to run a compile-and-go script/,
    // from XMLViewer plugin
    /can\'t load XRegExp twice in the same frame/,
    // chrome extensions
    /See the content scripts documentation for more details/,
    // Crossdomain errors
    'Script error.'
  ];

  var submitAjaxException = _.throttleImmediate(function(errorData) {
    $.ajax('/log-exception', {
      type: 'POST',
      data: errorData
    });
  }, SEND_RATE_INTERVAL);

  var match = function(file) {
    return function(element) {
      if (typeof element === 'string') {
        return file === element;
      }
      else if (typeof element.test === 'function') { // a regex
        return element.test(file);
      }
    };
  };

  var shallowExtractStringValues = function(obj) {
    var subset = {};

    _.each(obj, function(value, key) {
      if (typeof value === 'string') {
        subset[key] = value;
      }
    });

    return subset;
  };

  var trackError = function(payload) {
    var errorData = {
      error: payload,
      trace: erly.trace.read(),
      client: {
        // without the clone call, window.navigator, underscore's each()
        // doesn't iterate properly on FF
        navigator: shallowExtractStringValues(_.clone(window.navigator)),
        href: window.location.href,
        pathname: window.location.pathname,
        rev: erly.REV
      },
      utcTimestamp: +new Date()
    };

    if (typeof erly !== 'undefined' && erly) {
      errorData.client.userId = erly.userId;
      errorData.client.facebookId = erly.facebookId;
    }

    if (typeof console !== 'undefined') {
      console.error(errorData);
    }

    submitAjaxException(errorData);
  };

  var ignoreException = function(msg, file, line) {
    return (_.any(IGNORED_EXCEPTIONS_FILES, match(file)) ||
      _.any(IGNORED_EXCEPTIONS_MESSAGES, match(msg)));
  };

  if (!erly.__development) {
    /*
    window.onerror = _.wrap(window.onerror, function(onerror, msg, file, line) {
      if (!ignoreException(msg, file, line)) {
        trackError({
          filename: file,
          lineNumber: line,
          message: msg
        });
      }

      if (typeof onerror === 'function') {
        return onerror(msg, file, line);
      }
      else {
        // for errors to propagate on Chrome,
        // return true
        // see: https://bugs.webkit.org/show_bug.cgi?id=67119
        return false;
      }
    });
    */
  }

  erly.trackException = function(exc, source) {
    var message = _.isString(exc) ? exc : (exc.message || '').substr(0, 400);
    var error = {
      name: exc.name,
      message: message,
      // MS
      description: exc.description,
      number: exc.number,
      // Mozilla/Webkit
      stack: (exc.stack || '').split('\n'),
      fileName: exc.fileName,
      lineNumber: exc.lineNumber
    };
    if (source) {
      error.taggedSource = source;
    }
    trackError(error);
  };
}(erly));

(function(erly) {
  var browserSupport = {};

  var BROWSER_CONFIGURATIONS = [
    { ua: /iPad/i,
      name: 'iPad',
      ios: true,
      minSupportedVersion: 0
    },
    { ua: /iPhone/i,
      name: 'iPad',
      ios: true
    },
    { ua: /Firefox\/([0-9]+)\.[0-9]+/i,
      name: 'Firefox',
      scrollMultiplier: 125,
      velocityMultiplier: 2,
      averageVelocityCutoff: 250,
      mozilla: true,
      minSupportedVersion: 4
    },
    { ua: /Chrome\/([0-9]+)/i,
      name: 'Chrome',
      scrollMultiplier: 225,
      webkit: true,
      minSupportedVersion: 12
    },
    { ua: /Version\/([0-9]+).*Safari/i,
      name: 'Safari',
      scrollMultiplier: 20,
      webkit: true,
      minSupportedVersion: 5
    },
    { ua: /MSIE ([0-9]+)/,
      name: 'Internet Explorer',
      scrollMultiplier: 125,
      ie: true,
      minSupportedVersion: 9
    }
  ];

  var DEFAULT_BROWSER = {
    name: 'Default',
    scrollMultiplier: 125
  };

  var _browser = _(BROWSER_CONFIGURATIONS).reduce(
    function(chosen, config) {
      if (!chosen && config.ua && config.ua.test(navigator.userAgent)) {
        chosen = _.clone(config);
        chosen.version = RegExp.$1 ? parseInt(RegExp.$1, 10) : null;
        if (chosen.version < 9 && chosen.ie) {
          erly.oldIE = true;
        }
        delete chosen.ua;
      }
      return chosen;
    },
    null
  ) || DEFAULT_BROWSER;

  browserSupport.isSupported = function() {
    return (
      _browser.minSupportedVersion === 0 ||
      (_browser.version && _browser.minSupportedVersion &&
        _browser.version >= _browser.minSupportedVersion)
    );
  };

  browserSupport.detect = function() {
    return _browser;
  };

  browserSupport.useCanvas = function() {
   return Boolean(_browser.webkit);
  };

  browserSupport.showWarningIfRequired = function() {
    if (!this.isSupported() && $.cookie('ubw') !== '1') {
      erly.showTopNotification(function(div) {
        var span = div.find('span');
        if (_browser.ie && _browser.version === 8) {
          span.html('Your browser may not perform well when using ' +
          'Events. You may want to upgrade your browser or use ' +
          '<a href="http://www.google.com/chromeframe?redirect=true">' +
          'Google Chrome Frame</a>.');
        }
        else if (_browser.mozilla && _browser.version <= 3) {
          span.html('This browser may not perform well when using ' +
          'Events. You may want to upgrade your browser to the latest ' +
          'version to get the most out of this product.');
        }
        else {
          var link = 'http://windows.microsoft.com' +
            '/en-US/internet-explorer/downloads/ie';
          span.html([
            'Your browser is not fully supported.  We currently only ',
            'support the latest versions of ',
            '<a href="http://www.google.com/chrome">Chrome</a>, ',
            '<a href="http://getfirefox.com/">Firefox</a>, ',
            '<a href="http://www.apple.com/safari/download/">Safari</a>, ',
            'and <a href="' + link + '">Internet Explorer</a>.'
          ].join(''));
        }
        var img = $('<img />');
        img.attr('src', erly.PUB_URL + '/erly/img/icon-warning.png');
        img.attr('alt', "warning");
        div.prepend(img);
      }, function() {
        $.cookie('ubw', '1', {path: '/'});
      });
    }
  };

  browserSupport.addBrowserCssOverrides = function() {
    if (_browser.ios) {
      $('body').addClass('reduced-shadows');
    }
  };

  browserSupport.hasCssColors = function() {
    return !_browser.ie || _browser.version > 8;
  };

  browserSupport.hasCssTransitions = function() {
    return !_browser.ie;
  };

  browserSupport.usesCssTransitions = function() {
    return _browser.ios;
  };

  browserSupport.getJQueryFxInterval = function() {
    if (_browser.mozilla && _browser.version <= 3) {
      // For FF 3.X, slow down animations to 15 FPS
      return 66;
    }
    else if (_browser.ie && _browser.version < 9) {
      // For IE 8-, slow down animations to 5 FPS
      return 200;
    }
    // For everything else 30 FPS would be great
    return 33;
  };

  browserSupport.canDragUpload = browserSupport.canMultipleFileUpload =
    function() {
      return this.isSupported() && !_browser.ie;
    };

  erly.browserSupport = browserSupport;
}(erly));

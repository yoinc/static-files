var pb = {
  model: {},
  ui: {}
};

pb.events = {
  ACTIVATE_ROOM: 'ar',
  CHANNEL_ROOM: 'cr',
  NEW_ROOM: 'nr',
  PRESENCE: 'pr',
  PUBLISHER_ACTIVITY: 'pa',
  PUBLISH_CONNECT: 'puc',
  PUBLISH_PAUSE: 'pup',
  PUBLISH_RESUME: 'pur',
  PUBLISH_START: 'pus',
  PUBLISH_STOP: 'pust',
  ROOM_ACTIVATED: 'ra',
  ROOM_ALREADY_CREATED: 'rac',
  ROOM_CLOSE: 'rc',
  ROOM_HISTORY: 'rh',
  ROOM_MESSAGE: 'rms',
  ROOM_MESSAGE_DELETED: 'rmd',
  ROOM_PRESENCE: 'rp',
  ROOM_UPDATE: 'ru',
  ROOMS_RECEIVED: 'rr',
  SESSION_USER: 'su'
};


pb.pubsub = (function() {
  var _o = $({});

  function publish(topic, data) {
    if (!topic) {
      console.log('WARNING! publishing an undefined topic.', new Error().stack,
          data);
    }
    _o.trigger.apply(_o, [ arguments[0],
        Array.prototype.slice.apply(arguments, [ 1 ]) ]);
  }

  function subscribe(topic, callback) {
    if (!topic) {
      console.log('WARNING! subscribing to an undefined topic.',
          new Error().stack, callback);
    }
    _o.on.apply(_o, arguments);
  }

  return {
    publish: publish,
    subscribe: subscribe
  };
}());


pb.tmpl = (function() {
  /*jshint maxlen:10000 */
  var URL_REGEX = /\b((?:[a-z][\w\-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/ig;
  /*jshint maxlen:80 */
  var IMAGE_EXTS = ['gif', 'jpg', 'bmp', 'png'];
  var _templates = {};

  function formatDate(date) {
    if (typeof(date) === 'number') {
      date = new Date(date);
    }
    else if (typeof(date) === 'string') {
      date = Date.parse(date);
    }
    return date.toLocaleString();
  }

  function formatDurationMsec(duration) {
    var text = '';
    var hours = Math.floor(duration / (60 * 60 * 1000));
    if (hours > 0) {
      text += hours + ':';
    }
    duration -= hours * 60 * 60 * 1000;
    var minutes = Math.floor(duration / (60 * 1000));
    text += (hours > 0 ? doubleDigit(minutes) : minutes) + ':';
    duration -= minutes * 60 * 1000;
    var seconds = Math.ceil(duration / 1000);
    text += doubleDigit(seconds);
    return text;
  }

  function doubleDigit(number) {
    if (number < 10) {
      return '0' + number;
    }
    return number;
  }

  function init(templates) {
    _templates = templates;
  }

  function urlIsImage(url) {
    var parser = document.createElement('a');
    parser.href = url;
    var pathParts = parser.pathname.split('.');

    return $.inArray(pathParts.slice(-1)[0].toLowerCase(), IMAGE_EXTS) !== -1;
  }

  function preprocess(text) {
    if (!text) {
      return '';
    }
    var usePre = text.indexOf('\n') !== -1;
    if (usePre) {
      text = $('<pre/>').text(text).html();
    }
    else {
      text = $('<div/>').text(text).html();
    }
    text = text.replace(URL_REGEX, function(match) {
      var href = match;
      if (href.indexOf('://') === -1) {
        href = 'http://' + href;
      }

      // Shorten the display if needed
      var display = match;
      if (display.length > 80) {
        display = match.substring(0, 40) + ' ... ' +
            match.substring(href.length - 40);
      }

      var result = '<a target="_blank" href="' + href + '">' + display + '</a>';
      if (urlIsImage(href)) {
        result += '<div class="user-image"><img src="' + href + '" /></div>';
      }
      return result;
    });

    if (usePre) {
      text = '<pre>' + text + '</pre>';
    }
    return text;
  }

  function render(name, data) {
    return _templates[name](data);
  }

  return {
    init: init,
    render: render,
    formatDate: formatDate,
    preprocess: preprocess,
    formatDurationMsec: formatDurationMsec
  };
}());


pb.channel = (function(pb) {

  var _socket = null;
  var _appHost = null;

  function connect() {
    if (!_socket) {
      _socket = io.connect(_appHost, {
        'sync disconnect on unload': true
      });
      _socket.on('error', function(error) {
        console.log('socket error', error);
      });
      _socket.on('message', function(msg) {
        pb.pubsub.publish(pb.events.ROOM_MESSAGE, msg);
      });

      _socket.on('messageDeleted', function(msg) {
        pb.pubsub.publish(pb.events.ROOM_MESSAGE_DELETED, msg);
      });


      _socket.on('roomPresence', function(msg) {
        pb.pubsub.publish(pb.events.ROOM_PRESENCE, msg);
      });
      _socket.on('room', function(msg) {
        pb.pubsub.publish(pb.events.CHANNEL_ROOM, msg);
      });
      _socket.on('presence', function(msg) {
        pb.pubsub.publish(pb.events.PRESENCE, msg);
      });
      _socket.on('connect', function() {
        console.log('successfully connected channel');
      });
      _socket.on('publisher_activity', function(msg) {
        pb.pubsub.publish(pb.events.PUBLISHER_ACTIVITY, msg);
      });
    }
  }

  function init(appHost) {
    _appHost = appHost;
  }

  return {
    connect: connect,
    init: init
  };
}(pb));


pb.sound = (function() {
  var _cachedSounds = {};

  function play(soundPath) {
    if (!!Audio) {
      if (!_cachedSounds[soundPath]) {
        _cachedSounds[soundPath] = new Audio(soundPath);
      }
      _cachedSounds[soundPath].play();
    }
  }

  return {
    DING: '/mp3s/ding.mp3',
    play: play,

  };
}());

pb.ui.contentLanding = (function(pb) {
  var _el = null;
  var _data = {};

  function isoDateString(d) {
    function pad(n){
      return n < 10 ? '0' + n : n;
    }
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth()+1) + '-' +
      pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' +
      pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + 'Z';
  }

  function init(el, data) {
    _el = el;
    _data = data;
    _el.html(pb.tmpl.render('contentlanding.main', data));
    console.log(data);
    $.timeago.settings.allowAbout = false;
    $.timeago.settings.includePrefix = 'shared';
    $('abbr.timeago').attr('title',
      isoDateString(new Date(_data.share.createdAt)));
    $('abbr.timeago').timeago();
    var shareAvatar = '/img/default-avatar.png';
    if (_data.sharer.avatarUrl) {
      shareAvatar = _data.sharer.avatarUrl;
    } else if (_data.sharer.fbId) {
      shareAvatar = 'http://graph.facebook.com/' + _data.sharer.fbId +
         '/picture?type=square';
    }
    $('div.avatar img')
      .attr('src', shareAvatar)
      .attr('width', 30)
      .attr('height', 30);
    if (_data.message.type === 1 && _data.isFirefox) {
      $('div.content video').mediaelementplayer({
        videoWidth: _data.message.videoWidth,
        videoHeight: _data.message.videoHeight,
        pluginPath: '/swf/'
      });
    }
    $('div.content img, div.content div.photo').click(function() {
      if (_data.message.type === 2) {
        window.location.href = _data.message.imageUrl;
      } else if (_data.message.type === 5) {
        window.location.href = 'http://maps.apple.com/?q=' +
          _data.message.lat + ',' + _data.message.lng;
      } else {
        window.location.href =
          'https://itunes.apple.com/us/app/okhello/id632994162?ls=1&mt=8';
      }
    });
  }

  return {
    init: init
  };
}(pb));

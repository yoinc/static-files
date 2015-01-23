pb.ui.verify = (function(pb) {
  var _el;
  var _value;
  var _appLink;
  var _timer;

  function init(el, appLink, isMobileSafari) {
    _el = el;
    _el.html(pb.tmpl.render('verify.main', {
      appLink: appLink,
      isMobileSafari: isMobileSafari
    }));

    _appLink = appLink;
    _value = parseInt($('span.count').text(), 10);
    if (isMobileSafari) {
      _timer = setInterval(_decrementCount, 1000);
    }
  }

  function _decrementCount() {
    _value -= 1;
    if (_value === 0) {
      clearInterval(_timer);
      window.location.href = _appLink;
    } else {
      $('span.count').text(_value);
    }
  }

  return {
    init: init
  };
}(pb));

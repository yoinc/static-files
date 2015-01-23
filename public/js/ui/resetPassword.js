pb.ui.resetPassword = (function(pb) {
  var _el = null;
  var _data = {};
  var _timer;
  var _value;
  var _appLink;

  function _decrementCount() {
    _value -= 1;
    if (_value === 0) {
      clearInterval(_timer);
      window.location.href = _appLink;
    } else {
      $('span.count').text(_value);
    }
  }

  function _submitChangePassword(e) {
    e.preventDefault();
    var newpw = $('form #newpw').val();
    var confirmpw = $('form #confirmpw').val();
    if (newpw !== confirmpw) {
      $('form .alert-error').show();
      $('form span.error-text').text('Passwords do not match');
      return;
    }
    if (newpw.length < 5) {
      $('form .alert-error').show();
      $('form span.error-text')
        .text('Password must be at least 7 characters long');
      return;
    }
    $('form .alert-error').hide();
    $.post('/user/changePassword', {
      u: _data.u,
      v: _data.v,
      password: newpw,
    }, function(result) {
      if (result.error) {
        $('form .alert-error').show();
        $('form span.error-text')
          .text(result.error);
      } else {
        _el.html(pb.tmpl.render('resetpassword.passwordreset'));
        if (_data.os === 'iOS') {
          _value = parseInt($('span.count').text(), 10);
          _appLink = _data.appUrlScheme + '://';
          $('#open_app').attr('href', _appLink);
          $('#open_app').show();
          $('#redirect').show();
          _timer = setInterval(_decrementCount, 1000);
        }
      }
    });

  }

  function init(el, data) {
    _el = el;
    _data = data;
    _el.html(pb.tmpl.render('resetpassword.main', data));
    _el.find('form button.submit').click(_submitChangePassword);
  }

  return {
    init: init
  };
}(pb));

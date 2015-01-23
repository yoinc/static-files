pb.ui.index = (function(pb) {
  var _currentVersion;

  function _checkForUpdates() {
    setTimeout(_checkForUpdates, 15 * 60 * 1000);
    $.get('/ver', function(data) {
      if (data.version !== _currentVersion) {
        $('.update-warning').show();
      }
    });
  }

  function _sizePanels() {
    $('.right-panel').css('left', $('.left-bar').outerWidth());
  }

  function _submitSignupForm(e) {
    e.preventDefault();
    var email = $('form.signup-form #inputEmail').val();
    var password = $('form.signup-form #inputPassword').val();
    var firstName = $('form.signup-form #inputFirstName').val();
    var lastName = $('form.signup-form #inputLastName').val();

    $.post('/user/signup', {
      firstName: firstName,
      lastName: lastName,
      email: email,
      password: password
    }, function(data) {
      if (data.error) {
        $('.signup-form .alert-error').show();
        $('.signup-form span.error-text').text(data.error);
      } else {
        $('.signup-form .alert-error').hide();
        pb.model.session.check();
      }
    });
  }

  function _submitLoginForm(e) {
    e.preventDefault();
    var email = $('form.login-form #inputEmail').val();
    var password = $('form.login-form #inputPassword').val();

    $.post('/user/login', {
      email: email,
      password: password
    }, function(data) {
      if (data.error) {
        $('.login-form .alert-error').show();
        $('.login-form span.error-text').text(data.error);
      } else {
        $('.login-form .alert-error').hide();
        pb.model.session.check();
      }
    });
  }

  function _onUser() {
    if (pb.model.session.isAuthenticated()) {
      $('.left-bar').show();
      $('.right-panel').show();
      $('.login').hide();
      $('.login-message').text('You are logged in as ' +
          pb.model.session.getEmail());
    }
  }

  function init(el, currentVersion) {
    _currentVersion = currentVersion;

    var _el = el;
    _el.html(pb.tmpl.render('index.main'));

    pb.ui.roomlist.init($('.left-bar'));
    pb.ui.roompanel.init($('.right-panel'));
    pb.ui.ptvoverlay.init($('.ptv-overlay'));

    _el.find('form.signup-form button.submit').click(_submitSignupForm);
    _el.find('form.signup-form').submit(_submitSignupForm);

    _el.find('form.login-form button.submit').click(_submitLoginForm);
    _el.find('form.login-form').submit(_submitLoginForm);

    _el.find('button.fb-login').click(function() {
      pb.model.session.facebookLogin();
    });

    pb.pubsub.subscribe(pb.events.SESSION_USER, _onUser);

    $(window).resize(_sizePanels);
    _sizePanels();

    // Check for updates every once in a while
    _checkForUpdates();
  }

  return {
    init: init
  };
}(pb));

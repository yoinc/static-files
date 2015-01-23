/*!
 * Session-related functions
 */

(function(erly) {
  var Session = function() {
    this.facebookReady = false;
    this.authenticated = false;
    this.currentUser = {};
    $(_(this.setupLogin).bind(this));
  };

  /**
   * Logs out the given user.  If `logoutOfFacebook` is `true`, a Facebook
   * logout will also be performed.
   */
  Session.prototype.logout = function(logoutOfFacebook, noReload) {
    var beforeLogout = function(callback) {
      callback();
    };

    if (logoutOfFacebook && erly.facebookId) {
      beforeLogout = typeof FB === 'undefined' ? beforeLogout : FB.logout;
    }

    beforeLogout(function() {
      $.ajax({
        type: 'get',
        url: '/session/logout',
        complete: function() {
          if (!noReload) {
            window.location.reload();
          }
        }
      });
    });
  };

  /**
   * Returns true if there's a Facebook profile photo or uploaded profile pic
   */
  Session.prototype.hasAvatar = function() {
    var stockAvatar = !this.currentUser.picture ||
      /color-avatar/.test(this.currentUser.picture);
    return Boolean(!stockAvatar || this.currentUser.facebookId);
  };

  /**
   * Returns true if the currently logged in user has connected either
   * Google or Yahoo contacts.
   */
  Session.prototype.hasConnectedContacts = function() {
    return erly.services.isConnected(this.currentUser, 'google') ||
      erly.services.isConnected(this.currentUser, 'yahoo');
  };

  /**
   * Pops open the login dialog.
   */
  Session.prototype.login = function() {
    if ($('.signup-drop-down').length) { erly.modal.close(true); }
    var self = this;
    erly.modal.open({
      html: $('#tmplLoginModal').tmpl(),
      onComplete: function() {
        erly.track.userLogin({path: window.location.pathname});
        erly.modal.resize();
        self.setupLogin();

        var form = $('form#login');
        form.find('input:text').add(form.find('input:password')).
          focus(erly.enterTextField).
          blur(erly.leaveTextField);
      }
    });
  };

  /**
   * Pops open the login dialog if needed.  Return false if the login dialog
   * was shown.
   */
  Session.prototype.requireLogin = function(action, data) {
    if (!erly.userId) {
      if (action) {
        this.setLoginAction(action, data);
      }
      this.login();
      return false;
    }

    return true;
  };

  /**
   * Handle a login form submission.  Field names must include 'email' and
   * 'password'.  Must include 'error-container' div for errors.  'form' is
   * a jquery object for the login form.  'opt_beforeReload' is a function to
   * run before the page is reloaded upon a successful login.
   */
  Session.prototype.handleLoginForm = function(form, opt_beforeReload) {
    var self = this;
    var helper = new erly.FormHelper(form);
    if (!helper.validateCommon()) {
      return;
    }

    var invalidLogin = function() {
      helper.clearErrors();
      helper.showError(
        'Oops! The email address or password you entered is incorrect. ' +
        'Please try again.', null);
    };

    $.ajax({
      url: erly.urlFor.session('login'),
      type: 'POST',
      data: form.serialize(),
      success: function(user) {
        if (user.authenticated) {
          if (opt_beforeReload) opt_beforeReload();
          self.onLogin();
        }
        else {
          // show error
          invalidLogin();
        }
      },
      error: function() {
        invalidLogin();
      }
    });
  };

  /**
   * Behaviorizes any login elements on the current page.
   */
  Session.prototype.setupLogin = function() {
    $('span.facebook-login').click(_(this.facebookLogin).bind(this));

    var self = this;
    var login = $('form#login');
    login.submit(function() { self.handleLoginForm(login); });
  };

  /**
   * Shows a top notifications for common user actions.
   */
  Session.prototype.showTopNotifications = function() {
    var text = '';
    if (/^#user-removed/.test(window.location.hash)) {
      text = 'Your account has been removed.';
    }
    else if (/^#email-verified/.test(window.location.hash)) {
      text = 'Your account email has been verified.';
    }
    else if (/^#email-sent/.test(window.location.hash)) {
      text = 'We have sent a reset password link to your email.';
    }
    else if (/^#password-reset/.test(window.location.hash)) {
      text = 'Your password has been updated.';
    }

    if (text) {
      erly.showTopNotification(function(div) {
        div.addClass('user-notification');
        div.find('span').text(text);
      });
    }
  };

  /**
   * Updates the access token for the current user.
   */
  Session.prototype.updateAccessToken = function(token) {
    $.ajax({
      url: erly.urlFor.session('update_token'),
      type: 'POST',
      data: {accessToken: token},
      success: function(data) {
        if (data.success) {
          erly.oauthToken = token;
        } else {
          console.log('/update_token failed: ' + JSON.stringify(data));
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        var msg = '/update_token failed: ' + textStatus + ': ' +
          JSON.stringify(errorThrown);
        console.log(msg);
      }
    });
  };

  /**
   * Parse the name/email cookie for anonymous users, and store
   * in this.nameEmailCookie.
   */
  Session.prototype.parseNameEmailCookie = function() {
    this.nameEmailCookie = {};
    try {
      this.nameEmailCookie = JSON.parse($.cookie(
        erly.definitions.COOKIE_NAME_AND_EMAIL));
    } catch (e) {
    }
  };

  /**
   * Checks the current session, loads facebook scripts and updates internal
   * variables.  Handles Facebook login changes, etc.
   */
  Session.prototype.init = function(appId, noCheckStatus) {
    var self = this;

    self.facebookAppId = appId;
    $('.login.facebook').addClass('disabled');
    window.fbAsyncInit = function() {
      FB.init({
        appId: appId,
        status: true,
        cookie: true,
        xfbml: true,
        channelUrl: erly.BASE_URL + '/channel.html'
      });

      if (noCheckStatus) return;

      FB.getLoginStatus(function(res) {
        self.facebookReady = true;
        erly.events.fire(erly.events.FACEBOOK_READY);
        $('.login.facebook').removeClass('disabled');
        $('.logout.facebook').removeClass('disabled');

        if (!self.isAuthenticated()) {
          // User is not authenticated to Erly.
          return;
        }
        if (res.status !== 'connected') {
          // User is either logged in to Facebook but not connected to Erly,
          // or not even logged in.
          return;
        }

        var uid = res.authResponse.userID;
        var token = res.authResponse.accessToken;
        if (!uid || !token) {
          console.log('Bad FB.getLoginStatus reply: ' + JSON.stringify(res));
          return;
        }

        if (erly.facebookId && erly.facebookId !== uid) {
          // User is logged in as a different facebook user than our session
          // facebook user; redirect.
          erly.redirectTo('session', 'logout');
          return;
        }
        if (erly.oauthToken && erly.oauthToken !== token) {
          // Oauth token changed; update the server.
          self.updateAccessToken(token);
          return;
        }
      });
    };

    if (noCheckStatus) return;
    self.parseNameEmailCookie();
    self.check(_(self.loadFacebookScripts).bind(self));
  };

  Session.prototype.loadFacebookScripts = function() {
    var e = document.createElement('script'); e.async = true;
    e.src = document.location.protocol +
      '//connect.facebook.net/en_US/all.js';
    document.getElementById('fb-root').appendChild(e);
  };

  /**
   * Returns `true` if a user is Facebook connected.
   * @returns {Boolean}
   */
  Session.prototype.isFacebookConnected = function() {
    return Boolean(erly.oauthToken && erly.facebookId);
  };

  /**
   * Returns `true` if a user can disconnect Facebook.
   * @returns {Boolean}
   */
  Session.prototype.canDisconnectFacebook = function() {
    return Boolean(this.currentUser && this.currentUser.hasPassword);
  };

  /**
   * Returns `true` if a user is logged in according to Erly.
   * @returns {Boolean}
   */
  Session.prototype.isAuthenticated = function() {
    return this.authenticated;
  };

  Session.prototype.enableNavHeader = function() {
    var menu = $('.login-opened');
    var loginHeader = $('#login_header');
    var headerWrapper = $('#header_wrapper');
    var header = headerWrapper.find('.header');
    var originalZIndex = header.css('z-index');
    var shouldClose = false;

    loginHeader.show();

    loginHeader.find('a.name').click(function() {
      erly.redirectTo('gallery', erly.getUserData());
    });

    loginHeader.find('ul.menu li.activityfeed').click(function() {
      erly.redirectTo('/activity/' + erly.userName);
    });

    loginHeader.find('ul.menu li.events').click(function() {
      erly.redirectTo('gallery', erly.getUserData());
    });

    $('#header_wrapper').find('.events-button').click(function() {
      erly.redirectTo('gallery', erly.getUserData());
    });

   $('#header_wrapper').find('.updates-button').click(function() {
      erly.redirectTo('/activity/' + erly.userName);
    });


    var showMenu = function() {
      shouldClose = false;
      if (header.css('z-index') !== 998) {
        header.css('z-index', 998);
        menu.fadeIn(300, function() {
          menu.show();
        });
      }
    };

    var hideMenu = function() {
      shouldClose = true;

      setTimeout(function() {
        if (shouldClose) {
          menu.fadeOut(300, function() {
            header.css('z-index', originalZIndex);
            menu.hide();
          });
        }
      }, 500);
    };

    loginHeader.mouseenter(showMenu);
    $('#login_header .login-opened').mouseleave(hideMenu);
  };

  /**
   * Updates variables for the current session.
   */
  Session.prototype.updateWithServerData = function(callback, data) {
    if (_.keys(data).length > 0 && !data.error) {
      var lheader = $('#login_header');
      if (lheader.length) {
        lheader.html($('#tmplLoginHeader').tmpl(data));
        this.enableNavHeader();
      }
    }

    if (data.created) {
      erly.track.userSignup({path: window.location.pathname});
    }

    if (typeof callback === 'function') {
      callback(data);
    }

    if (data.authenticated) {
      this.currentUser = data;
      this.authenticated = true;
      erly.userId = data.id;
      erly.userName = data.name;
      erly.facebookId = data.facebookId;
      erly.oauthToken = data.oauthToken;
      erly.picture = data.picture;
      this.nameEmailCookie = {};
      if (data.activityCount && data.activityCount > 0) {
        $('.logo a').add('div.top-bar a.home-link')
          .attr('href', erly.urlFor.activity(this.currentUser));
      }
      else {
        $('.logo a').add('div.top-bar a.home-link')
          .attr('href', erly.urlFor.gallery(this.currentUser));
      }
      erly.track.setVisitorLoginStatus({logged_in: true});

      // Store the loginAction if there was one and clear the cookie
      try {
        this.loginAction = JSON.parse($.cookie('la'));
      }
      catch (e) {
        this.loginAction = null;
      }
      $.cookie('la', null);

      erly.events.fire(erly.events.AUTHENTICATED, data);
    }
    else {
      $('.logo a').add('div.top-bar a.home-link')
        .attr('href', erly.BASE_URL);
      erly.track.setVisitorLoginStatus({logged_in: false});
      erly.events.fire(erly.events.NOT_AUTHENTICATED, data);
    }
  };

  /**
   * Checks current session against the server and updates the UI and internal
   * variables based on the response.  Never call this yourself, instead use
   * ensureAuthenticated.
   */
  Session.prototype.check = function(callback) {
    $.ajax({
      type: 'get',
      url: erly.urlFor.session('check'),
      success: _(this.updateWithServerData).bind(this, callback),
      cache: false
    });
  };

  /**
   * Invokes authed immediately if already authed, otherwise attaches to auth
   * events.  unauthed is called if the user is unauthenticated.
   */
  Session.prototype.ensureAuthenticated = function(authed, unauthed) {
    if (this.isAuthenticated()) {
      authed();
    }
    else {
      erly.events.subscribeOnce(erly.events.AUTHENTICATED, authed);
      erly.events.subscribeOnce(erly.events.NOT_AUTHENTICATED,
        unauthed || function() {});
    }
  };

  Session.prototype.showError = function(message) {
    message = $.trim(message);
    if (message.lastIndexOf('.') !== message.length - 1) message += '.';
    message += ' Please contact <a href="mailto:feedback@erly.com">' +
      'feedback@erly.com</a> if this problem persists.';
    erly.modal.showAlert('Login error', message);
  };

  var SESSION_RETRY_TIMEOUT = 1000;
  var MAX_SESSION_RETRY = 3;
  /**
   * Verify the given Facebook session's token actually works using
   * a batch request.
   * @private
   */
  var _verifySession = function(accessToken, tryCount, callback) {
    if (typeof tryCount === 'function') {
      callback = tryCount;
      tryCount = null;
    }
    tryCount = tryCount || 0;

    var batch = [{method: 'GET', relative_url: 'me?fields=id'}];
    erly.facebookBatchCall(batch, accessToken, function(err, res) {
      if (err || res.length !== 1 || !Boolean(res[0])) {
        if (tryCount >= MAX_SESSION_RETRY) {
          callback(null);
        }
        else {
          setTimeout(function() {
            _verifySession(accessToken, tryCount + 1, callback);
          }, SESSION_RETRY_TIMEOUT);
        }
      }
      else {
        callback(((res || [])[0] || {}).id);
      }
    });
  };

  /**
   * Login via the fbs_* cookie if possible (shortcuts lots of BS code).
   */
  var _facebookCookieLogin = function(callback) {
    var cookie = $.cookie('fbs_' + erly.session.facebookAppId);
    if (cookie) {
      var session;
      try {
        session = erly.parseQueryString(JSON.parse(cookie));
      }
      catch(e) {
        // Ignore parse errors
        session = null;
      }

      if (session) {
        callback(session);
        return true;
      }
    }
    return false;
  };

  /**
   * Facebook login callback.
   */
  var _currentFacebookLoginCallback = null;

  /**
   * External callback for the opened window to invoke.  See
   * pub/facebook_window.html.
   * @protected
   */
  window._facebookLoginResult = function(hash) {
    _currentFacebookLoginCallback(
      erly.parseQueryString((hash || '').substring(1)));
    _currentFacebookLoginCallback = null;
  };

  /**
   * Our own FB.login replacement: pops up the facebook auth window and
   * prompts the user to login and/or authorize our app.
   *
   * @param {Function} callback : function(fbSession)
   * @private
   */
  var _facebookLogin = function(callback) {
    if (_facebookCookieLogin(callback)) { return; }

    if (typeof _currentFacebookLoginCallback === 'function') {
      // Invoke the old callback with an error result if we got here again
      // and the current callback is still set
      _currentFacebookLoginCallback({});
    }
    _currentFacebookLoginCallback = null;

    var nextUrl = erly.BASE_URL.replace(/^http:/,
      window.location.protocol === 'https:' ? 'https:' : 'http:');
    var url = 'https://www.facebook.com/connect/uiserver.php?' + $.param({
      app_id: erly.session.facebookAppId,
      method: 'permissions.request',
      display: 'page',
      next: nextUrl + '/facebook_window.html?_=' + new Date().getTime(),
      response_type: 'token',
      fbconnect: 1,
      perms: erly.FACEBOOK_PERMS
    });
    var dims = {
      left: window.screenLeft || window.screenX,
      top: window.screenTop || window.screenY,
      height: $(window).height(),
      width: $(window).width()
    };
    var popup = {width: 1000, height: 600};
    _currentFacebookLoginCallback = callback;
    window.open(url, 'erlyFacebookWindow',
      'width=' + popup.width + ', height=' + popup.height +
      ', menubar=no, toolbar=no' +
      ', left=' + (dims.left + (dims.width - popup.width) / 2) +
      ', top=' + (dims.top + (dims.height - popup.height) / 2));
  };

  /**
   * Perform a facebook login: pops the auth window if necessary, then
   * tries to login by calling /login on the server. If that fails, it
   * then tries to create a new user. If no callback is provided, calls
   * self.onLogin or self.showError.
   *
   * TODO(walt): require callback
   *
   * @param callback: function(err, fb_session).
   */
  Session.prototype.facebookLogin = function(callback) {
    // Just ignore if facebook isn't ready yet... we could setup an event
    // handler but browsers will block the login popup after the event fires
    // since it'll no longer be tied to the click
    if (!this.facebookReady) { return; }

    var self = this;

    if (typeof callback !== 'function') {
      callback = function(err) {
        if (err) {
          self.showError('There was a problem logging into your account: ' +
                         err.message || err.toString());
        } else {
          self.onLogin();
        }
      };
    }

    var session;  // Facebook session that includes 'uid' and 'access_token'.

    // Helper functions.
    var facebookLoginDone, loginWithFacebookSession, createAccountFromFacebook;

    var start = function() {
      // Pop the facebook auth window.
      _facebookLogin(facebookLoginDone);
    };

    facebookLoginDone = function(fbSession) {
      session = fbSession;
      if (!session || !session.access_token) {
        erly.track.fbPermissionsCancel({path: window.location.pathname});
        // TODO: we don't execute the callback if the user cancelled?
        return;
      }

      // Verify the session.
      _verifySession(session.access_token, function(uid) {
        if (!uid) {
          callback(new Error(
            'There was an error verifying your Facebook session, please ' +
              'try again in a few minutes.'));
          return;
        }
        if (!session.uid) {
          session.uid = uid;
        }

        loginWithFacebookSession();
      });
    };

    loginWithFacebookSession = function() {
      // Call /login on our server. If that fails, try to create a new user.
      $.ajax({
        url: erly.urlFor.session('login'),
        type: 'post',
        data: {
          facebookId: session.uid,
          oauthToken: session.access_token
        },
        success: function(data) {
          if (data.authenticated) {
            callback(null, session);
          } else {
            createAccountFromFacebook();
          }
        }
      });
    };

    createAccountFromFacebook = function() {
      // Create a new user account from facebook data. Do a call to
      // fetch the user's name and email.
      erly.facebookSingleCall(
        'me', session.access_token,
        function(err, data) {
          if (err) {
            callback(new Error(
              'There was a problem retrieving your data from Facebook: ' +
                err.message));
            return;
          }
          erly.signup.submit(null, {
            name: data.name,
            email: data.email,
            facebookId: session.uid,
            oauthToken: session.access_token,
            prefill: true
          }, callback);
        }
      );
    };

    start();
  };

  /**
   * Connect Facebook to the currently logged-in account.
   * Displays an error message if unsuccessful and calls back indicating error.
   *
   * @param finalCallback: finalCallback(error).
   */
  Session.prototype.facebookConnectToExistingAccount = function(finalCallback) {
    var self = this;

    var hasError = true;
    var fbSession, uid;

    async.series([
      function(callback) {
        // Pop the facebook window.
        _facebookLogin(function(session) {
          if (!session || !session.access_token) {
            // TODO: is this correct? what if they deny access?
            self.showError('There was a problem connecting your account.');
            callback(hasError);
          } else {
            fbSession = session;
            callback();
          }
        });
      },
      function(callback) {
        // Verify the session and get the uid.
        // TODO: do we need to do this if the session already has a uid?
        _verifySession(fbSession.access_token, function(uid) {
          if (!uid) {
            self.showError('There was an error verifying your Facebook ' +
                           'session, please try again in a few minutes.');
            callback(hasError);
          } else {
            fbSession.uid = uid;
            callback();
          }
        });
      },
      function(callback) {
        // Try to connect the facebook account to this account.
        $.ajax({
          url: erly.urlFor.session('facebook_connect'),
          type: 'post',
          data: {
            facebookId: fbSession.uid,
            oauthToken: fbSession.access_token
          },
          success: function(data) {
            if (data.success) {
              erly.facebookId = fbSession.uid;
              erly.oauthToken = fbSession.access_token;
              callback();
            } else if (data.error &&
                       /connected to another user/.test(data.error.message)) {
              erly.modal.showConfirm(
                'Connect Error',
                'This Facebook account is already linked to another Erly ' +
                  'account.  Would you like to log out of Facebook?',
                'Log out of Facebook', function() {
                  FB.logout(function() {
                    // TODO: does this FB.logout work?
                    //
                    // NOTE: we could just call facebookConnect again,
                    // *BUT* this triggers popup blockers since the
                    // FB.login event is no longer tied to a click
                    // event, so instead we simply show a modal to let
                    // them click the Facebook connect button again.
                    erly.modal.showAlert(
                      'Complete',
                      'You have been logged out of Facebook, ' +
                        'please try again.');
                    callback(hasError);
                  });
                });
            } else {
              self.showError(
                'There was a problem connecting your account to Facebook.');
              callback(hasError);
            }
          }
        });
      }
    ], function(err) {
      if (err) {
        finalCallback(err);
      } else {
        finalCallback();
      }
    });
  };

  /**
   * Set an action string that will end up in a cookie, to stash away
   * some info before the page is reloaded.
   */
  Session.prototype.setLoginAction = function(action, data) {
    $(window).unbind('unload.loginAction');
    $(window).bind('unload.loginAction', function() {
      var payload = {action: action};
      if (data) { payload.data = data; }
      $.cookie('la', JSON.stringify(payload));
    });
  };

  /**
   * Invoked after successful logins.
   *
   * @api public
   */
  Session.prototype.onLogin = function() {
    var path = window.location.pathname;
    if (path.indexOf('/collection/') === 0 ||
        path.indexOf('/fbapp') === 0 ||
        path.indexOf('/session/verify_pending_email') === 0 ||
        path.indexOf('/user/') === 0) {
      window.location.reload();
    }
    else {
      erly.redirectTo('activity', this.currentUser);
    }
  };

  /**
   * Returns true if the user's email is verified
   */
  Session.prototype.hasVerifiedEmail = function() {
    return this.currentUser.emailVerified || this.currentUser.facebookId;
  };

  Session.prototype.showEmailVerificationTopNotificationIfRequired =
    function() {
      this.ensureAuthenticated(function() {
        if (erly.userId && !erly.session.hasVerifiedEmail()) {
          erly.showTopNotification(function(div) {
            div.addClass('user-notification');
            div.find('span').text(
              'Please verify your email address by clicking on the ' +
              'link in your welcome email. ');
            var a = $('<a href="javascript:void(0)"></a>');
            a.click(function() {
              erly.resendEmailVerification();
            });
            a.text('Click here to resend the welcome email');
            div.find('span').append(a);
            div.find('span').append('.');
          });
        }
      });
    };

  /**
   * Clear out invite data from the query string and from the session.
   */
  Session.prototype.clearInvite = function() {
    $.ajax({
      url: '/session/clear_invite',
      success: function() {
        var newLocation = window.location.href.
          replace(/u?inv=[a-zA-Z0-9]+/, '');
        window.location.href = newLocation;
      }
    });
  };

  /**
   * Get current user
   * TODO: integrate into Session.
   */
  erly.getUserData = function() {
    return erly.session.currentUser;
  };

  erly.session = new Session();
  $(erly.session.showTopNotifications);
}(erly));

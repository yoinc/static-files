/*!
 * Signup handler
 */
(function(erly) {
  var signup = {};

  var _returnPath = null;

  /**
   * Prefills the vanity name given a first/last name
   */
  signup.attemptVanityNamePrefill = function(form, fname, lname) {
    // Kick off vanityName check
    $.ajax({
      url: erly.urlFor.session('unique_vanity_name'),
      type: 'POST',
      data: {firstName: fname, lastName: lname},
      success: function(data) {
        if (data.success) {
          form.find('input[name=vanityName]').val(data.vanityName);
        }
      }
    });
  };

  /**
   * Shows a signup modal that can be used on any page.
   *
   * @api public
   */
  signup.showModal = function() {
    if ($('.login-drop-down').length) { erly.modal.close(true); }
    erly.modal.open({
      html: $('#tmplSignupModal').tmpl({
        name: (erly.session.nameEmailCookie || {}).name,
        email: (erly.session.nameEmailCookie || {}).email
      }),
      onComplete: function() {
        var form = $('form#signup1');
        form.submit(function() {
          signup.submit(form);
        });
        signup.commonFormSetup(form);
      }
    });
  };

  /**
   * Checks the bound input field against currently existing vanity names.
   *
   * NOTE: this method is also used on the settings page.
   */
  signup.checkVanityName = function() {
    var el = $(this);
    var name = $.trim(el.val());

    // Remove shadow on parent
    el.parents('.custom-url-container').removeClass('error-shadow');

    if (!name) {
      el.parent().next('.availability').text('').removeClass('available taken');
      return;
    }

    $.ajax({
      url: erly.urlFor.session('check_field'),
      type: 'post',
      data: {field: 'vanityName', value: name},
      success: function(data) {
        if (!data.error) {
          if (data.exists) {
            el.parent().next('.availability').text(
              'URL Taken').removeClass('available').addClass('taken');
          }
          else {
            el.parent().next('.availability').text(
              'URL Available').removeClass('taken').addClass('available');
          }
        }
        else {
          el.parent().next('.availability').text(
            'Invalid format').removeClass('available').addClass('taken');
        }
      }
    });
  };

  /**
   * This is called when the user clicks the facebook button on the splash
   * page.
   *
   * Sign up using facebook. Log the user in if they already have an account.
   */
  signup.handleFacebookClick = function(form) {
    if (!erly.session.facebookReady) { return; }

    var helper = new erly.FormHelper(form);
    helper.clearErrors();

    erly.session.facebookLogin(function(err, session) {
      erly.hideLoginLoader();
      if (err) {
        helper.showError('There was an error logging you into our ' +
                         'service, please try again in a few minutes.');
        erly.trackException(err);
        return;
      }

      // If we get to here, the login either succeeded, or we already
      // created a new account for this facebook user and logged them
      // in successfully.  Just reload the page.
      erly.session.onLogin();
    });
  };


  /**
   * Creates a new user after validating
   */
  signup.submit = function(form, data, callback) {
    var helper = form ? new erly.FormHelper(form) : null;

    // Don't validate if data is provided, assume it's a facebook click.
    if (!data) {
      if (!helper || !helper.validateCommon()) {
        return;
      }
    }

    var shouldReload = false;
    if (typeof callback !== 'function') {
      shouldReload = true;
      if (helper) {
        callback = function(err) {
          if (err) helper.showError(err);
        };
      }
      else {
        callback = function(err) {
          if (err) erly.modal.showAlert(err);
        };
      }
    }

    $.ajax({
      type: 'post',
      url: erly.urlFor.session('create_user'),
      data: data ? data : $(form).serialize(),
      success: function(data) {
        if (data.created) {
          erly.events.fire(erly.events.NEW_USER);
          if (shouldReload) {
            if (_returnPath) {
              window.location = _returnPath;
            } else {
              window.location.reload();
            }
          }
          else {
            callback();
          }
        } else if (data.error) {
          callback(data.error.message);
        } else {
          callback('Server error while processing your signup');
        }
      },
      error: function(jqXHR, status, err) {
        callback('Server error while processing your signup');
      }
    });
  };

  signup.commonFormSetup = function(form) {
    form.find('span.facebook-signup').click(function() {
      signup.handleFacebookClick(form);
    });
  };

  /**
   * Behaviorizes homepage signup form
   * @private
   */
  signup.init = function() {
    var form = $('form#signup');
    if (erly.session.nameEmailCookie) {
      form.find('input[name="name"]').val(erly.session.nameEmailCookie.name);
      form.find('input[name="email"]').val(erly.session.nameEmailCookie.email);
    }
    form.submit(function() { signup.submit(form); });
    signup.commonFormSetup(form);
  };

  /**
   * Where to go after signup completion.
   */
  signup.setReturnPath = function(returnPath) {
    _returnPath = returnPath;
  };

  erly.signup = signup;
}(erly));

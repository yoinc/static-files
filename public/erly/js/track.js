/*global _gaq: true */
/*!
 * Event tracking
 */

(function(erly) {
  var track = {};

  // category, action, label, value (only category and action are required)
  // __gaq.push(['_trackEvent', category, action, label, value(int)]);

  track._trackEvent = function(category, action) {
    var i;
    var eventArr = ['_trackEvent', category, action];
    for (i = 2; i < arguments.length; i++) {
      eventArr.push(arguments[i]);
    }
    // console.log('_gaq.push(' + eventArr + ');');
    _gaq.push(eventArr);
  };

  track.userSignup = function(options) {
    if (!options) {
      options = {};
    }
    this._trackEvent('User', 'signup', options.path);
    if (window.location.href.indexOf('emailref=') !== -1) {
      // todo track the actual email type by parsing href.
      this._trackEvent('User', 'signup', 'emailref');
    }
  };

  track.userDeletion = function(confirmed, callback) {
    this._trackEvent('User', 'delete', confirmed ? 'confirmed' : 'clicked');
    if (typeof callback === 'function') {
      _gaq.push(callback);
    }
  };

  track.userLogin = function(options) {
    if (!options) {
      options = {};
    }
    this._trackEvent('User', 'login', options.path);
  };

  track.fbPermissionsCancel = function(options) {
    if (!options) {
      options = {};
    }
    this._trackEvent('Login', 'permissions_cancel', options.path);
  };

  track.servicePaired = function(options) {
    this._trackEvent('Service', 'paired');
  };

  track.postCreate = function(options) {
    if (!options) {
      options = {};
    }
    this._trackEvent('Post', 'created', "type_" + options.type, options.id);
    this._trackEvent('Post', 'created', "role_" + options.role, options.id);
    this._trackEvent('Post', 'created', "source_" + options.source, options.id);
    if (options.fulfilled) {
      this._trackEvent('Post', 'created', "request_fulfilled", options.id);
    }
  };

  track.postStart = function(options) {
    this._trackEvent('Post', 'started', options.type);
  };

  track.chronicleCreate = function(options) {
    if (!options) {
      options = {};
    }
    this._trackEvent('Chronicle', 'created', options.seed ? options.seed.type : 'noseed');
  };

  track.commentCreate = function(options) {
    if (!options) {
      options = {};
    }
    this._trackEvent('Comment', 'created');
  };

  // track.tagUser({invite: true/false}) to track whether the new tag is erly or not. (at tag time)
  track.tagUser = function(options) {
    if (!options) {
      options = {};
    }
    if (options.invite) {
      this._trackEvent('Tags', 'created', 'email_invite', options.count || 0);
    } else {
      this._trackEvent('Tags', 'created', 'erly_user', options.count || 0);
    }
  };

  track.geoLookup = function(options) {
    if (!options) {
      options = {};
    }
    this._trackEvent('Geo', 'lookup', options.success ? 'success' : 'fail');
  };


  track.setVisitorLoginStatus = function(options) {
    if (!options) {
      options = {};
    }
    var cArr = ['_setCustomVar', 1, 'Authenticated', options.logged_in ? 'true' : 'false', 1];
    _gaq.push(cArr);
  };

  erly.track = track;
}(erly));

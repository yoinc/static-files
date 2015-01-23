pb.model.session = (function(pb) {
  var _user = null;
  var _fbAppId = null;
  var _fbScope = null;
  var _appHost = null;
  var _refreshTimer = null;

  function init(appHost, fbAppId, fbScope) {
    _fbAppId = fbAppId;
    _fbScope = fbScope;
    _appHost = appHost;

    window.fbAsyncInit = function() {
      check();
      FB.init({
        appId: _fbAppId,
        status: true,
        xfbml: true,
        cookie: true,
        channelUrl: '/channel.html'
      });

      FB.getLoginStatus(function(res) {
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
      });
    };
    _loadFacebookScripts();
    _refreshTimer = setInterval(_refreshSession, 24 * 3600 * 1000);
  }

  function check() {
    $.get('/user/checkSession', function(data) {
      if (data.success) {
        _user = data.data.user;
        pb.channel.connect();
        pb.pubsub.publish(pb.events.SESSION_USER);
      }
    });
  }

  function _refreshSession() {
    if (_user) {
      // once per day, will refresh the session via the middleware
      $.post('/user/refreshSession', {}, function(data) {
        if (!data.success) {
          document.location.reload();
        }
      });
    }
  }

  function _loadFacebookScripts() {
    var e = document.createElement('script'); e.async = true;
    e.src = document.location.protocol +
      '//connect.facebook.net/en_US/all.js';
    document.getElementById('fb-root').appendChild(e);
  }

  function isAuthenticated() {
    return !!_user;
  }

  function getEmail() {
    return _user.email;
  }

  function getUserId() {
    return _user._id;
  }

  function setAuthenticatedUser(data) {
    _user = data.user;
    pb.channel.connect();
    pb.pubsub.publish(pb.events.SESSION_USER);
  }

  function getRoomList() {
    return _user.rooms;
  }

  function getRoomHistoryStartTime(roomId) {
    return (_user.historyStartTime &&
     _user.historyStartTime[roomId]) || 0;
  }

  function getActiveRoom() {
    return null;
  }

  function getContacts(callback) {
    // only returns fb friends now
    return callback(_user.fbContacts);
  }

  function facebookLogin() {
    FB.login(function(res) {
      if(res.status === 'connected') {
        FB.api('/me', function(profile) {
          $.post('/user/facebookLogin', {
            accessToken: res.authResponse.accessToken,
            userId: res.authResponse.userID,
            expiresIn: res.authResponse.expiresIn,
            name: profile.name,
            /*jslint camelcase: false */
            firstName: profile.first_name,
            lastName: profile.last_name,
            /*jslint camelcase: true */
            verified: profile.verified,
            email: profile.email,
            gender: profile.gender
          }, function() {
            check();
          });
        });
      } else {
        console.log(res);
      }
    }, {scope: _fbScope});
  }

  return {
    check: check,
    facebookLogin: facebookLogin,
    getEmail: getEmail,
    getContacts: getContacts,
    getRoomHistoryStartTime: getRoomHistoryStartTime,
    getRoomList: getRoomList,
    getUserId: getUserId,
    getActiveRoom: getActiveRoom,
    init: init,
    isAuthenticated: isAuthenticated,
    setAuthenticatedUser: setAuthenticatedUser
  };
}(pb));

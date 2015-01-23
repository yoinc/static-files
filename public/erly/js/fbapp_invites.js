/*!
 * Handling for rendering invites inside our facebook app.
 */
(function(erly) {
  erly.fbappInvites = {};

  var layoutComplete = false;
  var fbReady = false;

  var setCanvasSize = function() {
    if (layoutComplete && fbReady) {
      $('body').imagesLoadedTimeout(function() {
        FB.Canvas.getPageInfo(function(info) {
          var minHeight = info.clientHeight - 108;
          var height = Math.max(
            minHeight,
            $('div.header').outerHeight(true) +
              $('div.invites').outerHeight(true) +
              $('div.no-invites').outerHeight(true));
          FB.Canvas.setSize({ height: height });
        });
      });
    }
  };

  var showRsvpOptions = function() {
    $('.fb-connect').hide();
    $('.rsvp-option').show();
  };

  erly.fbappInvites.renderInvites = function(inviteData) {
    erly.events.subscribeOnce(erly.events.AUTHENTICATED, showRsvpOptions);

    erly.events.subscribeOnce(erly.events.FACEBOOK_READY, function() {
      fbReady = true;
      setCanvasSize();
    });

    if (inviteData.length === 0) {
      $('div.no-invites').fadeIn();
      layoutComplete = true;
      setCanvasSize();
      return;
    }

    var invites = $('#tmplFBInvite').tmpl(inviteData);

    $('div.invites').append(invites);

    invites.find('a').attr('target', '_blank');

    invites.find('.rsvp-button').click(function(e) {
      if (e.which > 1) {
        return;
      }

      var button = $(this);

      window.open(button.data('href'));

      return false;
    });

    invites.find('.fb-connect-button').click(function(e) {
      if (e.which > 1) {
        return;
      }

      erly.session.facebookLogin(function(err) {
        if (err) return erly.trackException(err);

        // If session.check() succeeds, it will fire erly.events.AUTHENTICATED,
        // which will in turn call showRsvpOptions.
        erly.session.check();
      });
    });

    invites.each(function() {
      var invite = $(this);
      erly.centerImage(invite.find('div.image-container img'));

      var data = invite.tmplItem().data;
      var title = invite.find('div.image-container div.title');
      title.css('top', 'auto').css('bottom', 'auto').css(
        'left', 'auto').css('right', 'auto');
      _.each(data.chronicle.metadataPosition || {
        top: '5%',
        left: '5%'
      }, function(v, k) {
        title.css(k, v);
      });

      erly.viewer.Metadata.applyStyle(title, data.chronicle.metadataStyle ||
        erly.viewer.DEFAULT_METADATA_STYLE);
    });


    layoutComplete = true;
    setCanvasSize();
  };
}(erly));

/*!
 * Timeline (Gallery) handling
 */

(function(erly) {
  var fbapp = {};

  /**
   * Bind the "updates" and "invitations" buttons on top.
   */
  fbapp.bindNav = function() {
    $('.header .navbar .updates').click(function(e) {
      if (e.which > 1) {
        return;
      }

      window.location = '/fbapp/';
    });

    $('.header .navbar .invitations').click(function(e) {
      if (e.which > 1) {
        return;
      }

      window.location = '/fbapp/?page=invitations';
    });
  };

  /**
   * Calls FB api to resize our iframe.
   */
  var resizeCanvas = function() {
    if (typeof FB !== 'undefined') {
      // TODO: set an explicit height? If we don't set explicitly, the height
      // can never shrink.
      FB.Canvas.setSize();
    }
  };

  /**
   * If 'o' is a facebook object representing an album, return an album;
   * otherwise return null.
   */
  var facebookObjectToAlbum = function(o) {
    if (o.cover_object_id === '0') {
      return null;
    }
    return {
      album_id: o.aid,
      object_id: o.object_id,
      location: o.location,
      created: o.created,
      caption: o.name,
      cover_art_id: o.cover_object_id,
      cover_art: 'https://graph.facebook.com/' +
        o.cover_object_id +
        '/picture?type=normal&access_token=' +
        encodeURIComponent(erly.oauthToken)
    };
  };

  /**
   * Fetch albums from facebook. Calls back with error or array of albums.
   */
  var getMyFacebookAlbums = function(offset, limit, callback) {
    var res_albums = [];
    var batch = [{
      method: 'POST',
      relative_url: 'method/fql.query?' +
        $.param({
          query: 'SELECT aid, object_id, cover_object_id, location,' +
            ' created, name' +
            ' FROM album WHERE owner=me()' +
            ' ORDER BY created DESC LIMIT ' + offset + ',' + limit
        })
    }];

    erly.facebookBatchCall(batch, function(err, res) {
      if (err) {
        callback(err);
        return;
      }

      var albums = _.map(res[0], facebookObjectToAlbum);
      var a = _.filter(albums, function(x) { return x && x.cover_art; });
      callback(null, a);
    });
  };

  /**
   * Submit a request to create an event from this album.
   */
  var sendCreateEventFromAlbum = function(album, contentDiv) {
    var suggestion = {
      source: 'facebook',
      type: 'album',
      id: album.object_id,
      location: album.location,
      cover_photo: album.cover_art
    };
    $.ajax({
      type: 'post',
      url: '/collection',
      data: {
        isSuggestion: '1',
        title: album.caption,
        createdDate: album.created,
        $data_json: JSON.stringify(suggestion)
      },
      success: function(data) {
        var html = $('#tmplFBAlbumCreateSuccess').tmpl({
          url: erly.urlFor.collection(data),
          caption: album.caption,
          cover_art: album.cover_art
        });
        contentDiv.html(html);
        erly.centerImage(html.find('.art img'), null, null, {
          ajaxLoaderQualifier: '-222222'
        });
        erly.modal.resize();
      },
      error: function(jqXHR, status, err) {
        erly.trackException(err);
        contentDiv.html($('#tmplFBAlbumCreateFailure').tmpl({}));
      }
    });
  };

  /**
   * Fetch and render one page of user's facebook albums.
   * Places content into 'pageDiv'.
   * Calls back with error, or the number of albums rendered.
   */
  var renderMyFacebookAlbums = function(offset, limit, pageDiv, callback) {
    var done = function(err, albums) {
      if (err) {
        callback(err);
        return;
      }
      var rendered = [];
      _.each(albums, function(album) {
        var aDiv = $('#tmplFacebookAlbum').tmpl(album);
        aDiv.click(function(e) {
          // Open modal. We explicitly set top pixels since this is
          // opening inside our iframe, so colorbox computes the
          // positioning incorrectly.
          var modalDiv = $('#tmplFBAlbumCreateModal').tmpl();
          erly.modal.open({
            html: modalDiv,
            top: '45px',
            onComplete: function() {
              sendCreateEventFromAlbum(album, modalDiv.find('.content'));
            }
          });
        });
        rendered.push(aDiv);
      });

      if (rendered.length > 0) {
        pageDiv.html('');
        _.each(rendered, function(x) {
          pageDiv.append(x);
          erly.centerImage(x.find('.art img'), null, null, {
            ajaxLoaderQualifier: '-222222'
          });
        });
      }
      callback(null, rendered.length);
    };
    getMyFacebookAlbums(offset, limit, done);
  };

  var enableAlbumButtons = function() {
    var _albumsPerPage = 6;
    var _curPage = -1;
    var _maxPage = -1;  // max page we have loaded
    var _lastPage = -1;  // -1 until we discover which page is last
    var _container = $('.facebook-album-container');
    var _pageWidth = 660;  // TODO(walt): can we pull this from the css?
    var _pageLoading = false;

    var slideDiv = function(pages) {
      var left = erly.cssPixels(_container, 'margin-left');
      left -= pages * _pageWidth;
      _container.css('margin-left', left);
      _curPage += pages;
    };

    var makeAndLoadPage = function(page) {
      // Make room for a new page in the container, add in the new
      // page with a loading spinner, start loading the albums into
      // the page, and finally slide it into view.
      var pageDiv = $('#tmplFBAlbumPage').tmpl();
      _container.width(_container.width() + _pageWidth);
      _container.append(pageDiv);
      _pageLoading = true;
      if (page > _maxPage) {
        _maxPage = page;
      }
      renderMyFacebookAlbums(
        page * _albumsPerPage, _albumsPerPage, pageDiv,
        function(err, n) {
          _pageLoading = false;
          if (err) {
            _lastPage = page;
            console.log('Facebook album error: ' + JSON.stringify(err));
            pageDiv.html(
              '<div class="error">' +
                'Sorry, there was a Facebook error, please try reloading.' +
                '</div>');
          } else {
            if (n < _albumsPerPage) {
              _lastPage = page;
            }
          }
        }
      );
    };

    $$('.facebook-album-selector .button-left').click(function() {
      // We never have to render anything when clicking left, since we
      // keep everything loaded and we always start at page 0. We only
      // have to slide the div.
      if (_curPage > 0) {
        slideDiv(-1);  // updates _curPage
      }
    });

    $$('.facebook-album-selector .button-right').click(function() {
      // If there is a page currently loading, or we are at the end,
      // ignore the click.
      if (_pageLoading || _curPage === _lastPage) {
        return;
      }

      // Only need to load a page if we haven't already loaded it.
      if (_curPage >= _maxPage) {
        makeAndLoadPage(_curPage + 1);
      }
      slideDiv(1);  // updates _curPage
    });

    $$('.choose-album button').click(function() {
      _curPage = 0;
      makeAndLoadPage(0);
      $('.facebook-album-selector').slideToggle('slow', function() {
        resizeCanvas();
      });
    });
  };

  /**
   * Init the facebook feed page. The activity feed has already been
   * initialized.
   */
  fbapp.initFeed = function(user) {
    erly.events.subscribe(erly.events.PAGE_READY, function() {
      // Called every time more activity feed items finish loading.
      resizeCanvas();
    });

    // Load facebook SDK first, then initialize the page.
    erly.events.subscribeOnce(erly.events.FACEBOOK_READY, function() {
      enableAlbumButtons();
      erly.activity.init(user);
    });
  };

  erly.fbapp = fbapp;
}(erly));

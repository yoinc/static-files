/*!
 * Timeline (Gallery) handling
 */

(function(erly) {
  var gallery = {};

  // Constants
  var BANNER_IMAGE_WIDTH = 345;
  var BANNER_ARROW_WIDTH = 11;
  var BANNER_ARROW_INDENT = 10;
  var ADDITIONAL_CALENDAR_MARGIN = 2;

  var PAGE_SIZE = 20;

  // private data
  var _collections = [];
  var _pastEvents = [];
  var _futureEvents = [];
  var _currentOffset = 0;
  var _featuredFetched;
  var _total = null;

  gallery.init = function(user) {
    if (typeof user === 'undefined' || !user) return;

    var self = this;

    $('div.header .navbar').add('div.header .beta-logo').remove();

    self.user = user;
    self.hookEvents();

    erly.session.ensureAuthenticated(function() {
      if (self.user.id === erly.userId && !erly.session.hasAvatar()) {
        $('h2 img.face').replaceWith(
          $('#tmplReplaceableAvatar').tmpl(erly.session.currentUser));
        _.defer(function() {
          var form = $('h2 form.profile-picture');
          form.parent().addClass('replaceable-avatar');
          erly.settings.uploadize(form.find('div.add-pic'), form, 'picture',
            true);
          $('a.add-pic-link').click(function() {
            form.find('div.add-pic input').click();
          });
          erly.events.subscribe(erly.events.PROFILE_PICTURE_CHANGED,
            function() {
              form.parent().removeClass('replaceable-avatar');
            }
          );
        });
      }
    });

    return self;
  };

  gallery.hookEvents = function() {
    erly.events.subscribe(erly.events.NOT_AUTHENTICATED,
      _(this.fetchAndLayout).bind(this));
    erly.events.subscribe(erly.events.AUTHENTICATED,
      _(this.fetchAndLayout).bind(this));
  };

  gallery.hookWindowEvents = function() {
    erly.onScrollNearFooter(gallery.loadMore);
  };

  gallery.bindCollectionBehaviors = function() {
    var self = this;

    $('.collection').each(function() {
      var collection = $(this);

      var user = collection.find('.user');
      var contributors = user.find('.contributors');
      var inMasthead = Boolean(collection.parents('.featured-masthead').length);
      if (!inMasthead && contributors.length > 0) {
        user.hoverUp(contributors, {
          repositionLeft: true,
          setupFunc: function() {
            var data = user.tmplItem().data;
            $.get(erly.urlFor.collection(data, 'tags'), function(tags) {
              // Hacky way to show the (owner) label
              _(tags).each(function(t) {
                t.ownerId = data.owner.id;
              });

              // Sort owner first, current user second, rest alpha
              tags.sort(function(a, b) {
                var aUserId = !a.isInvite && a.id;
                var bUserId = !b.isInvite && b.id;
                var aOwner = aUserId === data.owner.id;
                var bOwner = bUserId === data.owner.id;

                if (aOwner || (aUserId === erly.userId && !bOwner)) {
                  return -1;
                }
                else if (bOwner || (bUserId === erly.userId && !aOwner)) {
                  return 1;
                }
                else {
                  return a.name > b.name ? 1 : b.name > a.name ? -1 : 0;
                }
              });

              tags = _(tags).filter(function(t) {
                return t.taggingInfo && t.taggingInfo.rsvpState === 'yes';
              });

              self.renderFriends(tags, contributors.find('.friends'));
            });
          }
        });
      }

      var overlay = collection.find('.overlay');
      var shouldHover = false;
      collection.hover(function() {
        shouldHover = true;
        setTimeout(function() {
          if (shouldHover) {
            collection.addClass("shadow-wide");
            overlay.stop(true, true).fadeIn();
          }
        }, 100);
      }, function() {
        shouldHover = false;
        collection.removeClass("shadow-wide");
        overlay.stop(true, true).fadeOut();
      });

      var remove = collection.find('.remove');
      remove.click(function(e) {
        if (e.which === 1) {
          var data = collection.tmplItem().data;
          var deleteCollection = !data.isSeed && !data.isSuggestion;
          var what = deleteCollection ? 'Event' : 'Suggestion';

          var message = 'Are you sure you want to delete "' + data.title + '"?';

          erly.modal.showConfirm('Delete ' + what, message, 'Delete ' + what,
            function() {
              if (deleteCollection) {
                if (data.owner && data.owner.id === erly.userId) {
                  $.post(erly.urlFor.collection(data, 'delete'), {});
                }
                else {
                  $.post(erly.urlFor.collection(data, 'untag'), {
                    id: erly.userId
                  });
                }
              }
              else if (data.isSuggestion) {
                $.post(erly.urlFor.collection(data, 'suggested', 'remove'), {
                  erlyUserId: self.user.id
                });
              }

              collection.remove();
              _collections = _.filter(_collections, function(c) {
                return c !== data;
              });
              _pastEvents = _.filter(_pastEvents, function(c) {
                return c !== data;
              });
              _futureEvents = _.filter(_futureEvents, function(c) {
                return c !== data;
              });

              _total -= 1;
              _currentOffset -= 1;

              self.layout();
          }, {type: 'remove'});

          e.preventDefault();
          return false;
        }
      });
    });
  };

  gallery.fetchNextPage = function(callback) {
    if (_total === 0 ||
        _total && _collections && _total <= _collections.length) {
      return callback(false);
    }

    $.ajax({
      type: 'get',
      url: erly.urlFor.gallery(this.user, 'summary'),
      data: {
        limit: PAGE_SIZE,
        offset: _currentOffset
      },
      success: function(results) {
        var data = results.data;
        _.each(data, erly.updateEventWithCalculatedFields);
        if (!_total) {
          _total = results.total;
        }
        _currentOffset += data.length;
        _collections = _collections.concat(data);
        // separate into upcoming/recent
        _(data).forEach(function(c) {
          (c.startDate <= new Date() ? _pastEvents : _futureEvents).push(c);
        });


        if (typeof callback === 'function') {
          callback(true);
        }
      }
    });
  };

  gallery.renderFriends = function(friends, friendsContainer) {
    var self = this;
    var scrollable = $('<div class="friend-scroll"/>');
    scrollable.append($('#tmplFriend').tmpl(friends));
    friendsContainer.empty().append(scrollable);

    friendsContainer.find('.friend').click(function() {
      var friendData = $(this).tmplItem().data;
      if (friendData.isInvite) {
        return;
      }

      if (friendData.id === self.user.id) {
        return;
      }

      erly.redirectTo('gallery', friendData);
    });

    // NOTE: need to refind the scrollable for jScrollPane to work
    scrollable = friendsContainer.find('.friend-scroll');
    var api = scrollable.jScrollPane().data('jsp');
    scrollable.bind('jsp-scroll-y', _(api.reinitialise).bind(api));
  };

  gallery.fetchFriends = function() {
    if (!erly.session.isAuthenticated()) { return; }
    var self = this;
    var friendsContainer = $('.friends-wrapper .friends');
    var user = this.user;

    if (this.fetchedFriends) {
      self.renderFriends(this.fetchedFriends, friendsContainer);
      return;
    }

    $.get(erly.urlFor.gallery(user, 'friends'), function(data) {
      if (data && _.isArray(data)) {
        data.sort(function(a, b) {
          if (a.id === erly.userId) {
            return -1;
          }
          if (b.id === erly.userId) {
            return 1;
          }
          return b.chronicleCount - a.chronicleCount;
        });
        self.fetchedFriends = data;
        self.renderFriends(data, friendsContainer);
      }
      else {
        self.fetchFriends = [];
      }
    });
  };

  gallery.layout = function(options) {
    options = options || {};

    this.fetchFeatured();
    this.showStartPane();
    this.layoutCards();
    this.layoutFooter();
    this.bindCollectionBehaviors();
    this.view.afterLayout({shouldFadeIn: true});

    erly.events.fire(erly.events.PAGE_READY);
  };

  gallery.showStartPane = function() {
    $('.start-pane').find('.start-button').click(function(e) {
      if (e.which > 1) {
        return;
      }

      window.location = '/create_event';
    });

    if (_collections.length === 0 && (this.user.id === erly.userId)) {
      $('.start-pane').show();

      gallery.updateLine();
    }
  };

  gallery.fetchFeatured = function() {
    if (_featuredFetched) {
      return;
    }

    _featuredFetched = true;

    erly.featured.fetch(0, 6, function(results) {
      if (!results || results.length === 0) {
        return;
      }
      results = {data: results};

      // we only fetch this once, so render it now
      var featured = $('#tmplFeaturedPane').tmpl({
        collections: results.data
      });

      $('.gallery-footer').after(featured);

      var updateVisibility = function() {
        if ($.cookie('hide_featured')) {
          featured.find('.featured-pane').hide();
          featured.find('.open-featured').show();
        }
        else {
          featured.find('.featured-pane').show();
          featured.find('.open-featured').hide();
        }
        gallery.updateLine();
      };
      updateVisibility();

      featured.find('.image-container img').each(function() {
        erly.centerImage($(this));
      });

      featured.find('.remove').click(function(e) {
        if (e.which > 1) {
          return;
        }

        $.cookie('hide_featured', '1');
        updateVisibility();
      });

      featured.find('.open-featured').click(function(e) {
        if (e.which > 1) {
          return;
        }

        $.cookie('hide_featured', '');
        updateVisibility();
      });

      featured.find('.collection').each(function(i) {
        var collection = $(this);
        var overlay = collection.find('.overlay');
        var shouldHover = false;

        var title = collection.find('.small-title');
        var collectionData = results.data[i];
        if (collectionData.metadataPosition) {
          title.css('top', 'auto').css('bottom', 'auto').css(
            'left', 'auto').css('right', 'auto');
          _(collectionData.metadataPosition).each(function(v, k) {
            title.css(k, v);
          });
        }
        else {
          title.css('top', '5%').css('left', '5%');
        }

        if (collectionData.metadataStyle) {
          erly.viewer.Metadata.applyStyle(title,
            collectionData.metadataStyle);
        }
        else {
          erly.viewer.Metadata.applyStyle(title,
            erly.viewer.DEFAULT_METADATA_STYLE);
        }

        erly.checkEllipsis(title.find('span'), 36, 18);

        collection.hover(function() {
          shouldHover = true;
          setTimeout(function() {
            if (shouldHover) {
              collection.addClass("shadow-wide");
              overlay.stop(true, true).fadeIn();
            }
          }, 100);
        }, function() {
          shouldHover = false;
          collection.removeClass("shadow-wide");
          overlay.stop(true, true).fadeOut();
        });
      });
    });
  };

  // Reset variables and load
  gallery.fetchAndLayout = function() {
    var self = this;

    _collections = [];
    _futureEvents = [];
    _pastEvents = [];

    _total = null;
    _currentOffset = 0;
    $('.gallery-wrapper .loader').show();
    this.fetchNextPage(function(loadedMore) {
      self.hookWindowEvents();
      $('.gallery-wrapper .loader').show();
      $('.gallery-container .line').show();
      gallery.layout();
    });

    erly.session.showEmailVerificationTopNotificationIfRequired();
  };

  /**
   * Prevents load more events if this is true
   * @private
   */
  var _fetchingMore = false;

  gallery.loadMore = function() {
    if (_fetchingMore) { return; }

    _fetchingMore = true;
    gallery.fetchNextPage(function(loadedMore) {
      _fetchingMore = false;
      if (loadedMore) {
        gallery.layout();
      }
    });
  };

  gallery.layoutCards = function() {
    $('.gallery-wrapper .loader').hide();
    // Use a seeded random to preserve the layout across reloads
    Math.seedrandom(this.user.ident);
    var noCards = true;

    $('.gallery-wrapper .gallery .container').empty();

    _([['upcoming', _futureEvents], ['recent', _pastEvents]]).forEach(function(group) {
      _(group[1]).forEach(function(collection, i) {
        noCards = false;

        $('.gallery-wrapper .gallery.' + group[0] + ' .container').append(
          $("#tmplCollection").tmpl(collection).addClass(
            i % 2 === 0 ? 'left' : 'right'));
      });
    });
    if (noCards && (!erly.session.isAuthenticated() ||
        erly.session.currentUser.id !== this.user.id)) {
      $('.empty-gallery').show();
    }
  };

  gallery.view = {};

  gallery.view.fadeIn = function(shouldFadeIn) {
    if (shouldFadeIn) {
      _.each($('.gallery').toArray(), function(el) {
        var shouldFadeIn = true;
        el = $(el);

        if (el.hasClass('upcoming')) {
          shouldFadeIn = _futureEvents.length > 0;
        } else if (el.hasClass('recent')) {
          shouldFadeIn = _pastEvents.length > 0;
        }

        if (shouldFadeIn) {
          el.fadeIn(400);
        } else {
          el.hide();
        }
      });
    }
  };

  gallery.view.setMinHeight = function() {
    $('.gallery-container').css('min-height', 0);
  };

  gallery.view.centerImages = function() {
    var windowHeight = $(window).height() * 2;
    var windowScrollTop = $(window).scrollTop();
    $('.gallery .collection.lazy-load').
        add('.featured-outer .collection.lazy-load').
        each(function() {
      var collection = $(this);
      var colTop = collection.offset().top - windowScrollTop;
      var colHeight = collection.outerHeight();

      if (colTop + colHeight > 0 && colTop < windowHeight) {
        var data = collection.tmplItem().data;

        var container = collection.find('.image-container');
        var photo = data.coverPhoto;

        var coverImage = $('<img src="' +
        ((photo && photo.url) || erly.DEFAULT_COVER_PHOTO) +
        '" />');
        container.append(coverImage);
        coverImage.animate({
          opacity: 0.01
        }, 0);

        erly.centerImage(coverImage, null, null, {
          letterbox: {
            opacity: 0
          }
        });

        collection.removeClass("lazy-load");
      }
    });
  };

  gallery.view.centerImagesThrottled = _.throttle(
    gallery.view.centerImages, 250);

  gallery.view.placeTitles = function() {
    $('div.gallery .collection').
        add('div.featured-outer .collection').
        each(function() {
      var data = $(this).tmplItem().data;
      var position = data.metadataPosition || {left: '5%', top: '5%'};
      var el = $(this).find('.metadata-attributes');
      el = el.length ? el : $(this).find('.small-title');

      el.css('top', 'auto').css('bottom', 'auto').css(
        'left', 'auto').css('right', 'auto');
      _(position).each(function(v, k) {
        el.css(k, v);
      });

      if (data.metadataStyle) {
        erly.viewer.Metadata.applyStyle(el, data.metadataStyle);
      }
      else {
        erly.viewer.Metadata.applyStyle(el, erly.viewer.DEFAULT_METADATA_STYLE);
      }

      erly.checkEllipsis(el.find('span'), 36, 18);
    });
  };

  gallery.updateLine = function() {
    $('.gallery-container .line').height(
      $('.gallery-container').height() - 118);
  };

  gallery.view.afterLayout = function(options) {
    if (typeof options === 'undefined') {
      options = {};
    }

    if (typeof options.shouldFadeIn === 'undefined') {
      options.shouldFadeIn = true;
    }

    this.fadeIn(options.shouldFadeIn);
    this.setMinHeight();
    this.centerImages();
    this.placeTitles();
    gallery.updateLine();

    if ($('.gallery-wrapper .gallery.upcoming').css('display') === 'none') {
      $('.gallery-wrapper .gallery.recent h2').css('display', 'none');
    }
    $(window).unbind('scroll', this.centerImagesThrottled);
    $(window).scroll(this.centerImagesThrottled);
  };

  gallery.layoutFooter = function() {
    var footer = $(".gallery-footer");

    footer.empty();

    if (_total !== _collections.length) {
      var remaining = _total - _collections.length;
      $("#tmplGalleryFooterContents").tmpl({
        count: remaining < PAGE_SIZE ? remaining : PAGE_SIZE
      }).appendTo(footer);
      $('.load-button').click(function() {
        gallery.loadMore();
      });
    }
  };

  erly.gallery = gallery;
}(erly));

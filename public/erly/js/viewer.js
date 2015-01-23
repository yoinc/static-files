/*!
 * Viewer handler
 */

(function(erly) {
  var viewer = {};

  /**
   * Default background, if the cover photo is set to this URL, the hint will
   * be shown.
   */
  var DEFAULT_BACKGROUND_URL = viewer.DEFAULT_BACKGROUND_URL =
    erly.resolveStaticUrl(erly.STOCK_BACKGROUNDS.General[0]);

  viewer.MAX_POSTS = 1000;
  viewer.CAROUSEL_OPENED = "erly.viewer.CAROUSEL_OPENED";
  viewer.CAROUSEL_CLOSING = "erly.viewer.CAROUSEL_CLOSING";
  viewer.CAROUSEL_CLOSED = "erly.viewer.CAROUSEL_CLOSED";
  viewer.ROLE_CHANGED = "erly.viewer.ROLE_CHANGED";
  viewer.ZOOMED = "erly.viewer.ZOOMED";
  viewer.UNZOOMED = "erly.viewer.UNZOOMED";
  viewer.LOGIN_ACTION = "erly.viewer.LOGIN_ACTION";

  var DOM = {
    addPostsCentering: "#addPostsCentering",
    addPostsContainer: "#addPostsContainer",
    bottomLogo: '#bottomLogo',
    carouselContainer: "#carouselContainer",
    detailsBackground: "#detailsBackground",
    detailsContainer: "#detailsContainer",
    edit: '.toolbar .edit',
    flagstone: '#flagstone',
    header: "#header_wrapper .header",
    headerWrapper: "#header_wrapper",
    loader: ".viewer .loader",
    logoLink: "#logo > a",
    metadataContainer: '#metadataContainer',
    metadataContainment: '#metadataContainment',
    navigation: '#navigation',
    ownerLink: '#ownerLink',
    postsContainer: '#postsContainer',
    topPadding: '#topPadding',
    random: '#random',
    randomTooltip: '#randomTooltip',
    slider: '#slider',
    slideshowStart: '#slideshowStart',
    slideshowStop: '#slideshowStop',
    teaseContainer: '#teaseContainer',
    title: '#title',
    returnHover: '#return',
    undoToolbar: '#undoToolbar',
    userProfile: '.right-toolbar .user-profile',
    viewer: "#viewer",
    zoomClose: "#zoomClose"
  };

  var DEFAULT_LEFT_POS = 15;
  var DEFAULT_CAROUSEL_CONTAINER_TOP = 93;
  var SCROLL_BAR_WIDTH = 20;

  var MIN_WINDOW_HEIGHT = 655;

  var _addPostsCentering;
  var _addPostsContainer;
  var _backgroundImage;
  var _bottomLogo;
  var _carousel;
  var _carouselContainer;
  var _carouselContainerTop = DEFAULT_CAROUSEL_CONTAINER_TOP;
  var _carouselShowing;
  var _collection;
  var _details;
  var _detailsBackground;
  var _detailsContainer;
  var _disableUserProfileHovering = false;
  var _editHint;
  var _editing;
  var _flagstone;
  var _initialized;
  var _lastBackgroundDimensions;
  var _metadataContainer;
  var _metadataContainment;
  var _postData;
  var _postsContainer;
  var _slider;
  var _topPadding;
  var _teaseContainer;
  var _title;
  var _undoStack = [];
  var _viewer;
  var _zoomed;
  var positionBackToTop;

  var _wasNewCollection = false;

  /*
   * Handles cases where the window is too short for the carousel
   */
  function adjustCarouselLayout(fixedLayout) {
    if (fixedLayout) {
      _detailsBackground.show();
      _title.css('position', 'fixed');
      _slider.css('position', 'fixed');
      _addPostsCentering.css('position', 'fixed');
    }
    else {
      _detailsBackground.hide();
      _title.css('position', 'absolute');
      _slider.css('position', 'absolute');
      _addPostsCentering.css('position', 'absolute');
    }
  }

  function showPageScroll() {
    var browser = erly.browserSupport.detect();
    if (browser.name === 'iPad') {
      var el = $('#stretch_wrap');
      el.css('overflow-x', 'hidden');
      el.css('overflow-y', 'visible');
      el.css('max-height', 'none');
    }
    else {
      $('body').css({
        'overflow-x': 'hidden',
        'overflow-y': 'visible'
      });

      adjustCarouselLayout(true);
    }
  }

  function hidePageScroll() {
    var browser = erly.browserSupport.detect();
    var el = $('#stretch_wrap');
    if (browser.name === 'iPad') {
      el.css('max-height', $(window).height());
      el.css('overflow', 'hidden');
    }
    else {
      if ($(window).height() > MIN_WINDOW_HEIGHT) {
        $('body').css({
          'overflow-x': 'hidden',
          'overflow-y': 'hidden'
        });

        adjustCarouselLayout(true);
      }
      else {
        $('body').css({
          'overflow-x': 'hidden',
          'overflow-y': 'visible'
        });

        adjustCarouselLayout(false);
      }
    }
  }

  function fetchPosts(callback, since) {
    var url = erly.urlFor.collection(viewer.collection, 'posts');
    if (since) {
      url += '?since=' + since;
    }
    $.get(url, function(data) {
      callback(null, data);
    }).error(function(xhr, status, err) {
      if (status === 'parsererror') {
        callback(new Error('Invalid JSON returned for URL: ' + url));
      }
      else {
        callback(new Error(
          'Fetch posts ' + url + ' error: ' + [err, status].join(': ')));
      }
    });
  }

  function fitFlagstone() {
    _flagstone.width($(window).width());
    _flagstone.height($(window).height() - _topPadding.height());
    _metadataContainment.height(_flagstone.height() - 73);
  }

  function fitDetails() {
    var heightDelta = $(window).height() - _detailsContainer.outerHeight(true) -
      $$('#topDivider').outerHeight(true);
    $$("#detailsFooter").height(Math.max(80, heightDelta));
  }

  function fitBackgroundImage(force) {
    if (_backgroundImage) {
      var body = $('body');

      // NOTE: + SCROLL_BAR_WIDTH so we don't have to
      // resize when the scrollbar pops in and out
      var bodyWidth = body.width() + SCROLL_BAR_WIDTH;
      var bodyHeight = body.height();

      if (!force &&
          _lastBackgroundDimensions &&
          _lastBackgroundDimensions.width === bodyWidth &&
          _lastBackgroundDimensions.height === bodyHeight) {
        return;
      }

      _lastBackgroundDimensions = {
        width: bodyWidth,
        height: bodyHeight
      };

      var image = _backgroundImage.find('img');

      if (_backgroundImage.width() !== bodyWidth ||
          _backgroundImage.height() !== bodyHeight ||
          _backgroundImage.data('src') !== image.attr('src')) {
        _backgroundImage.width(bodyWidth).height(bodyHeight);
        _editHint.width(bodyWidth).height(bodyHeight);

        erly.centerImage(image, null, null, {
          ajaxLoaderQualifier: '-222222',
          duration: 0,
          noCanvas: true,
          callback: function() {
            erly.events.fire(erly.events.FLAGSTONE_IMAGE_SET);
          }
        });

        _backgroundImage.data('src', image.attr('src'));
      }
    }
  }

  function updateBackgroundImage() {
    _backgroundImage.empty();

    // hide it until it loads so that we
    // don't see a flicker effect
    _backgroundImage.hide();
    erly.events.subscribe(erly.events.FLAGSTONE_IMAGE_SET, function() {
      _backgroundImage.show();
    });

    _backgroundImage.append($('<img />').
      attr('src', _collection.coverPhoto.url));
    fitBackgroundImage(true);
  }

  function positionCarousel(duration, callback) {
    var top;
    var left;
    if (!_carouselContainer || !_carousel) { return; }

    if (_carouselShowing || _editing) {
      hidePageScroll();
    } else {
      showPageScroll();
    }

    _carouselContainer.width($(window).width());
    duration = duration || 0;

    var scrolledToTop = $(window).scrollTop() === 0;
    _carouselContainer.css('margin-left', 0);
    _carouselContainer.css('margin-top', _carouselContainerTop);

    if (_carouselShowing) {
      _carousel.showCarouselButtons(0);
      _slider.cssAnimate({left: 0}, duration, callback);

      _flagstone.cssAnimate({
        left: -$(window).width()
      }, duration);

      if (_zoomed) {
        _addPostsCentering.css('display', 'none');
      }
      else {
        _addPostsCentering.css('display', 'block');
        _addPostsCentering.cssAnimate({
          opacity: 1
        }, duration);
      }
    }
    else {
      _slider.cssAnimate({
        left: $(window).width()
      }, duration, callback);

      _flagstone.cssAnimate({
        left: 0
      }, duration);

      _carousel.hideCarouselButtons(0);

      _addPostsCentering.cssAnimate({
        opacity: 0
      }, duration, function() {
        _addPostsCentering.css('display', 'none');
      });
    }
  }

  function positionTease(duration) {
    if (!_teaseContainer) { return; }

    duration = duration || 0;

    _teaseContainer.show();

    if (_editing) {
      _teaseContainer.stop(true, true).cssAnimate({
        left: '20px'
      }, duration, function() {
        _slider.hide();
      });
    }
    else {
      _slider.show();
      var opened = -166;
      var closed = -46;
      _teaseContainer.unbind('mouseenter.tease').unbind('mouseleave.tease');

      if ((viewer.collection.startDate <= erly.now ||
          (viewer.Posts.instance && viewer.Posts.instance.postCount() > 0)) &&
          $(window).scrollTop() === 0) {

        _teaseContainer.stop(true, true).cssAnimate({
          left: opened
        }, duration);

        $$(DOM.navigation).stop(true, true).fadeIn();
      }
      else {
        _teaseContainer.stop(true, true).cssAnimate({
          left: closed
        }, duration);

        _teaseContainer.bind('mouseenter.tease', function() {
          _teaseContainer.stop(true, true).cssAnimate({
            left: opened
          }, duration);
        }).bind('mouseleave.tease', function() {
          _teaseContainer.stop(true, true).cssAnimate({
            left: closed
          }, duration);
        });

        $$(DOM.navigation).stop(true, true).fadeOut();
      }
    }
  }

  function toPercentage(decimal) {
    return (decimal * 100).toString().substring(0, 6) + '%';
  }

  function saveMetadataPosition() {
    var containmentWidth = _metadataContainment.width();
    var containmentHeight = _metadataContainment.height();

    // Make the metadata "stick" to the side of the window that it's
    // closest to
    var newPos = {};
    var metadataPos = _metadataContainer.position();
    var left = metadataPos.left;
    var right = containmentWidth - (left + _metadataContainer.outerWidth());
    if (left < right) {
      newPos.left = Math.max(
        Math.round(left / containmentWidth * 10000)/100, 0) + '%';
    }
    else {
      newPos.right = Math.max(
        Math.round(right / containmentWidth * 10000)/100, 0) + '%';
    }

    var top = metadataPos.top;
    var bottom = containmentHeight -
      (top + _metadataContainer.outerHeight());
    if (top < bottom) {
      newPos.top = Math.max(
        Math.round(top / containmentHeight * 10000)/100, 0) + '%';
    }
    else {
      newPos.bottom = Math.max(
        0, Math.round(bottom / containmentHeight * 10000)/100) + '%';
    }

    viewer.collection.metadataPosition = newPos;
    _metadataContainer.css($.extend(
      {bottom: '', left: '', top: '', right: ''}, newPos));

    $.ajax({
      type: 'post',
      url: erly.urlFor.collection(viewer.collection, 'update'),
      data: {
        metadataPosition: newPos
      },
      success: function(data) {
        // REVIEW: Need some indication of success?
      }
    });
  }

  function metadataOnHoverIn(e) {
    if (_metadataContainer.find('.viewer-metadata').is('.resizing')) {
      return;
    }

    var overlay = $("#metadataOverlay");
    overlay.css('opacity', 1);
    overlay.show();
  }

  function metadataOnHoverOut() {
    var overlay = $("#metadataOverlay");
    overlay.css('opacity', 0);
    overlay.hide();
  }

  var processResize = viewer.processResize = _.throttleImmediateFinal(
  function(save) {
    var minHeight = _metadataContainer.find(
      '.metadata-attributes'
    ).outerHeight(true);

    var minWidth = 0;
    _metadataContainer.find(
      '.detail.date, .detail.location, .detail.attendance'
    ).each(function() {
      minWidth = Math.max(minWidth, $(this).outerWidth(true));
    });

    var metadataPadding = $('#metadataContainer .padding');
    if (metadataPadding.length > 0) {
      minWidth += erly.cssPixels(metadataPadding, 'padding-left');
      minWidth += erly.cssPixels(metadataPadding, 'padding-right');

      // NOTE: Only factor in the padding-bottom b/c of the -20px margin of
      //       the title
      minHeight += erly.cssPixels(metadataPadding, 'padding-bottom');
    }

    var mdata = _metadataContainer.find('.viewer-metadata');
    if (mdata.outerHeight() < minHeight) {
      mdata.outerHeight(minHeight);
    }
    mdata.resizable('option', {
      minHeight: minHeight,
      minWidth: minWidth + 16
    });

    // Try to fit the title to the allotted space
    _metadataContainer.find('.title').css('max-width',
      viewer.collection.metadataWidth - 36);
    viewer.metadata.fitTitle();

    // If no explicit height was set, try to fit the metadata container
    _.defer(function() {
      if (!_collection.metadataHeight) {
        _metadataContainer.find('.viewer-metadata').height(
          _metadataContainer.find('.metadata-attributes').height() +
          erly.cssPixels(metadataPadding, 'padding-bottom')
        );
      }
    });

    if (save) {
      $.ajax({
        type: 'post',
        url: erly.urlFor.collection(viewer.collection, 'update'),
        data: {
          metadataWidth: viewer.collection.metadataWidth,
          metadataHeight: viewer.collection.metadataHeight
        },
        success: function(data) {
        // REVIEW: Need some indication of success?
        }
      });
    }
  }, 250);

  function onEditMode() {
    _editing = true;
    $$(DOM.navigation).fadeOut();

    $('#share-container').fadeOut();
    // UNDONE: This link doesn't seem that useful since it gets covered up
    //         by #metadataOverlay, and with the new resize handle, it gets
    //         in the way
    // $('.metadata-edit-details').show();
    _flagstone.find('.details-tease').fadeOut();
    _detailsBackground.hide();

    var wrapper = _metadataContainer.find('.viewer-metadata .padding');
    wrapper.mouseenter(metadataOnHoverIn);
    wrapper.mouseleave(metadataOnHoverOut);

    if (_collection.coverPhoto &&
        _collection.coverPhoto.url === DEFAULT_BACKGROUND_URL &&
        erly.browserSupport.canDragUpload()) {
      _editHint.show();
    }
    else {
      _editHint.hide();
    }

    _metadataContainer.find('.viewer-metadata').resizable({
      animate: false,
      animationDuration: 0,
      containment: '#metadataContainment',
      handles: 'se',
      start: function() {
        _metadataContainer.css('top', _metadataContainer.position().top + 'px');
        _metadataContainer.css('left', _metadataContainer.position().left + 'px');
        _metadataContainer.css('bottom', '').css('right', '');

        _metadataContainer.find('.viewer-metadata').css(
          'min-width', '').css('min-height', '').addClass('resizing');
      },
      resize: function(event, ui) {
        viewer.collection.metadataHeight = $(this).height();
        viewer.collection.metadataWidth = $(this).width();

        processResize(true);
      },
      stop: function() {
        processResize();

        _metadataContainer.find('.viewer-metadata').removeClass('resizing');
        saveMetadataPosition();
        viewer.refreshMetadata();
      }
    });

    positionCarousel(200);
    positionTease(200);
    hidePageScroll();

    var editInstructions = $('#editInstructions');
    editInstructions.width($(window).width() - (editInstructions.outerHeight() -
      editInstructions.height()));
  }

  function onExitEditMode() {
    _editing = false;

    _editHint.hide();

    _metadataContainer.find('.viewer-metadata').resizable('destroy');

    $$(DOM.navigation).fadeIn();
    if (_details) {
      _detailsBackground.show();
    }
    $('#share-container').fadeIn();
    $('.metadata-edit-details').hide();
    _flagstone.find('.details-tease').fadeIn();

    var wrapper = _metadataContainer.find('.viewer-metadata .padding');
    wrapper.unbind('mouseenter', metadataOnHoverIn);
    wrapper.unbind('mouseleave', metadataOnHoverOut);

    showPageScroll();
    positionCarousel(200);
    positionTease(200);
    fitFlagstone();

    // And again b/c a scrollbar may have disappeared
    _.delay(fitFlagstone, 600);
  }

  function toggleCarousel(animate) {
    if(_editing) { return; }

    if (typeof animate === 'undefined') {
      animate = true;
    }

    var eventToFire = null;
    _carouselShowing = !_carouselShowing;
    if (_carouselShowing) {
      $$(DOM.edit).cssAnimate({
        opacity: 0
      }, null, function() {
        $$(DOM.edit).hide();
      });
      $(".cover-image,#detailsBackground").animate({
        opacity: 0.5
      });

      positionBackToTop();

      _addPostsCentering.click(function(e) {
        if (erly.anchoredModal.isOpen()) {
          erly.anchoredModal.close();
        }
        else {
          toggleCarousel();
        }
      });
      _postsContainer.addClass('sliding');
      if (!viewer.embedMode) {
        $("#share-container").cssAnimate({
          top: -50
        }, 200, function() {
          _postsContainer.removeClass('sliding');
          _postsContainer.removeClass('hiding');
        });
      }
      else {
        _postsContainer.removeClass('sliding');
        _postsContainer.removeClass('hiding');
      }

      $('#logo').stop(true, true).fadeOut();

      _.defer(function() {
        var addPostsLeft = $('#addPostsContainer').offset().left;

        var titleText = _title.find('.text');
        titleText.text(viewer.collection.title);
        titleText.css('max-width',
          Math.min(300, addPostsLeft - 80)
        );

        erly.checkEllipsis(titleText, 48, 24);
        _title.css('top', Math.round((93 - _title.outerHeight()) / 2) +'px');

        _title.addClass('visible');
        _title.click(toggleCarousel);
      });

      _bottomLogo.stop(true, true).fadeIn();

      eventToFire = viewer.CAROUSEL_OPENED;
    }
    else {
      viewer.updatePermalink(null);
      erly.events.fire(viewer.CAROUSEL_CLOSING);
      if (viewer.collection.userRole.owner) {
        $$(DOM.edit).animate({
          opacity: 0
        }, 0);
        $$(DOM.edit).cssAnimate({
          opacity: 1
        }, null, function() {
          $$(DOM.edit).show();
        });
      }
      $(".cover-image,#detailsBackground").animate({
        opacity: 1
      });
      positionBackToTop();

      _addPostsCentering.unbind("click");
      _postsContainer.addClass('sliding');
      if (!viewer.embedMode) {
        $("#share-container").cssAnimate({
          top: -5
        }, 200, function() {
          _postsContainer.removeClass('sliding');
          _postsContainer.addClass('hiding');
        });
      }
      else {
        _postsContainer.removeClass('sliding');
        _postsContainer.removeClass('hiding');
      }

      $('#logo').stop(true, true).fadeIn();
      _title.removeClass('visible');
      _title.unbind('click');

      _bottomLogo.stop(true, true).fadeOut();

      eventToFire = viewer.CAROUSEL_CLOSED;
    }

    // close flagstone hover windows
    $('.drop-down-container').hide().empty();
    $('.icon-wrapper.active').removeClass('viewer-round-top-tab');
    $('.icon-wrapper.active').removeClass('viewer-round-bottom-tab');
    $('.icon-wrapper.active').removeClass('active');

    positionCarousel(animate ? 400 : 0, function() {
      erly.events.fire(eventToFire);
    });
  }
  viewer.toggleCarousel = toggleCarousel;

  function setupMetadata(callback) {
    _metadataContainment = $$(DOM.metadataContainment);
    _metadataContainer = $$(DOM.metadataContainer);

    viewer.metadata = new viewer.Metadata(_metadataContainer,
        function(err, data) {
      if (err) {
        return erly.trackException(err, 'viewer.js@setupMetadata');
      }
      _collection = data;
      viewer.collection = _collection;

      _flagstone.append($('#tmplViewerDetailsTease').tmpl(viewer.collection));
      _(function() {
        _flagstone.find('.details-tease').click(
          viewer.scrollToDetails);
      }).defer();

      var detailsTease = $('.details-tease');
      detailsTease.css({
        marginLeft: -(detailsTease.innerWidth() / 2)
      });
      detailsTease.show();

      $(window).resize(_.throttle(function() {
        detailsTease.css({
          marginLeft: -(detailsTease.width() / 2)
        });
      }, 200));

      var body = $('body');

      _editHint = $('<div class="edit-cover-hint"></div>');
      body.append(_editHint);
      _editHint.hide();
      // Potential perf issue with this...
      var _backgroundImageWrapper = $('<div class="cover-image-wrapper"></div>');
      _backgroundImage = $('<div class="cover-image"></div>');
      _backgroundImageWrapper.append(_backgroundImage);
      body.append(_backgroundImageWrapper);

      // Show the cover image
      if (!_collection.coverPhoto || !_collection.coverPhoto.url) {
        _collection.coverPhoto = _collection.coverPhoto || {};
        _collection.coverPhoto.url = DEFAULT_BACKGROUND_URL;
        _collection.coverPhoto.isNotSet = true;
      }
      updateBackgroundImage();

      // Restore the metadata window position
      if (data.metadataPosition) {
        _.each(data.metadataPosition, function(v, k) {
          _metadataContainer.css(k, v);
        });
      }
      else {
        _metadataContainer.css('top', '70px').css('left', '85px');
      }

      var metadataPadding = _metadataContainer.find('.viewer-metadata .padding');
      if (!data.metadataHeight) {
        _metadataContainer.find('.viewer-metadata').height(
          _metadataContainer.find('.metadata-attributes').height() +
          erly.cssPixels(metadataPadding, 'padding-bottom')
        );
      }

      if (!data.metadataWidth) {
        _metadataContainer.find('.viewer-metadata').width(
          _metadataContainer.find('.metadata-attributes').width() +
          erly.cssPixels(metadataPadding, 'padding-left') +
          erly.cssPixels(metadataPadding, 'padding-right') + 16
        );
      }

      $("#metadataContainer .edit-bar .drag-handle").hover(function() {
        if (!erly.oldIE) {
          $("#metadataContainer").addClass("shadow-wide-blue");
        }
      }, function() {
        if (!erly.oldIE) {
          $("#metadataContainer").removeClass("shadow-wide-blue");
        }
      });

      var closeCarousel = function() {
        if (_carouselShowing) {
          toggleCarousel();
        }
      };

      erly.events.subscribe(erly.layout.HOME_CLICKED, closeCarousel);
      erly.events.subscribe(erly.viewer.COVER_SET, function(src) {
        _collection.coverPhoto = _collection.coverPhoto || {};
        if (src === DEFAULT_BACKGROUND_URL &&
            _editing &&
            erly.browserSupport.canDragUpload()) {
          _editHint.show();
        }
        else {
          _editHint.hide();
        }
        if (_collection.coverPhoto.url !== src) {
          _collection.coverPhoto.url = src;
          _collection.coverPhoto.isNotSet = false;
          updateBackgroundImage();
        }
      });

      erly.events.subscribe(erly.viewer.ENTERING_EDIT_MODE, onEditMode);
      erly.events.subscribe(erly.viewer.EXITING_EDIT_MODE, onExitEditMode);

      callback();
    });

    var dimmed = false, animating = false;
    _metadataContainer.draggable({
      handle: '.drag-handle',
      scroll: false,
      containment: 'parent',
      // see draggable.fix-set-containment
      useContainmentScrollHack: true,
      start: function() {
        viewer.isDragging = true;
        _metadataContainer.css({bottom: '', left: '', top: '', right: ''});
        $('#backgroundPicker,#editInstructions,.viewer-edit-bottom-bar').fadeOut();
      },
      stop: function(ev, ui) {
        viewer.isDragging = false;
        $('#backgroundPicker,#editInstructions,.viewer-edit-bottom-bar').fadeIn();

        saveMetadataPosition();
      }
    });
  }

  function updateUI(teaseDelay) {
    teaseDelay = teaseDelay || 0;
    fitFlagstone();
    positionCarousel(0);
    _(positionTease).delay(teaseDelay);
    fitBackgroundImage();
    $('.drop-down-container').hide().empty();
    $('.icon-wrapper.active').removeClass('viewer-round-top-tab');
    $('.icon-wrapper.active').removeClass('viewer-round-bottom-tab');
    $('.icon-wrapper.active').removeClass('active');

    fitDetails();
  }

  // http://james.padolsey.com/javascript/bujs-1-getparameterbyname/
  function getParameterByName(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)')
                    .exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
  }


  var processEmailActions = function() {
    var processRSVP = function(rsvp) {
      erly.events.subscribeOnce(erly.events.SCROLLED_TO_DETAILS, function() {
        viewer.Details.instance.processRsvpClick(rsvp);
      });
      viewer.scrollToDetails();
    };

    // check for emailAction param, either by window.href or
    // by checking an object set by the handler.. do the former for now
    // todo: maybe change hash param into a json blob and put this there.
    var action = getParameterByName('emailAction');
    switch(action) {
      case 'rsvpYes':
        processRSVP('yes');
        break;
      case 'rsvpMaybe':
        processRSVP('maybe');
        break;
      case 'rsvpNo':
        processRSVP('no');
        break;
      case 'upload': // open add photo dialog
        viewer.toggleCarousel();
        if (erly.session.requireLogin('emailupload', {})) {
          _.delay(function() {
            viewer.addPosts.showByType('photo');
          }, 500);
        }
        break;
      case 'saveToCalendar':
        viewer.dialogs.showCalendarExportDialog();
        break;
      case 'viewDetails':
        viewer.scrollToDetails();
        break;
      case 'comment': // scroll to discussion area
        var discussionOffset = $('#discussion').offset();
        $('textarea#comment').focus();
        if ($.browser.mozilla || $.browser.msie) {
          $('html').animate({
            scrollTop: discussionOffset.top
          }, 200);
        }
        else {
          $('body').animate({
            scrollTop: discussionOffset.top
          }, 200);
        }
        break;
      default:
        break;
    }
    // attempt to clear history
    if (action && history.pushState) {
      history.pushState('', document.title, window.location.pathname);
    }
  };

  positionBackToTop = function() {
    var leftPos = _carouselShowing ? -$(window).width() : "50%";
    $('.back-to-top').css({ left: leftPos });
  };

  /*
   * Final UI setup after all the components have been initialized
   */
  var postComponentInit = function() {
    viewer.refreshMetadata();
    viewer.refreshShareContainer();
    viewer.handlePermalink();
    processEmailActions();
    viewer.stripInviteLink();

    if (viewer.collection.userRole.owner) {
      $(".toolbar .right-toolbar .edit").show();
    }

    if (viewer.collection.startDate <= erly.now) {
      $$(DOM.navigation).cssAnimate({opacity: 1});
    }

    if (viewer.isNewCollection() && viewer.collection.userRole.owner) {
      $$(DOM.edit).click();
    }

    $(window).resize(updateUI);
    updateUI(200);

    _.delay(updateUI, 1000);

    var checkLoginAction = function() {
      var loginAction = erly.session.loginAction;
      if (loginAction) {
        erly.events.fire(viewer.LOGIN_ACTION, loginAction);
      }
    };

    erly.events.subscribe(viewer.LOGIN_ACTION, function(loginAction) {
      if (loginAction.action === 'emailupload') {
        viewer.toggleCarousel();
        _.delay(function() {
          viewer.addPosts.showByType('photo');
        }, 500);
      }
    });

    if (erly.userId) {
      checkLoginAction();
    }
    else {
      erly.events.subscribe(erly.events.AUTHENTICATED, checkLoginAction);
    }

    erly.events.fire(erly.events.PAGE_READY);
  };

  var bindSwipeRight = function() {
    var browser = erly.browserSupport.detect();
    var scrollMultiplier;

    if (browser && browser.scrollMultiplier) {
      scrollMultiplier = browser.scrollMultiplier;
    } else {
      scrollMultiplier = 40;
    }

    _viewer.mousewheel(function(event, _, deltaX) {
      if (_carouselShowing) {
        return true;
      }

      // ignore the movement if we're over a jScrollPane target
      var jspPane = $(event.target).parents('.jspContainer');
      if (jspPane.length > 0 && jspPane.find('.jspVerticalBar').length > 0) {
        return;
      }

      var delta = deltaX * scrollMultiplier;

      if (delta > 200) {
        erly.events.fire(erly.events.SWIPE_RIGHT_OPEN_CAROUSEL);
        toggleCarousel();
      } else {
        return true;
      }
    });
  };

  var bindSwipeRightiPad = function() {
    _viewer.swipe({
      threshold: 100,
      swipeLeft: function(event, direction, distance) {
        if (_carouselShowing) {
          return true;
        }

        // swipe to show the carousel
        if (distance >= 500) {
          erly.events.fire(erly.events.SWIPE_RIGHT_OPEN_CAROUSEL);
          toggleCarousel();
          event.preventDefault();
        }
      }
    });
  };

  var hideToolbars = function() {
    if ($('.toolbar').length === 0) return;
    $$(".toolbar .right-toolbar").stop(true, true).fadeOut();
    $$(".toolbar .right-toolbar-unauthenticated").stop(true, true).fadeOut();
    $$(DOM.navigation).stop(true, true).fadeOut();
    $$("#share-container").stop(true, true).fadeOut();
  };

  var showToolbars = function() {
    if (_zoomed) {
      return;
    }

    var hasToolbar = $('.toolbar').length > 0;
    if (hasToolbar && !erly.getUserData().authenticated) {
      $(".toolbar .right-toolbar-unauthenticated").stop(true, true).fadeIn();
      $(".toolbar .right-toolbar").stop(true, true).fadeOut();
    }
    else if (hasToolbar) {
      $(".toolbar .right-toolbar").stop(true, true).fadeIn();
      $(".toolbar .right-toolbar-unauthenticated").stop(true, true).fadeOut();
    }

    $$(DOM.navigation).stop(true, true).fadeIn();
    if (hasToolbar) {
      $$("#share-container").stop(true, true).fadeIn();
    }
  };

  var _updatedLastSeen = false;
  var markActivitiesSeen = function() {
    if (_updatedLastSeen) { return; }
    if (!erly.session.isAuthenticated()) {
      _updatedLastSeen = true;
      return;
    }
    var url = erly.urlFor.collection(viewer.collection,
      'activities', 'unseen_count');
    $.post(url, {}, function() {
      _updatedLastSeen = true;
      viewer.updateDetailsTeaseCount(0);
    });
  };

  viewer.enableMarkingActivitiesSeen = function() {
    _updatedLastSeen = false;
  };

  viewer.setCarousel = function(carousel) {
    _carousel = carousel;
  };

  viewer.init = _.once(function(data) {
    showToolbars();

    if (data.authenticated) {
      var linkUrl = erly.urlFor.gallery(erly.session.currentUser);
      if (erly.session.currentUser.activityCount > 0) {
        linkUrl = erly.urlFor.activity(erly.session.currentUser);
      }
      $$(DOM.logoLink).attr("href", linkUrl);
      if ($$(DOM.returnHover)) {
        $$(DOM.returnHover).find('a').attr("href", linkUrl);
      }

      $$(DOM.userProfile).find('.profile-name').click(function(e) {
        if (e.which > 1) {
          return;
        }
        window.location = erly.urlFor.gallery(erly.session.currentUser);
      });
      $$(DOM.userProfile).find('ul.menu li.events').click(function(e) {
        if (e.which > 1) {
          return;
        }
        erly.redirectTo('gallery', erly.getUserData());
      });
      $$(DOM.userProfile).find('ul.menu li.activityfeed').click(function(e) {
        if (e.which > 1) {
          return;
        }
        erly.redirectTo('/activity/' + erly.userName);
      });
      $$(DOM.userProfile).hover(function() {
        if (_disableUserProfileHovering) {
          _disableUserProfileHovering = false;
          return;
        }
        $$(DOM.userProfile).find('.login-opened').show();
      }, function() {
        $$(DOM.userProfile).find('.login-opened').hide();
      });
    }

    $$(DOM.logoLink).hoverUp($$(DOM.returnHover), {
      hoverDelay: 100,
      passthroughClick: true
    });

    viewer.setupTooltips();

    _viewer = $(DOM.viewer);

    $(DOM.loader).remove();
    $$(DOM.header).hide();
    $$(DOM.headerWrapper).hide();

    _slider = $$(DOM.slider);
    _slider.cssAnimate({left: 0}, 0);

    _addPostsCentering =$$(DOM.addPostsCentering);
    _addPostsContainer = $$(DOM.addPostsContainer);
    _bottomLogo = $$(DOM.bottomLogo);
    _carouselContainer = $$(DOM.carouselContainer);
    _carouselContainer.width($(window).width());
    _detailsBackground = $$(DOM.detailsBackground);
    _detailsContainer = $$(DOM.detailsContainer);
    _flagstone = $$(DOM.flagstone);
    _postsContainer = $$(DOM.postsContainer);
    _teaseContainer = $$(DOM.teaseContainer);
    _title = $$(DOM.title);
    _topPadding = $$(DOM.topPadding);

    if (!viewer.collection.ident) {
      viewer.dialogs.showDeletedCollectionDialog();
      $('.toolbar .right-toolbar').
        add('.toolbar .right-toolbar-unauthenticated').hide();
      return;
    }

    _bottomLogo.click(toggleCarousel);

    async.parallel([
      function(cb) {
        setupMetadata(cb);
      },
      function(cb) {
        fetchPosts(cb);
      }
    ], function(err, results) {
      if (err) {
        return erly.trackException(err, 'viewer.js@init');
      }

      if (!viewer.metadata.isVisible()) {
        // hide selected metadata attributes and event info when private
        $.each($('.metadata-attributes').children(), function(i, el) {
          el = $(el);

          if (!el.hasClass('title') && !el.hasClass('creator')) {
            el.remove();
          }
        });

        $('.details-tease').remove();

        viewer.dialogs.showPasswordDialog(
          _collection.owner.name,
          _collection.ident);

        return;
      }

      var posts = results[1];

      _postData = _(posts).filter(function(p) {
        return p.type !== 'wir-welcome';
      });

      // Override the posts' ordering value if the collection has them
      if (_collection.postOrdering) {
        _(_postData).each(function(data) {
          data.order =
            parseInt(_collection.postOrdering["post_" + data.id], 10) ||
            data.order;
        });
      }

      _carousel = new viewer.Carousel(_collection, _postData,
        _postsContainer, {
          heightOffset: -95
      });

      viewer.tease = new viewer.Tease(_teaseContainer);
      if (!viewer.metadata.isVisible()) {
       viewer.tease.hide();
      }
      else {
        viewer.tease.update(_postData);
        _teaseContainer.click(function() {
          toggleCarousel();
        });

        var browser = erly.browserSupport.detect();

        if (browser.name === 'iPad') {
          bindSwipeRightiPad();
        }
        else {
          bindSwipeRight();
        }
      }

      viewer.addPosts = new viewer.AddPosts({
        collection: _collection,
        container: _addPostsContainer,
        carousel: _carousel
      });

      _details = new viewer.Details(_detailsContainer);
      _detailsBackground.show();

      postComponentInit();
    });

    var fadingOut = false;
    var backFading = false;

    $(document).scroll(_.throttle(function() {
      positionCarousel();

      var scrollTop = $(document).scrollTop();
      if (scrollTop > 0) {
        positionTease(200);
      }
      else {
        positionTease(200);
      }
      if (_editing) { return; }

      var detailsOffset = $('#detailsBackground').offset();

      if (scrollTop >= detailsOffset.top) {
        if (!backFading) {
          backFading = true;
          $('.back-to-top').fadeIn(function() {
            backFading = false;
            $('#flagstone .details-tease').hide();
          });
        }
      }
      else {
        $('.back-to-top').stop().hide();
        $('#flagstone .details-tease').show();
        backFading = false;
      }

      var loader = $('#activityLoaderObject');
      var height = $(window).height();
      if (loader.length && (scrollTop + height) >= loader.offset().top) {
        viewer.Details.instance.loadNextActivityPage();
      }

      var discussions = $('#discussion');
      if (discussions.length &&
          (scrollTop + height) >= discussions.offset().top) {
        markActivitiesSeen();
      }
    }, 250));

    fitFlagstone();
  }); // end of init

  viewer.setupTooltips = function() {
    function showTooltip(text, el) {
      var left = el.offset().left;
      var tooltip = $('#share-tooltip');
      if (!viewer.embedMode) {
        left -= 66;
      }

      tooltip.css('left', left + 'px');
      tooltip.css('width', '');
      tooltip.html(text);
      if (!viewer.embedMode) {
        tooltip.show();
      }
      else {
        tooltip.css('display', 'inline-block');
      }
    }

    function hideTooltip() {
      $('#share-tooltip').hide();
    }

    $('#share-container .fb').hover(function() {
      showTooltip('Share on Facebook', $(this));
    }, function() {
      hideTooltip();
    });

    $('#share-container .twitter').hover(function() {
      showTooltip('Share on Twitter', $(this));
    }, function() {
      hideTooltip();
    });

    $('#share-container .archive').hover(function() {
      showTooltip('Download Event archive', $(this));
    }, function() {
      hideTooltip();
    });

    $('#share-container .link').hover(function() {
      showTooltip('Copy Event link', $(this));
    }, function() {
      hideTooltip();
    });
  };

  viewer.fitDetails = fitDetails;

  viewer.isNewCollection = function() {
    if (window.location.hash && window.location.hash === '#newcollection') {
      viewer.updatePermalink(null);
      _wasNewCollection = erly.getUserData().id &&
        viewer.collection.owner.id === erly.getUserData().id;
      return _wasNewCollection;
    }
    return false;
  };

  viewer.wasNewCollection = function() {
    return _wasNewCollection;
  };

  viewer.clearWasNewCollection = function() {
    _wasNewCollection = false;
  };

  viewer.removePostsForUser = function(userId) {
    _carousel.removePostsForUser(userId);
  };

  viewer.gotoPost = function(id, animate, showComments, noFlash) {
    erly.events.subscribeOnce(viewer.CAROUSEL_OPENED, function() {
      _carousel.gotoPost(id, {
        flash: !noFlash,
        showDialog: true,
        showComments: showComments
      });
    });
    toggleCarousel(animate);
  };

  viewer.gotoDetailComment = function(id) {
    erly.events.subscribe(erly.events.DETAIL_COMMENTS_LOADED, function() {
      var item = $(".comment-feed-item[data-id=" + id + "]");

      if (item && item.length > 0) {
        var topOffset = item.offset().top;
        // make sure back to top button doesn't cover
        // the comment
        topOffset -= $('.back-to-top').outerHeight();
        $(window).scrollTop(topOffset);
      }
    });
  };

  viewer.scrollToDetails = _(function(ev) {
    var detailsOffset = $('#detailsBackground').offset();

    if (ev && $(ev.currentTarget).is('a')) {
      ev.stopPropagation();
      return true;
    }

    var whenDone = function() {
      erly.events.fire(erly.events.SCROLLED_TO_DETAILS);
    };

    var el = $.browser.mozilla || $.browser.msie ?
      $('html') :
      $('body');

    el.animate({
      scrollTop: detailsOffset.top
    }, 200, null, whenDone);
  }).throttleImmediate(500);

  viewer.getCoverPhotoURL = function() {
    return viewer.collection.coverPhoto.url;
  };

  viewer.isRestricted = function() {
    if (viewer.collection.publicEvent) {
      return false;
    }

    var role = viewer.collection.userRole;
    return (!role || (!role.member && !role.owner) ||
        (!erly.userId && !viewer.invite));
  };

  viewer.layout = function(collection) {
    viewer.collection = collection;
    viewer.invite = collection.invite;
    erly.events.subscribe(erly.events.AUTHENTICATED, viewer.init);
    erly.events.subscribe(erly.events.NOT_AUTHENTICATED, viewer.init);
  };

  viewer.refreshMetadata = function(refreshData) {
    viewer.metadata.refresh(refreshData);
  };

  viewer.isCarouselShowing = function() {
    return _carouselShowing;
  };

  /**
   * Animate the spinner behind the button.
   */
  function _enableSpinner(button) {
    var spin = function(canvas, time, options) {
      options = options || {};
      var color = options.color || 'rgb(0,0,0)';
      var padding = options.padding || 0;

      var iv;
      var start = new Date().getTime();
      var interval = 100;

      var animate = function() {
        var dt = new Date().getTime() - start;
        if (dt >= (time + interval)) return clearInterval(iv);

        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-out';
        ctx.beginPath();
        var n = Math.round(canvas.width / 2, 10);
        ctx.moveTo(n, n);
        ctx.arc(n, n, n - 1 - padding, 0, Math.PI * 2 * (dt / time));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        if (options.donutRadius) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.moveTo(n, n);
          ctx.arc(n, n, n - 1 - padding - options.donutRadius,
            0, Math.PI * 2 * (dt / time));
          ctx.closePath();
          ctx.fillStyle = 'black';
          ctx.fill();
        }
      };
      iv = setInterval(animate, interval);
      return iv;
    };
    var clear = function(canvas) {
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    var canvas = $('<canvas></canvas>');
    canvas.attr('width', button.width());
    canvas.attr('height', button.height());
    canvas.css({
      position: 'absolute',
      top: (parseInt(button.css('top'), 10) + 1) + 'px',
      right: parseInt(button.css('right'), 10) + 'px'
    });

    if (canvas && canvas[0].getContext && canvas[0].getContext('2d')) {
      button.after(canvas);
      var iv;
      button.bind('spin', function(ev, duration) {
        clearInterval(iv);
        iv = spin(canvas[0], duration || 4000, {
          padding: 2,
          color: 'rgba(225,225,225,0.50)',
          donutRadius: 4
        });
      });
      button.bind('spinCancel', function() {
        clearInterval(iv);
        clear(canvas[0]);
      });
    }
  }

  var _postPolling = {};
  viewer.zoom = function(post) {
    if (_zoomed) {
      return;
    }

    erly.anchoredModal.close();

    _zoomed = true;
    _carouselContainerTop = 0;
    positionCarousel();

    hideToolbars();

    erly.events.fire(viewer.ZOOMED, post);

    $(DOM.zoomClose).show().click(function(e) {
      if (e.which > 1) {
        return;
      }

      viewer.unzoom();
    });

    _enableSpinner($(DOM.slideshowStart));
    $(DOM.slideshowStart).show().click(function(e) {
      if (e.which > 1) {
        return;
      }

      _carousel.startSlideshow();

      $(this).hide();
      $$(DOM.slideshowStop).show();

      if (_postPolling.timeout) {
        clearTimeout(_postPolling.timeout);
        delete _postPolling.timeout;
      }
      if (_postPolling.lastPoll) {
        delete _postPolling.lastPoll;
      }

      // Check for new posts every so often
      var checkNewPosts = function() {
        if (!_postPolling.timeout) return;

        // Get max updated at among existing posts
        var maxUpdatedAt = null;
        _.each(_carousel.getPostData(), function(v) {
          if (!maxUpdatedAt || (v.updatedAt && v.updatedAt > maxUpdatedAt)) {
            maxUpdatedAt = v.updatedAt;
          }
        });
        _postPolling.lastPoll = maxUpdatedAt + 1;

        fetchPosts(function(err, posts) {
          if (!_postPolling.timeout) return;

          var newPosts = {};

          // Add all fetched posts
          _.each(posts, function(v) {
            if (!maxUpdatedAt || (v.updatedAt && v.updatedAt > maxUpdatedAt)) {
              maxUpdatedAt = v.updatedAt;
            }
            newPosts[v.id] = v;
          });

          // Remove ones we already have in the carousel
          _.each(_carousel.getPostData(), function(v) {
            delete newPosts[v.id];
          });

          // Refresh in case we have newer items
          _postPolling.lastPoll = maxUpdatedAt + 1;

          // Add all new ones
          if (_.keys(newPosts).length > 0) {
            _carousel.beginUpdate();
            _.each(newPosts, function(v) {
              _carousel.insertSlide(v);
            });
            _carousel.endUpdate();
          }

          _postPolling.timeout = setTimeout(checkNewPosts, 10000);
        }, _postPolling.lastPoll);
      };

      _postPolling.timeout = setTimeout(checkNewPosts, 10000);
    });

    $(DOM.slideshowStop).hide().click(function(e) {
      if (e.which > 1) {
        return;
      }

      _carousel.stopSlideshow();
      if (_postPolling.timeout) {
        clearTimeout(_postPolling.timeout);
        delete _postPolling.timeout;
      }

      $(this).hide();
      $$(DOM.slideshowStart).show();
    });
  };

  viewer.unzoom = function() {
    if (!_zoomed) {
      return;
    }

    _carousel.stopSlideshow();
    if (_postPolling.timeout) {
      clearTimeout(_postPolling.timeout);
      delete _postPolling.timeout;
    }

    $$(DOM.slideshowStart).hide();
    $$(DOM.slideshowStop).hide();

    _zoomed = false;
    _carouselContainerTop = DEFAULT_CAROUSEL_CONTAINER_TOP;
    positionCarousel();

    showToolbars();
    $(DOM.zoomClose).hide().unbind('click');

    _disableUserProfileHovering = true;

    // Clear permalink
    viewer.updatePermalink(null);

    erly.events.fire(viewer.UNZOOMED);
  };

  viewer.existIds = {};

  viewer.updateDetailsTeaseCount = function(count) {
    var el = $(DOM.flagstone).find('.details-tease .count');
    if (viewer.collection.pastEvent || !count || count === 0) {
      el.hide().text(count);
    }
    else {
      el.show().text(count);
    }
  };

  viewer.refreshShareContainer = function() {
    if (viewer.embedMode) return;
    var shareContainer = $('#share-container');
    var downloadPhotosButton = $('#share-container .archive');
    if (viewer.collection.userRole.member) {
      downloadPhotosButton.css('display', 'inline-block');
      shareContainer.css('margin-right', '-68px');
    }
    else {
      downloadPhotosButton.css('display', 'none');
      shareContainer.css('margin-right', '-53px');
    }
  };

  /**
   * Reads the current hash value for the page and performs the corresponding
   * action.
   */
  viewer.handlePermalink = function() {
    var id;

    if (!viewer.metadata) {
      return _.delay(viewer.handlePermalink, 500);
    }
    if (!viewer.metadata.isVisible()) { return; }

    var hash = $.trim(window.location.hash || '');
    if (/#cp_(\d+)/.test(hash)) {
      var position = parseInt(RegExp.$1, 10);
      erly.events.subscribeOnce(viewer.CAROUSEL_OPENED, function() {
        erly.layout.panel.animatedScrollToPosition(position);
      });
      toggleCarousel(false);
    }
    else if (/#z_(\d+)/.test(hash)) {
      var postId = parseInt(RegExp.$1, 10);
      var post = $('#post_' + postId);
      if (post.length > 0) {
        erly.events.subscribeOnce(viewer.CAROUSEL_OPENED, function() {
          _.defer(function() {
            viewer.zoom(post);
          });
        });
      }
      toggleCarousel(false);
    }
    else if (/#(\d+)\/details-comment/.test(hash)) {
      id = parseInt(RegExp.$1, 10);
      if (id) {
        viewer.gotoDetailComment(id);
      }
    }
    else if (/#(p_|)(\d+)/.test(hash)) {
      id = parseInt(RegExp.$2, 10);
      if (id) {
        viewer.gotoPost(id, false, hash.indexOf('/comments') >= 0,
          RegExp.$1 === 'p_' /* noFlash */);
      }
    }
  };

  /**
   * Strips uinv and inv links to prevent potential issues with sharing.
   */
  viewer.stripInviteLink = function() {
    if (history.replaceState) {
      var uri = window.location.pathname;
      if (window.location.hash) {
        uri += window.location.hash;
      }
      history.replaceState('', document.title, uri);
    }
  };

  viewer.updatePermalink = function(link) {
    if (!link) {
      if (history.replaceState) {
        history.replaceState('', document.title, window.location.pathname);
      }
      else {
        window.location.hash = '';
      }
    }
    else {
      if (history.replaceState) {
        history.replaceState('', document.title,
          window.location.pathname + link);
      }
      else {
        window.location.replace(link);
      }
    }
  };

  var updateUndoUI = function() {
    var toolbar = $$(DOM.undoToolbar);
    var closeButton = toolbar.find('.close');
    var undo = toolbar.find('.undo');

    undo.unbind('click');
    closeButton.unbind('click');

    if (_undoStack.length > 0) {
      // Show the undo UI
      toolbar.fadeIn();

      undo.text(_undoStack.slice(-1)[0].text);
      undo.click(function(e) {
        if (e.which > 1) {
          return;
        }

        viewer.undo();
      });

      closeButton.click(function(e) {
        if (e.which > 1) {
          return;
        }

        viewer.commitUndos();
      });
    }
    else {
      toolbar.fadeOut();
    }
  };

  viewer.addUndo = function(text, undo, commit) {
    _undoStack.push({
      text: text,
      commit: commit,
      undo: undo
    });

    updateUndoUI();

    $(window).bind('beforeunload', viewer.commitUndos);
  };

  viewer.commitUndos = function() {
    _.each(_undoStack, function(v) {
      try {
        v.commit();
      }
      catch (e) {
        erly.trackException(e);
      }
    });

    _undoStack = [];
    updateUndoUI();
  };

  viewer.undo = function() {
    if (_undoStack.length === 0) {
      return;
    }

    var lastAction = _undoStack.pop();
    lastAction.undo();

    updateUndoUI();
  };


  erly.viewer = viewer;
}(erly));

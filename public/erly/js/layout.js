/*!
 * Collection layout functions
 */
(function(erly) {
  var layout = {};
  var layoutPanel = {};

  /**
   * @const
   */
  var PHOTO_CAPTION_MAX_HEIGHT = 16 * 2;
  var PHOTO_CAPTION_ZOOMED_MAX_HEIGHT = 16 * 5;
  var LEFT_ARROW_KEY = 37;
  var RIGHT_ARROW_KEY = 39;
  var RIGHT = 1,
      LEFT  = 2;
  var INITIAL_MARGIN = 0;
  var CARD_BORDER_HEIGHT = 20;
  var CARD_BORDER_WIDTH = 30;
  var CARD_METADATA_HEIGHT = 30;
  var CARD_NONCONTENT_HEIGHT = CARD_BORDER_HEIGHT + CARD_METADATA_HEIGHT;
  var SIGNIFICANT_SCROLL_THRESHOLD = 500;

  var EASTER_EGG_CODE = '3dplz';

  var AVG_VELOCITY_CUTOFF = 100;

  var browser = erly.browserSupport.detect();
  var LAZY_LOAD_MAX = (browser.name === 'iPad' || browser.name === 'iPhone') ? 20 : 40;
  var _lazySizeData = null;

  var _inited = false;
  var _blocks;
  var _carouselContainer;
  var _carousel;
  var _carouselOuterWidth;
  var _carouselButtons;
  var _carouselLeftMargin;
  var _carouselButtonsShowing = true;
  var _container;
  var _containerWidth;
  var _options;
  var _scrollBar;
  var _scrollBarContainer;
  var _scrollBarPadding;
  var _viewport;
  var _viewportScale;
  var _viewportOuterWidth;
  var _sidebar;
  var _homeButtonShownOn;

  var _animationTime;
  var _zoomed;
  var _zoomed3d;
  var _zoomedCard;

  var _lastWidth = 0;
  var _lastHeight = 0;
  var _lastCarouselLeft = INITIAL_MARGIN;

  var _mouseDragging = false;
  var _mouseLastDragTime;
  var _mouseDragVelocity;
  var _mouseDragLast;
  var _mouseDragTarget;
  var _mouseDown;

  var _lazyLoadCount = 0;

  var _originalLoaderImage;

  var _relatedDisplayIndex = 0;
  var _firstLayout = true;

  /*
   * PRIVATE FUNCTIONS
   */

  // Forward declarations to satisfy jslint
  var animateOutCommentBox;
  var animatedScrollByVelocities;
  var animatedScrollByVelocity;
  var animatedScrollToPosition;
  var carouselAnimateScroll;
  var cssAnimateLeft;
  var findMinMaxScrollCoordinate;
  var getCarouselPosition;
  var rowLayout;
  var scrollToFront;
  var scrollToPosition;
  var showNonTransparentOverlay;
  var sizeCard;
  var updateCarouselButtons;
  var lazyLoad;

  var afterChangePosition = function(animationTime) {
    if (typeof animationTime === 'undefined') {
      animationTime = 0;
    }

    updateCarouselButtons();
    animateOutCommentBox();
    lazyLoad();
  };

  animatedScrollByVelocities = function(velocities) {
    // Get the average velocity of the last 100 readings
    var cumTime = 0;
    var cumXDelta = 0;
    var i = velocities.length - 1;

    var cutoff = browser.averageVelocityCutoff || AVG_VELOCITY_CUTOFF;
    while (i >= 0 && cumTime < cutoff) {
      // ignore any reading over cutoff
      if (cumTime + velocities[i][1] > cutoff) {
        // Add in a percentage of the xDelta
        cumXDelta += velocities[i][0] / velocities[i][1] * (cutoff - cumTime);
        cumTime = cutoff;
        break;
      }

      cumXDelta += velocities[i][0];
      cumTime += velocities[i][1];

      i--;
    }

    // 0 velocity - do nothing
    if (cumTime === 0 || cumXDelta === 0) {
      return;
    }

    animatedScrollByVelocity(cumXDelta, cumTime);
  };

  animatedScrollByVelocity = function(delta, time) {
    if (time > 0) {
      delta = Math.round(delta * (browser.velocityMultiplier || 1));

      var xVelocity = delta / time;
      var sign = xVelocity / Math.abs(xVelocity) * -1;

      if (delta === 0) {
        return;
      }

      var dest = getCarouselPosition() + Math.pow(Math.abs(xVelocity), 2) * 50 * sign;
      var duration = Math.pow(Math.abs(xVelocity), 1.5) * 50 + 100;

      if (duration > 3500) {
        duration = 3500;
      }

      animatedScrollToPosition(dest, null, duration);
    }
  };

  animatedScrollToPosition = function(pos, doneCallback, animationTime,
      options) {
    if (typeof options === 'undefined') {
      options = {};
    }

    if (typeof animationTime === 'undefined') {
      animationTime = 500;
    }

    var dest = findMinMaxScrollCoordinate(pos);
    var animationOptions = {
      scrollLeft: dest,
      left: 0
    };

    // Handles the case of the first or last card in zoomed mode
    if (dest < 0) {
      animationOptions.scrollLeft = 0;
      animationOptions.left = -dest;
    }

    if (_carousel.width() < pos) {
      _carousel.width(pos);
    }

    carouselAnimateScroll(animationOptions, animationTime, 'easeOutCubic',
        function() {
      afterChangePosition(animationTime, options);

      if (doneCallback) {
        doneCallback();
      }
    }, options);
  };

  carouselAnimateScroll = function(animationOptions, animationTime,
      animationFunction, doneCallback, options) {
    if (typeof options.updateViewport === 'undefined') {
      options.updateViewport = true;
    }

    if (Math.abs(getCarouselPosition() - animationOptions.scrollLeft) < 10) {
      animationTime = 0;
    }

    if (erly.browserSupport.usesCssTransitions()) {
      cssAnimateLeft(_carousel,
        animationOptions.scrollLeft - animationOptions.left,
        animationTime, doneCallback);
    } else {
      _carouselContainer.stop(true, true).animate({
        scrollLeft: animationOptions.scrollLeft
      }, animationTime, animationFunction, doneCallback);

      if (_carousel.position().left !== animationOptions.left) {
        _carousel.stop(true, true).animate({
          left: animationOptions.left
        }, animationTime);
      }
    }

    if (options.updateViewport) {
      layoutPanel.updateViewport(animationTime, animationOptions.scrollLeft);
    }
  };

  cssAnimateLeft = function(obj, left, animationTime, doneCallback) {
    obj = $(obj);

    _lastCarouselLeft = left;

    obj.css('-webkit-transition-property', '-webkit-transform');
    obj.css('-webkit-transition-duration', animationTime / 1000 + 's');
    obj.css('-webkit-transform', 'translate3d(' + -left + 'px, 0, 0)');
    obj.css('-webkit-transition-timing-function',
      'cubic-bezier(0, 0.3, 0.6, 1)');

    if (doneCallback) {
      setTimeout(function() {
        doneCallback();
      }, animationTime);
    }
  };

  animateOutCommentBox = function() {
    $('#commentBox').animate({
      opacity: 0
    }, 300, null, function() {
      erly.viewer.Carousel.instance.comments.updateCommentIcons();
      $(this).remove();
    });
  };

  var bindHoverHeader = function() {
    var wrapper = $('#header_wrapper');
    if (wrapper.hasClass('hoverable')) {
      return;
    }
    wrapper.addClass('hoverable');

    var header  = wrapper.find('.header');

    var showHeader = false;
    var selected = function(e) {
      // Sometimes we get a false hover event and all of these
      // flags are set.
      if (e.altKey && e.ctrlKey && e.shiftKey) {
        return;
      }
      showHeader = true;
      setTimeout(function() {
        if (showHeader) {
          header.stop().animate({
            marginTop: 0
          });
        }
      }, 250);
    };

    var deselected = function(animationDuration) {
      if (typeof animationDuration === 'undefined') {
        animationDuration = 500;
      }
      showHeader = false;

      header.stop().animate({
        marginTop: -50
      }, animationDuration);
    };

    wrapper.hover(selected, deselected);
  };

  var unbindHoverHeader = function() {
    var wrapper = $('#header_wrapper');
    if (wrapper.hasClass('hoverable')) {
      return;
    }
    wrapper.addClass('hoverable');

    var header  = wrapper.find('.header');

    wrapper.removeClass('hoverable');
  };

  var centerForIPad = function() {
    var orientation = window.orientation;

    if (orientation === 90 || orientation === -90) {
      $('.header').hide();
    } else {
      $('.header').show();
    }
  };

  var changePosition = function(delta, doneCallback) {
    scrollToPosition(getCarouselPosition() + delta, doneCallback);
  };

  var evenRowLayout = function(x, cardOptions, numRows, cardWidth, carouselHeight) {
    var i = 0;
    carouselHeight = carouselHeight - (numRows - 1);
    var cardHeight = Math.floor(carouselHeight / numRows);

    var rowHeights = [];
    var total = 0;
    for (i = 0; i < numRows - 1; i++) {
      rowHeights.push(cardHeight);
      total += cardHeight;
    }

    rowHeights.push(carouselHeight - total);

    return rowLayout(x, cardOptions, rowHeights, null, cardWidth);
  };

  findMinMaxScrollCoordinate = function(dest) {
    if (_carouselOuterWidth < $(window).width()) {
      return INITIAL_MARGIN;
    }

    // In zoomed mode, allow any coordinate (to support centering the
    // first and last card)
    if (_zoomed) {
      return dest;
    }

    var leftBound = INITIAL_MARGIN;
    var rightBound = INITIAL_MARGIN + _carouselOuterWidth - $(window).width();

    if (dest < leftBound) {
      return leftBound;
    } else if (dest > rightBound) {
      return rightBound;
    } else {
      return dest;
    }
  };

  getCarouselPosition = function() {
    if (erly.browserSupport.usesCssTransitions()) {
      return _lastCarouselLeft;
    } else if (_carouselContainer) {
      return _carouselContainer.scrollLeft();
    }
    return 0;
  };

  var getMouseDragTargetPosition = function() {
    if (_mouseDragTarget) {
      return getCarouselPosition();
    } else {
      return 0;
    }
  };

  var hideNonTransparentOverlay = function() {
    var overlayContainer = $('.viewer .loader-overlay-container');

    overlayContainer.
      css('-webkit-transition', 'opacity 1s linear').
      css('opacity', 0);

    setTimeout(function() {
      overlayContainer.remove();
    }, 1000);

    $('.viewer .loader').hide();
    $('.viewer .loader img').attr('img', _originalLoaderImage);
  };

  var handleOrientationChange = function() {
    $('body').bind('orientationchange', function() {
      showNonTransparentOverlay();
      centerForIPad();
      erly.viewer.Carousel.instance.relayout();

      // TODO: recenter on the last post that was visible before relayout
      // var visiblePost = $('.post:visible');
      // scrollToPosition(visiblePost.position().left);
      scrollToFront();
    });
  };

  /**
   * Lazily loads a single image, invokes `callback` when complete.
   */
  var _lazyLoadImage = function(image, callback) {
    callback = _.once(callback);

    if (!image.hasClass('lazy-loaded')) {
      // Invoke the callback after 5 seconds in case the image doesn't load
      // properly
      _.delay(function() { callback(); }, 5000);

      image.css('opacity', 0.01);
      image.attr('src', image.data('lazy-src'));
      image.addClass('lazy-loaded');
      image.removeClass('lazy-load');
      _lazyLoadCount++;

      // If this image needed some centering and letterboxing, do it
      if (image.hasClass('needs-center-letterbox')) {
        var storedArgs = image.data('center-letterbox');
        erly.centerImage(image, storedArgs[0], storedArgs[1],
          $.extend(storedArgs[2], {callback: callback}));
        return;
      }
    }
    callback();
  };

  /**
   * Images added to this queue will be loaded in order closest to the current
   * viewport.  Push or unshift [image, image's left position].
   *
   * @api private
   */
  var _imageQueue = async.customQueue(function(image, callback) {
    _lazyLoadImage(image[0], callback);
  }, 5);

  /**
   * Return the image closest to the center of the current viewport.
   *
   * @api private
   */
  _imageQueue.nextTask = function(tasks) {
    var scrollLeft = getCarouselPosition() + $(window).width() / 2;

    var cix = null, sdelta = null;
    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i].data;
      var delta = Math.abs(scrollLeft - task[1]);
      if (sdelta === null || delta < sdelta) {
        sdelta = delta;
        cix = i;
      }
    }

    var im = cix !== null ? tasks.splice(cix, 1)[0] : tasks.shift();
    return im;
  };

  var _lastScrollLeft = null;
  lazyLoad = function() {
    var windowWidth = $(window).width();
    var scrollLeft = getCarouselPosition();

    if (_lazySizeData) {
      _lazySizeData.scrollLeft = scrollLeft;
      _lazySizeData.windowWidth = windowWidth;

      var lazyCards = _lazySizeData.cards;
      _lazySizeData.cards = [];
      _.each(lazyCards, function(card) {
        // Remove the layout class so new sizing is applied immediately
        sizeCard(card);
      });
    }

    if (_lastScrollLeft !== null &&
        Math.abs(_lastScrollLeft - scrollLeft) > SIGNIFICANT_SCROLL_THRESHOLD) {
      // Significant movement, flush the image loading deque
      _imageQueue.flush();
    }
    _lastScrollLeft = scrollLeft;

    var getLeftRight = function(image) {
      var parent = image.parent();
      var postParent = parent.parents('.post');

      var left = erly.cssPixels(postParent, 'left') - scrollLeft;
      return {
        left: left,
        right: left + parent.width()
      };
    };

    _container.find('.lazy-load').each(function() {
      var image = $(this);

      // Check the container to see if it's in view
      var lr = getLeftRight(image);
      if (lr.left >= -windowWidth * 2 && lr.right <= windowWidth * 3) {
        // Queue up the image load along with its current position
        _imageQueue.unshift([image, lr.left + scrollLeft]);
        erly.centerImageAddLoader(image, null, null, {
          ajaxLoaderQualifier: _zoomed ? "-222222" : null
        });
      }
    });

    if (_lazyLoadCount > LAZY_LOAD_MAX &&
        window.location.search.indexOf('unload_images') !== -1) {
      _container.find('.lazy-loaded').each(function() {
        var image = $(this);

        // Check the container to see if it's in view
        var lr = getLeftRight(image);
        if (lr.left >= windowWidth * 3 || lr.right <= -windowWidth * 2) {
          image.attr('src', '/erly/img/bg-white-10.png');
          image.next('.letterboxed').remove();
          image.removeClass('lazy-loaded');
          image.addClass('lazy-load');

          _lazyLoadCount--;
        }
      });
    }
  };

  var recordDragMovements = function(distance, time) {
    if (!layoutPanel.dragVelocities) {
      layoutPanel.dragVelocities = [];
    }

    layoutPanel.dragVelocities.push([
      distance,
      time
    ]);
  };

  var recordMouseVelocity = function(event) {
    if (!_mouseDragVelocity) {
      _mouseDragVelocity = [];
    }

    _mouseDragVelocity.push([
      event.clientX - ((_mouseDragLast && _mouseDragLast.x) || event.clientX),
      event.timeStamp - (_mouseLastDragTime || event.timeStamp)
    ]);
  };

  rowLayout = function(x, cardOptions, rowHeights, splitIndex, cardWidth) {
    var numRows = rowHeights.length;

    // Force the sizes
    var cardPositions = [];
    var animating = false;
    var index = 0;
    var y = 0;
    var i = 0;
    for (; i < numRows; i++) {
      if (i === splitIndex) {
        var availableWidth = cardWidth - CARD_BORDER_WIDTH;
        var firstWidth = Math.round((availableWidth - 1) / 2);
        animating |= sizeCard(cardOptions[index], x, y, firstWidth,
          rowHeights[i]);
        cardPositions.push({
          x: x,
          y: y,
          w: firstWidth + CARD_BORDER_WIDTH,
          h: rowHeights[i],
          type: cardOptions[index].tmplItem().data.type
        });

        var nextX = x + firstWidth + CARD_BORDER_WIDTH + 1;
        var nextW = availableWidth - firstWidth - 1;
        animating |= sizeCard(cardOptions[index + 1], nextX, y, nextW, rowHeights[i]);
        cardPositions.push({
          x: nextX,
          y: y,
          w: nextW + CARD_BORDER_WIDTH,
          h: rowHeights[i],
          type: cardOptions[index + 1].tmplItem().data.type
        });

        index += 2;
      }
      else {
        animating |= sizeCard(cardOptions[index], x, y, cardWidth, rowHeights[i]);
        cardPositions.push({
          x: x,
          y: y,
          w: cardWidth + CARD_BORDER_WIDTH,
          h: rowHeights[i],
          type: cardOptions[index].tmplItem().data.type
        });

        index++;
      }

      y += rowHeights[i] + 1;
    }

    return {
      cardPositions: cardPositions,
      cardsUsed: index,
      xOffset: cardWidth + CARD_BORDER_WIDTH,
      animating: animating
    };
  };

  scrollToFront = function(doneCallback) {
    animatedScrollToPosition(0, doneCallback, 0);
  };

  scrollToPosition = function(pos, doneCallback) {
    animatedScrollToPosition(pos, doneCallback, 0);
  };

  var setupCarouselButtons = function(totalContentHeight, newMarginFun) {
    var containerWidth = _container.width();

    _carouselButtons.css('top', Math.floor(
      (totalContentHeight - _carouselButtons.outerHeight()) / 2) + 'px');
    _carouselButtons.unbind('click');

    var scrolling = false;
    var clickButton = function(direction) {
      return function() {
        if (scrolling) {
          return false;
        }

        scrolling = true;
        animatedScrollToPosition(newMarginFun(direction), function() {
          scrolling = false;
        });

        return false;
      };
    };

    _carouselButtons.eq(0).click(clickButton(LEFT));
    _carouselButtons.eq(1).click(clickButton(RIGHT));
  };

  var setupScrollBar = function(carouselWidth, carouselHeight, cardPositions) {
    // Put in a fake blank card if needed
    if (cardPositions.length === 0) {
      carouselWidth = $(window).width();
      cardPositions = [{
        x: 0,
        y: 0,
        w: carouselWidth,
        h: carouselHeight
      }];
    }

    var scale = 0.05;
    if (carouselWidth * scale > 500) {
      scale = 500 / carouselWidth;
    }

    _blocks.empty();
    _blocks.width(Math.round(carouselWidth * scale));
    var leftMargin = Math.round(_carouselLeftMargin * scale);
    _blocks.css('margin-left', leftMargin);
    var scrollBarHeight = _scrollBar.height();
    _.each(cardPositions, function(cardPos) {
      var t_temp = Math.round(scrollBarHeight * (cardPos.y / carouselHeight));
      var h_temp = Math.round(scrollBarHeight * (cardPos.h / carouselHeight));
      if ((t_temp + h_temp + 1) === scrollBarHeight) {
        h_temp += 1; // to make the carousel even for odd rounding
      }

      var block = $('<div class="block ' +  cardPos.type + '" style="' +
        'top:' + t_temp + 'px;' +
        'left:' +  Math.floor(cardPos.x * scale) + 'px;' +
        'width:' +  Math.round((cardPos.w + 1) * scale) + 'px;' +
        'height:' +  h_temp + 'px;' +
        '">&nbsp;</div>');

      _blocks.append(block);
    });

    var viewportBorderWidth = _viewport.outerWidth() - _viewport.width();
    _blocks.height(scrollBarHeight + 2);

    _scrollBar.width(Math.round(carouselWidth * scale) + leftMargin +
      viewportBorderWidth);
    _viewport.width(Math.min(
      Math.round((_containerWidth - INITIAL_MARGIN * 2) * scale),
      _blocks.width()
    ));
    _viewportScale = scale;
    _scrollBar.show();

    hideNonTransparentOverlay();
  };

  var _posCache = {};

  layout.sizeCard = sizeCard = function(card, left, top, width, height) {
    var getTargetHeight = function() {
      return height - CARD_BORDER_HEIGHT -
        (card.find('.metadata').length > 0 ? CARD_METADATA_HEIGHT : 0);
    };

    var cardId = card.attr("id");

    if (left) {
      _posCache[cardId] = [left, width];
    }

    // erly.profiling.mark('sizeCard', 'start');
    if (_lazySizeData) {
      // Grab some lazy sizing state
      if (typeof _lazySizeData.windowWidth === 'undefined') {
        _lazySizeData.windowWidth = $(window).width();
      }

      if (typeof _lazySizeData.scrollLeft === 'undefined') {
        _lazySizeData.scrollLeft = getCarouselPosition();
      }

      // Grab cached sizing data
      var dimData = _lazySizeData[cardId];
      if (typeof left === "undefined" && dimData) {
        left = dimData.left;
        top = dimData.top;
        width = dimData.width;
        height = dimData.height;
      }

      // Check if the card is in the viewport
      var inView = false;
      if ((left - _lazySizeData.scrollLeft) >= -_lazySizeData.windowWidth * 2 &&
      (left - _lazySizeData.scrollLeft + width) <= _lazySizeData.windowWidth * 3) {
        inView = true;
      }

      if (_zoomed3d) {
        if (_zoomedCard.attr('id') === cardId) {
          inView = true;
        }
      }

      if (!inView) {
        // If it hasn't been lazy-sized yet, do it
        if (!card.hasClass('lazy-laidout')) {
          _lazySizeData[cardId] = {
            left: left,
            top: top,
            width: width,
            height: height
          };

          card.css('left', left + 'px').css('top', top + 'px').width(width).height(height - CARD_BORDER_HEIGHT);

          var target = card.find('>div:eq(0)');
          target.width(width);

          // NOTE: For some reason, setting the height crashes on iOS
          if (browser.name !== 'iPad' && browser.name !== 'iPhone') {
            target.height(getTargetHeight());
          }
          card.addClass('lazy-laidout');

          // Don't animate next time around
          card.removeClass('laidout');
        }

        // Add it to the list of cards still needing sizing
        _lazySizeData.cards = _lazySizeData.cards || [];
        _lazySizeData.cards.push(card);

        return;
      }
    }

    var contentHeight = height - CARD_NONCONTENT_HEIGHT;

    var photo = card.find('.photo img:eq(0)');
    var photoCaption = card.find('.photo .caption .caption-container');
    if (photoCaption.length > 0) {
      erly.shortenUrls(photoCaption);
      var oldPhotoCaptionWidth = photoCaption.width();
      photoCaption.width(width - CARD_BORDER_WIDTH);

      var maxHeight = _zoomed ? PHOTO_CAPTION_ZOOMED_MAX_HEIGHT :
        PHOTO_CAPTION_MAX_HEIGHT;

      var hasEllipsis = erly.checkEllipsis(photoCaption, maxHeight, 15);

      var captionContainer = card.find('.photo .caption');
      captionContainer.unbind('hover');
      if (hasEllipsis) {
        var shouldShowCaption = false;
        captionContainer.hover(function() {
          if (shouldShowCaption) {
            return;
          }

          shouldShowCaption = true;

          setTimeout(function() {
            if (!shouldShowCaption) {
              return;
            }

            captionContainer.css('bottom', '').css('top',
              captionContainer.position().top);
            erly.clearEllipsis(photoCaption);
            _.defer(function() {
              captionContainer.css('top', '').css('bottom', maxHeight + 15 -
                captionContainer.height());
              captionContainer.stop().animate({
                bottom: 0
              });
            });
          }, 300);
        }, function() {
          shouldShowCaption = false;
          captionContainer.stop(true).animate({
            bottom: maxHeight + 15 - captionContainer.height()
          }, function() {
            erly.checkEllipsis(photoCaption, maxHeight, 15);
            captionContainer.css('bottom', 0);
          });
        }).css('z-index', 1000);
      }

      photoCaption.css('width', 'auto');
    }
    // erly.profiling.mark('sizeCard', 'checkEllipsis');

    var note = card.find('.note > .content');
    if (note.length > 0) {
      // Take into account the padding around the content...
      contentHeight -= 20;

      // erly.profiling.mark('sizeCardNote', 'start');
      var originalNoteWidth = note.width();

      var textLineHeight = 50;
      var quotes = true;

      var text = card.tmplItem().data.text;
      var forceSmallest = false;
      if (text.length < 140) {
        note.parent().addClass('quotes');
        if (text.length < 60) {
          note.parent().addClass('centered');
        }
      }
      else {
        note.parent().addClass('big-letter');
        textLineHeight = 42;
        quotes = false;
        if (note.parent().find('.letter').length === 0) {
          note.parent().prepend($('<div class="letter">' + text[0] + '</div>'));
        }

        if (text.length > 600) {
          forceSmallest = true;
        }
      }

      note.parent().removeClass('smaller').removeClass('medium');
      // NOTE: -10 for jScrollPane's vertical bar...
      note.width(width - CARD_BORDER_WIDTH - 10);
      note.parent().width(width);

      if (note.height() > contentHeight) {
        note.parent().addClass('medium');
        textLineHeight = quotes ? 36 : 24;
      }

      if (note.height() > contentHeight || forceSmallest) {
        note.parent().removeClass('medium');
        note.parent().addClass('smaller');
        textLineHeight = quotes ? 24 : 20;
      }

      if (note.is('.jspScrollable')) {
        note.data('jsp').destroy();
      }

      _.defer(function() {
        // NOTE: Have to refind our note here b/c jScrollPane does something
        //       funky
        note = card.find('.note > .content');
        note.css('height', 'auto');
        note.find(">div").width(width - CARD_BORDER_WIDTH);

        if (_zoomed) {
          erly.clearEllipsis(note);

          if (note.height() > contentHeight) {
            note.height(contentHeight);
            note.find('>div').width(width - CARD_BORDER_WIDTH - 20);
            _.defer(function() {
              note.jScrollPane();
            });
          }
        }
        else {
          erly.checkEllipsis(note, contentHeight, textLineHeight, true);
        }

        if (!forceSmallest) {
          var pad = Math.max(0, (contentHeight - note.height()) / 2);
          note.css('padding-top', pad + 'px');
        }
      });

      note.parent().css('width', '');
      // erly.profiling.reset('sizeCardNote');
    }

    var textHeight = 0;
    var link = card.find('.link');
    var linkImage = link.find('.image img:eq(0)');
    if (link.length > 0) {
      // erly.profiling.mark('sizeCardLink', 'start');
      var contentContainer = link.find('.content');
      var linkAnchor = link.find('a.url');
      var linkText = link.find('.text');
      var linkTitle = link.find('.title');
      var twitterImageIcon = link.find('.twitter-profile-icon');
      var imageContainer = link.find('.image');
      contentContainer.width(width - CARD_BORDER_WIDTH);
      var contentWidth = contentContainer.width();
      linkAnchor.width(width - CARD_BORDER_WIDTH);

      // Reset
      link.removeClass("smaller");
      erly.clearEllipsis(linkTitle);
      erly.clearEllipsis(linkText);

      var fitContent = function(natural) {
        // Reset all styling
        link.removeClass('large-image-left');
        imageContainer.css('height', '').css('width', '');
        contentContainer.css('width', '');

        // Centers and letterboxes the link image, repositions the collection
        // overlay if there is one.
        var centerImage = function(w, h, topAlign, letterboxOpacity) {
          erly.centerImage(linkImage, w, h, {
            duration: 0,
            letterbox: {
              opacity: letterboxOpacity,
              ajaxLoaderQualifier: _zoomed ? "-222222" : null,
              onlyIfTooNarrow: true
            },
            topAlign: topAlign,
            callback: function(im) {
              var overlay = card.find('.bottom');
              if (overlay.length > 0) {
                imageContainer.height(
                  imageContainer.height() - overlay.outerHeight());
              }
            }
          });
        };

        var LINK_TITLE_LINE_HEIGHT = 24;
        var LINK_TEXT_LINE_HEIGHT = 21;

        var MIN_TITLE_LINES = 2;
        var MIN_TEXT_LINES = 3;

        var sizeText = function(availableHeight, titleIndex) {
          var anchorHeight = linkAnchor.eq(titleIndex).parent().outerHeight(true);
          var textHeight = linkText.outerHeight(true);
          var titleHeight = linkTitle.eq(titleIndex).outerHeight(true);
          var totalHeight = titleHeight + textHeight + anchorHeight;

          if (totalHeight > availableHeight) {
            // First see if we have room to squish down the text
            var availableTextHeight = availableHeight - titleHeight - anchorHeight;
            if (Math.floor(availableTextHeight / LINK_TEXT_LINE_HEIGHT) >= MIN_TEXT_LINES) {
              // We have enough space, we're done
              erly.checkEllipsis(linkText, availableTextHeight, LINK_TEXT_LINE_HEIGHT);
              return 0;
            }

            // If there's still not enough room, chop the title down to minimum
            var neededHeight = totalHeight - availableHeight;
            var titleReduction = titleHeight - MIN_TITLE_LINES * LINK_TITLE_LINE_HEIGHT;
            var textReduction = neededHeight - titleReduction;
            erly.checkEllipsis(linkTitle.eq(titleIndex), titleHeight - titleReduction, LINK_TITLE_LINE_HEIGHT);
            erly.checkEllipsis(linkText, textHeight - textReduction, LINK_TEXT_LINE_HEIGHT);

            return 0;
          }
          else {
            return availableHeight - totalHeight;
          }
        };

        var useLandscape = function(heightPercent) {
          var IMAGE_CONTAINER_PADDING = 0;
          var imageHeight = Math.floor(height * heightPercent);

          linkAnchor.width(contentWidth);
          linkText.width(contentWidth);
          var titleWidth = contentWidth;
          if (twitterImageIcon.length > 0) {
            titleWidth -= twitterImageIcon.outerWidth(true);
          }
          linkTitle.width(titleWidth);
          var remaining = sizeText(height - CARD_NONCONTENT_HEIGHT - imageHeight - 8, 1);

          // Fill the remaining space with the image
          imageHeight += remaining - 5;

          imageContainer.width(width);
          imageContainer.height(imageHeight - IMAGE_CONTAINER_PADDING);

          imageContainer.next('.link-overlay').
            height(imageHeight).
            width(width).
            css('top', 0);
          centerImage(width, imageHeight, false, 0.2);
        };

        var usePortrait = function(widthPercent) {
          var imageWidth = Math.floor(width * widthPercent);
          imageWidth = Math.min(imageWidth, natural.w);
          imageContainer.width(imageWidth);

          link.addClass('image-left');

          linkAnchor.width(width - CARD_BORDER_WIDTH);
          var titleWidth = width - CARD_BORDER_WIDTH;
          if (twitterImageIcon.length > 0) {
            titleWidth -= twitterImageIcon.outerWidth(true);
          }
          linkTitle.width(titleWidth);

          var remaining = width - imageWidth - CARD_BORDER_WIDTH;
          contentContainer.css('padding', 0);
          contentContainer.width(remaining);
          linkText.width(remaining);
          sizeText(height - CARD_NONCONTENT_HEIGHT - 8, 0);

          var titleHeight = link.find('.portrait-title').outerHeight(true);
          var imageHeight = contentHeight - titleHeight;

          imageContainer.next('.link-overlay').
            height(imageHeight).
            width(imageWidth).
            css('top', titleHeight);
          centerImage(imageWidth, imageHeight , true, 0);
        };

        var isCollectionLink = imageContainer.find('.small-title').length > 0;

        // NO IMAGE
        if (natural.w === 0 || natural.h === 0) {
          link.addClass('smaller');
          useLandscape(0);
        }
        // SMALL CARD (don't show image)
        else if (height < 300 && !isCollectionLink) {
          link.addClass('smaller');
          useLandscape(0);
        }
        // SMALL IMAGE (letterbox image in landscape)
        else if (natural.w < 150 && natural.h < 150) {
          usePortrait(0.25);
        }
        // WIDE IMAGE
        else if (natural.w > width) {
          // BIG IMAGE (tall landscape it)
          if (natural.h > height) {
            useLandscape(0.6);
          }
          // JUST WIDE IMAGE (short landscape)
          else {
            useLandscape(0.3);
          }
        }
        // TALL IMAGE
        else if (natural.h > height) {
          // BIG IMAGE (tall landscape it)
          if (natural.w > width) {
            useLandscape(0.6);
          }
          // JUST TALL IMAGE (portrait)
          else {
            usePortrait(0.4);
          }
        }
        // FALLBACK TALL IMAGE (portrait)
        else if (natural.h > natural.w) {
          usePortrait(0.4);
        }
        // FALLBACK TO LANDSCAPE
        else {
          useLandscape(0.4);
        }
      };

      if (linkImage.length === 0) {
        fitContent({
          w: 0,
          h: 0
        });
      }
      else {
        erly.getNaturalDimensions(linkImage, fitContent);
      }
      // erly.profiling.reset('sizeCardLink');
    }

    card.data('targetLeft', left);
    card.data('targetWidth', width);

    var targetHeight = getTargetHeight();
    card.find('.overlay').width(width).height(targetHeight);
    card.find('.play-overlay').width(width).height(targetHeight);
    if (card.hasClass('laidout')) {
      erly.centerImage(photo, width, contentHeight, {
        duration: _animationTime,
        ajaxLoaderQualifier: _zoomed ? "-222222" : null,
        limitedStretch: 0 
      });

      if (card.data('noAnimation') || _animationTime === 0 ||
          erly.browserSupport.usesCssTransitions()) {
        card.css({
          top: top + 'px',
          left: left + 'px',
          width: width + 'px',
          height: (height - CARD_BORDER_HEIGHT) + 'px'
        });
        card.find('>div:eq(0)').css({
          width: width + 'px',
          height: targetHeight + 'px'
        });
      }
      else {
        card.animate({
          top: top,
          left: left,
          width: width,
          height: height - CARD_BORDER_HEIGHT
        }, _animationTime);

        card.find('>div:eq(0)').animate({
          width: width,
          height: targetHeight
        }, _animationTime);
      }

      // NOTE: For some reason overflow:hidden was getting added to cards
      //       after resize.
      card.css('overflow', 'visible');

      return true;
    }
    else {
      card.css('top', top + 'px');
      card.css('left', left + 'px');
      card.width(width).height(height - CARD_BORDER_HEIGHT);
      card.find('>div:eq(0)').width(width).height(targetHeight);

      erly.centerImage(photo, width, targetHeight, {
        ajaxLoaderQualifier: _zoomed ? "-222222" : null,
        limitedStretch: 0
      });

      card.addClass('laidout');

      // erly.profiling.reset('sizeCard');
      return false;
    }
  };

  var setMouseDragTargetPosition = function(left) {
    if (_mouseDragTarget) {
      animatedScrollToPosition(left, null, 0);
    }
  };

  showNonTransparentOverlay = function() {
    var orientation;

    if (window.orientation === -90 || window.orientation === 90) {
      orientation = 'vertical';
    } else {
      orientation = 'horizontal';
    }

    var overlayContainer = $('.viewer .loader-overlay-container');

    if (overlayContainer.length === 0) {
      $('.viewer .loader-overlay-container').remove();

      $('.viewer').append('                                   ' +
        '<div class="loader-overlay-container">               ' +
        '  <div class="loader-overlay ' + orientation + '">   ' +
        '  </div>                                             ' +
        '</div>');
    }

    var loader = $('.viewer .loader');
    var loaderImage = loader.find('img');

    _originalLoaderImage = $('.viewer .loader .img').attr('src');
    $('.viewer .loader img').attr('src', erly.PUB_URL + '/erly/img/ajax-loader-222222.gif');
    loader.show();
  };

  var updateCachedVariables = function() {
    _carouselOuterWidth = _carousel.outerWidth(true);
    _carouselLeftMargin = erly.cssPixels(_carousel, 'margin-left');
    _containerWidth     = _container.width();
  };

  updateCarouselButtons = _.throttle(function(duration) {
    if (!_carouselButtonsShowing) { return; }

    if (_zoomed) {
      _carouselButtons.stop(true, true).fadeIn(duration);
      return;
    }

    var pos = getCarouselPosition();
    if (pos === INITIAL_MARGIN || _carouselButtons.eq(0).is('.hidden')) {

      if (!_homeButtonShownOn) {
        _homeButtonShownOn = new Date();
      }
      _carouselButtons.eq(0).stop(true, true).fadeOut(duration);
    } else {
      _homeButtonShownOn = null;
      _carouselButtons.eq(0).stop(true, true).fadeIn(duration);
    }

    // if we can't scroll one pixel over, we are at the end
    if (findMinMaxScrollCoordinate(pos + 1) === pos ||
        _carouselButtons.eq(1).is('.hidden')) {
      _carouselButtons.eq(1).stop(true, true).fadeOut(duration);
    } else {
      _carouselButtons.eq(1).stop(true, true).fadeIn(duration);
    }
  }, 250);

  /*
   * PUBLIC FUNCTIONS
   */

  layoutPanel.bindHoverHeader = bindHoverHeader;
  layoutPanel.unbindHoverHeader = unbindHoverHeader;

  layoutPanel.animatedScrollToPosition = function(pos, doneCallback,
      animationTime, options) {
    // Take into account the margin
    pos += _carouselLeftMargin;
    animatedScrollToPosition(pos, doneCallback, animationTime, options);
  };
  layoutPanel.getCarouselPosition = getCarouselPosition;
  layoutPanel.hideCarouselButtons = function(duration) {
    var wasShowing = _carouselButtonsShowing;
    _carouselButtonsShowing = false;

    if (wasShowing && _carouselButtons) {
      _carouselButtons.stop(true, true).fadeOut(duration);
    }
  };
  layoutPanel.showCarouselButtons = function(duration) {
    var wasShowing = _carouselButtonsShowing;
    _carouselButtonsShowing = true;

    if (!wasShowing) {
      updateCarouselButtons(duration);
    }
  };
  layoutPanel.updateCarouselButtons = updateCarouselButtons;

  layoutPanel.clickNextCarouselButton = function() {
    _carouselButtons.eq(1).click();
  };

  layoutPanel.animatedScrollToFront = function(doneCallback) {
    animatedScrollToPosition(0, doneCallback);
  };

  layoutPanel.bindArrowKeyMovements = function() {
    $(window).keydown(function(event) {
      var tagName = event.target.nodeName.toLowerCase();
      var keyCode = event.which;

      // skip any input fields
      if (/(input)|(textarea)/.test(tagName)) {
        return true;
      }

      // ignore everything but left + right arrow key presses
      if (keyCode !== LEFT_ARROW_KEY && keyCode !== RIGHT_ARROW_KEY) {
        return true;
      }

      // if we are showing the photo modal, use
      // the arrow keys to page the photos.  Otherwise,
      // move the carousel
      if (_zoomed) {
        if (keyCode === LEFT_ARROW_KEY) {
          _carouselButtons.eq(0).click();
        } else {
          _carouselButtons.eq(1).click();
        }
      } else {
        var positionChange = 0,
            keypressDelta = 40;

        if (keyCode === LEFT_ARROW_KEY) {
          positionChange = -keypressDelta;
        } else if (keyCode === RIGHT_ARROW_KEY) {
          positionChange = keypressDelta;
        }

        changePosition(positionChange);
      }

      return true;
    });
  };

  layoutPanel.bindIPad = function() {
    layoutPanel.bindIPadSwipeMovements();
    centerForIPad();
    handleOrientationChange();
  };

  layoutPanel.bindIPadSwipeMovements = function() {
    var lastTime,
        lastDistance,
        originalPosition;

    _carouselContainer.swipe({
      triggerOnTouchEnd: true,
      allowPageScroll: 'vertical',
      threshold: 100,
      swipeStatus: function(event, phase, direction, distance) {
        if (phase === 'start') {
          originalPosition = getCarouselPosition();
          lastTime = new Date();
          lastDistance = 0;
          layoutPanel.dragVelocities = [];
        } else if (phase === 'move' && (direction === 'left' || direction === 'right')) {
          var now = new Date();

          if (direction === 'right') {
            distance *= -1;
          }

          // swipe left to show the flagstone

          if (originalPosition === 0 && distance < -500) {
            var homeButton = $('.home-button').eq(0);
            homeButton.click();
          } else {
            recordDragMovements(lastDistance - distance, now - lastTime);
            scrollToPosition(distance + originalPosition);

            lastDistance = distance;
            lastTime = now;
          }
        } else if (phase === 'cancel' || phase === 'end') {
          setTimeout(function() {
            animatedScrollByVelocities(layoutPanel.dragVelocities);
          }, 13);
        }
      }
    });
  };

  layoutPanel.bindMouseMovements = function(browser) {
    var swipeRightOpenedCarouselOn = null;

    erly.events.subscribe(erly.events.SWIPE_RIGHT_OPEN_CAROUSEL, function() {
      swipeRightOpenedCarouselOn = new Date();
    });

    var scrollMultiplier;

    if (browser && browser.scrollMultiplier) {
      scrollMultiplier = browser.scrollMultiplier;
    } else {
      scrollMultiplier = 40;
    }

    var zoomSwipeLeft = _.throttleImmediate(function() {
      _carouselButtons.eq(0).click();
    }, 500);
    var zoomSwipeRight = _.throttleImmediate(function() {
      _carouselButtons.eq(1).click();
    }, 500);

    _carousel.mousewheel(function(event, _, deltaX, deltaY) {
      // Don't move the carousel if we're wheeling over a jScrollPane
      // that can scroll
      var jspPane = $(event.target).parents('.jspContainer');
      if (jspPane.length > 0 && jspPane.find('.jspVerticalBar').length > 0) {
        return;
      }

      var delta = deltaX ? deltaX : -deltaY;

      if (_zoomed) {
        if (delta < 0) {
          zoomSwipeLeft();
        }
        else {
          zoomSwipeRight();
        }
        event.preventDefault();
        return false;
      }

      // Don't move the carousel if we just swiped right
      // from the flagstone
      if (swipeRightOpenedCarouselOn &&
          new Date() - swipeRightOpenedCarouselOn < 1420) {
        return true;
      }

      // Swipe back to the flagstone if we are at the
      // start of the carousel
      if (_homeButtonShownOn &&
          new Date() - _homeButtonShownOn > 1000 &&
          deltaX * scrollMultiplier < -200 &&
          getCarouselPosition() === 0) {
        erly.events.fire(erly.layout.HOME_CLICKED);
        return true;
      }

      if (delta) {
        changePosition(delta * scrollMultiplier);
        event.preventDefault();
      }
      else {
        return true;
      }
    });
  };

  layoutPanel.init = function(container, collection, options) {
    if (_inited) {
      return;
    }

    _options = $.extend({
      heightOffset: 0
    }, options);

    _container = container;

    _container.css('position', 'relative');
    _container.addClass("panel-layout");

    // Add the carousel buttons
    var leftButton = $('<button class="carousel-button cb-left"></button>');
    var rightButton = $('<button class="carousel-button cb-right"></button>');
    _container.append(leftButton);
    _container.append(rightButton);
    _carouselButtons = $().add(leftButton).add(rightButton);

    _scrollBarContainer = $('<div class="scrollbar-container"></div>');
    _container.prepend(_scrollBarContainer);

    _scrollBarPadding = $('<div class="scrollbar-padding"></div>');
    _scrollBarContainer.append(_scrollBarPadding);

    var homeButton = $('<div class="home-button"></div>');
    homeButton.click(function() {
      erly.events.fire(erly.layout.HOME_CLICKED);
    });
    _scrollBarPadding.append(homeButton);

    _scrollBar = $('<div class="scrollbar"></div>');
    _scrollBarPadding.append(_scrollBar);

    _blocks = $('<div class="blocks grayscale">&nbsp;</div>');
    _scrollBar.append(_blocks);

    _viewport = $('<div class="viewport">&nbsp;</div>');
    _scrollBar.append(_viewport);

    _carouselContainer = $('<div />').attr({
      id: 'carousel_container',
      'class': 'carousel-container'
    });
    _carousel = $('<div id="carousel" class="carousel"></div>');

    _carouselContainer.append(_carousel);
    _container.prepend($('<div class="bottom-shadow">&nbsp;</div>'));
    _container.prepend(_carouselContainer);
    _container.prepend($('<div class="top-shadow">&nbsp;</div>'));

    if (_carouselContainer.scrollLeft() < INITIAL_MARGIN) {
      animatedScrollToPosition(INITIAL_MARGIN, null, 0);
    }

    var flasher = $('<div id="flasher" class="flasher"><div>&nbsp;</div></div>');
    _carousel.prepend(flasher);

    _viewport.draggable({
      axis: 'x',
      containment: 'parent',
      drag: function(event, ui) {
        var pos = _viewport.position();
        var target = Math.round(pos.left / _viewportScale);

        animatedScrollToPosition(target, null, 0, {
          updateViewport: false
        });
      }
    });
    _viewportOuterWidth = _viewport.outerWidth();

    _scrollBar.click(function(e) {
      var scrollBarLeft = _scrollBar.offset().left;

      var target = Math.round(
        (e.pageX - scrollBarLeft - _viewportOuterWidth / 2) / _viewportScale);
      animatedScrollToPosition(target);
    });

    var onMouseMove = function(event) {
      if (_mouseDown) {
        _mouseDragging = true;

        erly.events.fire(erly.events.CAROUSEL_DRAGGED);
      }

      if (_mouseDragging) {
        var x = event.clientX;
        var y = event.clientY;

        var xDelta = _mouseDragLast.x - event.clientX;
        var dest = getMouseDragTargetPosition() + xDelta;

        dest = findMinMaxScrollCoordinate(dest);
        setMouseDragTargetPosition(dest);

        recordMouseVelocity(event);

        _mouseDragLast = {
          x: x,
          y: y
        };

        _mouseLastDragTime = event.timeStamp;

        event.preventDefault();
        return false;
      }

      return true;
    };

    var onMouseUp = function(event) {
      var mouseVelocities = _mouseDragVelocity;

      recordMouseVelocity(event);
      if (_mouseDragging && mouseVelocities.length > 1) {
        animatedScrollByVelocities(mouseVelocities);
      }

      _mouseDown = false;

      if (_mouseDragging) {
        $(document).unbind('mousemove', onMouseMove);
        $(document).unbind('mouseup', onMouseUp);

        _mouseDragging = false;
        _mouseDragLast = null;
        _mouseDragTarget = null;
        _mouseLastDragTime = null;
        _mouseDragVelocity = [];

        event.preventDefault();
        return false;
      }
      else {
        return true;
      }
    };

    _carousel.mousedown(function(event) {
      if (erly.oldIE) {
        if (event.button !== 1) {
          return true;
        }
      }
      else if (event.button !== 0) {
        return true;
      }

      if (_zoomed) {
        return true;
      }

      // If we are on drag handle don't do anything
      if ($(event.srcElement || event.target).is(".drag-handle, .drag-note")) {
        return true;
      }

      var tagName = event.target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'button') {
        return true;
      }

      _mouseDown = true;
      _mouseDragLast = {
        x: event.clientX,
        y: event.clientY
      };

      _mouseDragTarget = _carousel;
      _mouseLastDragTime = event.timeStamp;

      animateOutCommentBox();

      _mouseDragTarget.stop();

      $(document).mouseup(onMouseUp);
      $(document).mousemove(onMouseMove);

      return false;
    });

    _inited = true;
  };

  layoutPanel.lastZoomedCard = function() {
    return _zoomedCard;
  };

  layoutPanel.setZoomedCard = function(card) {
    _container.unbind('click.slideshow');

    _zoomedCard = card;

    if (_zoomedCard) {
      _container.bind('click.slideshow', function(e) {
        if (e.which > 1) {
          return;
        }

        // Find the post that was clicked
        var clickedPost = $(e.srcElement).parents("div.post");

        // If no post was clicked, base the direction on the location of the
        // click
        if (clickedPost.length === 0) {
          if (e.screenX < $(window).width() / 2) {
            _carouselButtons.eq(0).click();
          }
          else {
            _carouselButtons.eq(1).click();
          }
        }
        // Otherwise, see if the post was before or after the zoomed post
        else {
          if (_zoomedCard.get(0) !== clickedPost.get(0)) {
            if (_zoomedCard.position().left > clickedPost.position().left) {
              _carouselButtons.eq(0).click();
            }
            else {
              _carouselButtons.eq(1).click();
            }
          }
        }
      });
    }

    if (_zoomedCard) {
      _zoomedCard.css('opacity', 1);
    }
  };

  layoutPanel.layout = function(options) {
    var windowWidth = $(window).width();
    var windowHeight = $(window).height();
    if (windowWidth === _lastWidth &&
        windowHeight === _lastHeight &&
        !options.force) {
      return;
    }
    _lastWidth = windowWidth;
    _lastHeight = windowHeight;

    _animationTime = options.animationTime;
    if (typeof _animationTime === 'undefined') {
      _animationTime = 600;
    }

    _zoomed = options.zoomed;
    if (!_zoomed) {
      layoutPanel.setZoomedCard(null);
      _container.find('.download-icon').hide();
    }
    else {
      _container.find('.download-icon').show();
    }

    // erly.profiling.mark('LAYOUT', 'start');
    // Use a seeded pseudo-random number for some determinism
    Math.seedrandom(options.layoutSeed || Math.random());
    // erly.profiling.mark('LAYOUT', 'random seed determined');

    $('.right-col').css('margin-left', '0');

    var findSidebar = function() {
      _sidebar = _carousel.find('#sidebar').parent();
    };

    var newPosts = _container.find('> .post');
    findSidebar();

    if (_sidebar.length > 0) {
      _sidebar.after(newPosts);
    } else {
      _carousel.append(newPosts);
      findSidebar();
    }

    var cards = _carousel.find('.post');
    _lazySizeData = (cards.length > LAZY_LOAD_MAX ? {} : null);
    // erly.profiling.mark('LAYOUT', 'found visible cards');

    // Hard stop all animation
    cards.stop(true);
    // erly.profiling.mark('LAYOUT', 'stopped card animation');

    cards.find('.photo img').stop(true);
    cards.find('.photo canvas').stop(true);
    cards.find('> div:eq(0)').stop(true);
    cards.find('.link .image img').stop(true);
    _carouselContainer.stop(true);
    _viewport.stop(true);
    // erly.profiling.mark('LAYOUT', 'stopped all animation');

    // Size the carousel based on the window
    var height = Math.max(560, windowHeight + _options.heightOffset);
    var carouselMargins = erly.cssPixels(_carousel, 'margin-top') +
      erly.cssPixels(_carousel, 'margin-bottom');
    var carouselBorder  = erly.cssPixels(_carousel, 'border-top-width') +
      erly.cssPixels(_carousel, 'border-bottom-width');

    var carouselHeight = height - _scrollBarContainer.outerHeight(true);
    carouselHeight -= carouselMargins;
    carouselHeight -= carouselBorder;

    if (_zoomed) {
      carouselHeight = windowHeight - 10;
    }

    var i = 0;
    var x = 0;
    var index = 0;

    var get = function(field, v) {
      if (v.tmplItem && v.tmplItem().data) {
        return v.tmplItem().data[field];
      }
      return '';
    };

    // Figure out the layouts forwards, so old items will all preserve their
    // layout
    var layouts = [];
    var layoutHints = [];
    while (index < cards.length) {
      var cardOptions = [cards.eq(index)];
      if (index < cards.length - 1) {
        cardOptions.push(cards.eq(index + 1));
      }
      if (index < cards.length - 2) {
        cardOptions.push(cards.eq(index + 2));
      }

      var types = _.map(cardOptions, _(get).bind(null, 'type'));
      var hints = _.map(cardOptions, _(get).bind(null, 'layoutHint'));
      var fixedWidth;
      var layout;

      var layoutHint = hints[0];

      // First, choose a layout
      if (_zoomed) {
        layout = 'full';
      }
      else if (!types[1]) {
        // If there's only 1 card left, it has to be full
        layout = 'full';
      }
      else if (hints[0] === 'full') {
        // If this card must be full, make it full and use the hint
        layout = 'full';
      }
      else if (hints[0] === 'shrink' && types[1]) {
        // If this card must be small, then choose one and use the hint
        // NOTE: We purposely ignore hints[1] so we can't get trapped
        //       Effectively, shrink preempts the next full, but not the next next full
        if (types[2] && hints[2] !== 'full') {
          layout = erly.chooseNew(['split', 'triple', 'topHeavy', 'bottomHeavy', 'topHeavySplit', 'bottomHeavySplit'], layout);
        }
        else {
          layout = erly.chooseNew(['split', 'topHeavy', 'bottomHeavy'], layout);
        }
      }
      else if (hints[1] === 'full') {
        // If the next card must be full, this card must be full
        layout = 'full';
      }
      else if (!types[2] || hints[2] === 'full') {
        layout = erly.chooseNew(['full', 'split', 'topHeavy', 'bottomHeavy'], layout);
      }
      else {
        layout = erly.chooseNew(['full', 'split', 'triple', 'topHeavy', 'bottomHeavy', 'topHeavySplit', 'bottomHeavySplit'], layout);
      }

      // Next, choose a width for this layout that will work
      if (layout === 'full') {
        fixedWidth = carouselHeight;

        // Make notes and links have the same aspect ratio as A4 paper
        if (types[0] === 'note' || types[0] === 'link') {
          fixedWidth = Math.round(carouselHeight * 210 / 297);
        }
      }
      else if (layout === 'triple') {
        fixedWidth = Math.round(carouselHeight * 0.4);
      }
      else if (layout.indexOf('Split') !== -1) {
        fixedWidth = erly.choose([Math.round(carouselHeight * 0.8),
          carouselHeight]);
      }
      else {
        fixedWidth = erly.choose([Math.round(carouselHeight * 0.5),
          Math.round(carouselHeight * 0.65)]);
      }

      var cardsUsed = 2;
      if (layout === 'full') {
        cardsUsed = 1;
      }
      if (layout.indexOf('Split') !== -1 || layout === 'triple') {
        cardsUsed = 3;
      }

      layouts.push({
        layout: layout,
        hint: layoutHint,
        width: fixedWidth
      });

      index += cardsUsed;
    }
    // erly.profiling.mark('LAYOUT', 'layouts calculated');

    // Reset that data we'll be using for lazy loading
    if (_lazySizeData) {
      cards.removeClass('lazy-laidout');
    }

    cards.removeClass('can-grow').removeClass('can-shrink');

    var animating = false;
    var cardPositions = [];
    index = 0;
    _(layouts).each(function(o, layoutIndex) {
      var layout = o.layout;
      var hint = o.hint;
      var fixedWidth = o.width;
      var cardOptions = [cards.eq(index), cards.eq(index + 1), cards.eq(index + 2)];

      // Now apply the layouts
      var layoutInfo;
      var topRowHeight, bottomRowHeight;
      var cardsUsed;
      var xOffset;

      if (layout === 'full') {
        // Handle the hidden related card case
        if (cardOptions[0].css("display") === "none") {
          layoutInfo = {
            cardsUsed: 1,
            xOffset: -1, // offset the +1 border
            animating: false,
            cardPositions: [{
              w: 0,
              h: 0,
              x: 0,
              y: 0
            }]
          };
        }
        else {
          var dims = cardOptions[0].tmplItem().data.dimensions;
          // If we have dimensions during layout, make full layout cards
          // the proper image aspect ratio
          if (dims) {
            var ar = dims.width / dims.height;
            layoutInfo = evenRowLayout(x, cardOptions, 1,
              Math.round(
                Math.min(windowWidth - CARD_BORDER_WIDTH,
                  ar * (carouselHeight - CARD_NONCONTENT_HEIGHT))),
                carouselHeight);
          }
          else {
            layoutInfo = evenRowLayout(x, cardOptions, 1, fixedWidth, carouselHeight);
          }
        }
      }
      else if (layout === 'split') {
        layoutInfo = evenRowLayout(x, cardOptions, 2, fixedWidth, carouselHeight);
      }
      else if (layout === 'triple') {
        layoutInfo = evenRowLayout(x, cardOptions, 3, fixedWidth, carouselHeight);
      }
      else if (layout === 'topHeavy') {
        topRowHeight = Math.round(carouselHeight * 0.6);
        layoutInfo = rowLayout(x, cardOptions, [topRowHeight, carouselHeight - topRowHeight - 1], null, fixedWidth);
      }
      else if (layout === 'topHeavySplit') {
        topRowHeight = Math.round(carouselHeight * 0.6);
        layoutInfo = rowLayout(x, cardOptions, [topRowHeight, carouselHeight - topRowHeight - 1], 1, fixedWidth);
      }
      else if (layout === 'bottomHeavy') {
        bottomRowHeight = Math.round(carouselHeight * 0.6);
        layoutInfo = rowLayout(x, cardOptions, [carouselHeight - bottomRowHeight, bottomRowHeight - 1], null, fixedWidth);
      }
      else if (layout === 'bottomHeavySplit') {
        bottomRowHeight = Math.round(carouselHeight * 0.6);
        layoutInfo = rowLayout(x, cardOptions, [carouselHeight - bottomRowHeight, bottomRowHeight - 1], 0, fixedWidth);
      }
      else {
        throw new Error('Unknown layout "' + layout + '"!');
      }

      // Figure out what layout manipulations are possible
      var canGrow = false;
      var canShrink = false;
      var nextLayout = layouts[layoutIndex + 1];
      if (layout === 'full' && nextLayout) {
        canShrink = true;
      }
      if (layout !== 'full') {
        canGrow = true;
      }

      // Handle the case where the last card has been previously shrunk
      if (!nextLayout && hint === 'full') {
        canShrink = true;
      }

      for (var i = 0; i < layoutInfo.cardsUsed; i++) {
        if (canShrink) {
          cardOptions[i].addClass('can-shrink');
        }
        if (canGrow) {
          cardOptions[i].addClass('can-grow');
        }

        // Put this on to help with debugging
        cardOptions[i].addClass(layout);

        // Add information to help override layouts when doing layout
        // manipulation
        cardOptions[i][0].className =
          cardOptions[i][0].className.replace(/\blayout-group-\d+\b/g, '');
        cardOptions[i].addClass('layout-group-' + layoutIndex);
        cardOptions[i].data('layoutGroup', layoutIndex);
      }

      index += layoutInfo.cardsUsed;
      x += layoutInfo.xOffset;
      x += 1;
      animating |= layoutInfo.animating;

      // Remember all these positions so we can properly lay out the scrollbar
      cardPositions = cardPositions.concat(layoutInfo.cardPositions);
    });

    // erly.profiling.mark('LAYOUT', 'layouts applied');

    if (animating && _animationTime !== 0) {
      if (erly.browserSupport.usesCssTransitions()) {
        _carousel.cssAnimate({
          height: carouselHeight
        }, _animationTime);
      }
      else {
        _carousel.animate({
          height: carouselHeight
        }, _animationTime);
      }
    } else {
      _carousel.height(carouselHeight);
    }
    _carousel.width(x);

    // erly.profiling.mark('LAYOUT', 'lazy load start');
    lazyLoad();
    // erly.profiling.mark('LAYOUT', 'lazy load done');

    // erly.profiling.mark('LAYOUT', 'carousel resized');

    // erly.profiling.mark('LAYOUT', 'scrollbar completed');

    var viewer = $('.viewer');
    if (_zoomed) {
      _container.find('div.post').not(_zoomedCard).css(
        'opacity', _zoomed3d ? 0 : 0.1
      ).addClass('zoomed');
      _carouselContainer.addClass('zoomed');
      viewer.addClass('zoomed');
    }
    else {
      _container.find('div.post').css('opacity', 1).removeClass('zoomed');
      _carouselContainer.removeClass('zoomed');
      viewer.removeClass('zoomed');
    }

    updateCachedVariables();

    if (_zoomed) {
      _scrollBarContainer.hide();

      if (_zoomedCard) {
        var targetPos = _zoomedCard.position();

        var left = _zoomedCard.data('targetLeft') || targetPos.left;
        var width = _zoomedCard.data('targetWidth') || _zoomedCard.outerWidth();
        var position = Math.round(left - (windowWidth - width) / 2);
        animatedScrollToPosition(position, function() {}, _animationTime);
      }
    }
    else {
      _scrollBarContainer.show();

      // Delay the setup if we are animating, to ensure we have accurate
      // top/left
      if (animating) {
        setTimeout(_.bind(setupScrollBar, null, x, carouselHeight,
          cardPositions), 1500);
      }
      else {
        setupScrollBar(x, carouselHeight, cardPositions);
      }

      cards.css('-webkit-transition-property', 'none');
      cards.css('-webkit-transform', '');
      cards.css('box-shadow', '');
      _carousel.css('background', '');

      _zoomed3d = false;
    }

    var update3d = function() {
      var prevCard = _zoomedCard.prev();
      if (prevCard.length === 0) {
        prevCard = cards.last();
      }
      prevCard.css('-webkit-perspective-origin', '0 0');
      prevCard.css('-webkit-transform', 'perspective(1200) rotateX(' +
        '-90deg) translateZ(-400px)');

      var nextCard = _zoomedCard.next();
      if (nextCard.length === 0) {
        nextCard = cards.first();
      }
      nextCard.css('-webkit-perspective-origin', '0 100%');
      nextCard.css('-webkit-transform', 'perspective(1200) rotateX(' +
        '90deg) translateZ(-400px)');

      _zoomedCard.css('-webkit-perspective-origin', '0 100%');
      _zoomedCard.css('-webkit-transform', 'perspective(1200) rotateX(' +
        '0deg) translateZ(-200px)');
    };

    setupCarouselButtons(carouselHeight, function(direction) {
      // Try to page to a smart column break
      if (direction !== RIGHT && direction !== LEFT) {
        throw new Error('Unknown direction: ' + direction);
      }

      var windowWidth = $(window).width();

      var windowLeftBound = getCarouselPosition();
      var windowRightBound = windowLeftBound + windowWidth;

      var getLeftCardPosition = function(card) {
        return erly.cssPixels(card, 'left') + _carouselLeftMargin;
      };

      var getRightCardPosition = function(card) {
        card = $(card);
        // we really have an extra two pixels of 'fake padding' added by
        // the grey background shining through
        return getLeftCardPosition(card) + card.outerWidth() + 2;
      };

      // smallest first
      var compare = function(num1, num2) {
        if (num1 === num2) {
          return 0;
        } else if (num1 > num2) {
          return 1;
        } else if (num2 > num1) {
          return -1;
        }
      };

      var sortCards = function(cards, mappingFun) {
        // non destructive (make a copy)
        cards = _.without(cards, []);

        return cards.sort(function(card1, card2) {
          return compare(mappingFun(card1),
                         mappingFun(card2));
        });
      };

      var sortCardsLeft = function(cards) {
        return sortCards(cards, getLeftCardPosition);
      };

      var sortCardsRight = function(cards) {
        return sortCards(cards, getRightCardPosition).reverse();
      };

      var visibleCards = _.select(cards, function(card) {
        if (!$(card).is(":visible")) {
          return false;
        }

        var cardLeft = getLeftCardPosition(card);
        var cardRight = getRightCardPosition(card);

        var offScreenToLeft = cardRight <= windowLeftBound;
        var offScreenToRight = cardLeft >= windowRightBound;

        if (offScreenToLeft || offScreenToRight) {
          return false;
        } else {
          return true;
        }
      });

      if (visibleCards.length === 0) {
        return 0;
      }

      var pos;

      // If we're in zoom mode, center the adjacent card
      if (_zoomed) {
        if (_zoomedCard) {
          // If we are leaving a video card, reset the contents to stop the
          // video
          var zoomedCardData = _zoomedCard.tmplItem().data;
          if (zoomedCardData.type === 'video') {
            _zoomedCard.find('.embed-video').remove();
            _zoomedCard.find('.play-overlay').show();
          }

          _container.find('div.post').css('opacity', _zoomed3d ? 0 : 0.1);
          if (direction === LEFT) {
            _zoomedCard = _zoomedCard.prev('div.post');
            if (_zoomedCard.length === 0) {
              _zoomedCard = cards.last();
            }
            layoutPanel.setZoomedCard(_zoomedCard);
          }
          else if (direction === RIGHT) {
            _zoomedCard = _zoomedCard.next('div.post');
            if (_zoomedCard.length === 0) {
              _zoomedCard = cards.first();
            }
            layoutPanel.setZoomedCard(_zoomedCard);
          }

          var left = getLeftCardPosition(_zoomedCard);
          pos = left - Math.round((windowWidth - _zoomedCard.outerWidth() + 2) / 2);

          if (_zoomed3d) {
            update3d();
          }
        }
        else {
          pos = 0;
        }
      }
      else {
        var card;

        if (direction === LEFT) {
          card = $(sortCardsLeft(visibleCards)[0]);
          pos = getRightCardPosition(card) - windowWidth;
        } else if (direction === RIGHT) {
          card = $(sortCardsRight(visibleCards)[0]);
          pos = getLeftCardPosition(card);
        }

        // Sanity check: if our position actually indicates the opposite
        // direction, then something's gone wrong, and just page the width of
        // the screen.  This will happen in situatations like only one card on
        // the screen on devices with constrained widths.
        if ((direction === RIGHT && pos <= windowLeftBound) ||
        (direction === LEFT && pos >= windowLeftBound)) {
          pos = windowLeftBound;
          pos += (direction === LEFT ? -windowWidth : windowWidth);
        }
      }

      return pos;
    });

    updateCarouselButtons();
    // erly.profiling.mark('LAYOUT', 'carousel buttons applied');

    if (_firstLayout) {
      var browser = erly.browserSupport.detect();

      if (browser && browser.name === 'iPad') {
        erly.layout.panel.bindIPad();
      }
      else {
        erly.layout.panel.bindMouseMovements(browser);
        erly.layout.panel.bindArrowKeyMovements();
      }

      _carouselContainer.scrollLeft(0);
      erly.events.fire(erly.events.INITIAL_LAYOUT_COMPLETE);
      _firstLayout = false;
    }
    // erly.profiling.mark('LAYOUT', 'done');
    // erly.profiling.reset('LAYOUT');

    // CSS 3D Easter Egg
    var keys = [];
    $(window).unbind('keypress.3d');
    if (_zoomed) {
      $(window).bind('keypress.3d', function(e) {
        keys.push(e.which);
        keys = keys.slice(-(EASTER_EGG_CODE.length));
        if (String.fromCharCode.apply(null, keys) === EASTER_EGG_CODE) {
          _carouselContainer.scrollLeft(0);
          _carousel.css(
            'width', $(window).width() + 'px'
          ).css(
            'left', '0px'
          ).css(
            '-webkit-perspective-origin', '50% 50%'
          ).css(
            'padding-right', 0
          ).css(
            'background', '-webkit-radial-gradient(circle, #888, #444)'
          );
          update3d();
          $('div.post').each(function() {
            var post = $(this);
            post.css('opacity', 0).css('top', 0).css('left',
              Math.round(($(window).width() - post.outerWidth()) / 2)
            ).css('box-shadow', '0 10px 30px rgba(0, 0, 0, 0.5)');

            _zoomedCard.css('opacity', 1);
          });

          _.defer(function() {
            $('div.post').css(
              '-webkit-transition-duration', '1.5s'
            ).css(
              '-webkit-transition-property', 'all'
            );
          });

          _zoomed3d = true;
        }
      });
    }
  };

  layoutPanel.updateViewport = function(animationTime, pos) {
    if (!_viewport || !_viewportScale) {
      return;
    }

    if (typeof animationTime === 'undefined') {
      animationTime = 0;
    }

    if (typeof pos === 'undefined') {
      pos = getCarouselPosition();
    }

    if (_zoomed && _zoomedCard) {
      erly.viewer.updatePermalink('#z_' + _zoomedCard.data('postid'));
    }

    if (erly.browserSupport.usesCssTransitions()) {
      _viewport.cssAnimate({
        left: Math.round(pos * _viewportScale)
      }, animationTime);
    }
    else {
      _viewport.stop(true, true).animate({
        left: Math.round(pos * _viewportScale)
      }, animationTime);
    }
  };

  layout.HOME_CLICKED = 'home_clicked';

  erly.layout = layout;
  erly.layout.panel = layoutPanel;
}(erly));

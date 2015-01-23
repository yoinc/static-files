/*!
 * Home/splash page handler
 */

(function(erly) {
  var home = {};

  home.redirectAfterLogin = function(data) {
    var redirectUrl;
    var referrer = document.referrer;

    var referrerIsCollection = function(referrer) {
      if (referrer.indexOf(window.location.host) !== -1) {
        return false;
      }

      return (/collection\/.*/).test(referrer);
    };

    if (data.created) {
      // Navigate back if we came from our own site (and we didn't sign up from
      // the home page)
      if (referrer && referrerIsCollection(referrer)) {
        window.history.go(-1);
        return;
      } else {
        redirectUrl = "/timeline";
      }
    }
    else {
      redirectUrl = "/timeline";
    }

    erly.redirectTo(redirectUrl);
  };

  home.init = function() {
    $('#header_wrapper').remove();
    erly.events.subscribe(erly.events.AUTHENTICATED,
      home.redirectAfterLogin);
    var self = this;
    erly.events.subscribe(erly.events.NOT_AUTHENTICATED, function() {
      self.view.init();
    });
  };

  home.data = {
    SLIDE_WIDTH: null
  };

  var homeView = {};
  home.view = homeView;

  homeView.init = function() {
    this.viewLoaded = false;
    this.selectedSlide = null;
    this.targetSlide = null;
    this.setPagination();
    this.selectSlide(0, false);
    this.calculateWidths();
    this.setViewportWidth();
    this.setViewportBackgrounds();

    this.bindings.init();
    this.afterViewUpdate();
    this.viewLoaded = true;
    this.updateArrows();
    $(erly.signup.init);
  };

  homeView.el = function() {
    return $(".slides");
  };

  homeView.$ = function(selector) {
    return $(selector, this.el());
  };


  homeView.calculateWidths = function() {
    home.data.SLIDE_WIDTH = this.$(".slide").eq(0).outerWidth();
    home.data.MINI_SLIDE_WIDTH = $(".mini-slide-container .slide").eq(0).outerWidth();
    home.data.INITIAL_SLIDE_LEFT = $(".left-side").offset().left;
    home.data.SLIDE_COUNT = this.$(".slide").length;

    // don't recalculate when the screen is resized!
    if (!home.data.INITIAL_VIEW_PORT_LEFT) {
      home.data.INITIAL_VIEW_PORT_LEFT = erly.cssPixels(".mini-slides .slide-viewport", "left");
    }

    if (!home.data.INITIAL_VIEW_PORT_OFFSET_LEFT) {
      home.data.INITIAL_VIEW_PORT_OFFSET_LEFT = $(".mini-slides .slide-viewport").offset().left;
    }
  };

  homeView.setViewportWidth = function() {
    // uses the slides "natural" center point (set via margin auto in css)
    $(".slide-container").width($(window).width());
    $(".slide-container").css("marginLeft", -home.data.INITIAL_SLIDE_LEFT);
    $(".slides").css("marginLeft", home.data.INITIAL_SLIDE_LEFT);
  };

  homeView.updatePaginationPositionFromScroll = function(scrollOffset) {
    scrollOffset *= -1; // scroll goes in opposite direction
    // offset / miniSlideWidth == scrollOffset / slideWidth
    var offset = (scrollOffset / home.data.SLIDE_WIDTH) * home.data.MINI_SLIDE_WIDTH;
    offset += home.data.INITIAL_VIEW_PORT_LEFT;

    homeView.updatePaginationPosition(offset);
  };

  homeView.updateSlidePositionFromMiniPosition = function(miniOffset) {
    miniOffset -= home.data.INITIAL_VIEW_PORT_LEFT;
    var offset = (miniOffset / home.data.MINI_SLIDE_WIDTH) * home.data.SLIDE_WIDTH;
    offset *= -1; // in opposite direction

    homeView.updateSlidePosition(offset);
  };

  homeView.updateSlidePosition = function(offset) {
    $(".slides").stop().animate({"left": offset});
  };

  homeView.updatePaginationPosition = function(offset) {
    $(".slide-viewport").stop().animate({"left": offset});
  };

  homeView.afterViewUpdate = function() {
    homeView.updateTitleOpacties();
    homeView.updateArrows();
  };

  // skip this when loading the page
  homeView.updateArrows = function() {
    if (this.viewLoaded) {
      var offset = Math.abs(erly.cssPixels(".slides", "left"));
      var minWidth = 0;
      var maxWidth = home.data.SLIDE_WIDTH * (home.data.SLIDE_COUNT - 1);

      // start at the second slide, end at the nth 1 slide
      minWidth += home.data.SLIDE_WIDTH;
      maxWidth -= home.data.SLIDE_WIDTH;

      var leftButton = $(".carousel-button.left");
      var rightButton = $(".carousel-button.right");
      var miniLeft = $('.mini-slide-container .mini-left-arrow');
      var miniRight = $('.mini-slide-container .mini-right-arrow');

      if (offset >= minWidth) {
        leftButton.fadeIn();
        miniLeft.removeClass('disabled');
      } else {
        leftButton.fadeOut();
        miniLeft.addClass('disabled');
        miniRight.addClass('disabled');
      }

      if (offset > maxWidth) {
        rightButton.fadeOut();
        miniRight.addClass('disabled');
      } else {
        rightButton.fadeIn();
        miniRight.removeClass('disabled');
      }
    }
  };

  // starts at zero index!
  homeView.isValidSlideNumber = function(slideNumber) {
    if (slideNumber < 0 || slideNumber > this.$(".slide").length - 1) {
      return false;
    } else {
      return true;
    }
  };

  var selectSlide = function(el, property, direction, slideWidth, initialSlideOffset, slideNum, animation) {
    if (!homeView.isValidSlideNumber(slideNum)) {
      throw new Error("wrong slide number! (" + slideNum + ")");
    }

    var offset = ((slideNum * slideWidth) * direction) + initialSlideOffset;

    var complete = function() {
      if (homeView.targetSlide !== null) {
        homeView.selectedSlide = homeView.targetSlide;
        homeView.targetSlide = null;
      }
    };

    if (animation) {
      var options = {};
      options[property] = offset;

      el.stop().animate(options, {
        step: homeView.afterViewUpdate,
        complete: function() {
          homeView.afterViewUpdate();
          complete();
        }
      });
    } else {
      el.css(property, offset);
      homeView.afterViewUpdate();
      complete();
    }
  };

  homeView.selectSlide = function(slideNum, animation) {
    if (typeof animation === 'undefined') {
      animation = true;
    }

    homeView.targetSlide = slideNum;
    var el = this.el();

    selectSlide(el, "left", -1, home.data.SLIDE_WIDTH, 0, slideNum, animation);

    this.setSlideViewPortToSlide(slideNum, animation);
  };

  homeView.setSlideViewPortToSlide = function(slideNum, animation) {
    var el = $(".mini-slides"),
        viewport = el.find(".slide-viewport"),
        slideWidth = el.find(".slide").eq(0).outerWidth(),
        initialSlideOffset = slideWidth + erly.cssPixels(viewport, 'border-left-width') + 2;

    selectSlide(viewport, "left", 1, slideWidth, initialSlideOffset, slideNum, animation);
  };

  homeView.setPagination = function() {
    var numSlides = this.$(".slide").length,
            slide = "<div class='slide'></div>",
            i;

    for (i = 0; i < numSlides; i++) {
      $(".mini-slides .mini-slide-container").append(slide);
    }
  };

  homeView.setViewportBackgrounds = function() {
    var miniSlides = $(".mini-slides .slide");

    _.each($(".slide-container .slide img"), function(slide, index) {
      slide = $(slide);
      var imgSrc = slide.attr('src');
      var miniSlide = miniSlides.eq(index);

      miniSlide.html("<img src='" + imgSrc + "' alt='photo' />");
    });
  };

  homeView.updateTitleOpacties = function() {
    var slideWidth = home.data.SLIDE_WIDTH;
    var offset = Math.abs(erly.cssPixels($(".slides"), "left"));

    _.each($(".slides .slide"), function(slide, index) {
      slide = $(slide);

      var slideOffset = index * slideWidth;
      var distance = Math.abs(slideOffset - offset);
      var transparency = distance / slideWidth;
      var opacity = 1 - transparency;

      var title = slide.find('.headline');

      if (opacity <= 0) {
        title.hide();
      } else {
        title.show();
        title.css("opacity", opacity);
      }
    });
  };

  var homeViewBindings = {};
  homeView.bindings = homeViewBindings;

  homeViewBindings.init = function() {
    this.makeMiniSlidesClickable();
    this.makeSlidesClickable();
    this.makeFirstSlideLaunchProductVideo();
    this.windowResize();
    this.makeSlidesDraggable();
    this.makeFacebookNote();
    this.makeMiniSlidesDraggable();
    this.bindArrowButtons();
  };

  var bindSlideClicks = function(selector) {
    _.each($(selector), function(slide, i) {
      $(slide).click(function() {
        homeView.selectSlide(i, true);
      });
    });
  };

  homeViewBindings.makeMiniSlidesClickable = function() {
    bindSlideClicks(".mini-slides .slide");
  };

  homeViewBindings.makeSlidesClickable = function() {
    bindSlideClicks(".slides .slide");
  };

  homeViewBindings.makeFirstSlideLaunchProductVideo = function() {
    /*
    $(".slides .slide:eq(0)").click(function() {
      if (homeView.selectedSlide === 0) {
        erly.showProductVideo();
      }
    });
    */
  };

  homeViewBindings.makeFacebookNote = function() {
    var note = $(".home .note");
    var shouldShowNote = false;

    $(".home .facebook-note").click(function(e) {
      return false;
    });

    $(".home .facebook-note").hover(function() {
      shouldShowNote = true;
      setTimeout(function() {
        if (shouldShowNote) {
          note.stop();
          note.show().animate({
            opacity: 1
          });
        }
      }, 250);
    }, function() {
      shouldShowNote = false;
      note.stop();
      note.animate({
        opacity: 0
      }, function() {
        note.hide();
      });
    });
  };

  var unbindClick = function(selector) {
    _.each($(selector), function(el, i) {
      $(el).unbind("click");
    });
  };

  homeViewBindings.disableClickableMiniSlides = function() {
    unbindClick(".mini-slides .slide");
  };

  homeViewBindings.disableClickableSlides = function() {
    unbindClick(".slides .slide");
  };

  var makeDraggable = function(el, options) {
    $(el).draggable({
      axis: "x",
      drag: function(event, ui) {
        options.drag(ui.position.left);
      },
      containment: options.containment,
      start: function() {
        options.start();
      },
      stop: function() {
        setTimeout(function() {
          options.stop();
        }, 0);
      }
    });
  };

  homeViewBindings.makeSlidesDraggable = function() {
    makeDraggable(".slides", {
      drag: function(offset) {
        homeView.updatePaginationPositionFromScroll(offset);
        homeView.afterViewUpdate();
      },
      start: this.disableClickableSlides,
      stop: function() {
        homeViewBindings.makeSlidesClickable();
        homeView.afterViewUpdate();
        homeViewBindings.makeFirstSlideLaunchProductVideo();
      },
      containment: [-home.data.SLIDE_WIDTH * (home.data.SLIDE_COUNT - 1), null, 0, null]
    });
  };

  homeViewBindings.makeMiniSlidesDraggable = function() {
    var startDrag = home.data.INITIAL_VIEW_PORT_OFFSET_LEFT;
    var endDrag = startDrag + (home.data.MINI_SLIDE_WIDTH * (home.data.SLIDE_COUNT - 1));

    makeDraggable(".mini-slides .slide-viewport", {
      drag: function(offset) {
        homeView.updateSlidePositionFromMiniPosition(offset);
        homeView.afterViewUpdate();
      },
      start: this.disableClickableMiniSlides,
      stop: function() {
        homeViewBindings.makeMiniSlidesClickable();
        homeView.afterViewUpdate();
      },
      containment: [startDrag,
                    null,
                    endDrag,
                    null]
    });
  };

  homeViewBindings.bindArrowButtons = function() {
    var selectClosestSlide = function(incr) {
      var closestSlide;
      var closestSlideDistance = null;
      var offset = Math.abs(erly.cssPixels(".slides", "left"));

      _.each($(".slides .slide"), function(slide, index) {
        var slideOffset = index * home.data.SLIDE_WIDTH;
        var slideDistance = Math.abs(slideOffset - offset);

        if (closestSlideDistance === null || slideDistance < closestSlideDistance) {
          closestSlideDistance = slideDistance;
          closestSlide = index;
        }
      });

      var newSlideNumber = closestSlide + incr;

      if (homeView.isValidSlideNumber(newSlideNumber)) {
        homeView.selectSlide(newSlideNumber, true);
      }
    };

    $(".carousel-button.left").click(function() {
      selectClosestSlide(-1);
    });

    $(".carousel-button.right").click(function() {
      selectClosestSlide(1);
    });
    $(".mini-slide-container .mini-left-arrow").click(function() {
      if ($(this).css('opacity') !== '0.5') {
        selectClosestSlide(-1);
      }
    });

    $(".mini-slide-container .mini-right-arrow").click(function() {
      if ($(this).css('opacity') !== '0.5') {
        selectClosestSlide(1);
      }
    });
  };

  homeViewBindings.windowResize = function() {
    $(window).resize(function() {
      homeView.calculateWidths();
      homeView.setViewportWidth();
    });
  };

  erly.home = home;
}(erly));

/*!
 * Viewer metadata class
 */
(function(viewer) {
  viewer.ENTERING_EDIT_MODE = "erly.viewer.Metadata.ENTERING_EDIT_MODE";
  viewer.EXITING_EDIT_MODE = "erly.viewer.Metadata.EXITING_EDIT_MODE";
  viewer.TITLE_CLICKED = 'erly.viewer.Metadata.TITLE_CLICKED';
  viewer.DEFAULT_METADATA_STYLE = 'white black-bg';
  viewer.DEFAULT_METADATA_POSITION = {top: '5%', left: '5%'};

  var DOM = {
    backgroundPicker: '#backgroundPicker',
    backgroundOption: '.background-option',
    backgroundOptionTemplate: '#tmplEditBackgroundOption',
    backgroundOptionImage: '.background-option img',
    backgroundUpload: '.upload',
    carousel: '#categoryCarousel',
    carouselButtonLeft: '.carousel-button.cb-left',
    carouselButtonRight: '.carousel-button.cb-right',
    colorPicker: '#colorPicker',
    colorPickerTitle: '#colorPicker .title-draggable',
    colorPickerTemplate: '#tmplColorPicker',
    dateInput: '#date',
    datePicker: '.date-wrapper .date-picker',
    dragOverlay: '.drag-overlay',
    editBackgroundTemplate: '#tmplEditBackground',
    edit: '.toolbar .edit',
    share: '.toolbar .share',
    finishEditHint: '.toolbar .finish-edit-hint',
    finishShare: '.toolbar .finish-share',
    moveHint: '.edit-bar .move .hint',
    textStyleHint: '#colorCustomizer .text-style .hint',
    modalForm: '#modal form',
    metadataAttributes: '.metadata-attributes',
    metadataContainer: '.viewer-metadata',
    styleOption: '.text-style .option',
    textStyle: '.text-style',
    title: '.viewer-metadata .title',
    userProfileName: '.toolbar .user-profile .name',
    iconButton: '.icon-element',
    attendance: '.viewer-metadata .detail.attendance',
    rsvpAction: '.viewer-metadata .rsvp-action',
    creator: '.viewer-metadata .detail.creator',
    datetime: '.viewer-metadata .detail.date',
    location: '.viewer-metadata .detail.location',
    description: '.description',
    likeButton: '.detail.likes .like-button'
  };

  var TEMPLATES = {
    metadataAttributes: '#tmplViewerMetadataAttributes',
    main: '#tmplViewerMetadata'
  };

  var STYLES = ['black', 'white', 'grey', 'black-bg', 'white-bg'];

  function _isEditing() {
    return $('.viewer-edit-bottom-bar').is(':visible');
  }

  function getCollectionLink() {
    var base = window.location.protocol + '//' + window.location.host;
    return base + erly.urlFor.collection(viewer.collection);
  }

  function getShareIconUrl() {
    var coverPhotoUrl = viewer.getCoverPhotoURL();
    if (!coverPhotoUrl ||
    coverPhotoUrl.indexOf('fbcdn') !== -1) {
      coverPhotoUrl = 'http://erly.com/erly/img/fb-share-placeholder.jpg';
    }
    if (coverPhotoUrl.indexOf('http') !== 0) {
      coverPhotoUrl = 'http://erly.com' + coverPhotoUrl;
    }
    return coverPhotoUrl;
  }

  var Metadata = function(container, callback) {
    var _backgroundPicker;
    var _carousel;
    var _carouselButtonLeft;
    var _carouselButtonRight;
    var hookEditRegions;
    var unhookEditRegions;

    var self = this;

    this.isEditing = _isEditing;

    function fetchMetadata(callback) {
      $.get(erly.urlFor.collection(viewer.collection, 'metadata'),
        function(data) {
          erly.updateEventWithCalculatedFields(data);
          callback(null, data);
        }).error(function(xhr, status, err) {
          callback(err);
          erly.trackException("Error fetching metadata: " +
            status + ", " + JSON.stringify(err) + ", " + xhr.status);
        });
    }

    function bindTooltips() {
      var tooltip = $(DOM.metadataContainer).find('.tooltip');
      $(DOM.metadataContainer).find('.detail').add(
          $(DOM.metadataContainer).find('.detail .creator-name')).add(
          $(DOM.metadataContainer).find('.title')).hover(function() {
        if (_isEditing()) { return tooltip.hide(); }
        var text = $(this).data('tooltip');
        if (!text) { return; }

        var off = $(this).position();
        if (!$(this).offsetParent().is(DOM.metadataContainer)) {
          off = $(this).parent().position();
        }

        // HACK, special adjustments for specific divs

        var width = $(this).width();
        if ($(this).hasClass('title') || $(this).hasClass('location') ||
          $(this).hasClass('creator-name')) {
          var measure = $('<span></span>').text($.trim($(this).text())).
            css('display', 'none');
          width = measure.appendTo($(this)).width();
          $(this).find('span:last').remove();
        }

        if ($(this).hasClass('creator-name')) {
          off.top -= 4;
        }

        if ($(this).hasClass('location')) {
          off.top -= 3;
          width = Math.min($(this).width(), width + 30);
        }

        tooltip.text(text).css({
          top: off.top + 'px',
          left: (off.left + width + 10) + 'px'
        }).css('text-shadow', 'none').show();
      }, function() {
        tooltip.hide();
      });
    }

    var fitTitle = self.fitTitle = function(waitTime, callback) {
      waitTime = waitTime || 0;

      var title = $(DOM.title);
      var text = $.trim(title.text());
      var fontSize = 50;
      title.css("max-height", fontSize * 2 + "px");

      var tryFont = function(size) {
        title.css("font-size", size + "px");
        title.css("line-height", size + "px");
        return erly.checkEllipsis(title, size * 2, size);
      };

      setTimeout(function() {
        title.css("max-height", "");
        var metadata = viewer.collection;
        if (!metadata.metadataStyles || !metadata.metadataStyles.titleFontSize) {
          if (tryFont(50)) {
            if (tryFont(44)) {
              tryFont(40);
            }
          }
        }
        else {
          tryFont(metadata.metadataStyles.titleFontSize);
        }

        if (callback) { callback(); }
      }, waitTime);
    };

    erly.events.subscribe(erly.events.FONT_LOADED, function(family) {
      var currentFamily = viewer.collection || {};
      currentFamily = (currentFamily || {}).metadataStyles;
      currentFamily = (currentFamily || {}).fontFamily;
      if (currentFamily && currentFamily.indexOf(family) >= 0) {
        fitTitle();
      }
    });

    erly.events.subscribe(viewer.ROLE_CHANGED, function() {
      if (viewer.collection.userRole.member) {
        self.incrementMetadataCountBy("tagCount", 1);
      }
      else {
        self.incrementMetadataCountBy("tagCount", -1);
      }
      self._updateMetadataCounters();
    });

    // Handle login actions
    erly.events.subscribe(viewer.LOGIN_ACTION, function(loginAction) {
      if (loginAction &&
          loginAction.action === 'like' &&
          loginAction.data.type === 'collection') {
        if (loginAction.data.id === viewer.collection.id) {
          $(DOM.likeButton).click();
        }
      }
    });

    function showMetadataEdit() {
      erly.eventForm.showModal(erly.viewer.collection);
    }

    function unsetFlagstoneColors() {
      self._metadataPanel.css('background', '');
      self._metadataPanel.css('font-family', '');
      self._metadataPanel.css('color', '');
      self._metadataPanel.find('div.title').css('font-size', '')
        .css('line-height', '').css('font-family', '')
        .css('text-transform', 'uppercase');
      fitTitle();
    }


    function updateFlagstoneColors(overrideData, el) {
      var data = null;
      if (overrideData) {
        data = overrideData;
      } else {
        data = erly.viewer.collection.metadataStyles;
      }
      // do nothing if we have no override styles
      if (!data || $.isEmptyObject(data)) { return; }
      var root = null;
      if (el) {
        root = el;
      } else {
        root = self._metadataPanel;
      }
      self._metadataPanel.css('background', erly.getRGBA(data.backgroundColor,
              data.opacity));
      // text color
      self._metadataPanel.css('color', '#' + data.textColor);
      // title font size
      var title = root.find('div.title');
      if (data.fontFamily === 'DIN, sans-serif') {
        title.css('font-family', 'DIN_Light');
        title.css('text-transform', 'uppercase');
      } else {
        title.css('font-family', data.fontFamily);
        title.css('text-transform', 'none');
      }
      fitTitle();
    }

    function destroyColorPicker() {
      $(DOM.colorPicker).remove();
    }

    function saveMetadataStyles(clearCustomStyles) {
      var style = erly.viewer.collection.metadataStyle;
      var styles = erly.viewer.collection.metadataStyles || {};
      if (clearCustomStyles) {
        styles = null;
      }
       $.ajax({
        type: 'post',
        url: erly.urlFor.collection(viewer.collection, 'update'),
        data: {
          metadataStyle: style,
          metadataStyles: styles
        },
        success: function(data) {
          // REVIEW: Need some indication of success?
        }
      });
    }

    function showColorPicker(metadata) {
      if ($(DOM.colorPicker).length > 0) {
        return;
      }
      var previewOption = null;
      var farbPicker = null;
      var fonts = [
        'DIN, sans-serif',
        'Arial',
        'Georgia',
        'Impact',
        'League Script, cursive',
        'Philosopher, sans-serif',
        'Bad Script, cursive',
        'Monoton, cursive',
        'Carter One, cursive',
        'Raleway, cursive'
      ];
      var fontSizes = [14, 18, 28, 36, 50, 64, 80];
      if (!metadata.metadataStyles) {
        metadata.metadataStyles = {
          backgroundColor: '000000',
          opacity: 90,
          titleFontSize: 50,
          textColor: 'ffffff',
          fontFamily: 'DIN, sans-serif'
        };
      }
      var tmplData = metadata.metadataStyles;
      $$(DOM.colorPickerTemplate).tmpl(tmplData, {
        fonts: fonts,
        fontSizes: fontSizes
      }).appendTo($$('#metadataContainment'));
      var metadataContainer = $('#metadataContainer');

      var bgPickerHeight = $('#backgroundPicker').outerHeight();
      bgPickerHeight -= $('#metadataContainment').offset().top;
      var containmentWidth = $('#metadataContainment').width();
      var pos = metadataContainer.position();
      var left = pos.left + metadataContainer.width() + 160;
      $(DOM.colorPicker).css({
        top: pos.top < bgPickerHeight ? bgPickerHeight + 10 : pos.top,
        left: left > containmentWidth ? left - $(DOM.colorPicker).width() : left
      }).fadeIn(400);
      var styleOptions = $$(DOM.styleOption);

      var activeColorPickerElem = null;
      var activeKey = null;
      var showOrHidePicker = function(el, styleOptionKey) {
        if (!el) { return; }
        if (el.is(activeColorPickerElem)) {
          activeColorPickerElem = null;
          $('#colorPicker .picker').hide();
          $('body').unbind('click.farb');
        } else {
          activeColorPickerElem = el;
          activeKey = styleOptionKey;
          $('#colorPicker .picker').css('top', el.parent().position().top + 34);
          farbPicker.setColor('#' + metadata.metadataStyles[styleOptionKey]);
          $('#colorPicker .picker').show();
          $('body').bind('click.farb', function() {
            showOrHidePicker(activeColorPickerElem, activeKey);
          });
        }
      };

      farbPicker = $.farbtastic($('#colorPicker .picker'), function(color) {
        if (activeColorPickerElem) {
          activeColorPickerElem.css('background-color', color);
          if (activeKey) {
            metadata.metadataStyles[activeKey] = color.substring(1);
            if (metadata.metadataStyles.opacity === 0 &&
              activeKey === 'backgroundColor') {
              metadata.metadataStyles.opacity = 35;
              $('.opacity .value').slider('value', 35);
            }
          }
          saveMetadataStyles();
          updateFlagstoneColors();
        }
      });
      $('<div class="swatch-remove"></div>').appendTo($('#colorPicker .picker'));


      $('#colorPicker .picker').click(function(event) {
        return event.stopPropagation();
      });

      $('.background-color .value').click(function(event) {
        showOrHidePicker($(this), 'backgroundColor');
        event.stopPropagation();
      });

      $('.text-color .value').click(function(event) {
        showOrHidePicker($(this), 'textColor');
        event.stopPropagation();
      });

      $('#colorPicker .remove').click(destroyColorPicker);
      $('#colorPicker .swatch-remove').click(function(event) {
        showOrHidePicker(activeColorPickerElem);
      });

      var pausedAnimationElems = null;

      var pauseCssAnimations = function() {
        if (pausedAnimationElems) return;
        pausedAnimationElems = $('.animating');
        $.each(pausedAnimationElems, function(index, el) {
          $(el).removeClass('animating');
        });
      };

      var resumeCssAnimations = function() {
        if (!pausedAnimationElems) { return; }
        $.each(pausedAnimationElems, function(index, el) {
          $(el).addClass('animating');
        });
        pausedAnimationElems = null;
      };

      $('.opacity .value').slider({
        value: metadata.metadataStyles.opacity,
        slide: function(event, ui) {
          pauseCssAnimations();
          metadata.metadataStyles.opacity = ui.value;
          updateFlagstoneColors();
        },
        change: function(event, ui) {
          resumeCssAnimations();
          metadata.metadataStyles.opacity = ui.value;
          if (event.originalEvent) {
            saveMetadataStyles();
            updateFlagstoneColors();
          }
        }
      });
      $$('#colorPicker .font select').selectmenu({
        format: function(v) {
          return '<span style="font-family:' + v + '">' + v + '</span>';
        }
      });
      $$('#colorPicker .font select').change(function() {
        metadata.metadataStyles.fontFamily = $(this).val();
        saveMetadataStyles();
        updateFlagstoneColors();
        fitTitle();
      });

      var updateFontSize = function(offset) {
        var currentSize = parseInt(metadata.metadataStyles.titleFontSize, 10);
        if (!currentSize) {
          currentSize = parseInt($('.metadata-attributes .title')
              .css('font-size')
              .replace('px', ''), 10);
        }
        currentSize = currentSize + offset;
        // clip
        if (currentSize < 20) {
          currentSize = 20;
        }
        if (currentSize > 80) {
          currentSize = 80;
        }
        metadata.metadataStyles.titleFontSize = currentSize;
        saveMetadataStyles();
        updateFlagstoneColors();
        fitTitle();
      };
      $$('#colorPicker .title-font-size .decrease').click(function(eventObj) {
        updateFontSize(-2);
      });
      $$('#colorPicker .title-font-size .increase').click(function(eventObj) {
        updateFontSize(2);
      });

      $$(DOM.colorPicker).draggable();

      $$(DOM.colorPicker).css('right', ($$('#metadataContainment').width() - $$(DOM.colorPicker).width()) / 2);

      styleOptions.click(function() {
        var style = $(this).data("style");
        Metadata.applyStyle(self._metadataPanel, style);
        erly.viewer.collection.metadataStyle = style;
        unsetFlagstoneColors();
        var bgColor = '000000';
        var textColor = 'ffffff';
        var opacity = 90;
        if (style === 'white black-bg') {
          bgColor = '000000';
        } else if (style === 'grey white-bg') {
          bgColor = 'ffffff';
          textColor = '333333';
        } else if (style === 'black') {
          textColor = '000000';
          opacity = 0;
        } else {
          opacity = 0;
        }
        $('.opacity .value').slider('value', opacity);
        $('.background-color .value').css('background-color', '#' + bgColor);
        $('.text-color .value').css('background-color', '#' + textColor);
        $$('#colorPicker .font select').val('DIN').selectmenu();
        saveMetadataStyles(true);
        erly.viewer.collection.metadataStyles = {
          backgroundColor: bgColor,
          opacity: opacity,
          textColor: textColor,
          titleFontSize: 50,
          fontFamily: 'DIN, sans-serif'
        };
      });

    }

    var backgroundPickerLazyLoad = _.throttleImmediate(function() {
      var windowWidth = $(window).width();
      _carousel.find('img.lazy').each(function() {
        var image = $(this);
        var pos = image.offset();
        var right = pos.left + 160;
        if (pos.left < windowWidth && right > 0) {
          image.attr('src', image.data('src'));
          image.removeClass('lazy');
          erly.centerImage(image, null, null, {
            ajaxLoaderQualifier: "-222222"
          });
        }
      });
    }, 250);

    var updateCarouselButtons = function() {
      var windowWidth = $(window).width();
      var carouselPos = _carousel.position();
      if (carouselPos.left === 0) {
        _carouselButtonLeft.stop(true, true).fadeOut();
      }
      else {
        _carouselButtonLeft.stop(true, true).fadeIn();
      }

      if (carouselPos.left === -_carousel.outerWidth(true) + windowWidth) {
        _carouselButtonRight.stop(true, true).fadeOut();
      }
      else {
        _carouselButtonRight.stop(true, true).fadeIn();
      }

      // Update the selected category too
      var options = _backgroundPicker.find('.background-option');
      var firstOption;
      options.each(function() {
        var option = $(this);
        if (option.position().left > -carouselPos.left && !firstOption) {
          firstOption = option;
        }
      });

      var categories = _backgroundPicker.find('.category');
      categories.removeClass('selected');
      var found = false;
      categories.each(function() {
        var category = $(this);
        if (firstOption && firstOption.hasClass($.trim(category.text()))) {
          category.addClass('selected');
          found = true;
        }
      });
      if (!found) {
        categories.eq(0).addClass('selected');
      }
    };

    var moveCarousel = function(left, duration) {
      duration = duration || 200;
      _carousel.stop(true).animate({
        left: left
      }, duration, function() {
        backgroundPickerLazyLoad();
        updateCarouselButtons();
      });
    };

    var handleCarouselButton = function(optionWidth, leftFunc) {
      return function() {
        var windowWidth = $(window).width();
        var slideDistance = Math.floor(windowWidth / optionWidth) * optionWidth;

        moveCarousel(leftFunc(windowWidth, slideDistance));
      };
    };

    function destroyBackgroundPicker() {
      if (_backgroundPicker) {
        _backgroundPicker.animate({
          marginTop: -_backgroundPicker.outerHeight(true)
        }, function() {
          $(window).unbind('resize', backgroundPickerLazyLoad);
          _backgroundPicker.remove();
        });
      }
    }

    var editRegionClick = function(e) {
      if (e.which > 1) {
        return;
      }

      showMetadataEdit();
    };

    var editRegionClickWithFocus = function(el, focusEl) {
      $(el).click(function(e) {
        erly.events.subscribeOnce(erly.events.MODAL_OPEN, function() {
          $(focusEl).focus();
        });

        editRegionClick(e);
      });
    };

    var openCarousel = function(e) {
      if (e.which > 1) {
        return;
      }
      viewer.toggleCarousel();
    };

    // vertically center the metadata overlay content
    var centerMetadataOverlay = function() {
      var overlay = $$("#metadataOverlay");
      var containerHeight = overlay.height();
      var content = $$("#metadataOverlay .content");
      var contentHeight;

      if (!content.is(":visible")) {
        overlay.show();
        contentHeight = content.outerHeight();
        overlay.hide();
      } else {
        contentHeight = content.outerHeight();
      }

      content.css('margin-top', (containerHeight / 2) - (contentHeight / 2));
    };

    var refreshDropDowns = function() {
      self._setupDropDowns();
      self._updateMetadataCounters();
      var els = $(DOM.likeButton).add('.details-album-header .like-button');
      els.unbind('click.like');
      els.bind('click.like', function(e) {
        if (e.which > 1 || _isEditing()) {
          return;
        }

        if (!erly.session.requireLogin('like',
            {id: erly.viewer.collection.id, type: 'collection'})) {
          return;
        }

        self.closeAllDropDowns();
        var doLike = function(path, increment, isLiked) {
          $.post(erly.urlFor.collection(viewer.collection, path), {},
            function(data) {
              if (data.success) {
                self.incrementMetadataCountBy("totalLikeCount", increment);
                viewer.collection.isLiked = isLiked;
                self._updateLikeButton();
              }
            }
          );
        };

        doLike('likes', 1, true);
      });
      self._updateLikeButton();
    };

    self.refresh = function(fetch) {
      var render = function() {
        var template = $$(TEMPLATES.metadataAttributes).tmpl(viewer.collection);
        updateFlagstoneColors(viewer.collection.metadataStyles || {}, template);
        $$(DOM.metadataAttributes).replaceWith(template);
        $(DOM.title).data('original', null);
        if (viewer.Details.instance) {
          viewer.Details.instance.refresh();
        }
        if (_isEditing()) {
          hookEditRegions();
        }
        else {
          unhookEditRegions();
        }
        Metadata.setupShareCommands();
        refreshDropDowns();
        bindTooltips();
        fitTitle();
        viewer.processResize();

        // Set a max height on the owner name
        template.find('.creator-name').css('max-width',
          $$(DOM.metadataAttributes).width() -
          template.find('.trigger-button:visible').outerWidth(true) - 10);
        centerMetadataOverlay();
      };

      if (fetch) {
        fetchMetadata(function(err, metadata) {
          if (err) {
            erly.trackException(err, 'viewer_metadata.js@refresh');
          }
          viewer.collection = metadata;
          viewer.collection.vanityName = erly.session.currentUser.vanityName;

          if (history.replaceState) {
            history.replaceState('', '', erly.urlFor.collection(metadata));
          }
          render();
        });
      }
      else {
        // NOTE: If we're not refetching, make sure we recalc all the
        //       calculated fields (eg. pastEvent)
        erly.updateEventWithCalculatedFields(viewer.collection);
        render();
      }
    };

    hookEditRegions = function() {
      $([DOM.attendance, DOM.datetime, DOM.location].join(',')).
        unbind('click.action');
      $(DOM.title).unbind('click');
      editRegionClickWithFocus($(DOM.title), '#title');
      $(DOM.creator).find('.creator-name').unbind('click');
      $(DOM.creator).find('.creator-name').click(editRegionClick);
      $(DOM.description).click(editRegionClick);
      editRegionClickWithFocus($(DOM.datetime), '#start_date');
      editRegionClickWithFocus($(DOM.location), '#locationName');

      var showMetadataEditClick = function() {
        showMetadataEdit();
        return false;
      };
      $$('.metadata-edit-details').click(showMetadataEdit);
      $$('#metadataOverlay .click-to-edit').click(showMetadataEdit);

      $$('#metadataOverlay .click-to-change-colors').click(function() {
        showColorPicker(viewer.collection);
      });
      $(DOM.creator).find('.view-photos,.add-photos').hide();
      $(DOM.rsvpAction).hide();
      $(DOM.likeButton).hide();
    };

    unhookEditRegions = function() {
      $(DOM.title).unbind('click');
      $(DOM.creator).find('.creator-name').unbind('click');
      $(DOM.description).unbind('click');
      $(DOM.datetime).unbind('click');
      $(DOM.location).unbind('click');
      $(DOM.title).click(viewer.scrollToDetails);

      var addViewSelector = '.add-photos';
      if ((viewer.Posts.instance && viewer.Posts.instance.postCount()) ||
        (!viewer.collection.userRole.member &&
          !viewer.collection.publicEvent)) {
        addViewSelector = '.view-photos';
      }
      if ((addViewSelector === '.view-photos') ||
          (viewer.collection.startDate <= erly.now)) {
        $(DOM.creator).find(addViewSelector).show().unbind(
          'click.view').bind('click.view', openCarousel);
      }
      $(DOM.creator).find('.creator-name').click(function(e) {
        if (e.which > 1) {
          return;
        }
        window.location = erly.urlFor.gallery({
          ident: viewer.collection.ownerIdent
        });
      });

      $(DOM.attendance).bind('click.action', viewer.scrollToDetails);
      $(DOM.datetime).bind('click.action', function() {
        viewer.dialogs.showCalendarExportDialog();
      });
      $(DOM.location).bind('click.action', function() {
        if (viewer.collection.streetAddress) {
          window.open(erly.googleMapsLink(viewer.collection.streetAddress));
        }
        else {
          viewer.scrollToDetails();
        }
      });


      if ($(DOM.rsvpAction) && !erly.viewer.exported) {
        $(DOM.rsvpAction).show();
        if (viewer.collection.userRole.member &&
            (!viewer.collection.ownerOnly ||
              viewer.collection.userRole.owner))
          $(DOM.rsvpAction).find('span').click(function(e) {
            if (e.which > 1) {
              return;
            }
            if (!viewer.collection.userRole.attendee &&
              viewer.collection.pastEvent) {
              viewer.Details.instance.handleWasThere();
            }
            else {
              viewer.invites.showInvitePanel(viewer.collection, false, true);
            }
          });
        else if ($(DOM.rsvpAction).find('span'))
          $(DOM.rsvpAction).find('span').click(viewer.scrollToDetails);
      }

      $(DOM.likeButton).css('display', 'inline-block');
      $(document).unbind('keydown.backgroundPicker');
    };

    function setBackground(data, clicked) {
      var postData = {};
      if (typeof data === 'string' && data) {
        postData.coverPhotoUrl = data;
      }
      else if (data.postId) {
        postData.postId = data.postId;
      }
      else {
        postData.coverPhotoUrl = clicked.find('img').attr('src');
      }
      $.post(erly.urlFor.collection(viewer.collection, 'cover_photo'),
          postData, function(res) {
        if (res.success) {
          if (res.coverUrl !== (postData.coverPhotoUrl || data.src)) {
            // We could make the bg-image more crisp now, but it
            // causes some funky race conditions with centerImage
            // TODO: Figure out how to do this better
            /*
            _(function() {
              erly.events.fire(viewer.COVER_SET, res.coverUrl);
            }).delay(1000);
            */
          }
        }
        else {
          erly.trackException(
            new Error("Couldn't set cover photo " + JSON.stringify(postData)),
            'viewer_metadata.js@setBackground');
        }
      });

      // Show background immediately
      if (_backgroundPicker) {
        _backgroundPicker.find(DOM.backgroundOption).removeClass('selected');
      }

      if (clicked) { clicked.addClass('selected'); }
      erly.events.fire(
        viewer.COVER_SET, postData.coverPhotoUrl || data.src);
    }

    function setupBackgroundPicker() {
      // erly.profiling.mark('bg picker', 'start');
      var postImages = _.map(viewer.Carousel.instance.getPostData(), function(post) {
        return post.type === 'photo' ? {
          postId: post.id,
          src: post.picture
        } : null;
      });
      postImages = _.filter(postImages, Boolean);

      var stockImages = [];
      var categories = [];
      _.each(erly.STOCK_BACKGROUNDS, function(v, k) {
        categories.push({
          name: k
        });

        stockImages = stockImages.concat(_.map(v, function (v) {
          return {
            src: erly.resolveStaticUrl(v),
            thumb: erly.resolveStaticUrl(v.replace('.jpg', '-thumb.jpg')),
            category: k
          };
        }));
      });

      // erly.profiling.mark('bg picker', 'images mapped');
      _backgroundPicker = $$(DOM.editBackgroundTemplate).tmpl({
        categories: categories,
        images: postImages.concat(stockImages),
        hasPostImages: postImages.length > 0
      });

      // add background picker to DOM
      // and prepare for upcoming animation
      var main = $$('.main');
      main.prepend(_backgroundPicker);
      _backgroundPicker.css('marginTop', -_backgroundPicker.outerHeight(true));
      _backgroundPicker.animate({
        marginTop: 0
      }, function() {
        _backgroundPicker.find('.close').click(destroyBackgroundPicker);
      });

      setTimeout(function() {
        _backgroundPicker.css('opacity', 1);
        // erly.profiling.mark('bg picker', 'added to DOM');
        _backgroundPicker.animate({
          marginTop: 0
        }, function() {
          erly.events.fire(erly.events.BACKGROUND_PICKER_DISPLAYED);
        });
      }, 300);

      var dragged = false;

      var ignoreClick = false;
      var options = _backgroundPicker.find(DOM.backgroundOption);

      var setupOption = function(option) {
        option.click(function(e) {
          if (e.which > 1 || dragged) {
            return;
          }

          if (ignoreClick || $(this).is('.selected')) {
            ignoreClick = false;
            return;
          }

          var data = $(this).tmplItem().data;
          setBackground(data.src, $(this));
        });

        option.draggable({
          containment: 'body',
          revert: 'invalid',
          scroll: false,
          start: function(event, ui) {
            $$(DOM.backgroundPicker).css('overflow', 'visible');

            $('body').droppable({
              drop: function(event, ui) {
                if (ui.position.top > options.outerHeight()) {
                  ui.helper.click();
                }
              }
            });
            ui.helper.css('z-index', 10);
          },
          stop: function(event, ui) {
            // If the option moved, then ignore the click event that fires
            // on the option (so we don't double select or select after dragging)
            ignoreClick = !(ui.position.top === ui.originalPosition.top &&
              ui.position.left === ui.originalPosition.left);

            // Return to the original position;
            ui.helper.css(
              'top', ui.originalPosition.top
            ).css(
              'left', ui.originalPosition.left
            ).css(
              'z-index', ''
            );
            $('body').droppable('destroy');
          }
        });
      };

      setupOption(options);

      var overlay = $$(DOM.dragOverlay);
      var shouldHideOverlay = false;
      var upload = $$(DOM.backgroundUpload);
      var showUploadError = function() {
        erly.modal.showAlert('Sorry', "We couldn't handle that file. " +
        "Please ensure it is a valid image.");
      };
      upload.fileupload({
        autoUpload: true,
        url: '/upload?maxWidth=1600&maxHeight=1600&isCover=1'
      }).bind('fileuploaddone', function(err, data) {
        overlay.hide();

        data = data.result[0];
        if (!data.url) {
          return showUploadError();
        }

        erly.events.fire(viewer.COVER_SET, data.url);

        // Add new item to background options
        var newOption = $$(DOM.backgroundOptionTemplate).tmpl({
          src: data.url
        });
        upload.after(newOption);
        setupOption(newOption);

        $.post(erly.urlFor.collection(viewer.collection, 'cover_photo'), {
          coverPhotoUrl: data.url
        }, function(res) {
          if (res.success) {
            _backgroundPicker.find(DOM.backgroundOption).removeClass('selected');
            newOption.addClass('selected');
            backgroundPickerLazyLoad();
          }
        });
      }).bind('fileuploaddragover', function(err, data) {
        overlay.find('.drop').show();
        overlay.find('.upload-spinner').hide();
        overlay.show();
        shouldHideOverlay = false;

        $(document).unbind('dragleave');
        $(document).bind('dragleave', function(e) {
          shouldHideOverlay = true;
          setTimeout(function() {
            if (shouldHideOverlay) {
              overlay.hide();
            }
          }, 500);
        });
      }).bind('fileuploaddrop', function(err, data) {
        if (!data.files || data.files.length === 0) {
          overlay.hide();
        }
      }).bind('fileuploadstart', function(err, data) {
        // Show a processing icon
        overlay.show();
        overlay.find('.drop').hide();
        overlay.find('.upload-spinner').show();
      }).bind('fileuploadadd', function(event, data) {
        // HACK: jQuery fileupload doesn't fire an event ofr maxFileSize
        //       errors - it just renders a template, which isn't very
        //       useful for us.  So, we just validate this ourselves.  Yuck.
        var file = data.files && data.files[0];
        if (file) {
          if (file.size > 15000000) {
            erly.modal.showAlert('Sorry',
              'We can only handle images up to 15MB.');
            file.error = 'maxFileSize';
          }
        }
      }).bind('fileuploadfail', function(err) {
        overlay.hide();
        return showUploadError();
      });

      _carousel = _backgroundPicker.find(DOM.carousel);
      _carouselButtonLeft = _backgroundPicker.find(DOM.carouselButtonLeft);
      _carouselButtonRight = _backgroundPicker.find(DOM.carouselButtonRight);
      updateCarouselButtons();

      var optionWidth = options.outerWidth(true);
      _carouselButtonLeft.click(
        handleCarouselButton(optionWidth,
          function(windowWidth, slideDistance) {
            return Math.min(0, _carousel.position().left + slideDistance);
          }));
      _carouselButtonRight.click(
        handleCarouselButton(optionWidth,
          function(windowWidth, slideDistance) {
            return Math.max(-_carousel.outerWidth(true) + windowWidth,
              _carousel.position().left - slideDistance);
          }));

      // Select the current cover photo
      var currentCoverPhoto;
      _backgroundPicker.find('.background-option').each(function() {
        var option = $(this);
        if (option.find('img').data('src') ===
          viewer.collection.coverPhoto.url) {
          currentCoverPhoto = option;
        }
      });

      if (currentCoverPhoto) {
        currentCoverPhoto.addClass('selected');
        backgroundPickerLazyLoad();
        updateCarouselButtons();
      } else if (viewer.collection.coverPhoto.url) {
        var newOption = $$(DOM.backgroundOptionTemplate).tmpl({
          src: viewer.collection.coverPhoto.url
        });
        newOption.addClass('selected');
        upload.after(newOption);
        setupOption(newOption);
        backgroundPickerLazyLoad();
      }

      $(window).resize(backgroundPickerLazyLoad);

      _carousel.draggable({
        axis: 'x',
        containment: [-(_carousel.outerWidth(true) - $(window).width()), 0, 0, 0],
        start: function() {
          $$(DOM.backgroundPicker).css('overflow', 'hidden');
        },
        drag: _.throttleImmediate(function() {
          dragged = true;
          backgroundPickerLazyLoad();
          updateCarouselButtons();
        }, 50),
        stop: function() {
          _(function() {dragged = false;}).defer();
        }
      });

      var search = _backgroundPicker.find('.search');
      var searchInput = search.find('input');
      var searchCarousel = $('#searchCarousel');
      var emptySearchResults = $('#emptySearchResults');
      var categoryCarousel = $('#categoryCarousel');

      var showCategoryCarousel = function() {
        searchCarousel.hide();
        categoryCarousel.css('display', 'inline-block');
        categories.removeClass('no-selection');

        _carousel = categoryCarousel;
        updateCarouselButtons();

        searchInput.val('');
        search.removeClass('searched');
      };

      var showSearchCarousel = function() {
        searchCarousel.css('display', 'inline-block');
        categoryCarousel.hide();
        categories.addClass('no-selection');

        _carousel = searchCarousel;
        moveCarousel(0);
        updateCarouselButtons();

        search.addClass('searched');
      };

      categories = _backgroundPicker.find('.category');
      categories.click(function(e) {
        if (e.which > 1) {
          return;
        }

        categories.removeClass('selected');
        $(this).addClass('selected');

        showCategoryCarousel();
        var categoryName = $(this).data('category');
        if (!categoryName) {
          moveCarousel(0);
        }
        else {
          var targetOption = _backgroundPicker.find('.background-option.' +
            categoryName);
          var targetPos = targetOption.eq(0).position().left;
          moveCarousel(-targetPos + 20);
        }
      });

      var doSearch = function() {
        var query = $.trim(searchInput.val());
        emptySearchResults.hide();
        if (!query) {
          showCategoryCarousel();
          return;
        }

        searchCarousel.empty();
        showSearchCarousel();

        erly.services.bingImageSearch(query, 0, function(err, results) {
          if (err) {
            erly.trackException(err, 'viewer_metadata.js@doSearch');
            return;
          }

          if (results.error || results.length === 0) {
            emptySearchResults.show();
          }
          else {
            _.each(results, function(image) {
              var newOption = $$(DOM.backgroundOptionTemplate).tmpl({
                src: image.src
              });
              searchCarousel.append(newOption);
              setupOption(newOption);
            });
            backgroundPickerLazyLoad();
          }
        });
      };

      search.find('.button').click(function(e) {
        if (e.which > 1) {
          return;
        }

        if (search.hasClass('searched')) {
          searchInput.val('');
        }

        doSearch();
      });

      search.find('input').keypress(function(e) {
        if (e.which === 13) {
          doSearch();
          e.preventDefault();
          return false;
        }

        return true;
      });

      $(document).bind('keydown.backgroundPicker', function(e) {
        if ($('#modal').length > 0) {
          return;
        }

        if (e.which === 37) {
          _carouselButtonLeft.click();
        }
        else if (e.which === 39) {
          _carouselButtonRight.click();
        }
      });
      // erly.profiling.mark('bg picker', 'done');
    }

    function completeEdit() {
      erly.events.fire(viewer.EXITING_EDIT_MODE);
      self._metadataPanel.removeClass('editing');
      $$(DOM.edit).show();
      $$(DOM.moveHint).hide();
      $('#editInstructions').hide();
      $('.viewer .toolbar').eq(0).show();
      $('.viewer-edit-bottom-bar').hide();
      $$(DOM.finishEditHint).hide();

      // Set default bg if it hasn't been
      if (!viewer.collection.coverPhoto || !viewer.collection.coverPhoto.url ||
          viewer.collection.coverPhoto.isNotSet) {
        setBackground(viewer.DEFAULT_BACKGROUND_URL);
      }
      destroyColorPicker();
      destroyBackgroundPicker();
      unhookEditRegions();
      bindTooltips();
    }

    function setupBottomBar() {
      var bottomBar = $('.viewer-edit-bottom-bar');
      bottomBar.find('.done').click(function() {
        completeEdit();
        // show invite dialog for new collections
        if (viewer.wasNewCollection()) {
          // Don't show the prompt to add content if there are already posts in
          // this new collection
          var hideAddContent = viewer.Posts.instance && viewer.Posts.instance.postCount();
          viewer.invites.showInvitePanel(viewer.collection, true, hideAddContent);
          viewer.clearWasNewCollection();
        }
      });

      bottomBar.find('.edit-event-details').click(function() {
        showMetadataEdit();
        return false;
      });

      bottomBar.find('.extra-settings-link').click(function() {
        erly.eventForm.showExtraSettingsDropDown(viewer.collection);
        return false;
      });
    }

    function setupRightToolbar(metadata) {
      // Some hacks to make these layout properly on iPad and IE
      $$(DOM.edit).css('opacity', 1).hide();

      $$(DOM.userProfileName).html(erly.userName);
      $('#editInstructions a.change-background').click(setupBackgroundPicker);

      $$(DOM.edit).click(function() {
        erly.events.fire(viewer.ENTERING_EDIT_MODE);
        self._metadataPanel.addClass('editing');
        $$(DOM.edit).hide();
        self.closeAllDropDowns();

        $('.viewer .toolbar').eq(0).hide();
        $('#editInstructions').show();
        if (viewer.wasNewCollection()) {
          $('#editInstructions span.new-collection').show();
        }
        else {
          $('#editInstructions span.new-collection').hide();
        }

        var c = viewer.collection;
        if (c.coverPhoto &&
            c.coverPhoto.url === viewer.DEFAULT_BACKGROUND_URL) {
          setupBackgroundPicker();
        }

        $('.viewer-edit-bottom-bar').fadeIn(400, function() {
          erly.events.fire(erly.events.COMPLETED_ENTERING_EDIT_MODE);
        });

        hookEditRegions();
      });

      Metadata.setupShareCommands();

      var getStyle = function(el) {
        var style = '';
        _.each(STYLES, function(v) {
          if (el.hasClass(style)) {
            style += v + ' ';
          }
        });

        return $.trim(style);
      };


    }

    fetchMetadata(function(err, metadata) {
      if (err) {
        return callback(err);
      }

      viewer.collection = metadata;
      viewer.collection.vanityName = erly.session.currentUser.vanityName;
      self._metadataPanel = $$(TEMPLATES.main).tmpl(metadata);
      updateFlagstoneColors(metadata.metadataStyles);

      // NOTE: binds the proper non-editing actions
      _(function() {
        unhookEditRegions();
        bindTooltips();
      }).defer();

      var featureThis = $('#featured-this').add('#masthead-this');
      if (featureThis.length) {
        (function() {
          var featuredType = {};

          var updateText = function(type) {
            var title = type === 'featured' ? 'feature' : 'masthead';
            $('#' + type + '-this a').text(
              (featuredType[type] ? 'un' + title : title) + ' this');
          };

          featureThis.click(function() {
            var type = $(this).attr('id').split('-')[0];

            $.ajax({
              url: erly.urlFor.featured(),
              type: 'post',
              data: {
                id: erly.viewer.collection.id,
                isRemove: Boolean(featuredType[type]),
                type: type
              },
              success: function() {
                featuredType[type] = !featuredType[type];
                updateText(type);
              }
            });
          });

          var _check = function(type) {
            $.ajax({
              url: erly.urlFor.featured('check'),
              type: 'post',
              data: {id: erly.viewer.collection.id, type: type},
              success: function(data) {
                featuredType[type] = data.isFeatured;
                updateText(type);
              }
            });
          };

          _check('featured');
          _check('masthead');
        }());
      }

      container.html(self._metadataPanel);

      // Fit the title after 100ms to allow time to the DOM to catch up
      // and use some animation to cover it up
      self._metadataPanel.animate({
        opacity: 0,
        marginLeft: -8,
        marginRight: 8
      }, 0);

      var animateCallback = function() {
        self._metadataPanel.animate({
          opacity: 1,
          marginLeft: 0,
          marginRight: 0
        }, "linear");
      };

      if (!viewer.collection.metadataStyles) {
         fitTitle(100, animateCallback);
      } else {
        setTimeout(animateCallback, 100);
      }

      self._metadataPanel.find(DOM.title).click(function() {
        erly.events.fire(viewer.TITLE_CLICKED);
      });

      _.delay(refreshDropDowns, 1000);

      setupRightToolbar();
      setupBottomBar();
      bindTooltips();
      $('.bottom-bar .add-photos-button').click(function(e) {
        if (e.which > 1 || _isEditing()) {
          return;
        }
        openCarousel(e);
      });

      callback(null, viewer.collection);
    });
  };

  var _closeAllDropDowns = function() {
    $('.drop-down-container').hide().empty();
    $('.icon-wrapper.active').removeClass('viewer-round-top-tab');
    $('.icon-wrapper.active').removeClass('viewer-round-bottom-tab');
    $('.icon-wrapper.active').removeClass('active');
  };
  Metadata.prototype.closeAllDropDowns = _closeAllDropDowns;

  var _sizeDropDownContents = function(containment, anchor, fixedHeight) {
    var containmentOffset = containment.offset();
    var offset = anchor.offset();
    var top = offset.top - containmentOffset.top;
    var bottom = top + anchor.height();

    var topSpace = top - fixedHeight + 80;
    var bottomSpace = containment.height() - bottom - fixedHeight;

    return Math.max(bottomSpace, topSpace);
  };

  var _positionContainer = function(containment, dropdown, anchor) {
    var containmentDims = containment.offset();
    containmentDims.width = containment.width();
    containmentDims.height = containment.height();

    // Assumes anchor is within containment *and* dropdown's offset
    // parent is containment

    var dropdownDims = {};
    // HACK, without this height is very wrong

    var containedDiv = dropdown.find('.viewer-drop-down');
    dropdownDims.height = containedDiv.height();
    dropdownDims.width = containedDiv.width();

    var anchorDims = anchor.offset();
    anchorDims.left -= containmentDims.left;
    anchorDims.top -= containmentDims.top;
    anchorDims.height = anchor.height();

    // HACK (again?!), width is wrong unless we get the parent
    anchorDims.width = anchor.parent().width();

    var x = anchorDims.left;
    var y = anchorDims.top + anchorDims.height;
    var leftCorner = '';

    // flip left if we have exceeded the width
    if (x + dropdownDims.width > containmentDims.width) {
      x = (anchorDims.left + anchorDims.width) - dropdownDims.width;
      leftCorner = '-lc';
    }

    // reset viewer-drop-down
    dropdown.find('.viewer-drop-down').removeClass('viewer-round-top');
    dropdown.find('.viewer-drop-down').removeClass('viewer-round-bottom');
    dropdown.find('.viewer-drop-down').removeClass('viewer-round-top-lc');
    dropdown.find('.viewer-drop-down').removeClass('viewer-round-bottom-lc');

    // flip up if we have exceeded the height
    if (y + dropdownDims.height > containmentDims.height) {
      y = anchorDims.top - dropdownDims.height;
      dropdown.find('.viewer-drop-down').addClass('viewer-round-top' + leftCorner);
      anchor.parent().addClass('viewer-round-bottom-tab');
    }
    else {
      dropdown.find('.viewer-drop-down').addClass('viewer-round-bottom' + leftCorner);
      anchor.parent().addClass('viewer-round-top-tab');
    }

    dropdown.css({
      top: y + 'px',
      left: (x - 3) + 'px' // -3 is a hack
    });

    anchor.parent().addClass('active');
    var closeContainer = dropdown.find('.close-viewer-drop-down');
    closeContainer.click(function() {
      _closeAllDropDowns();
    });
  };

  var _setupDropDown = function(options) {
    if (!options.container) {
      throw new Error('Missing container');
    }
    if (!options.anchor) {
      throw new Error('Missing anchor');
    }
    if (!options.url) {
      throw new Error('Missing url');
    }

    var anchor = $(options.anchor);
    var container = $(options.container);

    // Create the dropdown div
    var dropdown = $('<div class="drop-down-container"></div>');
    dropdown.css('display', 'none');
    dropdown.appendTo(container);

    anchor.click(function() {
      // If our dropdown is already showing or we're in edit mode, just bail
      // (is(':visible') does not work)
      var quitAfterHiding = dropdown.css('display') === 'block';

      // Close all current drop downs
      _closeAllDropDowns();

      if (quitAfterHiding || _isEditing()) {
        return;
      }

      $.ajax({
        type: 'get',
        url: options.url,
        success: function(data) {
          if (typeof options.display === 'function') {
            options.display(data, dropdown);
            dropdown.show();
            _positionContainer(container, dropdown, anchor);
          }
        }
      });
    });

    return dropdown;
  };

  var _jspify = function(pane, containment, dropdown, anchor, fixedHeight) {
    fixedHeight = fixedHeight || 70;
    var api = pane.jScrollPane().data('jsp');
    // This is required otherwise Safari goes nuts
    pane.bind('jsp-scroll-y', _(api.reinitialise).bind(api));

    var sizer = function(scrollToBottom) {
      _(function() {
        var availableSpace = _sizeDropDownContents(containment, anchor,
          fixedHeight);
        var finalHeight = Math.min(api.getContentPane().outerHeight(true),
          availableSpace);
        pane.height(finalHeight);

        api.reinitialise();
        if (scrollToBottom) {
          api.scrollToBottom(false);
        }

        _positionContainer(containment, dropdown, anchor);
      }).defer();
    };

    return {sizer: sizer, api: api};
  };

  var gotoPostHandler = function(e) {
    if (e.which > 1) {
      return;
    }

    var postId = parseInt($(this).data('post-id'), 10);
    viewer.gotoPost(postId, true);
  };

  Metadata.prototype._setupLikes = function() {
    var containment = $$('#metadataContainment');
    var dropdown = null;
    var anchor = this._metadataPanel.find('.likes.icon-element');

    // Handle links to comments in posts
    dropdown = _setupDropDown({
      container: containment,
      anchor: anchor,
      url: erly.urlFor.collection(viewer.collection, 'likes'),
      display: function(data, container) {
        data.sort(function(a, b) {
          return erly.normalizeDate(b.createdAt).getTime() -
            erly.normalizeDate(a.createdAt).getTime();
        });

        var feed = $$('#tmplLikeFeed').tmpl({
          likes: data,
          metadataStyle: viewer.collection.metadataStyle
        });

        feed.find('.post-like-link').click(gotoPostHandler);

        var pane = container.append(feed).find('.comment-rows');
        var jspData = _jspify(pane, containment, dropdown, anchor);
        var sizeLikes = jspData.sizer;
        var api = jspData.api;

        var deleteLike = function() {
          // only the person who liked something can delete his own like
          var likeData = $(this).tmplItem().data;
          var post = likeData.postId? $('#post_' + likeData.postId) : null;
          var postData = post? post.tmplItem().data : null;

          if (postData) {
            $.post(erly.urlFor.collection(erly.viewer.collection, 'unlike',
                postData.id), {
              postId: postData.id,
              chronicleId: postData.chronicleId
            });
            postData.likeCount = postData.likeCount - 1 || 0;
            postData.isLiked = false;
            delete postData.likes;
            erly.viewer.Posts.instance.updateLikeButtonForPost(post);
          } else {
            // collection level like
            $.post(erly.urlFor.collection(viewer.collection, 'unlike'), {},
              function(data) {
                if (data.success) {
                  viewer.collection.isLiked = false;
                  viewer.metadata._updateLikeButton();
                }
              });
          }

          viewer.metadata.incrementMetadataCountBy("totalLikeCount", -1);
          viewer.metadata._updateMetadataCounters();

          $(this).parent().fadeOut(function() {
            if (viewer.collection.totalLikeCount === 0) {
              _closeAllDropDowns();
            }
            else {
              sizeLikes();
            }
            $(this).next().remove();
            $(this).remove();
          });
        };

        sizeLikes();
        container.find('.delete').click(deleteLike);
      }
    });
  };

  var _clickHandlerSet = false;
  Metadata.prototype._setupDropDowns = function() {
    $('#flagstone .drop-down-container').remove();
    this._setupLikes();
    if (_clickHandlerSet) {
      var dropDown = '.drop-down-container';
      $('body').click(function(ev) {
        if (!$(ev.target).is(dropDown) &&
            !$(ev.target).parents(dropDown).length &&
            // Ignore clicks on modals
            !$(ev.target).is('.modal') &&
            !$(ev.target).parents('.modal')) {
          _closeAllDropDowns();
        }
      });
      _clickHandlerSet = true;
    }
  };


  Metadata.prototype._updateMetadataCounters = function() {
    var self = this;
    var update = function() {
      var count = viewer.collection[$(this).data('field')];
      $(this).text(count.toString());
      if ($(this).data('field') === 'totalLikeCount') {
        if (count === 0) {
          $(this).parent().parent().hide();
          self._metadataPanel.find('.icon-element-likes-disabled').
            css('display', 'inline-block');
        }
        else {
          self._metadataPanel.find('.icon-element-likes-disabled').hide();
          $(this).parent().parent().show();
        }
      }
      if (count === 1) {
        $(this).parent().removeClass('pluralized');
      }
      else {
        $(this).parent().addClass('pluralized');
      }
    };
    self._metadataPanel.find('.icon-element .metadata-count').each(update);
    $('#detailsTitle .icon-details .likes .metadata-count').each(update);
  };

  Metadata.prototype._updateLikeButton = function() {
    var els = $(DOM.likeButton).add('.details-album-header .like-button');
    if (viewer.collection.isLiked) {
      els.hide();
    }
    else {
      els.css('display', 'inline-block');
    }
  };

  Metadata.prototype.isVisible = function() {
    return erly.viewer.collection.visible;
  };

  Metadata.prototype.incrementMetadataCountBy = function(name, count) {
    viewer.collection[name] += count;
    this._updateMetadataCounters();
  };

  Metadata.applyStyle = function(element, style) {
    _.each(STYLES, function(v) {
      element.removeClass(v);
    });

    _.each(style.split(" "), function(v) {
      element.addClass(v);
    });
  };

  Metadata.setupShareCommands = function() {
    if (!viewer.embedMode &&
        viewer.collection.ownerOnly &&
        !viewer.collection.pastEvent) {
      $("#share-container").hide();
    }
    else {
      $("#share-container").show();
    }
    $("#share-container").find('a.fb').unbind('click');
    $("#share-container").find('a.fb').click(function() {
      Metadata.shareFB();
    });
    $("#share-container").find('a.twitter').unbind('click');
    $("#share-container").find('a.twitter').click(function() {
      Metadata.shareTwitter();
    });
    $("#share-container").find('a.link').unbind('click');
    $("#share-container").find('a.link').click(function() {
      viewer.invites.showShareLinkPanel(viewer.collection);
    });
    $("#share-container").find('a.archive').unbind('click');
    $("#share-container").find('a.archive').click(function() {
      var link = $(this);
      if (!link.hasClass('working')) {
        link.addClass('working');
        Metadata.downloadArchive(link);
      }
    });
  };

  Metadata.downloadArchive = function(link) {
    $.get(erly.urlFor.collection(viewer.collection, 'archive'),
          function(data) {
      if (data.success) {
        erly.modal.showConfirm('We\'re Preparing Your Archive',
          'We are creating an archive of your Erly Event and will email ' +
          'you with a link to download it once it\'s completed.', 'Close', null,
          { hideCancel: true });
      } else {
        erly.modal.showAlert('Sorry', "You don't have permission to archive " +
                             'this collection.');
      }
      link.removeClass('working');
    }).error(function(xhr, status, err) {
      erly.modal.showAlert('Archive Unavailable', 'Sorry, we encountered ' +
        'an error creating an archive of this Event.  Please try ' +
        'again later.');
      link.removeClass('working');
    });
  };

  Metadata.shareFB = function() {
    if (typeof FB === 'undefined') {
      return erly.modal.showAlert(
        'Facebook Error',
        'We were unable to load Facebook at this time.  Sorry for the ' +
        'inconvenience.');
    }
    FB.ui({
      method: 'feed',
      name: viewer.collection.title,
      link: getCollectionLink(),
      picture: getShareIconUrl(),
      description: "An Erly Event -- the fastest and easiest way to build a beautiful webpage for your event."
    }, function() {
    });
  };

  Metadata.shareTwitter = function() {
    var isMine = 'this';
    if (viewer.collection.owner.id === erly.getUserData().id)
      isMine = 'my';
    var twitter_message = "Check out " + isMine + " @erlyco Event:";
    window.open('http://twitter.com/share?url=' +
    encodeURIComponent(getCollectionLink()) +
    "&text=" +
    encodeURIComponent(twitter_message), '_twitterShareWindow',
      'width=500,height=345');
  };

  viewer.Metadata = Metadata;
}(erly.viewer));

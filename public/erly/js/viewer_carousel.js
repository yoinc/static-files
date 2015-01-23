/*!
 * Viewer carousel class
 */
(function(viewer) {
  var DOM = {
    posts: '.post'
  };

  var Carousel = function(collection, postData, container, options, onReady) {
    var self = this;
    self.options = options;
    self.zoomed = false;
    self.container = container;
    var _posts;
    this.comments = new erly.viewer.Comments(collection, container);
    viewer.Carousel.instance = self;

    this.hideCarouselButtons = erly.layout.panel.hideCarouselButtons;
    this.showCarouselButtons = erly.layout.panel.showCarouselButtons;

    function getRoleString() {
      if (!collection.userRole) {
        return 'none';
      }
      else if (collection.userRole.owner) {
        return 'owner';
      }
      else if (collection.userRole.member) {
        return 'member';
      }
      else {
        return 'none';
      }
    }

    function initPostData(post) {
      if (!post) {
        return;
      }

      // initialize empty comments for new posts.
      if (!post.commentCount) {
        post.commentCount = 0;
        post.comments = [];
      }

      if (!post.order && post.id) {
        post.order = post.id;
      }
      post.order = parseFloat(post.order);

      var source = post.source;
      var photoId;
      if (post.facebookIds) {
        photoId = post.facebookIds.id;
      }
      else if (post.photoIds) {
        photoId = post.photoIds;
      }

      if (source && photoId) {
        erly.viewer.existIds[source + photoId] = photoId;
      }
    }

    var zoom = function(post) {
      if (self.zoomed) {
        return;
      }

      self.zoomed = true;
      self.relayout(true, 0);
      _(function() {
        erly.layout.panel.setZoomedCard(post);
        self.gotoPost(post, {
          animationTime: 0
        });
      }).defer();

      viewer.Posts.instance.hideActions();
      self.container.find('.overlay').removeClass('fade-in').hide();
    };

    var unzoom = function() {
      if (!self.zoomed) {
        return;
      }

      var lastZoomed = erly.layout.panel.lastZoomedCard();

      self.zoomed = false;
      self.relayout(true, 0);
      viewer.Posts.instance.showActions();
      _(function() {
        self.gotoPost(lastZoomed, {
          animationTime: 0
        });
        self.zoomedPost = null;
      }).defer();
      self.container.find('.overlay').addClass('fade-in');
    };

    this.flashPost = function(post) {
      var position = post.position();
      var flasher = $('#flasher');
      flasher.stop(true, true);
      flasher.css('left', position.left + 'px');
      flasher.css('top', position.top + 'px');

      var inner = flasher.find('>div');
      inner.width(post.outerWidth() - 10).height(post.outerHeight() - 10);
      inner.css('opacity', 1.0);
      flasher.animate({
        opacity: 0.6
      }, 400, function() {
        inner.animate({
          opacity: 0
        }, 1200, function() {
          // Put the flasher away
          flasher.css('left', 0).css('top', 0);
          inner.height(0).width(0);
        });
      });
    };

    this.gotoPost = function(targetOrId, options) {
      options = options || {};
      var flash = options.flash;
      var showComments = options.showComments;
      var callback = options.callback;

      // Wait until we are ready
      if (container.find(".post.laidout").length === 0) {
        setTimeout(function() {
          self.gotoPost(targetOrId, options);
        }, 500);
        return;
      }

      var target = targetOrId;
      if (typeof target === 'number') {
        // Find the post
        target = container.find("#post_" + target);
      }

      if (target.length === 0) {
        if (options.showDialog) {
          viewer.dialogs.showDeletedCollectionItemDialog();
        }
        return;
      }

      // Try to center the post
      var targetPos = target.position();
      var windowWidth = $(window).width();

      var position = Math.round(targetPos.left -
      (windowWidth - target.outerWidth()) / 2);
      erly.layout.panel.animatedScrollToPosition(position, function() {
        if (showComments) {
          target.find('.comment-count').safeClick();
        }
        else {
          if (flash) {
            self.flashPost(target);
          }
        }

        if (callback) {
          callback();
        }
      }, options.animationTime);
    };

    // TODO: Probably want to add counting to this
    var _batchUpdate = null;
    this.beginUpdate = function() {
      _batchUpdate = {};
    };

    this.endUpdate = function() {
      var relayout = function() {
        if (_batchUpdate.posts) {
          $.each(_batchUpdate.posts, function(i, v) {
            v.animate({
              opacity: 1.0
            }, 1500, 'linear', function() {
              $(this).css('opacity', '');
            });
          });
        }

        viewer.refreshMetadata();
        _batchUpdate = null;
      };

      this.relayout(true);
      if (_batchUpdate.scrollToPost) {
        this.gotoPost(_batchUpdate.scrollToPost, {
          callback: relayout
        });
      }
      else {
        relayout();
      }
    };

    function animateNewPost(newPost, replacing, retryCount) {
      if (typeof retryCount === 'undefined') {
        retryCount = 0;
      }

      newPost.css('opacity', '0.01').show();

      if (_batchUpdate) {
        if (!replacing && !_batchUpdate.scrollToPost) {
          _batchUpdate.scrollToPost = newPost;
        }
        _batchUpdate.posts = _batchUpdate.posts || [];
        _batchUpdate.posts.push(newPost);
      }
      else {
        var layoutPost = function() {
          newPost.animate({
            opacity: 1.0
          }, 1500, 'linear', function() {
            $(this).css('opacity', '');
          });
        };

        self.relayout(true);
        // Scroll to where the new post resides
        if (!replacing) {
          self.gotoPost(newPost, {
            callback: layoutPost
          });
        }
        else {
          layoutPost();
        }
      }
    }

    this.getCurrentInsertPost = function() {
      // Find the insertion point based on the current position of the carousel
      var carouselPos = erly.layout.panel.getCarouselPosition();
      var posts = container.find('.post');
      var windowWidth = $(window).width();
      var target = posts.eq(0);
      for (var i = 0; i < posts.length; i++) {
        var candidate = posts.eq(i);
        var pos = candidate.position();
        var left = pos.left - carouselPos;

        var candidateWidth = candidate.outerWidth();
        var right = left + candidate.outerWidth();

        // The last card that is mostly on screen
        if (right - (candidateWidth / 3) < windowWidth) {
          target = candidate;
        }
      }

      return target;
    };

    this.getCurrentInsertOrder = function() {
      var order;

      var insertionPost = this.getCurrentInsertPost();
      var data = insertionPost.tmplItem().data;
      if (data.order) {
        order = data.order - 0.1;
        var next = insertionPost.next();
        if (next.length > 0) {
          var nextData = next.tmplItem().data;
          if (nextData.order) {
            order = (data.order + nextData.order) / 2;
          }
        }
      }
      if (!order) {
        order = 200;
      }

      return order;
    };

    this.addPost = function(post, target, skipMetadataUpdate) {
      initPostData(post);
      erly.track.postCreate({
        type: post.type,
        role: getRoleString(),
        id: collection.id,
        source: post.source || 'user',
        fulfilled: post.request
      });

      var source = post.source;
      var photoId;
      if (post.facebookIds) {
        photoId = post.facebookIds.id;
      }
      else if (post.photoIds) {
        photoId = post.photoId;
      }
      if (source && photoId) {
        erly.viewer.existIds[post.source + photoId] = photoId;
      }

      var newPost = $('#tmplPost').tmpl(post);

      if (!target) {
        target = this.getCurrentInsertPost();
      }

      if (target.length === 0) {
        container.append(newPost);
      }
      else {
        target.after(newPost);
      }

      viewer.Tease.instance.update();
      if (!skipMetadataUpdate) {
        viewer.refreshMetadata();
      }
      animateNewPost(newPost);

      _posts.attachBehaviors(newPost);
      viewer.refreshShareContainer();

      if (this.zoomed) {
        viewer.Posts.instance.hideActions();
        self.container.find('.overlay').removeClass('fade-in').hide();
      }

    };

    this.relayout = function(force, animationTime) {
      var options = {
        force: force,
        layoutSeed: erly.normalizeDate(collection.createdAt).getTime(),
        animationTime: animationTime
      };

      if (self.zoomed) {
        options.zoomed = true;
      }

      this.relayoutAddItemsCard();

      erly.layout.panel.layout(options);
      this.comments.updateCommentIcons(container);
    };

    this.relayoutAddItemsCard = function() {
      if (_posts.postCount() === 0) {
        self.removeAddItemsCard();
        self.showAddItemsCard();
      }
      else {
        self.removeAddItemsCard();
      }
    };

    /*
     * Gets all the data objects from the current set of posts
     */
    this.getPostData = function() {
      return _.map(container.find(DOM.posts), function(post) {
        return $(post).tmplItem().data;
      });
    };

    // Clean up the data
    _.each(postData, initPostData);
    postData.sort(function(a, b) {
      return b.order - a.order;
    });

    erly.layout.panel.init(container, collection, self.options);

    _posts = new viewer.Posts(collection, postData, this.comments, container);

    var browser = erly.browserSupport.detect();

    // resizing for iPad happens on rotate
    if (browser.name !== 'iPad') {
      $(window).resize(_.throttle(function() {
        self.relayout(true, 0);
      }, 250));
    }

    _posts.attachBehaviors();

    this.removePostsForUser = function(userId) {
      _posts.removePostsForUser(userId);
    };

    erly.events.subscribe(viewer.ZOOMED, zoom);
    erly.events.subscribe(viewer.UNZOOMED, unzoom);

    erly.events.subscribe(viewer.ROLE_CHANGED, this.relayoutAddItemsCard);

    if (typeof onReady === 'function') {
      erly.events.subscribeOnce(erly.events.INITIAL_LAYOUT_COMPLETE, onReady);
    }

    self.relayout(true, 0);
  };

  Carousel.prototype.getAddItemsCard = function() {
    return $('.add-item-card-wrapper');
  };

  Carousel.prototype.showAddItemsCard = function() {
    var card = this.getAddItemsCard();
    if (card.length === 0) {
      if (erly.viewer.isRestricted()) {
        card = $('#tmplEmptyCollection').tmpl();
        card.appendTo($('.carousel-container'));
      }
      else {
        card = $('#tmplAddItemCard').tmpl();
        card.appendTo($('.carousel-container'));

        card.find('button').each(function() {
          $(this).click(function() {
            viewer.addPosts.showByType($(this).data('type'));
          });
        });
      }
    }
    else {
      card.show();
    }

    // If there are no blanks, add some
    return false;
  };

  Carousel.prototype.removeAddItemsCard = function() {
    this.getAddItemsCard().remove();
  };

  Carousel.prototype.startSlideshow = function() {
    var self = this;
    var go = function() {
      erly.layout.panel.clickNextCarouselButton();
      $('#slideshowStart').trigger('spin', [3900]);
      self.slideshowNextHandle = setTimeout(go, 4000);
    };

    go();
  };

  Carousel.prototype.stopSlideshow = function() {
    if (this.slideshowNextHandle) {
      $('#slideshowStart').trigger('spinCancel');
      clearTimeout(this.slideshowNextHandle);
    }
  };

  Carousel.prototype.insertSlide = function(post) {
    var target = erly.layout.panel.lastZoomedCard();
    this.addPost(post, target);

    // REVIEW: When the user exits slideshow mode, these slides will be
    //         out of order - do we want to do a fixup in stopSlideshow?
  };

  viewer.Carousel = Carousel;
}(erly.viewer));

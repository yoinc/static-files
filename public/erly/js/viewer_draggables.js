/*!
 * Draggable/droppable logic for posts
 */

(function(viewer) {
  viewer.Draggables = function(collection, container) {
    var updatePost = function(id, layoutHint, callback) {
      $.ajax({
        url: erly.urlFor.collection(collection, 'post', id, 'update'),
        data: {
          layoutHint: layoutHint || ''
        },
        type: 'post',
        success: function() {
          callback(null);
        },
        error: function(jqXHR, status, err) {
          callback(err || status);
        }
      });
    };

    var slidePeekTimeout = null;

    var stopSlidePeek = function() {
      if (slidePeekTimeout) {
        clearTimeout(slidePeekTimeout);
        slidePeekTimeout = null;
      }
    };

    var resetSlidePeek = function(posts) {
      stopSlidePeek();
      posts.find('.post').css({'margin-left': 0, 'margin-top': 0});
    };

    var slidePeek = function(draggable, droppable) {
      droppable = $(droppable);
      if (droppable.hasClass('earlier') || droppable.hasClass('later')) {
        return;
      }

      droppable.stop();
      stopSlidePeek();

      slidePeekTimeout = setTimeout(function() {
        var current = $(draggable).tmplItem().data.order;
        var target = $(droppable).tmplItem().data.order;
        var top = '-5px';
        var left = '-20px';
        var klass = 'later';
        if (current < target) {
          top = '5px';
          left = '20px';
          klass = 'earlier';
        }
        droppable.animate({
          'margin-left': left,
          'margin-top': top
        }, 200, function() {
          // check if we're still dragging, if not revert
          var posts = $('.viewer .posts');
          if (!posts.hasClass('dragging')) {
            resetSlidePeek(posts);
          }
          droppable.addClass(klass);
          stopSlidePeek();
        });
      }, 500);
    };


    var reorder = function(post, targetPost) {
      var postData = post.tmplItem().data;
      var targetPostData = targetPost.tmplItem().data;
      var originalLayoutHint = postData.layoutHint;

      if (targetPost.hasClass('swap-hint')) {
        // also swap the layout hints
        var layoutHint = postData.layoutHint;
        postData.layoutHint = targetPostData.layoutHint;
        targetPostData.layoutHint = layoutHint;

        // swap the two positions.
        var postNeighbor = post.prev();
        if (targetPost.is(postNeighbor)) {
          targetPost.before(post);
        } else {
          targetPost.after(post);
          postNeighbor.after(targetPost);
        }
      }
      else {
        if (postData.order < targetPostData.order) { // drop on later card
          targetPost.before(post);
        }
        else { // drop on earlier card
          targetPost.after(post);
        }
      }

      // Walk all post and set order values
      var allPosts = container.find('div.post');
      var postOrdering = {};
      var currentOrderValue = allPosts.length;
      allPosts.each(function() {
        var data = $(this).tmplItem().data;
        data.order = currentOrderValue;
        postOrdering["post_" + data.id.toString()] = currentOrderValue;

        currentOrderValue--;
      });

      // Update the tease image
      var allPostsData = _.map(allPosts, function(post) {
        return $(post).tmplItem().data;
      });
      viewer.tease.update(allPostsData);

      // Save the layout hints
      updatePost(postData.id, postData.layoutHint, function(err) {
        if (!err) { // ignore errors until we have a good way to revert order
          updatePost(targetPostData.id, targetPostData.layoutHint,
            function(err) {
              if (err) {
                // revert the order we sent before if the second call failed
                updatePost(postData.id, originalLayoutHint);
              }
            }
          );
        }
      });

      $.ajax({
        url: erly.urlFor.collection(collection, 'update_ordering'),
        data: {postOrdering: postOrdering},
        type: 'post'
      });
    };

    var setupDroppables = function(posts) {
      var droppables = posts.find('.post').not('.sidebar').not('.related')
        .not('.ui-droppable');

      droppables.droppable({
        includeBorders: true,
        intersectCallback: function(droppable) {
          // Include bottom margin
          var element = $(droppable.element);
          if (element.hasClass('later')) {
            droppable.proportions = {
              width: droppable.element[0].offsetWidth + 20,
              height: droppable.element[0].offsetHeight + 5
            };
          }
          else if (element.hasClass('earlier')) {
            // assumes offset got reset due to includeBorders
            droppable.offset.left -= 20;
            droppable.offset.top -= 5;
          }
        },
        over: function(ev, ui) {
          posts.find('.post').removeClass('drop-target');
          var droppable = $(this);
          droppable.addClass('drop-target');

          if (this !== posts.data('currentDroppable')) {
            posts.find('.post').removeClass(
              'drop-target swap-hint earlier later');
            resetSlidePeek(posts);
          }

          posts.data('currentDroppable', this);
        },
        out: function(ev, ui) {
          resetSlidePeek(posts);
          posts.find('.post').removeClass('drop-target');
          ui.helper.find('.drag-handle .drag-note').text('');
        },
        drop: function(ev, ui) {
          var post = ui.draggable;
          var targetPost = $(this);

          // disallow action when readonly
          if (collection.readonly === true) {
            return;
          }

          resetSlidePeek(posts);

          ui.helper.remove();
          reorder(post, targetPost);

          var droppable = posts.data('currentDroppable');
          posts.find('.swap-overlay').remove();
          posts.find('.post').removeClass('drop-target');
          posts.data('currentDroppable', null);

          post.css('top', targetPost.position().top + 'px')
            .css('left', targetPost.position().left + 'px')
            .width(targetPost.width())
            .height(targetPost.height());

          erly.viewer.Carousel.instance.relayout(true);
        },
        tolerance: 'pointer'
      });
    };

    var MINI_HEIGHT = 200;
    var MINI_WIDTH = 250;

    var generateHelper = function(ev, ui) {
      var post = $(this);
      var mini = post.clone();
      var body = mini.find('>div:eq(0)');

      mini.css({width: '200px', height: '200px'});
      body.css({width: '200px', height: '180px'});
      mini.addClass('ui-draggable-dragging');
      mini.find('.fade-in').not('.drag-handle').add('>div.metadata').remove();

      // Fake a bunch of crap so we can resize properly, also we need to wait
      // a tiny hair of a second so that the prior CSS rules can be applied since
      // the card isn't in the DOM yet
      setTimeout(function() {
        mini.attr('id', new Date().getTime().toString() + Math.random());
        mini.tmplItem().data = _.clone(post.tmplItem().data);
        mini.data('noAnimation', true);

        // finally resize
        erly.layout.sizeCard(mini, ev.pageX, ev.pageY, 200, 180);
      }, 1);

      return mini;
    };

    this.setupDraggable = function(post) {
      if (post.is('.sidebar') || post.is('.related')) {
        return;
      }

      var slideHandles = {};
      var checkSlide = function(ev, buttonSelector) {
        var button = container.find(buttonSelector);
        // NOTE: .beginning means it's the Home button
        if (button.length === 0 || button.is('.beginning')) {
          return;
        }

        var buttonLeft = button.offset().left;
        if (ev.pageX > buttonLeft &&
            ev.pageX < buttonLeft + button.width()) {
          if (typeof slideHandles[buttonSelector] === 'undefined') {
            slideHandles[buttonSelector] = setInterval(function() {
              console.log(button.get(0).className);
              if (!button.is('.beginning')) {
                button.click();
              }
            }, 1100);

            button.click();
          }
        }
        else {
          if (slideHandles[buttonSelector]) {
            clearInterval(slideHandles[buttonSelector]);
            delete slideHandles[buttonSelector];
          }
        }
      };

      var resetCheckSlide = function() {
        _.each(slideHandles, function(v, k) {
          clearInterval(v);
        });
      };

      var checkSlideBoth = _(function(ev) {
        checkSlide(ev, 'button.carousel-button.cb-left:visible');
        checkSlide(ev, 'button.carousel-button.cb-right:visible');
      }).throttle(500);

      post.draggable({
        scroll: false,
        revert: 'invalid',
        handle: '.drag-handle',
        helper: generateHelper,
        appendTo: container,
        opacity: 1,
        refreshPositions: true,
        zIndex: 200,
        drag: function(ev, ui) {
          // always reset check slide if the mouse starts moving
          resetCheckSlide();

          // Check if the mouse is on either side of the viewport, if so, begin a
          // timer that when fired moves the viewport one screen in that
          // direction
          checkSlideBoth(ev);

          var droppable = $(container.data('currentDroppable'));
          if (droppable) {
            var body = droppable.find('>div:eq(0)');
            if (body.length > 0) {
              var position = body.offset();
              var overlay = droppable.find('.swap-overlay');
              if (ev.pageX < position.left ||
                  ev.pageY < position.top  ||
                  ev.pageY >= position.top + body.height() ||
                  // right-side is harder to hit
                  ev.pageX >= position.left + body.width() - 30) {
                droppable.addClass('drop-target');
                droppable.removeClass('swap-hint');
                if (overlay.length > 0) {
                  overlay.remove();
                }
                var pos = droppable.offset();
                ui.helper.find('.drag-handle .drag-note').text('Insert here');

                slidePeek(this, droppable);
              }
              else {
                resetSlidePeek(container);
                droppable.addClass('swap-hint');
                droppable.removeClass('drop-target');
                if (overlay.length === 0) {
                  droppable.append($('<div class="swap-overlay"></div>'));
                  droppable.find('.swap-overlay').
                    height(body.height()).
                    width(body.width());
                }
                ui.helper.find('.drag-handle .drag-note').text('Swap positions');
              }
            }
          }
        },
        stop: function() {
          container.removeClass('dragging');
          container.find('.post').removeClass('drop-target');
          container.find('.post').removeClass('swap-hint');
          resetSlidePeek(container);
          $(this).removeClass('post-dragging');
          post.find('.drag-handle').removeClass('active');
          resetCheckSlide();
        },
        start: function(ev, ui) {
          container.addClass('dragging');
          $(this).addClass('post-dragging');
          container.data('currentDroppable', null);
          container.find('.post').removeClass('drop-target');
          container.find('.post').removeClass('swap-hint');
          post.find('.drag-handle').addClass('active');
          ui.helper.find('.drag-handle .drag-note').text('');
        }
      });

      setupDroppables(container);
    };
  };
}(erly.viewer));

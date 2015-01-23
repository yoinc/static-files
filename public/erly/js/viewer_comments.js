/*!
 * Comment handling
 */

(function(viewer) {
  var Comments = function(collection, container) {
    this._currentCommentBoxPostId = -1;
    this._container = container;
    this._collection = collection;
    viewer.Comments.instance = this;

    erly.events.subscribe(erly.viewer.CAROUSEL_CLOSING, function() {
      if ($('#commentBox')) {
        erly.viewer.Carousel.instance.comments.updateCommentIcons();
        $('#commentBox').remove();
      }
    });

    erly.events.subscribe(viewer.LOGIN_ACTION, function(loginAction) {
      if (loginAction.action === 'comment' &&
        loginAction.data.type === 'post') {
        viewer.toggleCarousel();
        _.delay(function() {
          viewer.Carousel.instance.gotoPost(loginAction.data.id, {
            showComments: true,
            callback: function() {
              $('#commentBox textarea').val(loginAction.data.text);
              $('#commentBox .comments-input button').click();
            }
          });
        }, 1000);
      }
    });
  };

  /**
   * Places the comment box within the current container.
   *
   * @api private
   */
  var _placeBox = function(duration) {
    var self = viewer.Comments.instance;
    var post = $('#post_' + viewer.Comments.instance._currentCommentBoxPostId);
    var box = $('#commentBox');
    var availableHeight = self._container.height();

    $(box.children()).each(function() {
      var child = $(this);

      if (child.hasClass('comments-container') || child.not(':visible')) {
        return;
      }

      availableHeight -= child.outerHeight(true);
    });

    // Give a little space on the bottom of the page
    availableHeight -= 50;

    box.find('.comments-container').css('max-height', availableHeight + 'px');

    var commentCountSelected = post.find('.metadata .comment-count');
    var left = commentCountSelected.offset().left +
      commentCountSelected.outerWidth();

    var top = post.offset().top + post.outerHeight() - 60;

    var TRIANGLE_ATTRIBUTES = {
      BORDER_WIDTH: 8,
      COLOR: 'white',
      BORDER_COLOR: '#aaa',
      TRIANGLE_OFFSET: 2
    };

    var right = left + box.outerWidth() +
      TRIANGLE_ATTRIBUTES.TRIANGLE_OFFSET + TRIANGLE_ATTRIBUTES.BORDER_WIDTH;
    var windowWidth = $(window).width() - 8;

    var boxHeight = box.outerHeight();
    var boxWidth  = box.outerWidth();
    var boxBottom = top + boxHeight;

    var postsTop = self._container.offset().top;
    var postsBottom = postsTop + self._container.height();
    var windowBottom = $(window).height();

    // Ensure the width of the box fits in the screen
    var commentCount;
    if (right > windowWidth) {
      commentCount = post.find('.comment-count');
      left = commentCount.offset().left + commentCountSelected.outerWidth() - 20 - boxWidth;
    }

    if (boxBottom > postsBottom - 20) {
      top = Math.max(postsTop - 60, postsBottom - boxHeight);
    }

    box.show().css({
      opacity: 0,
      top: top + 'px',
      left: left + 'px'
    });

    // add triangle
    $('.bordered-triangle').remove();

    commentCount = post.find('.comment-count');
    var boxOnRight = (erly.cssPixels(box, 'left') -
      commentCount.offset().left > 0) ? true : false;

    var triangleOptions = {
      borderWidth: TRIANGLE_ATTRIBUTES.BORDER_WIDTH,
      color: TRIANGLE_ATTRIBUTES.COLOR,
      borderColor: TRIANGLE_ATTRIBUTES.BORDER_COLOR
    };

    if (boxOnRight) {
      triangleOptions.position = 'left';
    } else {
      triangleOptions.position = 'right';
    }

    var triangle = erly.widgets.createPositionedBorderedTriangle(
      box,
      commentCount,
      TRIANGLE_ATTRIBUTES.TRIANGLE_OFFSET,
      triangleOptions
    );

    triangle.css('top', commentCount.offset().top - erly.cssPixels(box, 'top'));

    box.animate({
      opacity: 1
    }, duration || 0, function() {
      erly.events.fire(erly.events.COMMENT_OPEN);
    });
  };


  var _updateCommentIcon = function(post) {
    var data = post.tmplItem().data;
    var count = data.commentCount || 0;
    var commentSpan = post.find('.comment-count').find('span');

    commentSpan.text(count);
    if (count > 0) {
      commentSpan.addClass('has-comments');
    } else {
      commentSpan.removeClass('has-comments');
    }
  };

  /**
   * Expects to be bound to the click event of an element.
   * @api private
   */
  var _deleteCommentHandler = function() {
    var _deleteComment = function() {
      var commentData = $(this).tmplItem().data;

      $.post(
        erly.urlFor.collection(
          viewer.collection, 'comment', commentData.id, 'delete'),
        {},
        function(data) {
          if (!data.success) {
            // REVIEW: Warn the user?
          }
        }
      );

      $(this).parent().fadeOut(function() {
        $(this).remove();
        var data = $('#commentBox').tmplItem().data;
        var removeIndex = -1;
        _.each(data.comments, function(v, i) {
          if (v.id === commentData.id) {
            removeIndex = i;
          }
        });

        if (removeIndex !== -1) {
          data.comments.splice(removeIndex, 1);
          data.commentCount = data.commentCount - 1;
          viewer.metadata.incrementMetadataCountBy('totalCommentCount', -1);
        }
        viewer.Comments.instance.updateCommentIcons();
        var count = data.commentCount || 0;
        if (count === 0)
          $('#commentBox').fadeOut();
      });
    };

    var self = this;
    viewer.Comments.showRemoveConfirmationDialog(function() {
      _deleteComment.apply(self);
    });
  };

  Comments.prototype.fetchComments = function(postData, callback) {
    if (postData.comments) {
      return callback();
    }

    $.get(erly.urlFor.collection(this._collection, 'comments', postData.id),
      function(data) {
        postData.comments = data;
        callback();
      },
      'json'
    );
  };

  Comments.showRemoveConfirmationDialog = function(confirmed) {
    erly.modal.showConfirm(
      'Delete comment',
      'Are you sure you want to delete this comment?',
      'Delete',
      confirmed,
      {type: 'remove'});
  };

  Comments.prototype.processComment = function(id, text) {
    var box = $('#commentBox'); // it's ok if this does not exist

    $.post(erly.urlFor.collection(viewer.collection, 'comments', id), {
      postId: id,
      text: $.trim(text),
      chronicleId: viewer.collection.id
    }, function(res) {
      if (res.success) {
        viewer.metadata.incrementMetadataCountBy('totalCommentCount', 1);

        // Also add it to the event details
        viewer.Details.instance.addComment(res.data);

        if (!box.length) {
          // Increment comment count and bail if this is from loginAction
          var singlePost = $('#post_' + id);
          if (singlePost && singlePost.tmplItem() && singlePost.data) {
            singlePost.tmplItem().data.commentCount += 1;
            _updateCommentIcon(singlePost);
          }
          return;
        }

        // NOTE: The server isn't able to get this easily, so we can fill
        //       in the postType here
        var data = box.tmplItem().data;
        res.data.postType = data.type;
        erly.track.commentCreate();

        box.find('textarea').val('');
        box.find('.comments-input').removeClass('show-button');
        var textarea = box.find('textarea:eq(0)');
        textarea.commentTextarea();

        // update the tmplItem directly
        data.comments.push(res.data);
        data.commentCount++;

        var container = box.find('.comments-container');
        if (container.text().indexOf('No comments yet') !== -1) {
          container.empty();
        }

        var newComment = $('#tmplComment').tmpl(res.data);
        container.animate({
          scrollTop: 0
        }, function() {
          newComment.find('.delete').click(_deleteCommentHandler);
          newComment.appendTo(container);
          newComment.css('opacity', 0.01);
          erly.shortenUrls(newComment.find('.message-text'), 18, true);
          viewer.Comments.instance.updateCommentIcons();

          box.find('.prettydate').prettyDate(
            erly.normalizeDate(res.data.serverNow));

          _placeBox();

          newComment.delay(100).animate({
            opacity: 1.0
          });
        });
      }
      else {
        Comments.handleCommentError(res);
      }
    });
  };

  Comments.prototype.showCommentBox = function(post) {
    var data = post.tmplItem().data;
    var self = this;

    if ($('#commentBox').length > 0) {
      this.updateCommentIcons();

      $('#commentBox').fadeOut(function() {
        $('#commentBox').remove();
      });

      if (this._currentCommentBoxPostId === data.id) {
        this._currentCommentBoxPostId = -1;
        return;
      }
    }

    this._currentCommentBoxPostId = data.id;
    if (!data.comments) {
      data.comments = [];
    }

    data.comments.sort(function(a, b) {
      return erly.normalizeDate(a.createdAt) - erly.normalizeDate(b.createdAt);
    });

    _.each(data.comments, function(d) {
      if (d.fromUserIdent) {
        d.fromLink = erly.urlFor.gallery({
          ident: d.fromUserIdent
        });
      }
    });

    var box = $('#tmplCommentBox').tmpl(data);
    box.find('.message-text').each(function() {
      erly.shortenUrls(this, 18, true);
    });
    $('body').append(box);

    var scrollBottom = function() {
      var container = box.find('.comments-container');
      container.scrollTop(container[0].scrollHeight);
    };

    var animatedScrollBottom = function(fun) {
      var container = box.find('.comments-container');

      container.animate({
        scrollTop: container[0].scrollHeight
      }, fun);
    };

    box.find('.prettydate').prettyDate(new Date());

    box.find('.remove').show().click(function() {
      box.detach();
      self.updateCommentIcons();
    });
    box.find('.delete').click(_deleteCommentHandler);

    var postButton = box.find('.comments-input button');
    var textarea = box.find('textarea:eq(0)');

    textarea.commentTextarea({
      focusFunc: animatedScrollBottom,
      growFunc: _placeBox,
      submitFunc: function() {
        var text = textarea.val();
        if (!viewer.invite && !erly.session.requireLogin('comment',
            {text: text, type: 'post', id: data.id})) {
          return;
        }
        postButton.click();
      }
    });

    box.find('.comments-more a').click(function() {
      var more = box.find('.comments-rest .single-comment');
      var container = box.find('.comments-container');
      var last = container.find('.single-comment:last');

      container.prepend(more);

      $(this).parent().hide();

      _placeBox();
      // scroll back down to the bottom so that we can do the animation
      scrollBottom();

      container.animate({
        scrollTop: 0
      });

      return false;
    });

    postButton.click(function() {
      var box = $('#commentBox');
      var data = box.tmplItem().data;
      var payload = {
        id: data.id,
        type: 'post',
        text: $.trim(box.find('textarea').val())
      };
      if (!viewer.invite && !erly.session.requireLogin('comment', payload)) {
        return;
      }
      self.processComment(payload.id, payload.text);
    });

    _placeBox(600);
  };

  Comments.handleCommentError = function(res) {
    if (res.error && res.error.message.indexOf("doesn't exist") !== -1) {
      erly.modal.showAlert('Sorry',
        'This post has been deleted.  Please refresh your page.');
    }
    else if (res.error && /validate.*email/.test(res.error.message)) {
      erly.modal.showEmailVerificationAlert();
    }
    else {
      erly.modal.showAlert('Sorry', "We couldn't add that comment.");
    }
  };

  Comments.prototype.updateCommentIcons = function() {
    this._container.find('.post').each(function() {
      _updateCommentIcon($(this));
    });
  };

  erly.viewer.Comments = Comments;
}(erly.viewer));

/*!
 * Viewer Posts class
 */

(function(viewer) {
  var AVIARY_TOOLS = [
    // 'rotate',
    // 'flip',
    // 'resize',
    // 'crop',
    'redeye',
    'blemish',
    'colors',
    'saturation',
    'brightness',
    'contrast',
    'drawing',
    'text',
    'stickers',
    'whiten',
    'blur',
    'sharpen'
  ];

  var AVIARY_API_KEY = '25e651c10';
  var AVIARY_VERSION = 1;
  var AVIARY_LOAD_RETRY_LIMIT = 30;
  var AVIARY_LOAD_RETRY_INTERVAL = 1000;
  var AVIARY_LOAD_TIMEOUT = 1000 * 30;

  viewer.COVER_SET = 'erly.viewer.Posts.COVER_SET';
  viewer.Posts = function(collection, postData, comments, container) {
    var DOM = {
      template: "#tmplPost"
    };

    this._draggables = new erly.viewer.Draggables(collection, container);
    this._container = container;
    this._comments = comments;
    viewer.Posts.instance = this;

    var self = this;
    erly.events.subscribe(viewer.ROLE_CHANGED, function() {
      if (!viewer.collection.userRole.member) {
        self.hideActions();
      }
      else {
        self.showActions();
      }
    });

    container.append($$(DOM.template).tmpl(postData));
  };

  viewer.Posts.prototype.postCount = function() {
    return this._container.find('.post').length;
  };

  viewer.Posts.prototype.photoCount = function() {
    return this._container.find('.post .photo').length;
  };

  viewer.Posts.prototype.hideActions = function() {
    this._container.find('.corner-actions').removeClass('fade-in').hide();
    this._container.find('.left-corner-actions').removeClass('fade-in').hide();
  };

  viewer.Posts.prototype.showActions = function() {
    if (viewer.collection.userRole.member) {
      this._container.find('.corner-actions').addClass('fade-in');
      this._container.find('.left-corner-actions').addClass('fade-in');
    }
  };

  viewer.Posts.prototype.attachBehaviors = function(posts) {
    var self = this;
    // If posts is falsy, then try to attach to all posts in the container
    posts = posts || self._container;

    // Hide edit actions for existing posts if the user is not a member
    if (!viewer.collection.userRole.member) {
      self.hideActions();
    }

    var eachPost = posts.is(".post") ? posts : posts.find(".post");
    // erly.profiling.mark("initPost", "start");
    eachPost.hover(function() {
      var post = $(this);
      if (post.parents('.posts').hasClass('dragging')) return;

      post.addClass("should-fade-in");
      setTimeout(function() {
        if (post.hasClass("should-fade-in")) {
          post.find(".fade-in").fadeIn();
        }
        post.find('.play-overlay').animate({opacity: 1});
      }, 300);
    }, function() {
      var post = $(this);
      post.removeClass("should-fade-in");
      // NOTE: This should use:
      //     post.find(".fade-in").fadeOut();
      // but for some reason, it doesn't fade out .left-corner-actions, so
      // do it manually?
      post.find(".fade-in").stop(true, true).animate({
        opacity: 0
      }, function() {
        $(this).css('opacity', '');
        $(this).hide();
      });
      post.find('.play-overlay').animate({opacity: 0.7});
    });
    // erly.profiling.mark("initPost", "fades");

    // SETUP DETAILS
    eachPost.find(".note .enlarge-overlay").safeClick(function() {
      viewer.zoom($(this).parents('div.post'));
    });

    var playEmbed = function(post, delay) {
      var data = post.tmplItem().data;

      if (data.embed) {
        // Stick the autoplay querystring param on
        // REVIEW: Works for YouTube and Vimeo - will it work for others?
        var hasQuerystring = false;
        var embedstr = data.embed;
        if (embedstr.indexOf('autoplay') < 0) {
          embedstr = embedstr.replace(
              /(src|value)(=['"]http[^'"]+)(['"])/g,
              function(str, p1, p2, p3, offset, s) {
            var delimiter = '?';
            if (p2.indexOf('?') !== -1) {
              delimiter = '&';
            }

            return p1 + p2 + delimiter + 'autoplay=1&wmode=direct' + p3;
          });
          // Allow overlays on top of the player
          embedstr = embedstr.replace('</param>',
            '</param><param name="wmode" value="direct"></param>');
          embedstr = embedstr.replace('<embed',
            '<embed wmode="direct" ');
        }

        if (post.find('.embed-video').length === 0) {
          _.delay(function() {
            var container = post.find('>div').eq(0);

            var w = container.width(), h = container.height();

            var embedContainer = $('<div/>');
            embedContainer.css('text-align', 'center');
            embedContainer.width(w);
            embedContainer.height(h);
            embedContainer.addClass('embed-video');

            // Replace width/height in embed code
            embedstr = embedstr.
              replace(/width\s*=\s*[^\s>]+/g, 'width="' + w + '"').
              replace(/height\s*=\s*[^\s>]+/g, 'height="' + h + '"');
            var embed = $(embedstr);
            embed.width(w);
            embed.height(h);

            embedContainer.append(embed);
            container.prepend(embedContainer);

            // For flickr embeds, the object tag will have meaningless height
            // while the inner embed tag will have the proper height, so choose
            // the max of the two.
            var embedHeight = Math.max(
              embed.find('embed').height() || 0,
              embed.height());
            embedContainer.css('padding-top', Math.round(
              (embedContainer.height() - embedHeight) / 2));

            embedContainer.click(function(e) {
              e.preventDefault();
              return false;
            });

            var playOverlay = container.find('.play-overlay');
            var caption = container.find('.caption');
            var overlay = container.find('.overlay');
            playOverlay.hide();
            caption.hide();
            overlay.hide();

            erly.events.subscribeOnce(viewer.UNZOOMED, function() {
              container.find('.embed-video').remove();

              playOverlay.show();
              caption.show();
              overlay.show();
            });
          }, delay);
        }
      }
    };

    eachPost.find('.photo .play-overlay').safeClick(function(event) {
      var thisPost = $(this).parents('div.post');
      playEmbed(thisPost, 0);
    });

    eachPost.find('.photo .overlay').safeClick(function(event) {
      var thisPost = $(this).parents('div.post');
      viewer.zoom(thisPost);

      playEmbed(thisPost, 500);
    });
    // erly.profiling.mark("initPost", "details");

    // SETUP LINKS
    eachPost.find('.link a').safeClick(
      function() {
        var data = $(this).tmplItem().data;
        var href = $(this).attr('href');
        if (href.indexOf('javascript') === 0) {
          window.open(data.link);
        }
        else {
          window.open(href);
        }
      }
    );
    // erly.profiling.mark("initPost", "safeClick links");

    eachPost.find('.link .image-link').hover(
      function() {
        $(this).find('.link-overlay').fadeIn('fast');
      },
      function() {
        $(this).find('.link-overlay').fadeOut('fast');
      }
    );
    // erly.profiling.mark("initPost", "image-link hover");

    var _showLikesTooltip = function(postId) {
      return function() {
        var el = $(this);
        $.ajax({
          type: 'get',
          url: erly.urlFor.collection(viewer.collection, 'likes', postId),
          success: function(data) {
            if (data.length === 0 ||
                el.parent().find('.likes-tooltip').length > 0) { return; }

            var tip = $('<div class="likes-tooltip"></div>');
            el.after(tip);
            var text = $('<span></span>');
            tip.append(text);

            _.defer(function(){
              data = data.sort(function(a, b) {
                return a.fromUserId === erly.userId ? -1 :
                  b.fromUserId === erly.userId ? 1 :
                  a.fromName < b.fromName ? -1 :
                  a.fromName === b.fromName ? 0 : 1;
              });

              _(data).forEach(function(like, i) {
                var name = like.fromName;
                if (like.fromUserId === erly.userId) {
                  name = 'You';
                }
                if (i === data.length - 1 && i !== 0) {
                  text.append('and ');
                }

                text.append($('<a></a>').text(name).
                  attr('href', erly.urlFor.gallery(like)));

                if (i < data.length - 1) {
                  if (data.length > 2) {
                    text.append(', ');
                  }
                  else {
                    text.append(' ');
                  }
                }
              });
              text.append(' liked this');

              if (text.outerWidth() < tip.width()) {
                tip.width(text.outerWidth());
              }

              var offset = el.position();
              var dims = {height: el.height(), width: el.width()};
              tip.css({
                top: (offset.top - tip.outerHeight() - 4) + 'px',
                left: (offset.left - tip.width() + dims.width) + 'px'
              });
            });
          }
        });
      };
    };

    var _hideLikesTooltip = function() {
      $(this).parent().find('.likes-tooltip').remove();
    };

    eachPost.find('.like-count').each(function() {
      var data = $(this).parent().parent().tmplItem().data;
      $(this).mouseover(_showLikesTooltip(data.id));
    });

    $('body').mouseover(function(ev) {
      var target = $(ev.target);
      if (!target.is('.metadata') &&
          !target.parents('.metadata').length) {
        $('.likes-tooltip').remove();
      }
    });

    // SETUP LIKES
    var _liking = false;
    var processLike = function(id) {
      if (_liking) { return; }
      _liking = true;
      var post = $('#post_' + id);
      var data = post.tmplItem().data;
      var handleLikeCallError = function(res, action) {
        if (res.error && res.error.message.indexOf("doesn't exist") !== -1) {
          erly.modal.showAlert('Sorry',
            'This post has been deleted.  Please refresh your page.');
        }
        else if (res.error && /validate.*email/.test(res.error.message)) {
          erly.modal.showEmailVerificationAlert();
        }
        else {
          erly.modal.showAlert('Sorry',
            "We couldn't " + action + ' that like.');
        }
      };

      if (!data.isLiked) {
        // have not been liked yet by the user
        $.post(erly.urlFor.collection(erly.viewer.collection, 'likes',
            data.id), {
          postId: data.id,
          chronicleId: data.chronicleId
        }, function(res) {
          _liking = false;
          if (res.success) {
            $('.likes-tooltip').remove();
            data.likeCount = (data.likeCount || 0) + 1;
            data.isLiked = true;
            viewer.metadata.incrementMetadataCountBy('totalLikeCount', 1);
            self.updateLikeButtonForPost(post);
          }
          else {
            handleLikeCallError(res, 'add');
          }
        });
      }
      else {
        // already liked by the user, unlike
        $.post(erly.urlFor.collection(erly.viewer.collection,
            'unlike', data.id), {
          postId: data.id,
          chronicleId: data.chronicleId
        }, function(res) {
          _liking = false;
          if (res.success) {
            data.likeCount--;
            $('.likes-tooltip').remove();
            data.isLiked = false;
            viewer.metadata.incrementMetadataCountBy('totalLikeCount', -1);
            self.updateLikeButtonForPost(post);
          }
          else {
            handleLikeCallError(res, 'remove');
          }
        });
      }
    };

    if (!erly.viewer.exported) {
      eachPost.find('.like-count').safeClick(function() {
        var post = $(this).parent().parent();
        var data = post.tmplItem().data;
        var payload = {
          id: data.id,
          type: 'post'
        };
        if (!viewer.invite && !erly.session.requireLogin('like', payload)) {
          return;
        }
        processLike(data.id);
      });
    }

    // SETUP COMMENTS
    eachPost.find('.comment-count').safeClick(function() {
      var post = $(this).parent().parent();
      self._comments.fetchComments($(post).tmplItem().data, function() {
        self._comments.showCommentBox(post);
      });
    });

    // Setup loginAction handling
    erly.events.subscribe(viewer.LOGIN_ACTION, function(la) {
      if (!la) { return; }

      if (la.action === 'like' && la.data.type === 'post') {
        processLike(la.data.id);
      }
      else if (la.action === 'comment' && la.data.type === 'post') {
        self._comments.processComment(la.data.id, la.data.text);
      }
    });

    // SETUP LAYOUT HINTING
    eachPost.find('.expand').safeClick(function() {
      var data = $(this).tmplItem().data;
      var post = $(this).parents('.post');

      var updatePost = function(id, newLayout) {
        $.post(erly.urlFor.collection(viewer.collection, 'post', id, 'update'),
          {layoutHint: newLayout},
          function(data) {
            if (data.error) {
              erly.trackException(new Error(data.error),
                'viewer_posts.js@updatePost');
            }
          });
      };

      // Default to no hinting
      var newVal = '';
      if (post.hasClass('can-grow')) {
        // If there was no layoutHint, make it full
        if (data.layoutHint !== 'shrink') {
          newVal = 'full';
        }

        // If it wasn't already shrunk, force it to full
        if (!data.layoutHint && !post.hasClass('full')) {
          newVal = 'full';
        }
      }
      if (post.hasClass('can-shrink')) {
        // If there was no layoutHint, shrink it
        if (data.layoutHint !== 'full') {
          newVal = 'shrink';
        }

        // If it wasn't already full, force it to shrink
        if (!data.layoutHint && post.hasClass('full')) {
          newVal = 'shrink';
        }
      }

      var layoutGroup = $(this).parents('.posts').find(
        '.layout-group-' + post.data('layoutGroup')
      );
      data.layoutHint = newVal;
      updatePost(data.id, newVal);

      layoutGroup.each(function() {
        var peer = $(this);
        if (peer.attr('id') === post.attr('id')) {
          return;
        }

        var peerData = $(this).tmplItem().data;
        peerData.layoutHint = '';
        updatePost(peerData.id, '');
      });

      viewer.Carousel.instance.relayout(true);

      _.delay(function() {
        viewer.Carousel.instance.gotoPost(post);
      }, 600);
    });

    $('body').append('<script type="text/javascript" src="http://feather.aviary.com/js/feather.js"></script>');

    // SETUP EDIT
    eachPost.find('.edit, .photo-filter-container').safeClick(function() {
      var clickedElement = $(this);
      var data = $(this).tmplItem().data;
      var post = $(this).parent().parent();
      var template = $('#tmplEditModal').tmpl(data);
      var form = template.find('form');
      var aviaryImageUrl;

      if (!erly.viewer.collection.userRole.owner && erly.userId !== data.fromUserId) {
        erly.modal.showAlert("Sorry", "Only the owner of this post or this collection can edit this post.");
        return;
      }

      form.submit(function () {
        var newText = form.find('[name=text]').val();
        if (newText.length === 0 &&
          (data.type === 'note' || data.type === 'link')) {
          return false;
        }

        var postData = {};
        if (data.type === 'note') {
          postData.text = newText;
        }
        else if (data.type === 'photo') {
          postData.caption = newText;

          if (aviaryImageUrl) {
            if (!data.origUrlBeforeTransform) {
              postData.origUrlBeforeTransform = data.orig_url;
            }

            data.picture = aviaryImageUrl;
            postData.transformationImageUrl = aviaryImageUrl;
          }
        }
        else if (data.type === 'video') {
          postData.title = newText;
        }
        else if (data.type === 'link') {
          postData.text = newText;

          var newTitle = form.find('[name=title]').val();
          if (newTitle.length !== 0) {
            postData.title = newTitle;
          }
        }

        $.extend(data, postData);

        $.post(erly.urlFor.collection(viewer.collection, 'post', data.id, 'update'),
          postData, function() {
          erly.viewer.Carousel.instance.beginUpdate();
          post.removeClass('laidout');
          post.html($('#tmplPost').tmpl(data).html());
          self.attachBehaviors(post);
          erly.viewer.Carousel.instance.endUpdate();
        });

        erly.anchoredModal.close();
        erly.modal.close();
        return false;
      });

      template.find('.button-bar .cancel').click(function () {
        if (!$(this).hasClass('disabled')) {
          erly.anchoredModal.close();
          erly.modal.close();
        }
      });

      template.find('.button-bar .save').click(function() {
        if ($(this).hasClass('disabled')) {
          return false;
        }
      });

      var colorboxClose = $.colorbox.close;

      var innerWidth = 510;
      var marginWidth = 13;

      erly.modal.open({
        inline: true,
        scrolling: false,
        open: true,
        href: template,
        innerWidth: innerWidth + marginWidth * 2,
        onComplete: function() {
          var img = $("#modal .add-note .image img");

          if (img.length > 0) {
            $("#modal").hide();

            var croppedImageUrl;
            var hiResUrl = img.attr('src');

            var maxWidth = innerWidth;
            var maxHeight = $(window).height() - 300;

            img.parent().css({
              maxWidth: maxWidth,
              maxHeight: maxHeight
            });

            img.css({
              maxWidth: maxWidth,
              maxHeight: maxHeight
            });

            img.imagesLoadedTimeout(15000, function() {
              img.unbind('load');

              _.defer(function() {
                $("#modal").show();
                erly.modal.resize();

                var loader = $("#modal .add-note .image .loader");
                loader.css({
                  width: img.width(),
                  height: img.height()
                });
                var photoFilterLink = $("#modal .add-note .photo-filter-link");
                photoFilterLink.css({
                  width: img.width()
                });
              });
            });

            if (data.type === 'photo') {
              // start uploading to get a server-side cropped
              // image for aviary
              $.ajax({
                url: '/upload/generate-aviary-resized-image',
                type: 'POST',
                data: {
                  postId: data.id,
                  maxHeight: maxHeight,
                  maxWidth: maxWidth
                },
                success: function(data) {
                  if (data && data.imageUrl) {
                    croppedImageUrl = data.imageUrl;

                    // need to use publicly accessible images
                    if (erly.__development) {
                      hiResUrl = 'http://c677127.r27.cf2.rackcdn.com/auto_9_12503_10367_f5013317-bfb1-484d-a6e0-bc8e26209af2.jpg';
                      croppedImageUrl = 'http://api.dosx.io/upload/cached/1659452b9af64a569f8aa8c240f17664_hires-aviary-crop.jpg';
                    }
                  }
                }
              });

              template.find(
                'div.photo-filter-link a'
              ).click(function(e) {
                var loader = template.find('div.loader');
                loader.show();

                e.preventDefault();

                var startAviaryLoadTime = new Date();

                // wait until we get the cropped image back
                // and for aviary script to fully load
                var interval = setInterval(function() {
                  if (new Date() - startAviaryLoadTime > AVIARY_LOAD_TIMEOUT) {
                    loader.hide();
                    clearInterval(interval);
                    erly.modal.showAlert('Image Editor Unavailable', 'Sorry, we encountered ' +
                      'an error launching our image editor.  Please try ' +
                      'again later.');
                    return;
                  }

                  if (!croppedImageUrl) {
                    return;
                  }

                  if (typeof Aviary === 'undefined') {
                    return;
                  }

                  clearInterval(interval);

                  // disable all colorbox closing methods while
                  // aviary is open
                  $.colorbox.close = function() {};

                  var aviaryOptions = {
                    apiKey: AVIARY_API_KEY,
                    tools: AVIARY_TOOLS,
                    apiVersion: AVIARY_VERSION,
                    hiresUrl: hiResUrl,
                    openType: 'float',
                    theme: 'black',
                    postUrl: erly.BASE_URL + '/aviary-postback',
                    url: croppedImageUrl
                  };

                  var aviaryEditor = new Aviary.Feather(aviaryOptions);

                  img.unbind('load');
                  img.imagesLoadedTimeout(30000, function() {
                    img.unbind('load');

                    // for some reason aviary doesn't seem to launch
                    // on first click.  setting this timeout seems to
                    // do the trick
                    setTimeout(function() {
                      var launchOptions = {
                        image: img[0],
                        onReady: function() {
                          $('.close-modal').hide();
                          $('.button-bar input').addClass('disabled');
                          $('.photo-filter-link .photo-filter-link-container').hide();
                          loader.hide();

                          // Show Aviary controls on the left side of the time
                          var aviaryControls = $('#avpw_controls');
                          aviaryControls.css('left',
                            $("#colorbox").offset().left -
                            aviaryControls.outerWidth(true));
                          // HACK: Make this work with Aviary's fadeIn effect
                          _.defer(function() {
                            aviaryControls.stop(true, true).css('opacity', 1);
                          });
                        },
                        onClose: function() {
                          $.colorbox.close = colorboxClose;

                          $('.close-modal').show();
                          $('.photo-filter-link .photo-filter-link-container').show();
                          $('.button-bar input').removeClass('disabled');

                          $('#avpw_controls').css('opacity', '');
                        },
                        onSave: function(imageId, newUrl, newHighResUrl) {
                          if (!newHighResUrl || newHighResUrl.length <= 0) {
                            throw new Error('No high res image returned by Aviary!');
                          }

                          var highResImageFetches = 0;

                          aviaryImageUrl = newHighResUrl;

                          img.load(function() {
                            img.unbind('load');
                            img.unbind('error');

                            aviaryEditor.close();
                          });

                          img.error(function() {
                            highResImageFetches++;

                            if (highResImageFetches > AVIARY_LOAD_RETRY_LIMIT) {
                              img.unbind('load');
                              img.unbind('error');

                              img.attr('src', newUrl);
                              aviaryEditor.close();
                              return;
                            }

                            setTimeout(function() {
                              img.attr('src', newHighResUrl);
                            }, AVIARY_LOAD_RETRY_INTERVAL);
                          });

                          img.attr('src', newHighResUrl);
                        },
                        onError: function(e) {
                          throw new Error(e);
                        }
                      };

                      aviaryEditor.launch(launchOptions);
                    }, 300);
                  });

                  img.attr('src', croppedImageUrl);
                }, 100);
              });

              if (clickedElement.is('.photo-filter-container')) {
                template.find('div.photo-filter-link a').click();
              }
            }
          }
        }
      });
    });

    // SETUP REMOVE
    eachPost.find('.remove').safeClick(function() {
      var post = $(this).parents('.post');
      var data = post.tmplItem().data;
      if (!erly.viewer.collection.userRole.owner && erly.userId !== data.fromUserId) {
        erly.modal.showAlert(
          'Sorry',
          'Only the owner of this post or this collection can remove this ' +
          'post.');
        return;
      }

      var handleRemoveAll = function() {
        self.removeAllPostsByUser(data, function() {
          erly.modal.close();
        });
      };

      self.removePost(post, data);
    });

    eachPost.find('.drag-handle').hover(function() {
      var post = $(this).parents('.post');
      if (!erly.oldIE) {
        post.addClass('shadow-wide');
        post.css('z-index', 1);
      }
      self._draggables.setupDraggable(post);
    }, function() {
      if (!erly.oldIE) {
        var post = $(this).parents('.post');
        post.removeClass('shadow-wide');
        post.css('z-index', '');
      }
    });
  };

  var _removePostFromUI = function(id) {
    var post = typeof id === 'number' ? $('#post_' + id) : $(id);
    if (!post || post.length === 0) { return; }

    var photo = post.tmplItem().data;
    var source = photo.source;
    var photoId;
    if (photo.facebookIds) {
      photoId = photo.facebookIds.id;
    }
    else if (photo.photoIds) {
      photoId = photo.photoIds;
    }
    if (source && photoId) {
      delete erly.viewer.existIds[source + photoId];
    }
    post.remove();
  };

  var _relayoutAfterPostRemoval = function() {
    erly.viewer.Carousel.instance.relayout(true);
    erly.viewer.Tease.instance.update();
    erly.viewer.metadata.refresh();
  };

  viewer.Posts.prototype.removePostsForUser = function(userId) {
    var removeIds = [];
    this._container.find('.post').each(function() {
      var post = $(this).tmplItem().data;
      if (post.fromUserId === userId) {
        removeIds.push(post.id);
      }
    });
    _(removeIds).forEach(_removePostFromUI);
    _relayoutAfterPostRemoval();
  };

  viewer.Posts.prototype.removeAllPostsByUser = function(data, callback) {
    var errorMessage =
      "Sorry, we couldn't remove these posts. Please try again later.";
    $.ajax({
      type: 'post',
      url: erly.urlFor.collection(
        erly.viewer.collection, 'remove_posts_by', data.fromUserId),
      success: function(data) {
        if (data.success) {
          _(data.removedPostIds).forEach(_removePostFromUI);
          _relayoutAfterPostRemoval();
        }
        else {
          erly.modal.showAlert('Sorry', errorMessage);
        }
        if (typeof callback === 'function') {
          callback();
        }
      },
      error: function() {
        erly.modal.showAlert('Sorry', errorMessage);
      }
    });
  };

  viewer.Posts.prototype.removePost = function(post, data, callback) {
    $(post).fadeOut(function() {
      var postData = post.tmplItem().data;
      var previousPostData = post.prev().tmplItem().data;
      viewer.addUndo('Restore the last removed ' + postData.type, function() {
        var target = $('#post_' + previousPostData.id);
        if (target.length === 0) {
          // HACK: Set the target to flasher to make it the first post
          target = $('#flasher');
        }
        viewer.Carousel.instance.addPost(postData, target);
      }, function() {
        $.ajax({
          type: 'post',
          url: erly.urlFor.collection(
            erly.viewer.collection, 'post', data.id, 'delete'),
          success: function(data) {
            if (data.success) {
            }
            if (typeof callback === 'function') {
              callback();
            }
          },
          error: function() {
            // Seems like innocuous errors are thrown here, so just ignore
          }
        });
      });

      _removePostFromUI(post);
      _relayoutAfterPostRemoval();
      erly.viewer.refreshShareContainer();
    });
  };

  viewer.Posts.prototype.updateLikeButtonForPost = function(post) {
    var data = post.tmplItem().data;
    var likeSpan = post.find(".like-count").find("span");
    likeSpan.text(data.likeCount);
    likeSpan.removeClass("is-liked has-likes");
    if (data.isLiked) {
      likeSpan.addClass("is-liked");
    }
    else {
      if (data.likeCount > 0) {
        likeSpan.addClass("has-likes");
      }
    }
  };

}(erly.viewer));

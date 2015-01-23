/*!
 * Viewer details class
 */
(function(viewer) {
  var _refreshActivityUnseenCount = function() {
    if (!erly.session.isAuthenticated()) return;
    var url = erly.urlFor.collection(viewer.collection,
      'activities', 'unseen_count');
    $.get(url, function(data) {
      viewer.updateDetailsTeaseCount(data.count);
    });
  };

  var Details = function(container, options) {
    var self = this;
    viewer.Details.instance = self;
    var _commentsOnly = false;
    var _activityOffset = 0;
    var _activityHasMore = false;
    var ACTIVITY_LOAD_LIMIT = 100;

    var _injectActivities = function(items, activities) {
      // Merge and sort
      items = _(items).concat(activities || []).sort(function(a, b) {
        return (b.dateAddedAt || b.createdAt) - (a.dateAddedAt || a.createdAt);
      });

      // Filter items that we shouldn't show
      items = _(items).filter(function(story) {
        return !story.loaderObject && story.objectType !== 'comment';
      });

      // Insert a "loader object" after the oldest activity, but only if we
      // have more items to load
      if (_activityHasMore) {
        var minActivityTime = null;
        var minActivityIndex = null;
        _(items).forEach(function(story, i) {
          if (story.dateAddedAt && (!minActivityTime ||
              minActivityTime > story.dateAddedAt)) {
            minActivityTime = story.dateAddedAt;
            minActivityIndex = i;
          }
        });
        if (minActivityIndex) {
          items.splice(minActivityIndex + 1, 0, {loaderObject: true});
        }
      }

      return items;
    };

    var DOM = {
      attendance: '#attendance',
      detailsTitle: '#detailsTitle',
      discussion: '#discussion',
      eventInfo: '#eventInfo',
      infoContainer: '#infoContainer',
      headerContainer: '#headerContainer',
      rsvp: '#rsvp'
    };

    var TEMPLATES = {
      comment: '#tmplCommentFeedItem',
      eventInfo: '#tmplDetailsEventInfo',
      discussion: '#tmplDetailsDiscussion',
      leftDate: '#tmplDetailsLeftDate',
      rsvp: '#tmplDetailsRsvp',
      titleLocation: '#tmplDetailsTitleLocation',
      albumHeader: '#tmplDetailsAlbumHeader'
    };

    var _commentData;
    var _container = container;
    var _internalChange;

    // Array of tags or invites for this event.
    var _tagData;

    // "Tag" for the current user; this might be an "invite" if the user is
    // not an erly user, or a "tag" if it is. It is also set to an "invite"
    // if an anonymous user made an RSVP.
    var _userTag;

    var getBaseRsvp = function(opt_rsvpReply) {
      var postData = {};
      if (opt_rsvpReply) {
        postData.rsvpState = opt_rsvpReply;
      }
      return postData;
    };

    function getTagProperty(tag, property, defaultValue) {
      return tag && tag.hasOwnProperty(property) ?
        tag[property] :
        tag && tag.taggingInfo && tag.taggingInfo.hasOwnProperty(property) ?
        tag.taggingInfo[property] :
        defaultValue;
    }

    function getRsvpState(tag) {
      return getTagProperty(tag, 'rsvpState', 'pending');
    }

    function getGuestCount(tag) {
      return getTagProperty(tag, 'guestCount', 0);
    }

    function getLastViewTime(tag) {
      return getTagProperty(tag, 'lastViewTime', null);
    }

    var scrollToTop = function() {
      var scrollSelector = ($.browser.mozilla || $.browser.msie) ?
        'html' : 'body';
      $(scrollSelector).animate({scrollTop: 0});
    };

    this.refreshPhotos = function(initialRefresh) {
      var photos = viewer.Carousel.instance.getPostData();
      // TODO(eden): figure out if there's a better event we can hook
      if (initialRefresh && photos.length === 0) {
        setTimeout(_(this.refreshPhotos).bind(this), 1000);
        return;
      }

      var maxPhotos = 32;
      if (erly.browserSupport.detect().name === 'iPad') {
        maxPhotos = 10;
      }

      var originalCount = photos.length;
      photos = _(photos).filter(function(post) {
        return post.type === 'photo';
      }).slice(0, maxPhotos);
      photos.push({showMore: true, count: originalCount});
      $(DOM.detailsTitle).find('.photos').
        html($('#tmplAlbumTitlePhotos').tmpl(photos));
      _.defer(function() {
        // Render images
        $(DOM.detailsTitle).find('.photos .photo img').each(function() {
          var image = $(this);
          image.css('opacity', 0.01);
          image.attr('src', image.data('lazy-src'));
          image.addClass('lazy-loaded');
          image.removeClass('lazy-load');
          erly.centerImage(image, null, null, {
            noCanvas: true,
            skipFaces: true
          });
        });
        // add click-behavior
        $(DOM.detailsTitle).find('.photos .photo').unbind('click').click(
        function() {
          var im = $(this).tmplItem().data;
          viewer.gotoPost(im.id);
        });
        $(DOM.detailsTitle).find('.photos .show-more').unbind('click').click(
        function() {
          viewer.toggleCarousel();
        });
      });
    };

    this.updateMetadata = function(data) {
      if (data.isAlbum) {
        $$(DOM.detailsTitle).html($$(TEMPLATES.albumHeader).tmpl(data));
        $$(DOM.eventInfo).hide();
        this.refreshPhotos();

        $$('#detailsBackground').removeClass('album');
        if (viewer.collection.pastEvent) {
          $$('#detailsBackground').addClass('album');
        }
      }
      else {
        $$(DOM.detailsTitle).html($$(TEMPLATES.titleLocation).tmpl(data));
        if ($.trim(data.description)) {
          $$(DOM.eventInfo).html($$(TEMPLATES.eventInfo).tmpl(data));
          $$(DOM.eventInfo).show();
        }
        else {
          $$(DOM.eventInfo).hide();
        }
      }

      if (viewer.collection.userRole.owner) {
        $('#detailsTitle .edit').show().click(function(e) {
          if (e.which > 1) {
            return;
          }
          if (erly.viewer.isCarouselShowing()) {
            erly.viewer.toggleCarousel();
          } else {
            erly.eventForm.showModal(erly.viewer.collection);
          }
        });
      }
    };

    var renderActivityAndCommentDetails = function() {
      // skip everything after the loader object
      var sawLoader = false;
      var comments = _(_commentData).reduce(function(data, item) {
        if (sawLoader) return data;
        if (!_commentsOnly || !item.dateAddedAt) data.push(item);
        sawLoader = Boolean(item.loaderObject);
        return data;
      }, []);
      comments = $$(TEMPLATES.comment).tmpl(comments, {
        linkToChronicle: function(story, id, comments) {
          if (id) {
            return ['javascript',
              'erly.viewer.gotoPost(' +
                JSON.stringify(id) + ', true, ' +
                JSON.stringify(comments) + ')'
            ].join(':');
          }
          return ['javascript', 'void(0)'].join(':');
        },
        collectionFeed: true
      });
      var empty = $$(DOM.discussion).find('.comments-empty-image');
      if (comments.length === 0) {
        empty.show();
      }
      else {
        empty.hide();
      }

      $$(DOM.discussion).find('.comments').html(comments);
      $$(DOM.discussion).find('.comments .delete').click(function(e) {
        if (e.which > 1) {
          return;
        }

        var comment = $(this).parents('.comment-feed-item');
        var data = comment.tmplItem().data;
        $.ajax({
          type: 'post',
          url: erly.urlFor.collection(viewer.collection, 'comment', data.id,
            'delete')
        });

        _.each(_commentData, function(comment, i) {
          if (comment.id === data.id) {
            _commentData.splice(i, 1);
          }
        });

        comment.fadeOut(function() {
          comment.remove();

          if ($$(DOM.discussion).find('.comments').children().length === 0) {
            empty.show();
          }
        });
      });

      $$(DOM.discussion).find('.post-comment-link').click(function(e) {
        if (e.which > 1) {
          return false;
        }

        var postId = parseInt($(this).data('post-id'), 10);

        if (postId) {
          viewer.toggleCarousel();
          _.delay(function() {
            viewer.Carousel.instance.gotoPost(postId, {
              flash: true
            });
          }, 600);
        }
      });

      erly.events.fire(erly.events.DETAIL_COMMENTS_LOADED);

      viewer.fitDetails();
    };

    var updateComments = function(refreshData) {
      if (refreshData) {
        async.parallel({
          comments: function(callback) {
            $.ajax({
              url: erly.urlFor.collection(viewer.collection, 'comments'),
              success: function(data) {
                callback(null, data.sort(function(a, b) {
                  return erly.normalizeDate(b.createdAt).getTime() -
                    erly.normalizeDate(a.createdAt).getTime();
                }));
              }
            });
          },
          activities: function(callback) {
            _activityOffset = 0;
            _activityHasMore = true;
            viewer.enableMarkingActivitiesSeen();
            self.loadActivities(callback);
          }
        }, function(err, data) {
          _commentData = _injectActivities(
            data.comments || [], data.activities || []);
          renderActivityAndCommentDetails();
        });
      }
      else {
        renderActivityAndCommentDetails();
      }
    };

    erly.events.subscribe(viewer.ROLE_CHANGED, function() {
      updateComments(true);
    });

    var _loadingActivities = false;
    this.loadActivities = function(callback) {
      var returnEmptyActivityFeed = function() {
        // ignore errors as the collection having no activities
        _activityOffset = 0;
        _activityHasMore = false;
        callback(null, []);
        _loadingActivities = false;
      };
      if (!_activityHasMore) return callback(true);
      if (_loadingActivities) return callback(true);
      if (!erly.session.isAuthenticated()) return returnEmptyActivityFeed();
      _loadingActivities = true;
      $.ajax({
        type: 'get',
        url: [
          erly.urlFor.collection(viewer.collection, 'activities'),
          $.param({offset: _activityOffset, limit: ACTIVITY_LOAD_LIMIT})
        ].join('?'),
        success: function(data) {
          _activityOffset = data.nextOffset;
          _activityHasMore = (data.activities || []).length > 0;
          data = erly.activity.condenseStories(data.activities, true);
          callback(null, data);
          _loadingActivities = false;
        },
        error: returnEmptyActivityFeed
      });
    };

    this.loadNextActivityPage = function() {
      self.loadActivities(function(err, data) {
        if (!err) {
          _commentData = _injectActivities(_commentData, data);
          renderActivityAndCommentDetails();
        }
      });
    };


    this.addComment = function(commentData) {
      _commentData.unshift(commentData);
      updateComments();
    };

    // Declare some functions.
    var updateAttendance, processRsvpClick, renderRsvp;

    // Update attendance data, and update the last view time for this user.
    var updateAttendanceData = function(data, render, defaultState) {
      _tagData = data;

      _tagData.sort(function(a, b) {
        if (a.isOwner) {
          return -1;
        }

        if (b.isOwner) {
          return 1;
        }

        return a.name.toLowerCase() > b.name.toLowerCase() ? 1 :
          b.name.toLowerCase() > a.name.toLowerCase() ? -1 : 0;
      });
      var authId = erly.userId || (viewer.invite || {}).id;
      _userTag = _.filter(_tagData, function(tag) {
        return tag.id === authId;
      })[0];

      // Update the last view time for the tag
      if (_userTag) {
        $(DOM.rsvp).find('not-you').text('Not ' + _userTag.name + '?');
        if (!viewer.invite && _userTag.isInvite) {
          viewer.invite = _userTag;
        }
        var postData = getBaseRsvp();
        postData.lastViewTime = 'server_date';

        $.ajax({
          type: 'POST',
          data: postData,
          url: erly.urlFor.collection(viewer.collection, 'rsvp')
        });
      }

      var attendees = _.filter(_tagData, function(t) {
        return getRsvpState(t) === 'yes';
      });
      viewer.attendeeCount = _.reduce(attendees, function(memo, t) {
        return memo + 1 + getGuestCount(t);
      }, 0);

      var rsvpState = getRsvpState(_userTag);
      viewer.rsvpd =  rsvpState && (rsvpState !== 'pending');
      _internalChange = true;
      try {
        viewer.refreshMetadata();
      }
      finally {
        _internalChange = false;
      }

      if (render) {
        updateAttendance(false, defaultState);
      }
    };

    var fetchAttendance = function(callback) {
      $.ajax({
        url: erly.urlFor.collection(viewer.collection, 'tags'),
        success: function(data) {
          updateAttendanceData(data);
          callback(data);
        }
      });
    };

    this.handleWasThere = function() {
      if (!erly.session.requireLogin('wasThere',
          {id: erly.viewer.collection.id})) {
        return;
      }

      $.post(erly.urlFor.collection(viewer.collection, 'checkin'), {
        wasThere: true
      }, function(data) {
        viewer.collection.userRole.member = true;
        viewer.collection.userRole.attendee = true;

        if (data.success) {
          erly.events.fire(viewer.ROLE_CHANGED);
          updateAttendance(true);
        }
        else if (data.error && data.error.message) {
          if (/validate your email address/.test(data.error.message)) {
            erly.modal.showEmailVerificationAlert();
          }
          else {
            erly.modal.showAlert('Error', data.error.message);
          }
        }
      });
    };

    updateAttendance = function(refreshData, defaultState, callback) {
      var render = function() {
        if (viewer.collection.pastEvent && viewer.collection.guestListHidden) {
          if (viewer.collection.userRole.owner) {
            $('#details').addClass('guest-list-owner-only');
          } else {
            $('#details').addClass('guest-list-gone');
            return;
          }
        } else {
          $('#details').removeClass('guest-list-gone');
          $('#details').removeClass('guest-list-owner-only');
        }

        if (!_tagData || _tagData.length === 0) {
          $$(DOM.attendance).hide();
          return;
        }

        var attendanceHtml;
        if (viewer.collection.isAlbum) {
          // Album: there is no "RSVP state" for each tag, we just display
          // every tag as a contributor.
          attendanceHtml = $$('#tmplDetailsAttendanceAlbum').tmpl({
            tags: _tagData
          });
        } else {
          // Build mapping of each RSVP state to an array of tags for that
          // state, since we display them separately.
          var rsvps = {};
          rsvps.yes = [];
          rsvps.maybe = [];
          rsvps.no = [];
          rsvps.pending = [];
          rsvps.userTagRsvpState = getRsvpState(_userTag);

          // Separate the tags into different states
          _.each(_tagData, function(tag) {
            if (tag.isInvite && !tag.picture && !tag.facebookId) {
              tag.picture = erly.choose(erly.STOCK_AVATARS);
            }

            var rsvpState = getRsvpState(tag);
            if (rsvps[rsvpState]) {
              rsvps[rsvpState].push(tag);
            }
            else {
              rsvps.pending.push(tag);
            }
            rsvps[rsvpState + 'Count'] =
              (rsvps[rsvpState + 'Count'] || 0) + 1 + getGuestCount(tag);
          });
          attendanceHtml = $$('#tmplDetailsAttendanceEvent').tmpl(rsvps);
        }

        $$(DOM.attendance).show();
        $$(DOM.attendance).html(attendanceHtml);

        $$(DOM.attendance).find('.invite-more a').
          add($$(DOM.attendance).find('.add-contributors-blurb a')).click(
          function(e) {
          if (e.which > 1) {
            return;
          }

          viewer.invites.showInvitePanel(viewer.collection, false, true);
        });

        var animationSpeed = 0;
        $$(DOM.attendance).find('.label').click(function(e) {
          if (e.which > 1) {
            return;
          }

          var rsvpList = $(this).next('.rsvp-list');
          if (rsvpList.hasClass('showing')) {
            rsvpList.removeClass('showing').slideUp(animationSpeed);
          }
          else {
            rsvpList.addClass('showing').slideDown(animationSpeed);
          }
        });

        if (defaultState) {
          $$(DOM.attendance).find(
            '.label.' + defaultState + '-attending'
          ).click();
        }
        else {
          $$(DOM.attendance).find('.label').eq(0).click();
        }
        animationSpeed = 200;

        $$(DOM.attendance).find('.edit-rsvp').click(function(e) {
          if (e.which > 1) {
            return;
          }

          var guestData = $(this).tmplItem().data;
          erly.modal.open({
            html: $$('#tmplEditRsvpDialog').tmpl(guestData),
            onComplete: function() {
              var modal = $('.edit-rsvp-dialog');
              var response = getRsvpState(guestData);
              var guestCount = getGuestCount(guestData);

              var popup = modal.find('.popup');

              modal.find('.label').hover(function() {
                popup.stop(true, true).delay(100).fadeIn();
              }, function() {
                popup.stop(true, true).fadeOut();
              });

              var handleRsvpChange = function(newValue) {
                return function(e) {
                  if (e.which > 1) {
                    return;
                  }

                  response = newValue;
                  modal.find('b').text(response).removeClass(
                    ['yes', 'no', 'maybe', 'pending']
                  ).addClass(response);
                  popup.stop(true, true).fadeOut();

                  modal.find('.rsvp-actions').show();
                  if (response === 'no') {
                    modal.find('.rsvp-actions').hide();
                  }

                  erly.modal.resize({
                    width: modal.find('.response').outerWidth(true) +
                      modal.find('.change').outerWidth(true) + 40
                  });
                };
              };

              modal.find('.rsvp-option.yes').click(handleRsvpChange('yes'));
              modal.find('.rsvp-option.maybe').click(handleRsvpChange('maybe'));
              modal.find('.rsvp-option.no').click(handleRsvpChange('no'));

              modal.find('input[name="guestCount"]').spinner({
                min: 0,
                max: 100
              }).change(function() {
                guestCount = parseInt($(this).val(), 10);
              });

              modal.find('.cancel').click(function(e) {
                if (e.which > 1) {
                  return;
                }

                erly.modal.close();
              });

              modal.find('.submit').click(function(e) {
                if (e.which > 1) {
                  return;
                }

                $.ajax({
                  type: 'POST',
                  data: {
                    ownerEditRsvpId: guestData.id,
                    rsvpState: response,
                    guestCount: guestCount
                  },
                  success: function() {
                    erly.modal.close();
                    updateAttendance(true, response);
                  },
                  url: erly.urlFor.collection(viewer.collection, 'rsvp')
                });
              });
            }
          });
        });

        $$(DOM.attendance).find('.remove').click(function(e) {
          if (e.which > 1) {
            return;
          }

          var guestData = $(this).tmplItem().data;
          // If the owner is being removed, delete the collection
          if (!guestData.isInvite &&
              guestData.id === viewer.collection.owner.id) {
            erly.modal.showConfirm('Delete Event',
                'Removing the yourself from this Event will delete it ' +
                'because you are the owner.  ' +
                'Are you sure you want to delete "' +
                  viewer.collection.title + '"?',
                'Delete Event', function() {
              $.post(erly.urlFor.collection(viewer.collection, 'delete'), {},
                  function(data) {
                if (data.success) {
                  erly.redirectTo('/timeline');
                }
              });
            }, {type: 'remove'});
          }
          else {
            var guest = this;
            var message = 'Are you sure you want to remove "' +
              guestData.name + '"';

            var guestPosts = _.filter(viewer.Carousel.instance.getPostData(),
              function(p) {
                return p.fromUserId === guestData.id;
              });
            if (guestPosts.length > 0) {
              message += " and all of their posts";
            }

            message += "?";

            erly.modal.showConfirm(
              'Remove user',
              message,
              'Remove',
              function() {
                $.post(
                  erly.urlFor.collection(viewer.collection, 'untag'),
                  guestData,
                  function(data) {
                    if (!data.success) {
                      erly.modal.showAlert('Error',
                        'There was a problem while trying to remove ' +
                        'this guest.');
                    }
                    else {
                      viewer.removePostsForUser(guestData.id);
                      $(guest).parent().fadeOut(function() {
                        updateAttendance(true);
                        if (!guestData.isInvite &&
                            guestData.id === erly.userId) {
                          delete viewer.collection.userRole.member;
                          delete viewer.collection.userRole.attendee;
                          erly.events.fire(viewer.ROLE_CHANGED);
                        }
                      });
                    }
                  }
                );
              },
              {type: 'remove'}
            );
          }
        });

        if (!viewer.isRestricted() && getRsvpState(_userTag) !== 'yes') {
          var wasThereButton = $$(DOM.attendance).find('.was-there');
          wasThereButton.show();
          wasThereButton.click(function(e) {
            if (e.which > 1) {
              return;
            }

            self.handleWasThere();
          });

          erly.events.subscribe(viewer.LOGIN_ACTION, function(loginAction) {
            if (loginAction &&
                loginAction.action === 'wasThere' &&
                loginAction.data.id === viewer.collection.id) {
              wasThereButton.click();
            }
          });
        }
      };

      var complete = function() {
        updateComments(refreshData);
        render();
        if (typeof callback === 'function') { callback(); }
      };

      if (refreshData && !_.isArray(refreshData)) {
        fetchAttendance(complete);
      }
      else if (_.isArray(refreshData)) {
        _tagData = refreshData;
      }
      complete();
    };

    // Set a loginAction to do an RSVP, so when the page is reloaded it
    // will process the RSVP.
    var setRsvpLoginAction = function(rsvpReply) {
      erly.session.setLoginAction('rsvp', {
        reply: rsvpReply,
        collectionId: viewer.collection.id
      });
    };

    var processComment = function(text) {
      var textarea = $$(DOM.discussion).find('textarea');
      $.ajax({
        type: 'POST',
        url: erly.urlFor.collection(viewer.collection, 'comments'),
        data: {text: text},
        success: function(data) {
          if (data.success) {
            textarea.val('');
            textarea.commentTextarea();
            self.addComment(data.data);
          }
          else {
            viewer.Comments.handleCommentError(data);
          }
        }
      });
    };

    // Handle the loginAction when the page loads, which will process an
    // RSVP or comment if necessary.
    erly.events.subscribe(viewer.LOGIN_ACTION, function(la) {
      if (!la) { return; }

      if (la.action === 'rsvp' && la.data.reply &&
          la.data.collectionId === viewer.collection.id && erly.userId) {
        processRsvpClick(la.data.reply);
      }
      else if (la.action === 'comment' && la.data.type === 'collection' &&
          $.trim(la.data.text)) {
        processComment(la.data.text);
      }
    });

    var handleFacebookClick = function(form, rsvpReply) {
      if (!erly.session.facebookReady) { return; }

      // Set a login action, then sign up or log the user in. That will
      // cause the page to reload and we will then process the login action.
      setRsvpLoginAction(rsvpReply);
      erly.signup.handleFacebookClick(form);
    };

    var handleAnonymousFormSubmit = function(rsvpReply) {
      var rsvpForm = $$('.anonymous-rsvp-modal form#rsvp-name-form');
      var formHelper = new erly.FormHelper(rsvpForm);
      formHelper.clearErrors();
      erly.modal.resize();

      // If password is provided, process form like a signup form.
      // TODO(walt): we probably only want to set the loginAction if successful.
      if (rsvpForm.find('input[name=password]').val() !== '') {
        setRsvpLoginAction(rsvpReply);
        erly.signup.submit(rsvpForm, null);
        return;
      }

      // Process anonymous RSVP.
      if (!formHelper.validateCommon()) {
        erly.modal.resize();
        return;
      }

      // Record the RSVP with no user.
      var postData = getBaseRsvp(rsvpReply);
      postData.name = rsvpForm.find('input[name=name]').val();
      postData.email = rsvpForm.find('input[name=email]').val();

      $.ajax({
        type: 'POST',
        data: postData,
        url: erly.urlFor.collection(viewer.collection, 'rsvp'),
        success: function(data) {
          if (data.success) {
            // The server should have replied with a name/email cookie that
            // says who we are, which we use to pull out the invite from the
            // list of tags/invites.
            erly.session.parseNameEmailCookie();

            if (!viewer.invite && data.invite) {
              viewer.invite = data.invite;
            }
            // Update attendance and rsvp.
            updateAttendance(true, rsvpReply, function() {
              renderRsvp();
              erly.modal.close();
              if (!viewer.collection.userRole.member) {
                viewer.collection.userRole.member = true;
                erly.events.fire(viewer.ROLE_CHANGED);
              }
            });
          } else {
            formHelper.showError(
              data.error || 'There was an error, please try again.', null);
          }
        }
      });
    };

    var openAnonymousRsvpConfirmation = function(rsvpReply) {
      erly.modal.open({
        html: $$('#tmplAnonymousRsvpConfirmation').tmpl({
          response: rsvpReply,
          ownerName: viewer.collection.owner.name
        }),
        onComplete: function() {
          var modal = '.anonymous-rsvp-modal ';

          // Hook up facebook connect button.
          $$(modal + 'span.facebook-confirm').click(function(e) {
            handleFacebookClick(
              $$(modal + 'form#facebook-confirm-form'), rsvpReply);
          });

          // Hook up the manual form and form submission.
          var rsvpNameForm = $$(modal + '#rsvp-name-form');
          rsvpNameForm.find('button.confirm').click(
            function(e) { handleAnonymousFormSubmit(rsvpReply); });
          rsvpNameForm.find('input[type="text"]').
            focus(erly.enterTextField).blur(erly.leaveTextField);
          erly.enableWatermarks(rsvpNameForm);

          // Hook up login form submission.
          var rsvpLoginForm = $$(modal + '#rsvp-login-form');
          rsvpLoginForm.find('button.confirm').click(
            function(e) {
              erly.session.handleLoginForm(rsvpLoginForm, function() {
                // Set the loginAction before a successful login.
                setRsvpLoginAction(rsvpReply);
              });
            });
          rsvpLoginForm.find('input').
            focus(erly.enterTextField).blur(erly.leaveTextField);
          erly.enableWatermarks(rsvpLoginForm);

          // Hook up the log in and rsvp here links.
          var rsvpContainer = $$(modal + '#rsvp-name-form-container');
          var loginContainer = $$(modal + '#rsvp-login-form-container');
          rsvpContainer.find('a.login').click(function(e) {
            rsvpContainer.hide();
            loginContainer.show();
            erly.modal.resize();
          });
          loginContainer.find('a.login').click(function(e) {
            loginContainer.hide();
            rsvpContainer.show();
            erly.modal.resize();
          });
        }
      });
    };

    processRsvpClick = function(rsvpReply) {
      if (viewer.collection.userRole.owner) {
        // prevent owner from rsvpClicking
        return;
      }

      if (!_tagData) {
        setTimeout(_.bind(processRsvpClick, null, rsvpReply), 500);
        return;
      }

      if (!erly.userId && !viewer.invite && !_userTag) {
        openAnonymousRsvpConfirmation(rsvpReply);
        return;
      }

      var postData = getBaseRsvp(rsvpReply);
      $.ajax({
        type: 'POST',
        data: postData,
        url: erly.urlFor.collection(viewer.collection, 'rsvp'),
        success: function(data) {
          if (data.success) {
            if (_userTag) {
              _userTag.rsvpState = rsvpReply;
            }
            updateAttendance(true /* refresh data */, rsvpReply, renderRsvp);
          }
          // don't need to log errors again, the handler on the server side
          // will do it.
        }
      });
    };

    this.processRsvpClick = processRsvpClick;

    var bindAddEmailHooks = function() {
      var eventHasGuests = _tagData.length > 1; // 1 = owner
      var emailGuests = $$(DOM.rsvp).find('.email-guests');

      if (eventHasGuests) {
        var clickHandler = function(e) {
          if (e.which > 1) {
            return;
          }

          var rsvps = {
            yes: [],
            no: [],
            maybe: [],
            pending: []
          };

          _.each(_tagData, function(tag) {
            // skip the user sending the invite
            if (tag.vanityName &&  // it's a user, not an invite
                tag.id === erly.session.currentUser.id) {
              return;
            }
            var rsvpState = getRsvpState(tag);
            rsvps[rsvpState].push(tag);
          });

          viewer.invites.showEmailPanel(viewer.collection, rsvps);
        };

        emailGuests.show();
        emailGuests.unbind('click');
        emailGuests.click(clickHandler);
      } else {
        emailGuests.hide();
      }
    };

    var bindRsvpBehaviors = function() {
      var rsvpClick = function(rsvpReply) {
        return function(e) {
          if (e.which > 1) {
            return;
          }
          processRsvpClick(rsvpReply);
        };
      };

      $$(DOM.rsvp).find('.label').hover(function() {
        $$(DOM.rsvp).find('.popup').stop(true, true).delay(100).fadeIn();
      }, function() {
        $$(DOM.rsvp).find('.popup').stop(true, true).fadeOut();
      });

      $$(DOM.rsvp).find('.yes').click(rsvpClick('yes'));
      $$(DOM.rsvp).find('.maybe').click(rsvpClick('maybe'));
      $$(DOM.rsvp).find('.no').click(rsvpClick('no'));
      // $$(DOM.rsvp).find('.change a').click(rsvpClick('pending'));

      $$(DOM.rsvp).find('.add-guests, .invite-more').click(
        function(e) {
        if (e.which > 1) {
          return;
        }

        viewer.invites.showInvitePanel(viewer.collection, false, true);
      });

      if (_userTag) {
        $(DOM.rsvp).find('.not-you').click(function() {
          erly.session.clearInvite();
        }).text('Not ' + _userTag.name + '?');
      }
      else {
        $(DOM.rsvp).find('.not-you').hide();
      }

      erly.events.subscribe(erly.events.INVITES_ADDED, function() {
        bindAddEmailHooks();
      });

      bindAddEmailHooks();

      $$(DOM.rsvp).find('.add-calendar').click(function(e) {
        viewer.dialogs.showCalendarExportDialog();
      });

      $$(DOM.rsvp).find('.directions').click(function(e) {
        if (e.which > 1) {
          return;
        }

        window.open(erly.googleMapsLink(viewer.collection.streetAddress ||
            viewer.collection.locationName));
      });


      var guestCount = $$(DOM.rsvp).find('.action.guests input[type=text]');
      guestCount.spinner({
        min: 0,
        max: 100
      });
      var delayedPostHandle;
      var updateGuestCount = function() {
        var val = parseInt(guestCount.val(), 10) || 0;
        if (parseInt(val, 10) < 0) {
          guestCount.val(0);
          return;
        }

        if (delayedPostHandle) {
          clearTimeout(delayedPostHandle);
        }

        // Update UI immediately
        viewer.attendeeCount += (val - getGuestCount(_userTag));
        _internalChange = true;
        try {
          viewer.refreshMetadata();
        }
        finally {
          _internalChange = false;
        }

        if (_userTag.taggingInfo) {
          _userTag.taggingInfo.guestCount = val;
        }
        else {
          _userTag.guestCount = val;
        }

        updateAttendance(false, _userTag ? getRsvpState(_userTag) : null);

        var postData = getBaseRsvp();
        postData.guestCount = val;

        delayedPostHandle = setTimeout(function() {
          $.ajax({
            type: 'POST',
            data: postData,
            url: erly.urlFor.collection(viewer.collection, 'rsvp')
          });
        }, 500);
      };

      guestCount.change(updateGuestCount);
    };

    renderRsvp = function() {
      if (viewer.collection.pastEvent &&
          !viewer.collection.userRole.owner ||
          viewer.collection.isAlbum ||
          viewer.exported) {
        $$(DOM.rsvp).hide();
      }
      else {
        $$(DOM.rsvp).html($$(TEMPLATES.rsvp).tmpl({
          collection: viewer.collection,
          rsvpState: getRsvpState(_userTag),
          guestCount: getGuestCount(_userTag)
        })).show();
        bindRsvpBehaviors();
      }
    };

    self.refresh = function() {
      if (_internalChange) {
        return false;
      }

      fetchAttendance(function() {
        renderRsvp();
        updateAttendance();
      });

      $$(DOM.discussion).html(
        $$(TEMPLATES.discussion).tmpl(viewer.collection));
      $$(DOM.discussion).find('input[type=checkbox]').change(function() {
        _commentsOnly = !!$(this).attr('checked');
        updateComments();
      });

      _refreshActivityUnseenCount();
      self.refreshPhotos();

      var textarea = $$(DOM.discussion).find('textarea');
      textarea.focus(erly.enterTextField).blur(erly.leaveTextField);
      textarea.commentTextarea({
        submitFunc: function() {
          var text = container.find('textarea').val();
          if (!viewer.invite && !erly.session.requireLogin('comment',
              {text: text, type: 'collection'})) {
            return;
          }
          processComment(text);
        }
      });
      textarea.commentTextarea();
      self.updateMetadata(viewer.collection);
      updateComments(true);
    };

    self.getAttendanceData = function() {
      return _tagData;
    };

    self.updateAttendance = updateAttendance;
    self.updateAttendanceData = updateAttendanceData;

    $('.back-to-top').click(scrollToTop);
    $('#detailsFooter').find('img').click(scrollToTop);
  };

  viewer.Details = Details;

  // Return a string for display with the date/time range for the event.
  viewer.formatDateRangeForEvent = function(eventData) {
    if (!eventData || !eventData.startDate) {
      return '';
    }

    var s = '';
    var f = erly.dateFormatters;

    var start = eventData.hasOwnProperty('displayStartDate') ?
      eventData.displayStartDate :
      erly.util.getEventDisplayStartDate(eventData);
    var end = eventData.hasOwnProperty('displayEndDate') ?
      eventData.displayEndDate :
      erly.util.getEventDisplayEndDate(eventData);

    // If there is an end date, we use a shorter format.
    var sameDay = end && f.sameDay(start, end);
    var myFormatDate = end && !sameDay ?
      f.formatDateShortDayShortMonth : f.formatDate;

    if (!eventData.hasTime) {
      s += myFormatDate(start);
      if (end) {
        s += ' - ';
        s += myFormatDate(end);
      }
      return s;
    }

    s += myFormatDate(start);
    s += ', ' + f.formatAlarmClock(start);
    if (end) {
      s += ' - ';
      if (!sameDay) {
        s += myFormatDate(end) + ', ';
      }
      s += f.formatAlarmClock(end);
    }
    return s;
  };
}(erly.viewer));

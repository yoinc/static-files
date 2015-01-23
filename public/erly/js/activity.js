(function(erly) {
  // function references
  var activity = {};

  // module private variables
  var _fetching = false;
  var _nextOffsetSelf = 0;
  var _nextOffsetFriend = 0;
  var _limit = 100;
  var _user = null;
  var _maxtime = null;
  var _helper = null;

  var INFINITE_SCROLL_DELAY_INTERVAL = 3;
  var INFINITE_SCROLL_DELAY_MS = 5000;
  var _infiniteScrollCount = 1;
  var _delayingInfiniteScroll;

  // module private functions
  var _behaviorizeFeedItems = null;
  var _collateRsvpsViews = null;
  var _doInfiniteScroll = null;
  var _condenseStories = null;
  var _createKey = null;
  var _showEmptyActivities = null;
  var _showSparseActivities = null;

  // Helper object to handle differences between rendering the page inside
  // facebook canvas or not.
  var _nonFBHelper = {
    'enableInfScroll': function() {
      $(window).scroll(_doInfiniteScroll);
    },
    'disableInfScroll': function() {
      $(window).unbind('scroll', _doInfiniteScroll);
    },
    'getScrollTop': function() { return $(window).scrollTop(); },
    'getHeight': function() { return $(window).height(); },
    'anchorTarget': ''
  };

  // Facebook helper; constructor.
  var FBHelper = function() {
    this.tid_ = null;
    this.scrollTop_ = 0;
    this.clientHeight_ = -1;
  };

  // For now, we disable infinite scroll for facebook canvas. The commented
  // code works to enable it, but we need to poll for the scroll position due
  // to cross-domain issues, and every time we poll the browser displays an
  // annoying loading message.
  FBHelper.prototype.enableInfScroll = function() {};
  FBHelper.prototype.disableInfScroll = function() {};
/*
  FBHelper.prototype.enableInfScroll = function() {
    if (this.tid_ === null) {
      var self = this;
      this.tid_ = setInterval(function(){ self.checkScroll_(); }, 500);
    }
  };
  FBHelper.prototype.disableInfScroll = function() {
    if (this.tid_ !== null) {
      clearInterval(this.tid_);
    }
  };
  FBHelper.prototype.checkScroll_ = function() {
    var self = this;
    FB.Canvas.getPageInfo(function(info) {
      if (info.scrollTop !== self.scrollTop_ ||
          info.clientHeight !== self.clientHeight_) {
        self.scrollTop_ = info.scrollTop;
        self.clientHeight_ = info.clientHeight;
        _doInfiniteScroll();
      }
    });
  };
*/
  FBHelper.prototype.getScrollTop = function() { return this.scrollTop_; };
  FBHelper.prototype.getHeight = function() { return this.clientHeight_; };
  FBHelper.prototype.anchorTarget = 'target=_blank ';

  var _populateAndInitializeRightSideCollections = function(scope, data) {
    scope.append($('#tmplFriendCollection').tmpl(data));
    scope.find('.collection').hover(
      function() { $(this).find('.overlay').show(); },
      function() { $(this).find('.overlay').hide(); }
    );
    scope.find('.collection').click(function() {
      erly.redirectTo('collection', $(this).tmplItem().data);
    });
    scope.find('.collection .cover img').each(function() {
      erly.centerImage($(this), null, null, {noLoader: true});
    });
  };

  var _showFriendCollections = function() {
    $.ajax({
      url: '/friends/sidebar',
      success: function(data) {
        var noUpcoming = true;
        if (data.upcoming && data.upcoming.length > 0) {
          $('.friend-collections .header').show();
          _populateAndInitializeRightSideCollections(
            $('.friend-collections .friends .collections'), data.upcoming);
          noUpcoming = false;
        }
        if (data.recent && data.recent.length > 0) {
          $('.featured-collections .header').show();
          _populateAndInitializeRightSideCollections(
            $('.featured-collections .collections'), data.recent);
        } else {
          $('.featured-collections').hide();
          if (noUpcoming)
            $('.friend-collections .find-more-friends').css('border-top', 'none');
        }
      }
    });
  };

  /**
   * Update the top nav with current number of unseen updates
   */
  activity.setupHeader = _.once(function() {
    erly.session.ensureAuthenticated(function() {
      var user = erly.session.currentUser;
      var url = erly.urlFor.gallery(user, 'unseen_activity_count');
      if (erly.gallery.user && erly.gallery.user.lastActivitySeenTime) {
        url += '?lastActivitySeenTime=' +
          erly.normalizeDate(erly.gallery.user.lastActivitySeenTime).getTime();
      }
      $.get(url, function(data) {
        if (data.total > 0 && data.count > 0) {
          $('.nav-buttons .updates-button .count').text(data.count).show();
        }
      });
    });
  });

  // expects object with ident key
  activity.init = function(user) {
    _user = user;
    _helper = erly.facebookCanvas ? new FBHelper() : _nonFBHelper;

    // NOTE: We use erly.gallery.renderFriends, so we need to set
    //       this to make clicking on the friends' galleries work
    erly.gallery.user = user;

    var feed = $('#tmplActivityFeed').tmpl(user);
    feed.appendTo($('.activity-feed'));

    // show more
    _helper.enableInfScroll();

    $('.activity-header .fb-avatar').click(function() {
      window.location = erly.urlFor.gallery(erly.session.currentUser);
    });

    // initial fetch
    activity.fetchMoreItems(true);

    // Show Facebook button if required
    erly.session.ensureAuthenticated(function() {
      if (!erly.session.isFacebookConnected()) {
        var findMore = $('.find-more-friends');
        findMore.show();
        $('a.facebook-connect').click(function() {
          erly.session.facebookConnectToExistingAccount(function(err) {
            if (!err) {
              findMore.hide();
            }
          });
        });
      }
    });

    // Set up the timelines hover
    var timelineHeader = $('.featured-collections h2');
    var timelines = $('.featured-collections .friends-timelines');
    if (timelineHeader.length && timelines.length) {
      timelines.css({
        left: (timelineHeader.position().left + 10) + 'px',
        top: '50px'
      });
      timelineHeader.hoverUp(timelines, {
        setupFunc: function() {
          setTimeout(function() {erly.gallery.fetchFriends();}, 250);
        }
      });
    }

    erly.session.showEmailVerificationTopNotificationIfRequired();

    // Populate friend's collection list
    if (!erly.facebookCanvas) {
      _showFriendCollections();
    }
  };

  _behaviorizeFeedItems = function(feedItems) {
    feedItems.find('.post-content img').each(function() {
      erly.centerImage($(this), null, null, {noLoader: true});
    });

    feedItems.find('.collection-cover .title').each(function() {
      var title = $(this);
      title.css('top', 'auto').css('bottom', 'auto').css(
        'left', 'auto').css('right', 'auto');
      var collectionData = title.tmplItem().data.chronicle;
      if (collectionData.metadataPosition) {
        _(collectionData.metadataPosition).each(function(v, k) {
          title.css(k, v);
        });
      }
      else {
        title.css('top', '5%').css('left', '5%');
      }

      if (collectionData.metadataStyle) {
        erly.viewer.Metadata.applyStyle(title, collectionData.metadataStyle);
      }
      else {
        erly.viewer.Metadata.applyStyle(title,
          erly.viewer.DEFAULT_METADATA_STYLE);
      }

      erly.checkEllipsis(title.find('span'), 56, 28);
    });
  };

  _doInfiniteScroll = function() {
    if (_fetching || _delayingInfiniteScroll) {
      return;
    }

    var offset = $('div.activity-feed-items .loader').offset();
    if (offset.top < _helper.getScrollTop() + _helper.getHeight()) {
      var delay = 0;
      if (_infiniteScrollCount % INFINITE_SCROLL_DELAY_INTERVAL === 0) {
        delay = INFINITE_SCROLL_DELAY_MS;
        _delayingInfiniteScroll = true;
      }

      _(function() {
        _infiniteScrollCount++;
        _delayingInfiniteScroll = false;
        activity.fetchMoreItems();
      }).delay(delay);
    }
  };

  _showEmptyActivities = function() {
    $('.activity-feed-items').addClass('no-activities');
    $('.activity-feed-items').html(
      'There are no updates to share with you at this time.');
    $('.empty-activities-pane').show();
    $('.empty-line').show();
    $('.empty-activities-pane').find('.start-button').click(function(e) {
      if (e.which > 1) {
        return;
      }
      window.location = '/create_event';
    });
  };

  _showSparseActivities = function() {
    $('.empty-activities-pane').show();
    $('.empty-activities-pane').find('.start-button').click(function(e) {
      if (e.which > 1) {
        return;
      }
      window.location = '/create_event';
    });
  };
  activity.fetchMoreItems = function(initialFetch) {
    erly.debugLog('activity.fetchMoreItems');
    var loader = $('.activity-feed-items .loader');
    loader.show();

    _fetching = true;
    $.get(erly.urlFor.gallery(_user, 'feed'),
      {
        limit: _limit,
        offsetSelf: _nextOffsetSelf,
        offsetFriend: _nextOffsetFriend,
        maxtime: _maxtime
      },
      function(data) {
        // save offsets
        _nextOffsetSelf = data.nextOffsetSelf;
        _nextOffsetFriend = data.nextOffsetFriend;

        // add user's ident for self feed items
        _(data.feed).forEach(function(item) {
          if (!item.userIdent) {
            item.userIdent = _user.ident;
            item.userName = _user.name;
          }
          _maxtime = item.dateAddedAt;
        });
        // render activity feed items
        var feedItems = $('#tmplActivityFeedItem')
          .tmpl(_condenseStories(data.feed), {
            now: new Date(),
            linkToChronicle: function(story, id, comments) {
              if (story.chronicle) {
                story = story.chronicle;
              }
              else if (story.chronicleIdent) {
                story = {ident: story.chronicleIdent};
              }
              else {
                story = {ident: story};
              }
              var url = erly.urlFor.collection(story);
              if (typeof id !== 'undefined') {
                return [
                  url,
                  id + (comments ? '/comments' : '')
                ].join('#');
              }
              else {
                return url;
              }
            },
            ownId: _user.id,
            aTarget: _helper.anchorTarget
          });

        loader.before(feedItems);
        loader.hide();
        _fetching = false;

        _behaviorizeFeedItems(feedItems);
        // in case there is no activity at all
        if (data.prefilterCount === 0 && initialFetch === true) {
          _showEmptyActivities();
        }
        // decide on visibility of show more button
        if (data.prefilterCount === 0) {
          loader.remove();
          _helper.disableInfScroll();

          var $activityFeedItems = $('.activity-feed-item');
          if ($activityFeedItems.length === 0) {
            _showEmptyActivities();
          } else if ($activityFeedItems.length < 4 && $activityFeedItems.find('.collection-cover').length === 0) {
            _showSparseActivities();
          }
        }

        // decide to auto-fetch more
        if (data.prefilterCount === _limit && data.feed.length === 0) {
          activity.fetchMoreItems();
        }

        if (initialFetch) {
          // In case the first batch didn't cover the whole screen
          _doInfiniteScroll();
        }

        erly.events.fire(erly.events.PAGE_READY);
    }).error(function() {
      _fetching = false;
    });
  };

  var RSVP_COLLATION_PERIOD = 1000 * 60 * 15;
  /*
   * Removes view feed items that happen within RSVP_COLLECTION_PERIOD
   * milliseconds of a corresponding (same chronicle and user) RSVP feed item
   */
  _collateRsvpsViews = function(feed) {
    var rsvpKey = function(item) {
      return item.chronicleIdent + '|' + item.userId;
    };

    var getTime = function(item) {
      return erly.normalizeDate(item.dateAddedAt).getTime();
    };

    // Grab all rsvps and views from the feed
    var rsvps = {};
    var views = {};
    _(feed).each(function(item) {
      if (item.objectType === 'rsvpStateChanged') {
        rsvps[rsvpKey(item)] = item;
      }
      else if (item.objectType === 'eventPageView') {
        views[rsvpKey(item)] = item;
      }
    });

    var toFilter = {};
    _(rsvps).each(function(rsvp) {
      var key = rsvpKey(rsvp);
      var view = views[key];
      if (view &&
        Math.abs(getTime(rsvp) - getTime(view)) < RSVP_COLLATION_PERIOD) {
        toFilter[key] = view;
      }
    });

    return _(feed).filter(function(item) {
      return (item.objectType !== 'eventPageView') || !toFilter[rsvpKey(item)];
    });
  };

  _createKey = function(feedItem, aggressive) {
    var keyParts = [];
    if (feedItem.objectType !== 'tag' || !feedItem.userId) {
      keyParts.push(feedItem.userId || 'self');
    }
    keyParts.push(feedItem.objectType);
    keyParts.push(feedItem.chronicleId);
    if (feedItem.objectType === 'post') {
      // only condense photo posts, unless this is an aggressive condense
      if (feedItem.post.type === 'photo' || aggressive) {
        keyParts.push(feedItem.post.type);
      }
      else {
        keyParts.push(feedItem.post.id);
      }
    } else {
      var objectType = (feedItem.objectType === 'tag_multiple') ?
          'tag' : feedItem.objectType;
      keyParts.push(feedItem[feedItem.objectType].id);
    }
    return keyParts.join('_');
  };

  // condense stories by time:
  // by person and collection and type
  activity.condenseStories = _condenseStories = function(feed, aggressive) {
    var groupingInterval = 3*3600*1000; // 3 hours
    var condensedStories = [];
    var workingSet = {};
    var userLast = erly.gallery.user ?
      erly.normalizeDate(erly.gallery.user.lastActivitySeenTime) :
      null;
    feed = _collateRsvpsViews(feed);
    var lastItem;
    _(feed).forEach(function(item) {
      var key = _createKey(item, aggressive);

      var activeItem = workingSet[key];
      if (!activeItem ||
          activeItem.maxTime - erly.normalizeDate(item.dateAddedAt) >
            groupingInterval ||
          // Don't condense across a the last view time 'border'
          (userLast && lastItem &&
            erly.normalizeDate(item.dateAddedAt) < userLast &&
            erly.normalizeDate(lastItem.dateAddedAt) > userLast)) {
        if (activeItem) { // pop out a story from the working set
          condensedStories.push(activeItem);
        }
        workingSet[key] = {
          maxTime: erly.normalizeDate(item.dateAddedAt),
          stories: [item]
        };
      } else {
        // fits within this time interval.
        activeItem.stories.push(item);
      }
      lastItem = item;
    });
    // drain the working set into condensedStories
    _(_(workingSet).keys()).forEach(function(key) {
      condensedStories.push(workingSet[key]);
    });
    // sort condensedStories by maxTime
    condensedStories = condensedStories.sort(function(a, b) {
      return b.maxTime.getTime() - a.maxTime.getTime();
    });
    // massage stories a bit for presentation.
    condensedStories = _(condensedStories).map(function(cstory) {
      cstory.stories[0].count = cstory.stories.length;
      // custom condensation per objectType
      if (cstory.stories[0].objectType === 'post' &&
          (cstory.stories[0].post.type === 'photo' || aggressive)) {
        cstory.stories[0].allphotos = _(cstory.stories.slice(0, 3)).map(
            function(story) {
          return story.post;
        });
      } else if (cstory.stories[0].objectType === 'tag' &&
        cstory.stories[0].count > 1) {
        // multiple people being tagged, flip the story around
        cstory.stories[0].userIdent = cstory.stories[0].tag.ident;
        cstory.stories[0].userName = cstory.stories[0].tag.name;
        cstory.stories[0].userId = cstory.stories[0].tag.id;
        cstory.stories[0].objectType = 'tag_multiple';
      }
      return cstory.stories[0];
    });

    var samePostOrCollection = function(a, b) {
      return !a.postId && !b.postId ?
        a.chronicleId === b.chronicleId :
        a.chronicleId === b.chronicleId && a.postId === b.postId;
    };

    // Group similar likes together
    condensedStories = _(condensedStories).reduce(function(stories, story) {
      var last = stories.length ? stories[stories.length - 1] : null;
      if (last && story.like && last.like &&
          samePostOrCollection(story.like, last.like)) {
        last.users = last.users || [last];
        last.users.push(story);
      }
      else {
        stories.push(story);
      }
      return stories;
    }, []);

    // "Tag" the last left off story
    var lastStory;
    var lastStoryDate;
    _(condensedStories).each(function(story) {
      var storyDate = erly.normalizeDate(story.dateAddedAt);
      if (lastStoryDate && lastStoryDate > userLast &&
          storyDate < userLast) {
        lastStory.lastLeftOff = "You left off here on " +
            erly.dateFormatters.formatDateShortNoYear(userLast);
      }

      lastStory = story;
      lastStoryDate = storyDate;
    });


    return condensedStories;
  };

  erly.activity = activity;
}(erly));

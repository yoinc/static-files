/*!
 * Featured collections page
 */
(function(erly) {
  var featured = {};

  /** @const */
  var _loadItemsPerPage = 50;

  var _list = [];
  var _currentOffset = 0;
  var _continueLoading = true;
  var _loadingMore = false;

  var _currentLeft;
  var _maxLeft;
  var _minLeft;

  var _behaviorizeCollections = function() {
    _.defer(function() {
      erly.gallery.view.centerImages();
      erly.gallery.view.placeTitles();
      erly.gallery.bindCollectionBehaviors();
    });
  };

  var _resizeMasthead = function() {
    var scrollable = $('.masthead-scrollable');

    // Center the first item within the viewport
    var containerWidth = $('.featured-masthead').outerWidth();
    var itemWidth = parseInt(
      scrollable.find('.collection').first().outerWidth(), 10);

    _minLeft = -1 * scrollable.find('.collection').last().position().left;
    _maxLeft = parseInt((containerWidth - itemWidth) / 2, 10);

    var offset = scrollable.find('.collection').length % 2 === 0 ?
      0 : itemWidth;
    _currentLeft = (_minLeft - offset) / 2;
    _currentLeft += $(window).width() / 2;
    scrollable.css('left', _currentLeft + 'px');
  };

  var _behaviorizeMasthead = function() {
    var scrollable = $('.masthead-scrollable');

    $(window).resize(_resizeMasthead);
    _resizeMasthead();

    $('.arrow').click(_.throttleImmediate(function() {
      var itemWidth =
        parseInt(scrollable.find('.collection').first().outerWidth(), 10);
      if ($(this).hasClass('arrow-right') &&
          _currentLeft - itemWidth / 2 >= _minLeft) {
        _currentLeft -= itemWidth;
      }
      else if ($(this).hasClass('arrow-left') &&
          _currentLeft + itemWidth / 2 <= _maxLeft) {
        _currentLeft += itemWidth;
      }

      if ((_currentLeft - itemWidth / 2) <= _minLeft) {
        $('.arrow-right').hide();
        $('.arrow-left').show();
      }
      else if ((_currentLeft + itemWidth / 2) >= _maxLeft) {
        $('.arrow-left').hide();
        $('.arrow-right').show();
      }
      else {
        $('.arrow-right').show();
        $('.arrow-left').show();
      }

      scrollable.animate({left: _currentLeft}, 450);
    }, 500));
  };

  var _populateMasthead = function() {
    $.ajax({
      type: 'get',
      url: erly.urlFor.featured('masthead'),
      success: function(data) {
        data = data.sort(function() {
          return 0.5 - Math.random();
        });
        _(data).forEach(function(item) {
          item.excludeDate = true;
          item.extendedTitle = true;
          item.cssClass = 'center';
          erly.updateEventWithCalculatedFields(item);
        });
        try {
          $('.masthead-scrollable').append($('#tmplCollection').tmpl(data));
        }
        catch(e) {
          erly.trackException(e, 'featured.js@_populateMasthead');
        }
        _behaviorizeMasthead();
        _behaviorizeCollections();
      }
    });
  };

  var _populateList = function() {
    if (_loadingMore || !_continueLoading) { return; }
    _loadingMore = true;
    featured.fetch(_currentOffset, _loadItemsPerPage, function(data) {
      if (data.length === 0) {
        _continueLoading = false;
      }
      _(data).forEach(function(item) {
        item.excludeDate = true;
        item.cssClass = 'center';
      });
      try {
        $('.featured').append($('#tmplCollection').tmpl(data));
      }
      catch(e) {
        erly.trackException(e, 'featured.js@_populateMasthead');
      }
      _currentOffset += data.length;
      _loadingMore = false;
      _behaviorizeCollections();

      erly.events.fire(erly.events.PAGE_READY);
    });
  };

  /**
   * Returns a randomized list of featured items subject to the given
   * offset/limit.  This method may obtain more than requested from the
   * server in order to provide a fairly random list.
   */
  var _fetchedData = [];
  var _fetchedOffset = 0;
  var FETCH_LIMIT = 50;
  featured.fetch = function(offset, limit, callback) {
    $.ajax({
      type: 'get',
      url: erly.urlFor.featured('summary'),
      data: {offset: _fetchedOffset, limit: FETCH_LIMIT},
      success: function(data) {
        data = data.sort(function() {
          return 0.5 - Math.random();
        });
        _.each(data, erly.updateEventWithCalculatedFields);
        _fetchedData = _(_fetchedData).concat(data);
        _fetchedOffset += data.length;
        callback(_fetchedData.slice(offset, offset + limit));
      }
    });
  };

  featured.init = function(forHomePage) {
    if (!forHomePage) {
      _populateMasthead();
      erly.onScrollNearFooter(_populateList);
    }
    else {
      _loadItemsPerPage = 6;
    }
    _populateList();
  };

  erly.featured = featured;
}(erly));

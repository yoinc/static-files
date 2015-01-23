(function(cms) {
  var stats = {};
  var DEFAULT_PAGE_SIZE = 25;

  stats.offsetId = null;

  var findRecordsMatchingFilter = function(records) {
    var val = $('.filters .event-type select').val();

    return _.select(records, function(record) {
      if (val === 'all') {
        return true;
      } else if (val === 'photo-album') {
        return record.isAlbum;
      } else {
        return !record.isAlbum;
      }
    });
  };

  var queryLimit = _.memoize(function() {
    var queryPairs = window.location.search.slice(1).split('&');

    var query = {};

    _.each(queryPairs, function(pair) {
      var parts = pair.split('=');
      query[parts[0]] = parts[1];
    });

    return query.limit || DEFAULT_PAGE_SIZE;
  });

  var applyFilter = function() {
    var val = $('.filters .event-type select').val();

    switch (val) {
      case 'all':
        $('.events table tbody tr').show();
        break;

      case 'photo-album':
      case 'invitation':
        $('.events table tbody tr').show();
        $('.events table tbody tr[data-type!="' + val + '"]').hide();
        break;

      default:
        throw new Error('invalid event type filter');
    }
  };

  var fetchMore = function(options) {
    if (!options) {
      options = {};
    }

    if (typeof options.lastFilteredRecords === 'undefined') {
      options.lastFilteredRecords = [];
    }

    var ql = queryLimit();
    $('div.more a').hide();

    var url = '/cms/stats/events/latest' +
      '?limit=' + ql;

    if (stats.offsetId) {
      url += '&offsetId=' + stats.offsetId;
    }

    $.ajax({
      url: url,
      success: function(data) {
        $('div.more a').show();
        if (data) {
          var tmpl = $('#tmplCMSEventList').tmpl(data.records);
          $('.events table tbody').append(tmpl);

          var len = data.records.length;
          if (len > 0) {
            stats.offsetId = data.records[len - 1].id;
          }

          $('.events table .raw-record').unbind('click');
          $('.events table .raw-record').click(function() {
            var id = $(this).parents('tr').eq(0).attr('data-id');
            id = parseInt(id, 10);

            var url = '/cms/console';
            url += '?model=chronicle';
            url += '&action=get';
            url += '&id=' + id;

            window.location = url;

            return false;
          });

          if (data.records.length < ql) {
            $('div.more a').hide();
          }

          if (data.records.length > 0) {
            applyFilter();

            _.each(findRecordsMatchingFilter(data.records), function(record) {
              options.lastFilteredRecords.push(record);
            });

            if (options.lastFilteredRecords.length < ql) {
              fetchMore({ lastFilteredRecords: options.lastFilteredRecords });
            }
          }
        }
      }
    });
  };

  stats.init = function() {
    cms.downloadTemplate('/tmpl/cms/stats.html', function(tmpl) {
      $('body').append(tmpl[0]);

      fetchMore();
    });

    $('div.more a').click(function(e) {
      if (e.which > 1) {
        return;
      }

      fetchMore();
    });

    $('.filters .event-type select').change(function() {
      applyFilter();
    });
  };

  cms.stats = stats;
}(erly.cms));
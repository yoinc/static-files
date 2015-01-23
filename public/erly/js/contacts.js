/*!
 * Contacts and auto-complete handling
 */

(function(erly) {
  var contacts = {};
  contacts.data = null;
  contacts.fetched = false;
  contacts.fetching = false;

  /**
   * Escape characters for regular expressions.
   * @const
   * @private
   */
  var REGEX_ESCAPE_CHARS_REGEX = /[\-\[\]{}()*+?.,\\\^$|#\s]/g;

  /**
   * Converts `query` to a name suitable for finding contacts.
   *
   * @param {String} query
   * @returns {RegExp}
   * @private
   */
  var convertQueryToRegex = function(query) {
    var rx = query.replace(REGEX_ESCAPE_CHARS_REGEX, function(match) {
      return '\\' + match;
    });
    return new RegExp('(^| )' + rx, 'i');
  };

  contacts.prefixSearch = function(query) {
    if (!this.fetched || !this.data) { return []; }
    var rx = convertQueryToRegex(query);
    return _(this.data).filter(function(contact) {
      return (contact.name && rx.test(contact.name)) ||
             (contact.email && rx.test(contact.email));
    }).sort(function(a, b) {
      // sort erly users to the front
      if (a.userId && !b.userId) { return -1; }
      else if (!a.userId && b.userId) { return 1; }
      else {
        // Use name sorting
        return a.name === b.name ? 0 : a.name > b.name ? 1 : -1;
      }
    });
  };

  contacts.fetchData = function(force, callback) {
    if (typeof force === 'function') {
      callback = force;
      force = false;
    }
    if ((!force && this.fetched) || this.fetching) { return; }

    this.fetched = false;
    this.fetching = true;

    var self = this;
    // erly.profiling.mark('contacts', 'start');
    async.parallel({
      facebook: function(callback) {
        if (erly.session.isFacebookConnected()) {
          erly.facebookSingleCall('/me/friends', function(err, res) {
            if (err) {
              callback(err);
            }
            else {
              callback(null, res.data);
            }
          });
        }
        else {
          callback(null, []);
        }
      },
      erly: function(callback) {
        $.ajax({
          url: erly.urlFor.contacts(),
          dataType: 'json',
          cache: !force,
          success: function(data) {
            callback(null, data || {});
          },
          error: function(jqXHR, status, err) {
            callback(err, null);
          }
        });
      }
    }, function(err, data) {
      // erly.profiling.mark('contacts', 'finish');
      self.fetched = !err;
      self.fetching = false;

      // Sort data into a huge list
      var list = data.facebook || [];

      data.erly = data.erly || {};

      // Include `userId` for facebook friends on erly
      _(list).forEach(function(friend) {
        var userId = (data.erly.facebookIdToErlyId || {})[friend.id];
        if (typeof userId !== 'undefined') {
          friend.userId = userId;
        }

        // Convert `id` from facebook into `facebookId`
        friend.facebookId = friend.id;
        delete friend.id;
      });

      // concat contacts list
      list = _(list).concat(data.erly.contacts || []);

      // add friends that aren't in the list already
      list = _(list).concat(_(data.erly.friends || []).filter(function(friend) {
        return !_(list).some(function(existing) {
          return friend.userId === existing.userId ||
            friend.facebookId === existing.facebookId;
        });
      }));

      if (typeof callback === 'function') {
        callback(err, list);
      }
      else {
        self.data = list;
      }
    });
  };

  erly.contacts = contacts;
}(erly));

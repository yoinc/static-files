/*!
 * Tagging helpers
 */

(function(viewer) {
  var tags = {};

  /** @const */
  var KEYCODE_BACKSPACE = 8;

  /** @const */
  var KEYCODE_UP = 38;

  /** @const */
  var KEYCODE_DOWN = 40;

  /** @const */
  var KEYCODE_ENTER = 13;

  /** @const */
  var KEYCODE_TAB = 9;

  /** @const */
  var KEYCODE_ESC = 27;

  /** @const */
  var KEYCODE_COMMA = 188;

  /** @const */
  var CONTACT_LIST_SPLIT = /[,\uff0c;]/;

  // shared, used to correlate the raw text field
  var _selectedContacts = [];

  /**
   * Clears all errors.
   * @api private
   */
  var _clearErrors = function(message) {
    $('.tagging-form .error').text('').hide();
  };

  /**
   * Displays the given error message on the form.
   * @api private
   */
  var _displayError = function(message) {
    $('.tagging-form .error').text(message).fadeIn('fast');
  };


  // some actually valid emails may be rejected by this..
  // but those are super unusual.
  var _looksLikeValidEmail = function(email) {
    email = (email || '').toLowerCase();
    return erly.validate.ANCHORED_EMAIL_REGEX.test(email);
  };

  var _updateCurrentCount = function() {
    var textfield = $(this);
    _.defer(function() {
      var count = 0;
      _(textfield.val().split(CONTACT_LIST_SPLIT)).forEach(function(contact) {
        if ($.trim(contact).length > 0 &&
            (contact.indexOf('@') > 0 || contact.indexOf('Erly User') > 0)) {
          count++;
        }
      });
      $('.tagging-form .tag-count').text(
        erly.util.pluralize(count, 'email') + ' entered');
    });
  };

  /**
   * @api private
   */
  var _parseContacts = function(contactText, selectedContacts) {
    var response = {
      contacts: [],
      problem: null
    };
    var erlyUsers = {};
    _(selectedContacts).forEach(function(contact) {
      if (contact.userId) {
        erlyUsers[contact.name] = contact;
      }
    });
    var processing = _(contactText.split(CONTACT_LIST_SPLIT)).
        forEach(function(contact) {
      // discard empty strings
      contact = $.trim(contact);
      if (!contact) { return; }

      var m = /"?([^"]+)"?\s+<(.+?)>/.exec(contact);
      var name = m ? m[1] : null;
      var email = m ? m[2] : null;

      // try to correlate against erly user ids in selectedContacts
      if (email === 'Erly user' && erlyUsers.hasOwnProperty(name)) {
        response.contacts.push({
          name: name,
          userId: erlyUsers[name].userId
        });
      }
      else if (email && _looksLikeValidEmail(email)) {
        // invite these people directly
        response.contacts.push({
          name: name,
          email: $.trim(email)
        });
      }
      else if (_looksLikeValidEmail(contact)) {
        response.contacts.push({
          name: contact.substring(0, contact.indexOf('@')),
          email: contact
        });
      }
      else {
        response.problem = contact;
      }
    });
    return response;
  };

  /**
   * formats the contact, gmail style
   * @api private
   */
  var _formatContactText = function(contact, includeCommaSpace) {
    var contactText = "";
    var name = contact.name || contact.primary_name;
    if (name === contact.email) {
      name = null;
    }
    if (name) {
      contactText += name + ' <';
    }
    if (contact.email) {
      contactText += contact.email;
    }
    else if (!contact.isInvite && contact.userId) {
      contactText += 'Erly user';
    }
    if (name) {
      contactText += '>';
    }
    if (includeCommaSpace === true) {
      contactText += ', ';
    }
    return contactText;
  };



  /**
   * Common autocomplete tasks.
   * @api private
   */
  var _acCommon = function(fn) {
    return function(ev) {
      _clearErrors();
      var container = $(this).parents('.tagging-form').
        find('.autocomplete-container').eq(0);
      if (!container || !container.length) { return; }
      return fn.apply(this, [container, ev]);
    };
  };

  /**
   * Selects `index` from the contact list in `container` and saves data into
   * `form`.
   * @api private
   */
  var _select = function(container, textfield, index) {
    var data = container.children().first().tmplItem().data;
    if (data && data.contacts && data.contacts[index]) {
      var contact = data.contacts[index];
      _selectedContacts.push(contact);
      var existingText = textfield.val();
      var lastComma = existingText.lastIndexOf(',');
      var newText = "";
      if (lastComma !== -1) {
        newText = existingText.substring(0, lastComma) + ', ' +
          _formatContactText(contact, true);
      } else {
        newText = _formatContactText(contact, true);
      }
      textfield.val(newText);
      container.removeData('selectedIndex');
    }
    container.hide();
  };

  /**
   * Populates and displays the autocomplete form based on input text. Expects
   * to be bound to the key up event of a text element.
   * @api private
   */
  var _autocomplete = _acCommon(function(container, ev) {
    if (ev.which === KEYCODE_ENTER) { return ev.preventDefault(); }
    if (ev.which === KEYCODE_COMMA) { return ev.preventDefault(); }
    if (ev.which === KEYCODE_ESC) { return ev.preventDefault(); }
    var textfield = $(this);
    _updateCurrentCount.call(this);
    var fieldText = $(this).val();

    var query = $.trim(fieldText.substring(fieldText.lastIndexOf(',') + 1));
    if (query && query === container.data('lastQuery')) { return; }

    // Clear old data
    container.data('lastQuery', query);
    container.removeData('selectedIndex');
    container.empty();
    var contacts = query ? erly.contacts.prefixSearch(query) : [];

    // Filter contacts without emails or erly user ids.
    contacts = _(contacts).filter(function(contact) {
      return contact.email || contact.userId;
    });

    // Don't show people who are already in the guest list
    var guests = viewer.Details.instance.getAttendanceData();
    if (guests) {
      var guestIdsAndEmails = {};
      _.each(guests, function(guest) {
        if (guest.id) {
          guestIdsAndEmails[guest.id] = true;
        }
        if (guest.email) {
          guestIdsAndEmails[guest.email] = true;
        }
      });
      contacts = _(contacts).reject(function(contact) {
        return guestIdsAndEmails.hasOwnProperty(contact.userId) ||
          guestIdsAndEmails.hasOwnProperty(contact.email);
      });
    }

    // Hide autocomplete
    if (!contacts.length) {
      container.hide();
    }
    else {
      // Populate the dropdown and show it
      container.append($('#tmplAutocompleteDropDown').tmpl({
        contacts: contacts
      }, {
        formatContactText: _formatContactText
      }));
      var offset = textfield.position();
      var windowOffset = textfield.offset();
      // Highlight first
      container.data('selectedIndex', 0);
      _.defer(function() {
        var first = container.find('.contact').first();
        if (first.position()) {
          first.addClass('highlight');
          container.scrollTop(first.position().top);
        }
      });
      container.css({
        position: 'absolute',
        top: offset.top + $(this).outerHeight() + 'px',
        left: offset.left + 'px'
      });

      // Enable clicks
      var contact = container.find('.contact');
      contact.click(function() {
        var el = this, index = null;
        contact.each(function(i) {
          if (this === el) { index = i; }
        });
        if (index !== null) {
          _select(container, textfield, index);
        }
      });
      container.show();
    }
  });

  /**
   * Handles autocomplete selection. Expects to be bound to a text element in a
   * form with sibling input elements: name and email.
   * @api private
   */
  var _autocompleteSelection = _acCommon(function(container, ev) {
    if (ev.which === KEYCODE_ENTER || ev.which === KEYCODE_COMMA ||
        ev.which === KEYCODE_TAB) {
      var index = container.data('selectedIndex');
      _select(container, $(this), index);
      ev.preventDefault();
      return true;
    }
    else if (container.is(':visible') && ev.which === KEYCODE_ESC) {
      ev.preventDefault();
      ev.stopPropagation();
      container.removeData('selectedIndex');
      container.hide();
      return false;
    }
  });

  /**
   * Handles autocomplete navigation events. Should be bound to keydown.
   * @api private
   */
  var _autocompleteNavigation = _acCommon(function(container, ev) {
    if (!container.is(':visible')) { return; }
    if (ev.which === KEYCODE_ENTER) { return ev.preventDefault(); }
    if (ev.which === KEYCODE_COMMA) { return ev.preventDefault(); }
    if (ev.which === KEYCODE_TAB) { return ev.preventDefault(); }
    if (ev.which === KEYCODE_ESC) {
      ev.stopPropagation();
      return ev.preventDefault();
    }
    var index = container.data('selectedIndex');
    index = typeof index === 'number' ? index : -1;
    var max = container.find('.contact').length;
    if (ev.which === KEYCODE_UP || ev.which === KEYCODE_DOWN) {
      if (ev.which === KEYCODE_UP) {
        index = index <= 0 ? max - 1 : index - 1;
      }
      else if (ev.which === KEYCODE_DOWN) {
        index = (index + 1) % max;
      }

      var selected = container.
        data('selectedIndex', index).
        find('.contact').removeClass('highlight').
        eq(index).addClass('highlight');

      var cellHeight = selected.outerHeight();
      var position = cellHeight * index;
      var scrollPosition = container.scrollTop();
      if (position < scrollPosition) {
        container.scrollTop(position);
      }
      else if (position > scrollPosition + container.height() - cellHeight) {
        container.scrollTop(position - container.height() + cellHeight);
      }

      ev.preventDefault();
    }
  });

  /**
   * Handles tagging submission.  Should be bound to the form onsubmit event.
   * @api private
   */
  var _submit = function(contacts, message, callback) {
    $.ajax({
      url: erly.urlFor.collection(viewer.collection, 'tags'),
      type: 'post',
      data: {tags: JSON.stringify(contacts), message: message},
      success: function(result) {
        if (result && result.error) {
          var message = result.error.message ||
            'There was an error sending the invites';
          _displayError(message);
          callback(true);
        }
        else {
          erly.track.tagUser({invite: true, count: result.newCounts.invites});
          erly.track.tagUser({invite: false, count: result.newCounts.users});
          viewer.Details.instance.updateAttendanceData(result.updatedTags,
            true, viewer.collection.pastEvent ? "yes" : "pending");
          callback(null, result.newCounts.users + result.newCounts.invites);
        }
      },
      error: function(jqXHR, status, err) {
        _displayError('There was an error sending the invites');
        callback(true);
      }
    });
  };

  /**
   * Enables autocompletion and tag submission on the given tagging form.
   *
   * @param {jQuery} container
   * @api private
   */
  var _behaviorize = function(container, submitCallback) {
    if (!container || !container.length) { return; }
    var textarea = container.find('textarea.tagging-input');
    // Generate an autocomplete container for displaying results
    if (!container.find('.autocomplete-container').length) {
      textarea.after(
        $('<div class="autocomplete-container" style="display:none"></div>'));
    }

    textarea.
      // Autocomplete on the name field
      keyup(_autocomplete).
      // Selection handling
      keyup(_autocompleteSelection).
      // Setup navigation
      keydown(_autocompleteNavigation).
      // clear errors on focus
      focus(_clearErrors);

    var button = container.find('button.submit');
    button.click(function() {
      button.attr('disabled', true);

      // prepare the data by correlating what's now in the textfield
      // with all the contacts that we've selected.
      var contacts = _parseContacts(textarea.val(), _selectedContacts);

      // if there are any issues, displayError.
      if (contacts.problem) {
        _displayError(
          'Sorry, the email you provided "' + contacts.problem + '" was not' +
          ' recognizable.  Please ensure all contacts are properly formatted.');
        button.removeAttr('disabled');
      }
      else if (contacts.contacts.length === 0) {
        _displayError('Please enter the email addresses of your guests.');
        button.removeAttr('disabled');
      }
      else {
        var personalMessage = container.find('textarea.personal-message').val();
        // if no issues, submit
        _submit(contacts.contacts, personalMessage, function(err, newCounts) {
          button.removeAttr('disabled');
          textarea.val('');
          if (!err) {
            submitCallback(newCounts,
                           contacts.contacts && contacts.contacts.length);
            erly.events.fire(erly.events.INVITES_ADDED);
          }
        });
      }
    });

    // Enable service connections if the user has not yet connected
    if (!erly.session.hasConnectedContacts()) {
      if (!erly.viewer.invite) {
        container.find('a.import-source').each(function() {
          erly.services.bindConnect(
            $(this).find('span.name').text().replace('!', ''), this);
        });
        erly.widgets.importContacts.bind();
      }
    }
    else {
      // otherwise hide it
      container.find('.import-contacts').hide();
      // and resize the modal if needed
      erly.modal.resize();
    }

    // Hide the autocomplete dropdown if clicks occur outside it
    var acContainer = '.autocomplete-container';
    $('body').click(function() {
      $(acContainer).hide();
    });
  };

  /**
   * Enables autocomplete for a given container.
   *
   * @param {jQuery} container
   * @param {Function} callback - when new tags are added
   * @api public
   */
  tags.enableAutoComplete = function(container, submitCallback) {
    if (!erly.viewer.invite) {
      erly.contacts.fetchData();
    }
    _selectedContacts = [];
    _behaviorize(container, submitCallback);
    erly.enableWatermarks();
  };

  viewer.tags = tags;
}(erly.viewer));

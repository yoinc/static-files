/*global jstz: true */

(function(erly) {
  var DOM = {
    formWrapper:               '.event-form-wrapper',
    stepTitle:                 '.event-form-wrapper div.step-title span',
    titleInput:                '.event-form-wrapper .title-input',
    streetAddressInput:        '.event-form-wrapper .street-address',
    locationNameInput:         '.event-form-wrapper .location-name',
    dateWrapper:               '.event-form-wrapper .date-wrapper',
    datePicker:                '.event-form-wrapper .date-wrapper .date-picker',
    contentForm:               '.event-form-wrapper .content-form form',
    passwordCheckbox:          '.event-form-wrapper .select-password',
    passwordInput:             '.event-form-wrapper input[name=password]',
    timezoneInput:             '.event-form-wrapper input[name=timezone]',
    backButton:                '.event-form-wrapper .submit-bottom .back-button',
    cancelButton:              '.event-form-wrapper .submit-bottom .cancel-button',
    continueButton:            '.event-form-wrapper .submit-bottom .continue-button',
    deleteButton:              '.event-form-wrapper .submit-bottom .delete-button',
    submitButton:              '.event-form-wrapper .submit-bottom input[type=submit]',
    toggleOptions:             '.content-form .toggle-options',
    importLink:                '.import-link',
    showDescriptionLink:       '.show-description-link',
    showLocationLink:          '.show-location-link',
    descriptionRow:            '#description-row',
    locationNameRow:           '.location-name-row',
    startDateInput:            '#start_date',
    startTimeInput:            '#start_time',
    endDateInput:              '#end_date',
    endTimeInput:              '#end_time',
    endDateRow:                '#end_date_row',
    cancelDedupeButton:        '#cancel_dedupe',
    ignoreDedupeEventButton:   '#ignore_dedupe_event',
    createEventFlowContainer:  '.event-form-wrapper .create-event-flow-container',
    eventDetailsContainer:     '.event-form-wrapper .create-event-flow-container .event-details',
    addPhotoDialog:            '.event-form-wrapper .create-event-flow-container .add-photo',
    chooseCoverDialog:         '.event-form-wrapper .create-event-flow-container .choose-cover'
  };

  var EXTRA_INPUT_FUDGE_FACTOR = 5;
  var EXTRA_INPUT_PADDING = 5;
  var INVALID_URL_CHARS = /[\!\*\'\(\)\;\:\@\&\=\+\$\,\/\?\#\[\]]/g;

  var _options;
  var _settingsVisible = false;

  // Stores the selected album from the 3rd party album dialog, if chosen
  var _importedFromAlbum = null;
  var _importedPhotos = null;
  var _coverPhoto = null;

  var _addPosts;

  var _currentStep = null;
  var _lastStep = null;

  var _googleAutocompleteLoaded = false;

  var _userTimeZone = jstz.determine_timezone();

  // Tells hash change event handler to ignore one hash change event but
  // not subsequent fires.
  var _mungeHashChangeEvent = false;

  var vanityUrlBase = function(vanityName) {
    return erly.BASE_URL + '/user/' +
      (vanityName || erly.session.currentUser.vanityName) + '/';
  };

  var checkForDedupedEvent = function(paramsAsArray, cb) {
    $.ajax({
      url: erly.urlFor.collection('dedupe'),
      type: 'POST',
      data: paramsAsArray,
      success: function(data) {
        cb(data.length > 0 ? data : false);
      }
    });
  };

  var paramsArrayToHash = function(paramsArray, keysToRemove) {
    var hash = {};
    keysToRemove = keysToRemove || [];

    _.each(paramsArray, function(kvPair) {
      if ($.inArray(kvPair.name, keysToRemove) < 0) {
        hash[kvPair.name] = kvPair.value;
      }
    });

    return hash;
  };

  /*
   * @constructor
   */
  var DateHelper = function(eventData) {
    this.startDate_ = eventData.startDate || new Date();
    this.endDate_ = eventData.endDate || new Date();
    this.hasStartTime_ = eventData.hasTime || false;
    this.hasEndTime_ = eventData.hasTime || false;
    this.hasEndDate_ = eventData.hasOwnProperty('endDate');
    this.timezone_ = eventData.timezone;  // should have always been attached
    this.START_ = 0;
    this.END_ = 1;
  };

  var eventForm = {};

  eventForm.eventData = null;

  function centerImages(rendered) {
    rendered.each(function() {
      erly.centerImage($(this).find('.art img'), null, null, {
        ajaxLoaderQualifier: '-222222'
      });
    });
  }

  function toggleCoverPhoto(photo, e) {
    var data = $(photo).tmplItem().data;
    var check = $(photo).find('input');
    var checked = check.attr('checked') === 'checked';
    var isInput = false;

    if (e) {
      isInput = $(e.target).attr('type') === 'checkbox';
    }

    // If the checkbox was clicked, the checked value has already been
    // flipped, so flip it back
    if (isInput) {
      checked = !checked;
    }

    $(DOM.chooseCoverDialog).find('input[type=checkbox]').removeAttr('checked');

    if (checked) {
      check.removeAttr('checked');
      data.selected = false;
      _coverPhoto = null;
    }
    else {
      check.attr('checked', 'checked');
      data.selected = true;
      _coverPhoto = data;
    }
  }

  // If it doesn't already exist, attach 'timezone' and 'timezoneShortName'
  // to 'eventData.
  var attachTimezone = function(eventData, callback) {
    if (!eventData.timezone) {
      eventData.timezone = _userTimeZone.name();
    }
    if (!eventData.timezoneShortName) {
      $.ajax({
        type: 'POST',
        url: '/timezoneShortName',
        data: {
          olsonName: eventData.timezone,
          timeMS: (eventData.startDate || new Date()).getTime()
        },
        success: function(data) {
          if (data.success) {
            eventData.timezoneShortName = data.shortName;
          }
        },
        complete: function(jqXHR, textStatus) {
          if (!eventData.timezoneShortName) {
            eventData.timezoneShortName = '?';
          }
          callback();
        }
      });
    } else {
      callback();
    }
  };

  eventForm.init = function(data) {
    var self = this;
    attachTimezone(data, function() {
      self.eventData = data;
      self.dateHelper = new DateHelper(data);
      self.layout();

      // Wait for the DOM to finish templating
      _(function() {
        erly.session.ensureAuthenticated(function() {
          self.toggleDateInputs();

          eventForm.enableHugeButtons();
          $(window).bind('hashchange', eventForm.navigateBasedOnHash);
          _.defer(eventForm.navigateBasedOnHash);

          erly.events.fire(erly.events.PAGE_READY);
        });
      }).defer();
    });
  };

  var stringIntToBoolean = function(obj, property) {
    var val = obj[property];

    if (val) {
      if (typeof val === 'string') {
        obj[property] = parseInt(val, 10) ? true : false;
      }
    }
  };

  eventForm.layout = function() {
    stringIntToBoolean(this.eventData, 'private');
    stringIntToBoolean(this.eventData, 'hasTime');
    var template = $$('#tmplEventForm').tmpl(this.eventData);
    template.appendTo($$('.create-event-content'));
  };

  eventForm.bindExtraSettingsEvents = function() {
    this.enableHintHovers();
    this.enablePasswordSelectionBindings();
  };

  eventForm.navigateBasedOnHash = function() {
    if (_mungeHashChangeEvent) {
      _mungeHashChangeEvent = false;
      return;
    }
    var hash = window.location.hash;
    var fromStepOne = $('.choices-container').is(':visible');
    var clearHash = function() {
      if (history && history.replaceState) {
        history.replaceState('', document.title, window.location.pathname);
      }
      else {
        window.location.hash = '';
      }
    };
    // Step one
    if (!hash) {
      eventForm.goToBeginning();
    }
    // Step two
    else if (hash === '#album') {
      if (fromStepOne) {
        $('.choices-container .huge-button.album').click();
      }
      else {
        eventForm.navigateToStep(false);
      }
    }
    // Step two
    else if (hash === '#invitation') {
      if (fromStepOne) {
        $('.choices-container .huge-button.invite').click();
      }
      else {
        eventForm.navigateToStep(false);
      }
    }
    // Step three
    else if (hash.indexOf('-2') === hash.length - 2) {
      if (fromStepOne) {
        // Can't skip from step one to three...
        clearHash();
      }
      else {
        // if we can't navigate to the desired step, update the hash
        // to the current step
        if (eventForm.canNavigateToStep(true)) {
          eventForm.navigateToStep(true);
        }
        else {
          eventForm.updateHash(window.location.hash.replace('-2', ''));
        }
      }
    }
    // Step ???
    else {
      clearHash();
    }
  };

  eventForm.enableBindings = function(forUpdate) {
    this.enableMoreDetailsButtons();
    this.enableAutocomplete();
    this.enableAddStreetAddress();
    this.enableBackButton();
    this.enableCancelButton();
    this.enableContinueButton();
    this.enableToggleOptions();
    this.enableEmptyText();
    this.dateHelper.enableBindings();
    this.enablePrivacyToggle();
    this.enableExtraSettings();
    this.bindExtraSettingsEvents();

    if (forUpdate) {
      this.enableDeleteButton();
      this.enableUpdate();
    }
    else {
      // this.initializeAlbumImport();
      this.enableSubmit();
      $(DOM.titleInput).focus();
    }

    erly.enableWatermarks();
  };

  eventForm.toggleDateInputs = function() {
    // Hide the time input and the option to enter an end date
    $('.event-fields .right').toggle(!this.eventData.isAlbum);
  };

  eventForm.getCollectionLink = function() {
    return vanityUrlBase(this.eventData.ownerVanityName) +
      this.eventData.vanityUrl;
  };

  // Nope, this doesn't get called anymore
  eventForm.initializeAlbumImport = function() {
    erly.albumImporter.init();
    $(DOM.importLink).click(function() {
      erly.albumImporter.showModal();
    });
  };

  eventForm.enableMoreDetailsButtons = function() {
    $(DOM.showDescriptionLink).click(function() {
      $(DOM.showDescriptionLink).parent('.row').hide();
      $(DOM.descriptionRow).show();
    });

    $(DOM.showLocationLink).click(function () {
      $(DOM.showLocationLink).parent('.row').hide();
      $(DOM.locationNameRow).show();
    });
  };

  function repositionModal() {
    if ($(document).find('body').css('overflow') !== 'hidden') {
      return;
    }

    var window_height = $(window).height();
    var modal_height = $('#modal').height();
    var modal_top = $('#modal').offset().top;
    var colorbox_top = (modal_height + modal_top) - window_height;
    if (colorbox_top > 0) {
      colorbox_top = modal_top - colorbox_top;

      if (colorbox_top > 0) {
        $('#colorbox').css('top', colorbox_top + 'px');
      } else {
        $('#colorbox').css('top', '0px');
      }
    }
    eventForm.modalResize();
  }

  eventForm.updateHash = function(hash) {
    if (hash === window.location.hash) return;
    _mungeHashChangeEvent = true;
    window.location.hash = hash;
  };

  eventForm.enableHugeButtons = function() {
    var showFormFields = function() {
      $('.choices-container').hide();
      $('.event-fields').show();

      var formFieldsTemplate = $$('#tmplEventFields').tmpl(eventForm.eventData);
      formFieldsTemplate.appendTo($('.event-fields').empty());

      eventForm.buildCreationSteps();
      _currentStep.isLoaded = true;

      eventForm.enableBindings();
    };

    $('.choices-container .huge-button.invite').click(function() {
      eventForm.eventData.isAlbum = false;
      showFormFields();
      $(DOM.stepTitle).html(_currentStep.title);
      document.title = _currentStep.title;
      eventForm.updateHash('#invitation');
    });

    $('.choices-container .huge-button.album').click(function() {
      $(DOM.formWrapper).addClass('full-location-name');
      eventForm.eventData.isAlbum = true;
      showFormFields();
      $(DOM.stepTitle).html(_currentStep.title);
      document.title = _currentStep.title;
      eventForm.updateHash('#album');
    });
  };

  DateHelper.prototype.updateDate = function(which) {
    var ok = false;
    var input = which === this.START_ ? DOM.startDateInput : DOM.endDateInput;
    var str = $.trim($$(input).val());
    if (str !== '') {
      var date = erly.normalizeDate(str);
      if (date) {
        var d = which === this.START_ ? this.startDate_ : this.endDate_;
        d.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        $$(input).val(erly.dateFormatters.formatDateShortDayShortMonth(d));
        ok = true;
      }
    }
    if (which === this.END_) this.hasEndDate_ = ok;
  };

  DateHelper.prototype.updateTime = function(which) {
    var ok = false;
    var input = which === this.START_ ? DOM.startTimeInput : DOM.endTimeInput;
    var str = $.trim($$(input).val());
    if (str !== '') {
      try {
        var timeParsed = erly.normalizedParseTime(str);
        var d = which === this.START_ ? this.startDate_ : this.endDate_;
        d.setHours(timeParsed.hour, timeParsed.minute || 0, 0, 0);
        $$(input).val(erly.dateFormatters.formatAlarmClock(d));
        ok = true;
      } catch (e) {}
    }
    if (which === this.START_) {
      this.hasStartTime_ = ok;
    } else {
      this.hasEndTime_ = ok;
      this.hasEndDate_ = ok;
    }
  };

  // Is the start date/time before the end date/time?
  DateHelper.prototype.startEndConsistent = function() {
    if (!this.hasEndDate_) {
      return true;
    }

    if (this.hasStartTime_ && this.hasEndTime_) {
      return this.startDate_ <= this.endDate_;
    }

    // Compare only dates, no times.
    var s = this.startDate_;
    var e = this.endDate_;
    if (s.getFullYear() !== e.getFullYear()) {
      return s.getFullYear() < e.getFullYear();
    } else if (s.getMonth() !== e.getMonth()) {
      return s.getMonth() < e.getMonth();
    } else {
      return s.getDate() <= e.getDate();
    }
  };

  DateHelper.prototype.maybeAdjustDates = function(which) {
    if (!this.startEndConsistent()) {
      var from = which === this.START_ ? this.startDate_ : this.endDate_;
      var to = which === this.START_ ? this.endDate_ : this.startDate_;
      to.setFullYear(from.getFullYear(), from.getMonth(), from.getDate());
      if (this.startDate_ > this.endDate_) {
        to.setTime(
          to.getTime() +
            (which === this.START_ ? erly.dateUtil.DAY : -erly.dateUtil.DAY));
      }

      var input = which === this.START_ ? DOM.endDateInput : DOM.startDateInput;
      $$(input).val(erly.dateFormatters.formatDateShortDayShortMonth(to));
    }
  };

  DateHelper.prototype.maybeAdjustTimes = function(which) {
    if (!this.startEndConsistent()) {
      var from = which === this.START_ ? this.startDate_ : this.endDate_;
      var to = which === this.START_ ? this.endDate_ : this.startDate_;
      to.setHours(from.getHours(), from.getMinutes());

      var input = which === this.START_ ? DOM.endTimeInput : DOM.startTimeInput;
      $$(input).val(erly.dateFormatters.formatAlarmClock(to));
    }
  };

  /*
   * Parse fields from the form and return {} if there are no date
   * fields, null if there was an error, or an object with startDate,
   * hasTime, and endDate.  timezone is sent separately.
   */
  DateHelper.prototype.parseFields = function() {
    var self = this;
    if ($(DOM.startDateInput).length === 0) {
      // form doesn't contain date fields.
      return {};
    }

    $.each([self.START_, self.END_], function(index, which) {
      self.updateDate(which);
      self.updateTime(which);
    });

    var formatDateToSend = function(date, hasTime) {
      var a = {
        year: date.getFullYear(),
        month: date.getMonth(),
        date: date.getDate()
      };
      if (hasTime) {
        a.hours = date.getHours();
        a.minutes = date.getMinutes();
      }
      return a;
    };

    var reply = {
      hasTime: self.hasStartTime_ ? '1' : '0',
      startDateF: formatDateToSend(self.startDate_, self.hasStartTime_),
      endDateF: ''
    };
    if ($$(DOM.endDateInput).is(':visible') &&
        self.hasEndDate_ && self.endDate_ > self.startDate_ &&
        (!self.hasStartTime_ || self.hasEndTime_)) {
      reply.endDateF = formatDateToSend(self.endDate_, self.hasStartTime_);
    }
    if (!self.hasStartTime_ &&
        erly.dateFormatters.sameDay(self.startDate_, self.endDate_)) {
      // If there was no time and the days are the same, don't set the end date.
      reply.endDateF = '';
    }

    // TODO: send user's offset as a backup?

    return reply;
  };

  /*
   * Enable bindings on the date/time fields.
   */
  DateHelper.prototype.enableBindings = function() {
    if ($(DOM.startDateInput).length === 0) {
      // form doesn't contain date fields.
      return;
    }

    var self = this;

    // Time picker helpers.
    var formatTime = function(min) {
      var date = new Date();
      date.setHours(Math.floor(min / 60), min % 60, 0, 0);
      return erly.dateFormatters.formatAlarmClock(date);
    };
    var parseTime = function(str) {
      var parsed = erly.normalizedParseTime(str || '');
      var date = new Date();
      date.setHours(parsed.hour || 0, parsed.minute || 0, 0, 0);
      return date;
    };
    // The time the dropdown should start on if there is no input currently.
    // If the date is today, start at the next increment from 'now'; otherwise,
    // start at 6pm.  The date doesn't matter, only the time.
    var defaultTime = function() {
      var date = new Date();
      if (!erly.dateFormatters.sameDay(date, this.startDate_)) {
        date.setHours(18, 0, 0, 0);
      }
      return date;
    };

    $.each([this.START_, this.END_], function(index, which) {
      // Enable calendar pickers.
      var input = which === self.START_ ? DOM.startDateInput : DOM.endDateInput;
      erly.util.setCommonDatePickerEvents($$(input));
      var dateConstraint = {};
      if (!erly.__development) {
        dateConstraint = eventForm.eventData.isAlbum ? {
          maxDate: new Date()
        } : {
          minDate: new Date()
        };
      }

      $$(input).datepicker(_.extend({dateFormat: 'D, M d, yy'}, dateConstraint));
      $$(input).change(function() {
        self.updateDate(which);
        self.maybeAdjustDates(which);
      });

      // Enable time pickers.
      input = which === self.START_ ? DOM.startTimeInput : DOM.endTimeInput;
      $$(input).timePicker({
        step: 30,
        endTime: new Date(0, 0, 0, 23, 59, 0),
        show24Hours: false,
        formatTime: formatTime,
        parseTime: parseTime,
        defaultTime: defaultTime
      });
      $$(input).change(function() {
        self.updateTime(which);
        self.maybeAdjustTimes(which);
      });
    });

    // Enable time zone picker.
    var mapDiv = $('.timezonemap');
    var mapRow = $('.timezonemaprow');
    var visibleTZ = $$(eventForm.getCurrentForm().find('input.timezone'));

    var acceptZoneAndClose = function(zoneName, display) {
      // User clicked 'done' or clicked away, update the timezone
      // with the selection.  Update the hidden field with the Olson
      // name, and update the visible field with the short name.
      $$(DOM.timezoneInput).val(zoneName);
      visibleTZ.val(display || zoneName);
      mapRow.slideToggle('slow', function() { repositionModal(); });
    };

    var attachedMap = false;
    var showTimezoneMap = function() {
      if (!attachedMap) {
        mapRow.find('div.timezoneclose a').click(function(e) {
          if (e.which > 1) {
            return;
          }

          mapRow.slideToggle('slow', function() { repositionModal(); });
        });
        mapDiv.timezonePicker({
          initialLat: 20,
          initialLng: 0,
          date: erly.normalizeDate($$(DOM.startDateInput).val()),
          jsonRootUrl: erly.PUB_URL + '/js/tz_json/',
          mapOptions: {
            maxZoom: 6,
            minZoom: 2,
            scrollwheel: false,
            streetViewControl: false
          },
          onReady: function() {
            mapDiv.timezonePicker('selectZone', self.timezone_);
          },
          onSelected: function(olsonName, utcOffset, tzName) {
            var pad = function(d) {
              if (d < 10) {
                return '0' + d;
              }
              return d.toString();
            };

            var now = new Date();
            var adjusted = new Date();
            adjusted.setTime(adjusted.getTime() +
            (adjusted.getTimezoneOffset() + utcOffset) * 60 * 1000);

            $("#zonepicker").timezonePicker('showInfoWindow',
            '<h2 style="margin: 0 0 4px 0">' +
            olsonName.split('/').slice(-1)[0].replace('_', ' ') + ' ' +
            '(' + tzName + ')' +
            '</h2>' +
            '<div class="metadata">' +
            '<div>Current Time: ' +
            pad(adjusted.getHours()) +
            ':' +
            pad(adjusted.getMinutes()) +
            ':' +
            pad(adjusted.getSeconds()) +
            '</div>' +
            '<div>Your Time: ' +
            pad(now.getHours()) +
            ':' +
            pad(now.getMinutes()) +
            ':' +
            pad(now.getSeconds()) +
            '</div>' +
            '<div>UTC Offset (in hours): ' +
            (utcOffset / 60) +
            '</div>' +
            '<div style="margin-top: 5px">' +
            '<center><button type="button" id="choose_timezone">' +
            'Use This Timezone' +
            '</button></center></div>' +
            '</div>', function() {
              var infoWindow = $(this);
              infoWindow.css('overflow', 'hidden');
              $('#choose_timezone').click(function(e) {
                if (e.which > 1) {
                  return;
                }

                acceptZoneAndClose(olsonName, tzName);
              });
            });
          }
        });
      }

      $$(DOM.startDateInput).unbind('change.timezonePicker');
      $$(DOM.startDateInput).bind('change.timezonePicker', function() {
        mapDiv.timezonePicker('setDate', erly.normalizeDate($(this).val()));
      });

      mapDiv.timezonePicker('hideInfoWindow');
      mapRow.slideToggle('slow', function() { repositionModal(); });
      attachedMap = true;
    };

    // Hook up click to open the popup.  Cancel so the body click handler
    // doesn't immediately close it.
    visibleTZ.click(showTimezoneMap);

    // Enable "add end date" link.
    var endDateWrapper = eventForm.getCurrentForm()
      .find('a.open-end-date-wrapper');
    endDateWrapper.click(function() {
      if ($$(DOM.endDateInput).val() === '') {
        // Fill in a default end date and time if none exist.
        var defaultDuration = 3 * erly.dateUtil.HOUR;
        self.endDate_ = new Date(self.startDate_.getTime() + defaultDuration);
        $$(DOM.endDateInput).val(
          erly.dateFormatters.formatDateShortDayShortMonth(self.endDate_));
        if (self.hasStartTime_) {
          $$(DOM.endTimeInput).val(
            erly.dateFormatters.formatAlarmClock(self.endDate_));
        }
      }

      $(this).parents('.add-end-date').hide();
      $$(DOM.endDateRow).show();
      repositionModal();
    });
  };

  eventForm.enablePrivacyToggle = function() {
    var privacyToggle = eventForm.getCurrentForm()
      .find('label.privacy-settings-toggle');
    privacyToggle.click(function () {
      privacyToggle.hide();
      $('.row .bottom.hidden').show();
      repositionModal();
    });
  };

  eventForm.enableExtraSettings = function() {
    eventForm.getCurrentForm().find('a.open-extra-settings').click(function() {
      $(this).hide();
      eventForm.getCurrentForm().find('.extra-settings').show();
    });
  };

  eventForm.enableCopyToClipboard = function() {
    var flashvars = {
      text: this.getCollectionLink(),
      bgcolor: 'white'
    };
    var params = {
      quality: 'high',
      wmode: 'transparent',
      allowscriptaccess: 'always'
    };
    var attributes = {
      name: 'clippy'
    };
    var swfCallback = function(status) {
      // if we don't have flash installed,
      // just fallback to using a full-sized input field
      if (!status.success) {
        $('.clippy-container').hide();
        $('.bookmark-container .bookmark').addClass('without-flash');
      }
    };

    swfobject.embedSWF('/swf/clippy.swf', 'clippy_alternative_content', '30',
      '30', '9.0.0', false, flashvars, params, attributes, swfCallback);

    var clippyContainer = $('.clippy-container');
    var copied = clippyContainer.find('.copied');
    var hover  = clippyContainer.find('.hover');

    clippyContainer.hover(function() {
      copied.hide();
      hover.show();
    }, function() {
      hover.hide();
    });

    clippyContainer.mousedown(function() {
      hover.hide();
      copied.show();

      setTimeout(function() {
        copied.fadeOut(1000);
      }, 1250);

      // make sure the click handler falls through
      // to the flash clipboard
      return true;
    });
  };

  eventForm.enableEmptyText = function() {
    var formWrapper = $$(DOM.formWrapper);

    function removeErrorShadow() { $(this).removeClass('error-shadow'); }
    formWrapper.find('input:text').focus(removeErrorShadow);

    formWrapper.find('input:text').
      not('input[name=locationName]').
      not('input[name=streetAddress]').
      not('input[name=address]').
      not('input[name=endDate]').
      focus(erly.enterTextField).
      blur(erly.leaveTextField);

    formWrapper.find('input:password').
      focus(erly.enterTextField).
      blur(erly.leaveTextField);

    if ($.trim($('#title').val())) {
      $('#title').removeClass('empty-text');
    }
  };

  var doToggleOptions = function() {
    $(DOM.toggleOptions).hide();
    $('.content-form .toggle-options-container').show();
  };

  eventForm.enableToggleOptions = function() {
    $(DOM.toggleOptions).find('span').click(doToggleOptions);
  };

  eventForm.enableBackButton = function() {
    var self = this;
    $(DOM.backButton).click(function() {
      self.navigateToStep(false);
    });
  };

  eventForm.enableCancelButton = function() {
    $(DOM.cancelButton).click(function() {
      if (window.location.pathname === '/create_event') {
        window.location.hash = '';
      } else {
        erly.modal.close();
      }
    });
  };

  eventForm.enableContinueButton = function() {
    var self = this;
    $(DOM.continueButton).click(function() {
      self.navigateToStep(true);
    });
  };

  eventForm.enableDeleteButton = function() {
    var self = this;
    if (!self.eventData.ident) {
      $(DOM.deleteButton).hide();
      $('.submit-bottom .toggle-options').show();
    }
    $(DOM.deleteButton).click(function() {
      erly.modal.showConfirm('Delete Event',
          'Are you sure you want to delete "' + self.eventData.title + '"?',
          'Delete Event', function() {
        $.post(erly.urlFor.collection(self.eventData, 'delete'), {},
            function(data) {
          if (data.success) {
            erly.redirectTo('gallery', erly.session.currentUser);
          }
        });
      }, {type: 'remove'});
    });
  };

  eventForm.enablePasswordSelectionBindings = function() {
    var checkbox = $(DOM.passwordCheckbox);
    checkbox.change(function(e) {
      if (e) {
        if (e.target.checked) {
          $$(DOM.passwordInput).show();
          erly.events.fire(erly.events.SHOW_PASSWORD_PROTECT);
        } else {
          $$(DOM.passwordInput).hide();
          erly.events.fire(erly.events.HIDE_PASSWORD_PROTECT);
        }
      }
    });
  };

  eventForm.loadPhotoPicker = function(options) {
    options = options || {};

    _addPosts = new erly.viewer.AddPosts({});
    _addPosts.showAddPhotoDialog({
      data: _.extend({
        inline: true,
        insertSelector: DOM.addPhotoDialog,
        isAlbum: eventForm.eventData.isAlbum,
        isEventForm: true,
        templateSelector: '#tmplAddPhotoForm'
      }, options)
    });
  };

  var addStep = function(newStep) {
    if (!_currentStep) {
      _currentStep = newStep;
    } else {
      _lastStep.next = newStep;
      newStep.prev = _lastStep;
    }

    _lastStep = newStep;
  };

  eventForm.buildCreationSteps = function() {
    // Don't build the list if one already exists
    if (_currentStep !== null) {
      return;
    }

    addStep({
      containerSelector: DOM.eventDetailsContainer,
      title: 'Create ' + (this.eventData.isAlbum ?
        'a photo album' : 'an invitation'),
      staticHeight: true,
      canMoveForward: function() {
        // Make sure that all the essential info is there before proceeding
        var params = eventForm.validateAndGetParams(eventForm.getCurrentForm());
        if (!params) {
          return false;
        }

        return true;
      }
    });

    if (!this.eventData.isAlbum) {
      addStep({
        containerSelector: DOM.addPhotoDialog,
        title: 'Choose a cover photo',
        setupFunc: function() {
          eventForm.loadPhotoPicker({
            singleSelect: true,
            showPresetBackgrounds: true
          });

          $(DOM.addPhotoDialog).addClass('cover-picker');
        }
      });
    } else {
      addStep({
        containerSelector: DOM.addPhotoDialog,
        title: 'Add photos',
        canMoveForward: function() {
          // If no photos are to be added then just create the album
          if (_addPosts.getSelectedPhotos().length === 0) {
            eventForm.submit();
            return false;
          }

          return true;
        },
        setupFunc: function() {
          eventForm.loadPhotoPicker({
            showImageSearch: false
          });
        }
      });

      addStep({
        containerSelector: DOM.chooseCoverDialog,
        title: 'Choose a cover photo',
        requiresRefresh: true,
        shrinkToScreenOrContents: true,
        setupFunc: function() {
          // Load all the selected photos in one place
          var container = $(DOM.chooseCoverDialog);
          var photos = $('#tmplBackgroundPickerOption').tmpl(_addPosts.getSelectedPhotos());
          var subContainer = $('<div class="background-container"/>').html(photos);
          container.html(subContainer);

          photos.each(function(index) {
            $(this).click(function(e) {
              if ($(this).is('.selected')) {
                return;
              }

              photos.removeClass('selected');
              $(this).addClass('selected');

              var data = $(this).tmplItem().data;
              _coverPhoto = data;
            });
          });

          photos.first().click();

          var backgroundPickerLazyLoad = _.throttleImmediate(function() {
            $(DOM.chooseCoverDialog).find('img.lazy').each(function() {
              var image = $(this);
              image.attr('src', image.data('src'));
              image.removeClass('lazy');
              erly.centerImage(image, null, null, {
                ajaxLoaderQualifier: "-222222"
              });
            });
          }, 250);
          backgroundPickerLazyLoad();
        }
      });
    }
  };

  eventForm.goToBeginning = function() {
    $('.choices-container').show();
    $('.event-fields').hide();
    _currentStep = null;
  };

  eventForm.canNavigateToStep = function(forwards) {
    return !(forwards &&
        _currentStep.canMoveForward &&
        !_currentStep.canMoveForward());
  };

  eventForm.navigateToStep = function(forwards) {
    // Perform any last checks that this step requires before moving forward
    if (!eventForm.canNavigateToStep(forwards)) return;

    var prevStep = _currentStep;
    _currentStep = (forwards ? _currentStep.next : _currentStep.prev);

    if (forwards) {
      eventForm.updateHash(window.location.hash.replace(/(-2)?$/, '-2'));
    }
    else {
      eventForm.updateHash(window.location.hash.replace('-2', ''));
    }

    // Show the back button if we are not on the first step
    $(DOM.backButton).toggle(_currentStep.hasOwnProperty('prev'));

    // Show the cancel button if we are on the first step
    $(DOM.cancelButton).toggle(!_currentStep.prev);

    // Show the continue button if there's a next step
    $(DOM.continueButton).toggle(_currentStep.hasOwnProperty('next'));

    // Show the submit button if we are on the last step
    $(DOM.submitButton).toggle(!_currentStep.next);

    if (!_currentStep.isLoaded || _currentStep.requiresRefresh) {
      _currentStep.isLoaded = true;
      _currentStep.setupFunc();
    }

    var originalHeight = $(_currentStep.containerSelector).height();
    $(_currentStep.containerSelector).height($(prevStep.containerSelector).height());

    $(prevStep.containerSelector).hide();
    $(_currentStep.containerSelector).show();

    // Fade in the new title
    $(DOM.stepTitle).fadeOut('fast', function() {
      $(DOM.stepTitle).html(_currentStep.title);
      $(DOM.stepTitle).fadeIn('fast');
    });

    var resizeContainer = function(animate) {
      if (!_currentStep) {
        return;
      }

      var container = $(_currentStep.containerSelector);
      var buttonBarHeight = $('.event-form-wrapper .submit-bottom').last().outerHeight() + 5;
      var availableHeight = $(window).height() - buttonBarHeight - container.offset().top;

      var newHeight = Math.max(400, availableHeight);
      if (_currentStep.staticHeight) {
        newHeight = originalHeight;
      } else if (_currentStep.shrinkToScreenOrContents) {
        var contentsHeight = container.children('div').height();
        newHeight = Math.min(newHeight, contentsHeight);
      }

      // Adjsut the new container's height to its original
      container.animate({
          height: newHeight
        }, animate ? 500 : 0);
    };

    if (!_currentStep.staticHeight) {
      $(window).resize(function() {
        resizeContainer(false);
      });
    }
    resizeContainer(true);
  };

  eventForm.validateAndGetParams = function(form) {
    var valid = true;

    // Remove error shadows.
    form.find('input').removeClass('error-shadow');

    // Check title.
    $.each([DOM.titleInput], function(i, v) {
      var field = $(v);

      if (field.length >= 1) {
        var fieldval = $.trim(field.val());
        if (fieldval.length === 0) {
          valid = false;
          field.addClass('error-shadow');
        }
      }
    });

    // Check password.
    if ($(DOM.passwordCheckbox).length > 0) {
      var input = $(DOM.passwordInput);
      if ($(DOM.passwordCheckbox).attr('checked') && input.val() === '') {
        valid = false;
        input.addClass('error-shadow');
      }
    }

    // Parse the date and time fields.
    var dateFields;
    if (eventForm.dateHelper) {
      dateFields = eventForm.dateHelper.parseFields();
      if (!dateFields) {
        valid = false;
      }
    }

    if (!valid) {
      return null;
    }

    // Build the params hash.
    var keysToRemove = ['startDate', 'startTime', 'endDate', 'endTime'];
    var hash = paramsArrayToHash(form.serializeArray(), keysToRemove);

    // Use data('value') if it exists
    var streetValue = $(DOM.streetAddressInput).data('value');
    if (streetValue) {
      hash.streetAddress = streetValue;
    }

    // Clean up and set some fields.
    if (dateFields) {
      _.extend(hash, dateFields);
    }
    if (hash.description) {
      hash.description = $.trim(hash.description);
    }

    // Explicitly put values for all checkboxes, so unchecking a box works.
    form.find('input[type=checkbox]').each(function(i) {
      var name = $(this).attr('name');
      hash[name] = hash[name] ? 1 : 0;
      $(this).checked = true;
    });

    if (hash.hasOwnProperty('doNotAllowGuestsToInvite')) {
      hash.ownerOnly = hash.doNotAllowGuestsToInvite ? 1 : 0;
      delete hash.doNotAllowGuestsToInvite;
    }

    return hash;
  };

  eventForm.onEventUpsert = function(data) {
    if (!data.success) {
      erly.modal.showAlert('Sorry',
        'We ran into an error creating your collection.');
      return;
    }

    this.eventData = data;

    if (_options.onEventUpsert) {
      _options.onEventUpsert(data);
    }
  };

  eventForm.showDedupeModal = function(data, options) {
    _.each(data, erly.updateEventWithCalculatedFields);
    var template = $$('#tmplDedupeModal').tmpl({dupes: data});

    erly.modal.open({
      inline: true,
      href: template,
      onComplete: function() {
        template.find('img').each(function() {
          erly.centerImage($(this));
        });
        if (options.ignoreDedupedEvent) {
          $$(DOM.ignoreDedupeEventButton).click(function() {
            options.ignoreDedupedEvent();
          });
        }

        $$(DOM.cancelDedupeButton).click(function() {
          erly.modal.close();
        });
      }
    });
  };

  eventForm.enableSubmit = function() {
    eventForm.getCurrentForm().unbind('submit');
    eventForm.getCurrentForm().submit(this.submit);
  };

  // Enable the submit button on the "Edit Details" modal.
  eventForm.enableUpdate = function() {
    eventForm.getCurrentForm().unbind('submit');
    eventForm.getCurrentForm().submit(this.update);
  };

  // Enable the submit button on the "Privacy Settings" dropdown.
  eventForm.enablePrivacySubmit = function(onComplete) {
    eventForm.getCurrentForm().submit(this.update);
    eventForm.getCurrentForm().data('onComplete', onComplete);
  };

  eventForm.enableHintHovers = function() {
    $('.event-form-wrapper .hint-hover').each(function(index) {
      var hint = $(this).siblings('.hint,.hint-below');
      $(this).hover(function() { hint.show(); },
                    function() { hint.hide(); });
    });
  };

  eventForm.enableAddStreetAddress = function() {
    var scope = $$('.event-form-wrapper');
    scope.find('.show-street-address').click(function() {
      scope.addClass('has-street-address');
      _.defer(function() {
        new google.maps.places.Autocomplete($(DOM.streetAddressInput)[0], {});
      });
      repositionModal();
    });
  };

  eventForm.enableAutocomplete = function() {
    var bindAutocomplete = null;
    bindAutocomplete = function() {
      // Try to avoid race condition
      if ($(DOM.locationNameInput).length === 0) {
        setTimeout(bindAutocomplete, 500);
        return;
      }

      $('.pac-container').remove();

      var locationNameInput = $$(DOM.locationNameInput);
      var input = locationNameInput[0];

      // Prevent form submission if the google autocomplete is showing
      locationNameInput.keydown(function(e) {
        if ($('.pac-container:visible').length > 0 && e.which === 13) {
          return false;
        }
        return true;
      });

      var completer = new google.maps.places.Autocomplete(input, {});
      google.maps.event.addListener(completer, 'place_changed',
        function() {
          // Don't split the input into name and street address if it's an album
          if (eventForm.eventData.isAlbum) {
            return;
          }

          var currentInput = locationNameInput.val();
          var place = completer.getPlace();
          if (place.formatted_address) {
            locationNameInput.blur();
            // Jump down to street address if this is a street address or if
            // there are one or fewer commas
            if (/^\d+/.test(place.name) ||
                currentInput.split(',').length <= 2) {
              place.name = '';
            }
            locationNameInput.val(place.name);
            var displayLocation = erly.getFormattedStreetAddress({
              locationName: place.name,
              streetAddress: currentInput
            });
            $('.show-street-address').click();
            $(DOM.startDateInput).datepicker('hide');
            $(DOM.streetAddressInput).
              val(displayLocation).
              data('value', currentInput).focus();
          }
        });

      $(DOM.streetAddressInput).change(function() {
        // Clear value if it ever changes
        $(this).removeData('value');
      });
    };

    erly.events.subscribeOnce(erly.events.GOOGLE_AUTOCOMPLETE_LOADED,
      bindAutocomplete);

    this.loadGoogleAutocompleteAsync();
  };

  eventForm.loadGoogleAutocompleteAsync = function() {
    if (_googleAutocompleteLoaded) {
      this.notifyGoogleAutocompleteLoaded();
    } else {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'http://maps.googleapis.com/maps/api/js' +
        '?sensor=false' +
        '&libraries=places' +
        '&callback=erly.eventForm.notifyGoogleAutocompleteLoaded';
      $(script).appendTo($('body'));
    }
  };

  eventForm.notifyGoogleAutocompleteLoaded = function() {
    _googleAutocompleteLoaded = true;
    erly.events.fire(erly.events.GOOGLE_AUTOCOMPLETE_LOADED);
  };

  eventForm.disableButtons = function() {
    $(DOM.submitButton).attr('disabled', 'disabled');
  };

  eventForm.enableButtons = function() {
    $(DOM.submitButton).removeAttr('disabled');
  };

  eventForm.prepareSubmission = function(submit) {
    async.waterfall([
      function(callback) {
        eventForm.disableButtons();
        callback();
      },
      submit
    ], function(err) {
      eventForm.enableButtons();
      if (err === 'bail') { return; } // silently quit
      if (err) { erly.trackException(err, 'event_form.js@prepareSubmission'); }
    });
  };

  eventForm.submit = function() {
    var form = eventForm.getCurrentForm();
    eventForm.prepareSubmission(function(callback) {
      var params = eventForm.validateAndGetParams(form);
      if (!params) {
        callback('bail');
        return;
      }

      //Mark the event as an album if it is one
      params.isAlbum = eventForm.eventData.isAlbum;

      async.waterfall([
        // check for dupes
        function(callback) {
          checkForDedupedEvent(params, function(data) {
            if (data) {
              eventForm.showDedupeModal(data, {
                ignoreDedupedEvent: function() {
                  erly.modal.close();
                  callback();
                }
              });
              callback('bail');
            } else {
              callback();
            }
          });
        },
        // submit data
        function(callback) {
          $.ajax({
            type: 'POST',
            url: erly.urlFor.collection(),
            data: JSON.stringify(params),
            contentType: 'application/json; charset=utf-8',
            success: function(data) {
              if (data.error) {
                var err = data.error.message;
                if (err) {
                  if (typeof err === 'string') {
                    var container = $$(DOM.formWrapper);
                    container.find('.error').text(err);
                    _.delay(function() {
                      container.find('.error').text('');
                    }, 2000);
                  }
                }
                callback(data.error);
              }
              else {
                erly.track.chronicleCreate({seed: {type: 'noseed'}});
                callback(null, data);
              }
            },
            error: function(jqXHR, status, err) {
              callback(err || status);
            }
          });
        },
        // import photos if we need
        function(data, callback) {
          if (_importedFromAlbum) {
            erly.albumImporter.importAlbum(data, _importedPhotos,
                _importedFromAlbum, function(err) {
              if (err) { return callback(err); }
              _importedFromAlbum = null;
              _importedPhotos = null;
              callback(null, data);
            });
          } else if (_addPosts &&
                     _addPosts.getSelectedPhotos().length > 0) {
            if (!eventForm.eventData.isAlbum) {
              _coverPhoto = _addPosts.getSelectedPhotos()[0];
              return callback(null, data);
            }

            _addPosts.submitSelectedPhotos(data, function(err, posts) {
              if (err) {
                return callback(err);
              }

              data.posts = posts;

              callback(null, data);
            });
          }
          else {
            callback(null, data);
          }
        },
        // Set the cover photo if we have one
        function(data, callback) {
          if (_coverPhoto) {
            var postBody = {};
            _.each(data.posts, function(p) {
              if (p.photoIds === _coverPhoto.id) {
                postBody.postId = p.id;
              }
            });

            // If there isn't a post matching the chosen cover photo for some
            // reason, then we'll have to use the url of the chosen cover
            if (!postBody.postId) {
              postBody.coverPhotoUrl = _coverPhoto.original ||
                _coverPhoto.orig_url || _coverPhoto.picture ||
                _coverPhoto.origUrl || _coverPhoto.src || _coverPhoto.id;

              if (_coverPhoto.satchelItem && _coverPhoto.id) {
                postBody.satchelItemId = _coverPhoto.id;
              }

              if (!postBody.coverPhotoUrl)  {
                // bail if we can't set a photo
                return callback(null, data);
              }
            }
            $.post(erly.urlFor.collection(data, 'cover_photo'), postBody,
              function(res) {
                callback(null, data);
              }
            );
          } else {
            callback(null, data);
          }
        },
        // finally complete and redirect
        function(data, callback) {
          erly.redirectTo(data.url + "#newcollection");
          callback();
        }
      ], callback);
    });
  };

  eventForm.update = function() {
    var form = eventForm.getCurrentForm();
    eventForm.prepareSubmission(function(callback) {
      var params = eventForm.validateAndGetParams(form);
      if (!params) {
        callback('bail');
        return;
      }

      $.ajax({
        type: 'POST',
        url: erly.urlFor.collection(erly.viewer.collection, 'update'),
        data: JSON.stringify(params),
        contentType: 'application/json; charset=utf-8',
        success: function() {
          erly.modal.close();
          erly.viewer.refreshMetadata(true);

          var onComplete = form.data('onComplete');
          if (typeof onComplete === 'function') {
            onComplete();
          }
          callback();
        },
        error: function(jqXHR, status, err) {
          callback(err || status);
        }
      });
    });
  };

  eventForm.prefillFromAlbum = function(album, photos) {
    _importedFromAlbum = album;
    _importedPhotos = photos;
    $$(DOM.titleInput).val(album.caption);
    $$(DOM.titleInput).focus();
    $$(DOM.streetAddressInput).val(album.location);
    var startDate = erly.normalizeDate(album.startDate);
    $$(DOM.startDateInput).val(
      erly.dateFormatters.formatDateShortDayShortMonth(startDate));
    $$(DOM.startTimeInput).val(
      erly.dateFormatters.formatAlarmClock(startDate));

    $(DOM.continueButton).hide();
    $(DOM.submitButton).show();
    $(DOM.submitButton).focus();
  };

  eventForm.modalResize = function() {
    var modal = erly.modal.window();
    if (modal.height() > $(window).height()) {
      $('#cboxLoadedContent').addClass('vertical-scroll');
    }
    else {
      $('#cboxLoadedContent').removeClass('vertical-scroll');
    }
    modal.colorbox.resize({
      width: modal.width(),
      height: Math.min(modal.height(), $(window).height())
    });
  };

  eventForm.showModal = function(data) {
    var template = $('#tmplEditMetadataModal');
    if (!template || !template.length) {
      throw new Error('Please include the create_event template');
    }

    // Close drop down
    eventForm.getCurrentForm(false).find('.cancel-button').click();

    var self = this;
    attachTimezone(data, function() {
      eventForm.eventData = data;
      eventForm.dateHelper = new DateHelper(data);
      erly.modal.open({
        inline: true,
        href: template.tmpl(data),
        scrolling: false,
        onClosed: function() {
          $('#cboxLoadedContent').removeClass('vertical-scroll');
        },
        onComplete: function() {
          self.toggleDateInputs();

          eventForm.modalResize();
          _.defer(eventForm.modalResize);
          erly.events.subscribe(erly.events.SHOW_PASSWORD_PROTECT,
                                eventForm.modalResize);
          erly.events.subscribe(erly.events.HIDE_PASSWORD_PROTECT,
                                eventForm.modalResize);
          _.defer(_(eventForm.enableBindings).bind(eventForm, true));
        }
      });
    });
  };

  eventForm.showExtraSettingsDropDown = function(collection) {
    var template = $('#tmplExtraSettingsDropDown');

    if (!template || !template.length) {
      throw new Error('Please include the create_event template');
    }

    var self = this;
    var close = erly.modal.close;

    erly.modal.open({
      inline: true,
      href: template.tmpl(collection),
      onComplete: function() {
        eventForm.bindExtraSettingsEvents();
        eventForm.getCurrentForm(true).find('.cancel-button').click(close);
        self.enablePrivacySubmit(close);
        $('.extra-settings-modal .extra-settings .pwd-field').
          focus(erly.enterTextField).blur(erly.leaveTextField);
      }
    });
  };

  var tomorrowDate = function() {
    return erly.dateUtil.getNextDay(new Date());
  };

  eventForm.getStartDateTextForForm = function(event) {
    var d = event.displayStartDate ? event.displayStartDate :
      event.isAlbum ? new Date() : tomorrowDate();
    return erly.dateFormatters.formatDateShortDayShortMonth(d);
  };

  eventForm.getStartDatePlaceholder = function(event) {
    var d = event.isAlbum ? new Date() : tomorrowDate();
    return erly.dateFormatters.formatDateShortDayShortMonth(d);
  };

  eventForm.getCurrentForm = function(anal) {
    anal = typeof anal === 'undefined' || anal;
    return anal ? $$('.event-form-wrapper form') :
      $('.event-form-wrapper form');
  };

  erly.eventForm = eventForm;
}(erly));

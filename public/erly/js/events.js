/**
 * Events
 * #194 - Consider moving this to jQuery's native event system via trigger/bind
 * on the document object.
 */

(function(erly) {
  var events = {};

  events.NEW_USER = 'newuser';
  events.AUTHENTICATED = 'authd';
  events.NOT_AUTHENTICATED = 'not_authd';
  events.COMMENT_OPEN = 'commentOpen';
  events.MODAL_CLOSE = 'modalClose';
  events.MODAL_OPEN = 'modalOpen';
  events.SETTINGS_UPDATED = 'settingsUpdated';
  events.TAGGING_AUTOCOMPLETE_SHOWN = 'taggingAutocompleteShown';
  events.TAGGING_CONTACT_ADDED = 'taggingContactAdded';
  events.CAROUSEL_DRAGGED = 'carouselDragged';
  events.SERVICE_CONNECTED = 'serviceConnected';
  events.SERVICE_DISCONNECTED = 'serviceDisconnected';
  events.SERVICE_CONNECTION_DENIED  = 'serviceConnectionDenied';
  events.SUGGESTIONS_REFRESHED = 'suggestionsRefreshed';
  events.FACEBOOK_READY = 'facebookReady';
  events.SERVICE_DATA_IMPORTED = 'serviceImported';
  events.SERVICE_DATA_IMPORTING = 'serviceImporting';
  events.SERVICE_DATA_NOT_CONNECTED = 'serviceImportNone';
  events.SERVICE_DATA_IMPORT_ERROR = 'serviceImportingErr';
  events.SHOW_PASSWORD_PROTECT = 'showpwprot';
  events.HIDE_PASSWORD_PROTECT = 'hidepwprot';
  events.GOOGLE_AUTOCOMPLETE_LOADED = 'gautocompleteLoad';
  events.VANITY_URL_CHECK = 'vanityUrlCheck';
  events.VANITY_URL_GENERATE = 'vanityUrlGenerate';
  events.SWIPE_RIGHT_OPEN_CAROUSEL = 'swipeRightOpenCarousel';
  events.PROFILE_PICTURE_CHANGED = 'pc';
  events.INVITES_ADDED = 'invitesAdded';
  events.FLAGSTONE_IMAGE_SET = 'flagstoneImgSet';
  events.SCROLLED_TO_DETAILS = 'scrolledToDetails';
  events.COMPLETED_ENTERING_EDIT_MODE = 'completedEditModeEnter';
  events.BACKGROUND_PICKER_DISPLAYED = 'backgroundPickerDisplayed';
  events.INITIAL_LAYOUT_COMPLETE = 'initialLayoutComplete';
  events.DETAIL_COMMENTS_LOADED = 'detailCommentsLoaded';
  events.FONT_LOADED = 'fontLoaded';

  events.PAGE_READY = 'pageReady';

  events._listeners = {};

  events.fire = function(eventName, data) {
    var listeners = events._listeners[eventName] || [];
    $.each(listeners, function(i, v) {
      try {
        v(data);
      }
      catch (e) {
        erly.trackException(e, 'events.js@fire');
      }
    });
  };

  events.subscribe = function(eventName, handler) {
    var listeners = events._listeners[eventName];
    if (!listeners) {
      listeners = [];
      events._listeners[eventName] = listeners;
    }

    listeners.push(handler);
  };

  events.subscribeOnce = function(eventName, handler) {
    var f;

    f = function() {
      events.unsubscribe(eventName, f);
      handler.apply(this, arguments);
    };

    events.subscribe(eventName, f);
  };

  events.resubscribe = function(eventName, handler) {
    events.unsubscribe(eventName, handler);
    events.subscribe(eventName, handler);
  };

  events.unsubscribe = function(eventName, handler) {
    var listeners = events._listeners[eventName];

    if (listeners) {
      events._listeners[eventName] = _(listeners).reject(function(h) {
        return h === handler;
      });
    }
  };

  erly.events = events;
}(erly));

/*global exports: true */
/*jshint scripturl: true */
/*!
 * URL helper functions
 */

(function(erly) {
  erly.urlFor = {
    /**
     * @returns {String}
     */
    home: function() {
      var extras = Array.prototype.slice.call(arguments);
      if (extras[0].indexOf('#') === 0) {
        return '/' + extras[0];
      }
      else {
        return ['/'].concat(extras).join('/');
      }
    },

    signup: function() {
      if (typeof window !== 'undefined' &&
          window && window.location) {
        var relpath = window.location.pathname + window.location.search;
        return '/?return=' + encodeURIComponent(relpath) + '#signup';
      }
      else {
        return '/#signup';
      }
    },

    /**
     * @returns {String}
     */
    settings: function() {
      var extras = Array.prototype.slice.call(arguments);
      return ['/settings'].concat(extras).join('/');
    },

    /**
     * @returns {String}
     */
    contacts: function() {
      var extras = Array.prototype.slice.call(arguments);
      return ['/contacts'].concat(extras).join('/');
    },

    /**
     * @returns {String}
     */
    session: function() {
      var extras = Array.prototype.slice.call(arguments);
      return ['/session'].concat(extras).join('/');
    },

    /**
     * Returns a url for a collection `data`. Expects `ident` or `id` to be
     * defined.  Extra arguments are appended with slashes at the end of the
     * URL.
     *
     * @param {Object} data
     * @returns {String}
     */
    collection: function(data) {
      var extras = Array.prototype.slice.call(arguments, 1);

      if (typeof data === 'string') {
        extras = [data];
        data = null;
      }

      if (!data) {
        return ['/collection'].concat(extras).join('/');
      }
      else if (extras.length === 0 &&
          (data.ownerVanityName || (data.owner || {}).vanityName) &&
          data.vanityUrl) {
        return [
          '/user',
          data.ownerVanityName || (data.owner || {}).vanityName,
          encodeURIComponent(data.vanityUrl)
        ].join('/');
      } else {
        return [
          '/collection',
          (data.ident || data.id || data.chronicleIdent)
        ].concat(extras).join('/');
      }
    },

    collectionICS: function(data) {
      return [
        '/user',
        data.ownerVanityName || (data.owner || {}).vanityName,
        encodeURIComponent(data.vanityUrl)
      ].join('/') + '.ics';
    },

    activity: function(data) {
      if (data) {
        return '/activity/' + data.vanityName;
      }
      else {
        return '/';
      }
    },

    /**
     * Returns a url for a collection `data`. Expects `ident` or `id` to be
     * defined.  Extra arguments are appended with slashes at the end of the
     * URL.
     *
     * @param {Object} data
     * @returns {String}
     */
    gallery: function(data) {
      if ((erly.viewer || {}).exported) {
        return 'javascript:void(0)';
      }

      var extras = Array.prototype.slice.call(arguments, 1);
      if (extras.length === 1 && extras[0] === 'friends') {
        // special case
        return '/friends';
      }
      else if (extras.length === 1 && extras[0] === 'featured') {
        // special case
        return '/featured';
      }
      else if (!data || (typeof data === 'string' && data.indexOf('#') === 0)) {
        if (!data) {
          return '/timeline';
        }
        else {
          return '/timeline' + data;
        }
      }
      else {
        var url = [
          '/timeline',
          data.fromUserIdent || data.ident || data.id
        ].concat(extras);
        url = url.join('/');
        return url;
      }
    },

    signupConfirmation: function() {
      return '/signup_confirmation';
    },

    syncStatus: function(service) {
      return "/sync_status/" + service;
    },

    featured: function() {
      var args = Array.prototype.slice.call(arguments);
      return '/featured' + (args.length ? '/' + args.join('/') : '');
    }
  };
}(typeof exports !== 'undefined' ? exports : erly));

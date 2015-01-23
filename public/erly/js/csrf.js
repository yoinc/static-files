/*!
 * CSRF protection in jQuery ajax calls.
 */

(function(erly) {
  /**
   * Attaches a prefilter to the global jQuery ajax handler which includes the
   * CSRF token in any post bodies.
   *
   * @param {Object} token
   * @public
   */
  erly.tokenize = function(token) {
    $.ajaxPrefilter(function(options, originalOptions, jqXHR) {
      if (options.type.toLowerCase() === 'post') {
        options.headers = options.headers || {};
        options.headers['X-CSRF'] = $.param(token);
      }
    });
  };
}(erly));

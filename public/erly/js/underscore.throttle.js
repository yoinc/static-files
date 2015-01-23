_.mixin({
  /**
   * Adds _.throttleImmediate which invokes the method immediately before
   * waiting on a timeout.
   *
   * See _ issue: https://github.com/documentcloud/underscore/issues/170
   * @api public
   */
  throttleImmediate: function(fn, wait) {
    var timeout = null;
    return function() {
      if (timeout !== null) { return; }
      timeout = setTimeout(function() { timeout = null; }, wait);
      fn.apply(this, arguments);
    };
  },
  /**
   * Variant of throttleImmediate that always executes the last call to
   * fn
   */
  throttleImmediateFinal: function(fn, wait) {
    var timeout = null;
    var lastCall;

    var doLastCall = function() {
      timeout = setTimeout(function() {
        timeout = null;
        if (!lastCall.called) {
          doLastCall();
        }
      }, wait);

      fn.apply(lastCall.self, lastCall.args);
      lastCall.called = true;
    };

    return function() {
      lastCall = {
        self: this,
        args: arguments
      };

      if (timeout !== null) {
        return;
      }

      doLastCall();
    };
  }
});

$(function() {
  var browser = erly.browserSupport.detect();

  // Tries to use css transitions to animate the element
  $.fn.cssAnimate = function(options, duration, callback) {
    if (!erly.browserSupport.usesCssTransitions()) {
      this.animate(options, duration, callback);
      return;
    }

    if (typeof duration === 'function') {
      callback = duration;
      duration = null;
    }

    duration = duration || 200;
    var target = this;
    this.css('-webkit-transition-duration', duration / 1000 + 's');

    _.each(options, function(v, k) {
      if (k === 'left') {
        target.css('-webkit-transform', 'translate3d(' + v + 'px, 0, 0)');
      }
      else if (k === 'top') {
        target.css('-webkit-transform', 'translate3d(0, ' + v + 'px, 0)');
      }
      else {
        target.css(k, v);
      }
    });

    if (callback) {
      setTimeout(callback, duration);
    }

    return target;
  };
});

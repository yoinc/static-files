// Provide a click handler that doesn't fire if the CAROUSEL_DRAGGED event
// was fired
$.fn.safeClick = function(callback) {
  var target = this;
  if (target.length === 0) {
    return;
  }

  var existingCallback = this.data("__safeClickCallback");
  if (!callback){
    if (existingCallback) {
      existingCallback.apply(this, [{}]);
      return;
    }
  }

  // Eat the normal click behavior
  target.click(function() {
    return false;
  });

  // Allow programmatic clicks
  var downElement = null;
  var dragged = false;

  target.unbind("mousedown", existingCallback);
  target.mousedown(function(event) {
    downElement = event.currentTarget;

    dragged = false;
    erly.events.subscribeOnce(erly.events.CAROUSEL_DRAGGED, function() {
      dragged = true;
    });
  });

  target.unbind("mouseup", existingCallback);
  target.mouseup(function(event) {
    if (downElement === event.currentTarget && !dragged) {
      if (event.which === 1) { // only left clicks.
        callback.apply(this, [event]);
      }
    }

    event.preventDefault();

    return true;
  });

  this.data("__safeClickCallback", callback);
};


/*
 * Auto-expands the textarea and submits on Enter keypress
 *
 * options.focusFunc is called any time the textarea is focused
 * options.growFunc is called any time the textarea is sized
 * options.submitFunc is called when the Enter key is pressed
 */
$.fn.commentTextarea = function(options) {
  options = $.extend({
    handleEnterKey: true
  }, options);
  var textarea = this;
  if (!textarea.is('textarea') || textarea.length !== 1) {
    throw new Error('Only apply commentTextarea to a single textarea');
  }

  var originalHeight = textarea.height();
  var padding = textarea.outerHeight() - textarea.height();
  if ($.browser.mozilla) {
    padding = 0;
  }

  var sizeTextarea = function() {
    var newHeight = textarea.get(0).scrollHeight - padding;
    if (newHeight > options.maxHeight) {
      newHeight = options.maxHeight;
      textarea.css('overflow-y', 'scroll');
    }
    else {
      textarea.css('overflow-y', 'hidden');
    }
    textarea.height(originalHeight).height(newHeight);
    if (options.growFunc) {
      options.growFunc();
    }
    erly.enableWatermarks();
  };

  // If we've already applied the behavior, just resize the text area
  if (this.hasClass('comment-textarea')) {
    sizeTextarea();
    return;
  }

  textarea.css('overflow-y', 'hidden');

  textarea.focus(function() {
    sizeTextarea();

    if (options.focusFunc) {
      options.focusFunc();
    }
  }).keydown(function(e) {
    if (options.handleEnterKey && e.which === 13) {
      if (options.submitFunc) {
        options.submitFunc();
      }
      textarea.blur();

      e.preventDefault();
      return false;
    }

    sizeTextarea();
    return true;
  });

  this.addClass('comment-textarea');
};

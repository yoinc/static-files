// Shows the popup after hovering on the element for 500ms
// Delays hiding the popup until 250ms of being away from the element/popup
//
// if reposition is true, it centers the hoverup on the element
// setupFunc allows for extra setup when the popup comes up
$.fn.hoverUp = function(popup, options) {
  options = options || {};
  var target = $(this);

  var showMenu = false;
  var hoverDelay = options.hoverDelay || 200;
  var gracePeriod = options.gracePeriod || 350;
  var tryHideMenu = function() {
    showMenu = false;
    setTimeout(function() {
      if (!showMenu) {
        popup.fadeOut(function() {
          if (options.onClose) {
            options.onClose();
          }
        });
        target.removeClass('active');
      }
    }, gracePeriod);
  };

  var doShowMenu = function() {
    if (target.hasClass('active')) {
      return;
    }

    if (options.setupFunc) {
      options.setupFunc();
    }
    var pos = target.position();
    popup.fadeIn();
    if (options.respositionTop) {
      popup.css('top', pos.top + target.height() + 8 + 'px');
    }

    if (options.repositionLeft) {
      popup.css('left', pos.left + target.width() / 2 - popup.width() / 2 + 'px');
    }
    if (options.repositionLeftMargin) {
      popup.css('left', pos.left + target.width() / 2 - popup.width() / 2 + 70 + 'px');
    }
    target.addClass('active');

    popup.unbind('hover').unbind('unhover');
    popup.hover(function() {
      showMenu = true;
    }, tryHideMenu);
  };

  target.hover(function() {
    showMenu = true;

    setTimeout(function() {
      if (showMenu) {
        doShowMenu();
      }
    }, hoverDelay);
  }, tryHideMenu);

  if (!options.passthroughClick) {
    target.safeClick(doShowMenu);
  }
};


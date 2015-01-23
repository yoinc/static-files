// Hides all the children greater than limit and
// adds a toggle link.
//
// If hideLabel is undefined, it will only allow showing all children
$.fn.moreify = function(limit, showLabel, hideLabel) {
  var container = this;
  var hiding = false;
  var toggleLink = container.find('a.moreify-toggle');

  if (!showLabel) {
    showLabel = 'show all';
  }

  if (container.children().length <= limit) {
    return;
  }

  var hideSome = function() {
    var i;
    container.children().hide();
    toggleLink.parent().show();

    for (i = 0; i < limit; i++) {
      container.children().eq(i).show();
    }
    toggleLink.text(showLabel);
    hiding = true;
  };

  var showAll = function() {
    container.children().show();
    hiding = false;

    if (hideLabel) {
      toggleLink.text(hideLabel);
    }
    else {
      toggleLink.parent().hide();
    }
  };

  if (toggleLink.length === 0) {
    toggleLink = $('<a class="moreify-toggle" href="javascript:void(0)">' + showLabel + '</a>');
    toggleLink.safeClick(function() {
      if (hiding) {
        showAll();
      }
      else {
        hideSome();
      }
    });

    var div = $('<div style="text-align:right;"></div>');
    container.append(div.append(toggleLink));
  }

  hideSome();
};


/*
 * A time picker for jQuery
 *
 * Dual licensed under the MIT and GPL licenses.
 * Copyright (c) 2009 Anders Fajerson
 * @name     timePicker
 * @author   Anders Fajerson (http://perifer.se)
 * @example  $("#mytime").timePicker();
 * @example  $("#mytime").timePicker({step:30, startTime:"15:00", endTime:"18:00"});
 *
 * Based on timePicker by Sam Collet (http://www.texotela.co.uk/code/jquery/timepicker/)
 *
 * Options:
 *   step: # of minutes to step the time by
 *   startTime: beginning of the range of acceptable times
 *   endTime: end of the range of acceptable times
 *   defaultTime: if no time is entered, time used to select which time to start
 *                (or function that returns default time)
 *   separator: separator string to use between hours and minutes (e.g. ':')
 *   show24Hours: use a 24-hour scheme
 *   amFormat: string to indicate am
 *   pmFormat: string to indicate pm
 *   formatTime(int): takes a time (min since midnight) and returns a string
 *   parseTime: function that takes a string and returns a date
 */

(function($){
  $.fn.timePicker = function(options) {
    // Build main options before element iteration
    var settings = $.extend({}, $.fn.timePicker.defaults, options);
    settings.step = Math.max(1, settings.step);

    return this.each(function() {
      $.timePicker(this, settings);
    });
  };

  $.timePicker = function (elm, settings) {
    var e = $(elm)[0];
    return e.timePicker || (e.timePicker = new jQuery._timePicker(e, settings));
  };

  $.timePicker.version = '0.3.1';

  $._timePicker = function(elm, settings) {

    var tpOver = false;
    var keyDown = false;
    var startTime = timeToDate(settings.startTime, settings);
    var endTime = timeToDate(settings.endTime, settings);
    var selectedClass = "selected";
    var selectedSelector = "li." + selectedClass;
    var prevKey = 0;

    $(elm).attr('autocomplete', 'OFF'); // Disable browser autocomplete

    var classes = 'time-picker' + (settings.show24Hours ? '' : ' time-picker-12hours');
    var $tpDiv = $('<div class="' + classes + '"></div>');
    var $tpList = $('<ul></ul>');

    // Build the list.
    for (var time = new Date(startTime); time <= endTime;
         time = new Date(time.getTime() + settings.step * 60 * 1000)) {
      var min = minSinceMidnight(time);
      $tpList.append('<li min=' + min + '>' +
                     settings.formatTime(min) + '</li>');
    }
    $tpDiv.append($tpList);
    $tpDiv.appendTo('body').hide();  // append timePicker div and position it

    // Store the mouse state, used by the blur event. Use mouseover instead of
    // mousedown since Opera fires blur before mousedown.
    $tpDiv.mouseover(function() {
      tpOver = true;
    }).mouseout(function() {
      tpOver = false;
    });

    $("li", $tpList).mouseover(function() {
      if (!keyDown) {
        $(selectedSelector, $tpDiv).removeClass(selectedClass);
        $(this).addClass(selectedClass);
      }
    }).mousedown(function() {
      tpOver = true;
    }).click(function() {
      setTimeVal(this);
    });

    var bodyClickHandler;

    var showPicker = function() {
      if ($tpDiv.is(":visible")) {
        return false;
      }
      $("li", $tpDiv).removeClass(selectedClass);

      // Position
      var elmOffset = $(elm).offset();
      $tpDiv.css({'top':elmOffset.top + elm.offsetHeight, 'left':elmOffset.left});

      // Show picker. This has to be done before scrollTop is set since that
      // can't be done on hidden elements.
      $tpDiv.show();

      // Bind body click listener.
      $(document).bind('click.close-timepicker', bodyClickHandler);

      // Try to find a time in the list that matches the entered time.
      var time;
      if (elm.value) {
        time = settings.parseTime(elm.value);
      } else if (typeof settings.defaultTime === 'function') {
        time = timeToDate(settings.defaultTime(), settings);
      } else {
        time = timeToDate(settings.defaultTime, settings);
      }
      var roundMinutes = roundUp(minSinceMidnight(time), settings.step);
      var $matchedTime = $('li[min=' + roundMinutes + ']', $tpDiv);

      if ($matchedTime.length) {
        $matchedTime.addClass(selectedClass);
        // Scroll to matched time.
        $tpDiv[0].scrollTop = $matchedTime[0].offsetTop;
      }
      return true;
    };

    var hidePicker = function() {
      tpOver = false;
      keyDown = false;
      $tpDiv.hide();
      $(document).unbind('click.close-timepicker', bodyClickHandler);
    };

    bodyClickHandler = function(e) {
      if ($tpDiv.is(":visible") && !tpOver) {
        hidePicker();
      }
    };

    // Show picker when input is focused.
    $(elm).focus(showPicker);

    // Attach to click as well as focus so timePicker can be shown again when
    // clicking on the input when it already has focus. Cancel the event so
    // the body click handler doesn't immediately hide the picker again.
    $(elm).click(function() { showPicker(); return false; });

    // Hide timepicker on blur.
    $(elm).blur(function() {
      if (!tpOver) {
        hidePicker();
      }
    });

    // Handle a keypress: up/down arrows, enter, escape.
    var handleKey = function(e) {
      var $selected;
      keyDown = true;
      var top = $tpDiv[0].scrollTop;
      switch (e.keyCode) {
        case 38: // Up arrow.
          // Just show picker if it's hidden.
          if (showPicker()) {
            return false;
          };
          $selected = $(selectedSelector, $tpList);
          var prev = $selected.prev().addClass(selectedClass)[0];
          if (prev) {
            $selected.removeClass(selectedClass);
            // Scroll item into view.
            if (prev.offsetTop < top) {
              $tpDiv[0].scrollTop = top - prev.offsetHeight;
            }
          }
          else {
            // Loop to next item.
            $selected.removeClass(selectedClass);
            prev = $("li:last", $tpList).addClass(selectedClass)[0];
            $tpDiv[0].scrollTop = prev.offsetTop - prev.offsetHeight;
          }
          return false;
          break;
        case 40: // Down arrow, similar in behaviour to up arrow.
          if (showPicker()) {
            return false;
          };
          $selected = $(selectedSelector, $tpList);
          var next = $selected.next().addClass(selectedClass)[0];
          if (next) {
            $selected.removeClass(selectedClass);
            if (next.offsetTop + next.offsetHeight > top + $tpDiv[0].offsetHeight) {
              $tpDiv[0].scrollTop = top + next.offsetHeight;
            }
          }
          else {
            $selected.removeClass(selectedClass);
            next = $("li:first", $tpList).addClass(selectedClass)[0];
            $tpDiv[0].scrollTop = 0;
          }
          return false;
          break;
        case 13: // Enter
          if ($tpDiv.is(":visible")) {
            // Only take the "enter" if the previous key was an arrow.
            var sel = prevKey === 0 || prevKey === 38 || prevKey === 40 ?
              $(selectedSelector, $tpList)[0] : null;
            setTimeVal(sel);
          }
          return false;
          break;
        case 27: // Esc
          hidePicker();
          return false;
          break;
      }
      return true;
    };

    // Keypress doesn't repeat on Safari for non-text keys.
    // Keydown doesn't repeat on Firefox and Opera on Mac.
    // Using kepress for Opera and Firefox and keydown for the rest seems to
    // work with up/down/enter/esc.
    var event = ($.browser.opera || $.browser.mozilla) ? 'keypress' : 'keydown';
    $(elm)[event](function(e) {
      var ret = handleKey(e);
      prevKey = e.keyCode;
      return ret;
    });
    $(elm).keyup(function(e) {
      keyDown = false;
    });

    /* Update the element with a new time. */
    var setTimeVal = function(sel) {
      // Update input field
      if (sel) {
        elm.value = $(sel).text();
      }
      // Trigger element's change events.
      $(elm).change();
      // Keep focus for all but IE (which doesn't like it)
      if (!$.browser.msie) {
        elm.focus();
      }
      hidePicker();
    }

    // Helper function to get an input's current time as Date object.
    // Returns a Date object.
    this.getTime = function() {
      return timeToDate(elm.value, settings);
    };

    // Helper function to set a time input.
    // Takes a Date object or string.
    this.setTime = function(time) {
      elm.value = settings.formatTime(minSinceMidnight(
        timeToDate(time, settings)));
      // Trigger element's change events.
      $(elm).change();
    };

  }; // End fn;

  // Plugin defaults.
  $.fn.timePicker.defaults = {
    step:30,
    startTime: new Date(0, 0, 0, 0, 0, 0),
    endTime: new Date(0, 0, 0, 23, 30, 0),
    defaultTime: new Date(),
    separator: ':',
    show24Hours: true,
    amFormat: ' AM',
    pmFormat: ' PM',
  };

  // Default time formatter.
  $.fn.timePicker.defaults.formatTime = function(min) {
    function formatNumber(value) { return (value < 10 ? '0' : '') + value; }
    var h = Math.floor(min / 60);
    var minutes = min % 60;
    var hours = this.show24Hours ? h : (((h + 11) % 12) + 1);
    return formatNumber(hours) + this.separator + formatNumber(minutes) +
      (this.show24Hours ? '' : ((h < 12) ? this.amFormat : this.pmFormat));
  };

  // Default time parser.
  $.fn.timePicker.defaults.parseTime = function(str) {
    if (str) {
      var array = str.split(this.separator);
      var hours = parseFloat(array[0]);
      var minutes = parseFloat(array[1]);

      // Convert AM/PM hour to 24-hour format.
      if (!this.show24Hours) {
        var am = str.indexOf('am') !== -1 || str.indexOf('AM') !== -1;
        if (hours === 12 && am) {
          hours = 0;
        } else if (hours !== 12 && !am) {
          hours += 12;
        }
      }
      return new Date(0, 0, 0, hours, minutes, 0);
    }
    return null;
  };

  // Private functions.

  /* Round up 'x' to a multiple of 'by'. */
  function roundUp(x, by) {
    return (by - x % by) % by + x;
  }

  /* Convert a time, as either a Date object or a string, to a date */
  function timeToDate(input, settings) {
    return (typeof input == 'object') ? normaliseTime(input) :
      normaliseTime(settings.parseTime(input));
  }

  /* Normalise time object to a common date. */
  function normaliseTime(time) {
    time.setFullYear(2001);
    time.setMonth(0);
    time.setDate(0);
    return time;
  }

  /* Number of minutes since midnight. */
  function minSinceMidnight(time) {
    return time.getHours() * 60 + time.getMinutes();
  }
})(jQuery);

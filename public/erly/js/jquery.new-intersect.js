/*!
 * Override jquery.ui.droppable intersect to include borders
 */
(function($) {
  var originalIntersect = $.ui.intersect;
  $.ui.intersect = function(draggable, droppable, toleranceMode) {
    if (droppable.offset && droppable.options.includeBorders &&
        !droppable.bordersIncluded) {
      var element = $(droppable.element);
      var left = element.css('border-left-width');
      var top = element.css('border-top-width');

      droppable.offset = element.offset();
      droppable.offset.left -= parseInt(left, 10);
      droppable.offset.top -= parseInt(top, 10);
    }

    if (typeof droppable.options.intersectCallback === 'function') {
      droppable.options.intersectCallback(droppable);
    }

    return originalIntersect(draggable, droppable, toleranceMode);
  };
}(jQuery));

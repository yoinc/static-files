/*!
 * Triangle widgets
 */

(function(widgets) {
  var RIGHT = "right",
      LEFT = "left",
      BOTTOM = "bottom",
      TOP = "top",
      POSITIONS = [
        TOP,
        RIGHT,
        BOTTOM,
        LEFT
      ];

  var oppositePosition = function(pos) {
    switch (pos) {
      case RIGHT:
        return LEFT;
      case LEFT:
        return RIGHT;
      case BOTTOM:
        return TOP;
      case TOP:
        return BOTTOM;
    }
  };

  var makeBorderName = function(positionName, attr) {
    return "border-" + positionName + "-" + attr;
  };

  widgets.createPositionedBorderedTriangle = function(container, anchorEl, positionOffset, triangleOptions) {
    var borderedTriangleWidth = triangleOptions.borderWidth + 1;
    var triangle = widgets.borderedTriangle(triangleOptions);

    if (triangleOptions.position === 'left') {
      triangle.css("left", borderedTriangleWidth * -1 + 1);
      container.css("left", erly.cssPixels(container, "left") + borderedTriangleWidth + positionOffset);
    } else {
      triangle.css("right", -borderedTriangleWidth);
      container.css('left', erly.cssPixels(container, "left") - (borderedTriangleWidth + positionOffset));
    }

    triangle.css("position", "absolute");

    triangle.appendTo(container);
    return triangle;
  };

  // Returns a DOM element with a bordered triangle
  // really two triangles overlayed on one another, inside a wrapper
  // (used for flexibility in positioning).
  //
  // This method takes the same args as widgets.triangle,
  // but also takes an additional (required) borderColor
  widgets.borderedTriangle = function(options) {
    var wrapper = $("<div class='bordered-triangle'></div>");

    var borderColor = options.borderColor;
    delete options.borderColor;

    var foregroundOptions = options;
    var backgroundOptions = $.extend({}, options);
    backgroundOptions = $.extend(backgroundOptions, {color: borderColor});

    var background = widgets.triangle(backgroundOptions).appendTo(wrapper);
    var foreground = widgets.triangle(foregroundOptions).appendTo(background);

    var negativeBorderWidth = options.borderWidth * -1;

    switch(options.position) {
      case RIGHT:
        foreground.css("margin-left", negativeBorderWidth - 1);
        foreground.css("margin-top", negativeBorderWidth);
        break;
      case LEFT:
        foreground.css("margin-left", 1);
        foreground.css("margin-top", negativeBorderWidth);
        break;
      case TOP:
        foreground.css("margin-left", negativeBorderWidth);
        foreground.css("padding-top", 1);
        break;
      case BOTTOM:
        foreground.css("margin-left", negativeBorderWidth);
        foreground.css("margin-top", negativeBorderWidth - 1);
        break;
    }

    return wrapper;
  };

  // Returns a triangle jquery element for insertion into
  // the DOM.
  //
  // Required params:
  //
  //   position: right | left | top | bottom (position in which the triangle is pointing)
  //   borderWidth
  //   color
  //
  widgets.triangle = function(options) {
    var givenPosition = options.position;
    var triangle = $("<div class='triangle-" + givenPosition + "'></div>");

    $.each(POSITIONS, function(i, pos) {
      var width = makeBorderName(pos, "width");
      var color = makeBorderName(pos, "color");

      if (pos === givenPosition) {
        triangle.css(width, 0);
      } else {
        triangle.css(width, options.borderWidth);
      }
    });

    triangle.css("border-color", "transparent");

    // set the color to the opposite pos that it is pointing to
    triangle.css(makeBorderName(oppositePosition(givenPosition), "color"), options.color);

    triangle.css("border-style", "solid");
    triangle.css('width', 0);
    triangle.css('height', 0);

    return triangle;
  };
}(erly.widgets = erly.widgets || {}));

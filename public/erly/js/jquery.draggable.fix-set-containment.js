/*!
 * Override _setContainment to ignore scrollWidth since it WebKit-based
 * browsers will grow scrollWidth as absolutely positioned element moves out of
 * its viewport.
 */
(function($) {
  var setContainment = $.ui.draggable.prototype._setContainment;
  $.ui.draggable.prototype._setContainment = function() {
    setContainment.apply(this);
    var o = this.options;
    if (o.useContainmentScrollHack) {
      if(!(/^(document|window|parent)$/).test(o.containment) &&
          o.containment.constructor !== Array) {
        var c = $(o.containment);
        var ce = c[0]; if(!ce) return;
        var co = c.offset();

        if (this.containment.length >= 3) {
          this.containment[2] = ce.offsetWidth -
            (parseInt($(ce).css("borderLeftWidth"), 10) || 0) -
            (parseInt($(ce).css("paddingRight"), 10) || 0) -
            this.helperProportions.width -
            this.margins.left -
            this.margins.right;
          this.containment[3] = ce.offsetHeight -
            (parseInt($(ce).css("borderTopWidth"), 10) || 0) -
            (parseInt($(ce).css("paddingBottom"), 10) || 0) -
            this.helperProportions.height -
            this.margins.top -
            this.margins.bottom;
        }
      }
    }
  };
}(jQuery));

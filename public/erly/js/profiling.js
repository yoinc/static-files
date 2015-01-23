/*!
 * Profiling helper
 */

(function(erly) {
  var profiling = {};
  var last = {};
  profiling.mark = function(category,label) {
    var newTime = new Date().getTime();
    last[category] = last[category] || newTime;
    console.warn("[" + category + "] " + label + ": " +
      (newTime - last[category]));
    last[category] = newTime;
  };
  profiling.reset = function(category) {
    profiling.mark(category, "reset");
    delete last[category];
  };
  erly.profiling = profiling;
}(erly));

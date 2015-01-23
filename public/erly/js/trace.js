erly.trace = (function(erly) {
  var _limit = 200; // 200 trace values
  var _entries = [];

  // write a value into the trace
  var write = function(value) {
    if (_entries.length === _limit) {
      _entries.shift();
    }
    _entries.push([new Date().getTime(), value]); // type agnostic
  };

  // clear the trace
  var clear = function() {
    _entries = [];
  };

  // read the last 200 values in the trace
  var read = function() {
    return JSON.stringify(_entries);
  };

  return {
    write: write,
    clear: clear,
    read: read
  };
}(erly));

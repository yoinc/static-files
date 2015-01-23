/*!
 * Copies async.queue (https://github.com/caolan/async) and adds some extra
 * functionality.
 */
(function(async) {
  /**
   * Extension of `async.queue` adding:
   *
   *  `flush`: Removes all queued tasks (does not cancel any currently
   *    running).
   *  `unshift`: Places a task onto the front of the deque so it will be run
   *    next.
   *  `nextTask`: Overridable function that allows one to change the order that
   *    tasks are run, defaults to `tasks.shift()`.
   */
  async.customQueue = function (worker, concurrency) {
    var workers = 0;
    var tasks = [];
    var q;
    var processNext = function() {
      if (q.saturated && tasks.length === concurrency) q.saturated();
      async.nextTick(q.process);
    };
    q = {
      concurrency: concurrency,
      saturated: null,
      empty: null,
      drain: null,
      unshift: function (data, callback) {
        tasks.unshift({data: data, callback: callback});
        processNext();
      },
      flush: function() {
        tasks = [];
      },
      push: function (data, callback) {
        tasks.push({data: data, callback: callback});
        processNext();
      },
      nextTask: function(tasks) {
        return tasks.shift();
      },
      process: function () {
        if (workers < q.concurrency && tasks.length) {
          var task = q.nextTask(tasks);
          if(q.empty && tasks.length === 0) q.empty();
          workers += 1;
          worker(task.data, function () {
            workers -= 1;
            if (task.callback) {
              task.callback.apply(task, arguments);
            }
            if (q.drain && tasks.length + workers === 0) q.drain();
            q.process();
          });
        }
      },
      length: function () {
        return tasks.length;
      },
      running: function () {
        return workers;
      }
    };
    return q;
  };
}(async));

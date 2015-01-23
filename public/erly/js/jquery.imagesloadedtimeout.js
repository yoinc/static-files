// $('img.photo',this).imagesLoaded(myFunction)
// execute a callback when all images have loaded.
// needed because .load() doesn't work on cached images

// mit license. paul irish. 2010.
// webkit fix from Oren Solomianik. thx!

// callback function is passed the last image to load
//   as an argument, and the collection as `this`

// NOTE: Modified by andrewlin12 to include a timeout
$.fn.imagesLoadedTimeout = function(timeout, callback) {
  if (typeof timeout === 'function') {
    callback = timeout;
    timeout = 10000;
  }

  var elems = this.find('img'), len = elems.length, blank = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  if (elems.length === 0 && this.length === 1 && this.get(0).tagName.toLowerCase() === 'img') {
    elems = $(this);
    len = 1;
  }

  var completed = false;
  var complete = function(thisRef) {
    if (!completed) {
      completed = true;
      callback.call(thisRef, elems);
    }
  };

  setTimeout(function() {
    complete();
  }, timeout);

  elems.bind('load', function() {
    if (--len <= 0 && this.src !== blank) {
      complete(this);
    }
  }).each(function() {
    // cached images don't fire load sometimes, so we reset src.
    if (this.complete || this.complete === undefined) {
      var src = this.src;
      // webkit hack from http://groups.google.com/group/jquery-dev/browse_thread/thread/eee6ab7b2da50e1f
      // data uri bypasses webkit log warning (thx doug jones)
      this.src = blank;
      this.src = src;
    }
  });

  return this;
};


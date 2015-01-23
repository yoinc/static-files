/*!
 * embed handler
 */

(function(erly) {
  var embed = {};
  function fetchPosts(callback) {
    $.get(erly.urlFor.collection(erly.viewer.collection, 'posts'),
      function(data) {
        callback(null, data);
      }
    ).error(function(xhr, status, err) {
      callback(err);
    });
  }
  embed.layout = function(collection) {
    $('html').css('overflow', 'hidden');
    $('body').css('background', 'transparent');
    var container = $$('#embedPostsContainer');
    container.height($(window).height());
    erly.viewer.collection = collection;
    erly.viewer.setupTooltips();
    $('#logo >a').hoverUp($('#return'), {
      hoverDelay: 100,
      passthroughClick: true
    });
    fetchPosts(function(err, posts) {
      if (err) return erly.trackException(err, 'embed.js@fetchPost');
      posts.unshift({
        type: 'link',
        image: (erly.viewer.collection.coverPhoto || {}).url,
        from: erly.viewer.collection.owner,
        fromUserId: erly.viewer.collection.ownerId,
        link: erly.urlFor.collection(erly.viewer.collection),
        linkedChronicleData: erly.viewer.collection,
        title: erly.viewer.collection.title
      });
      erly.viewer.setCarousel(
        new erly.viewer.Carousel(collection, posts, container, {}, function() {
          $('.top-shadow').hide();
          $('.bottom-shadow').hide();
          _.defer(function() {
            erly.viewer.zoom($('.card').first());
          });
          erly.viewer.Metadata.setupShareCommands();
        })
      );
    });
    embed.enableToolbar();
    erly.session.loadFacebookScripts();
  };
  embed.enableToolbar = function() {
    // cache body height and refresh on resize
    var bheight;
    bheight = $('body').height();
    $('body').resize(function() {
      bheight = $('body').height();
    });
    // detect when the mouse is within 25% of the bottom of the window
    var moving = false, showing = false;
    $('body').mousemove(function(ev) {
      if (moving) return;
      moving = true;
      if (bheight * 0.75 <= ev.pageY) {
        if (!showing) {
          $('.embed-toolbar').fadeIn(function() {
            showing = true;
            moving = false;
          });
        }
        else {
          moving = false;
        }
      }
      else {
        if (showing) {
          $('.embed-toolbar').fadeOut(function() {
            showing = false;
            moving = false;
          });
        }
        else {
          moving = false;
        }
      }
    });
  };
  erly.embed = embed;
}(erly));

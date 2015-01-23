/*!
 * Viewer tease class
 */

(function(viewer) {
  var Tease = function(container) {
    this._container = container;
    viewer.Tease.instance = this;
  };

  Tease.prototype.show = function() {
    this._container.show();
  };

  Tease.prototype.hide = function() {
    this._container.hide();
  };

  Tease.prototype.update = function(posts) {
    if (!posts) {
      posts = erly.viewer.Carousel.instance.getPostData();
    }

    var typeCounts = {};
    var typeImages = {};

    _.each(posts, function(post) {
      // Collate all under the same generic 'item' type
      var type = 'post'; // post.type;
      typeCounts[type] = typeCounts[type] || 0;
      typeCounts[type]++;

      // Use the first photo post as the tease photo
      if (post.type === 'photo' && !typeImages[type]) {
        typeImages[type] = post.picture || post.image;
      }
    });

    this._teaseData = [];
    _.each(typeCounts, function(count, type) {
      this._teaseData.push({
        type: type,
        count: count,
        image: typeImages[type]
      });
    }, this);

    var rendered = $$('#tmplViewerTease').tmpl({items: this._teaseData});
    this._container.html(rendered);
    if (!erly.browserSupport.hasCssTransitions()) {
      this._container.find('.viewer-tease').
        css('background', 'url(/erly/img/bg-black-70.png)');
    }

    this._container.find('.stack .image img').each(function() {
      erly.centerImage($(this), null, null, {
        noLoader: true
      });
    });
  };

  viewer.Tease = Tease;
}(erly.viewer));

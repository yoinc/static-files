if (typeof erly === 'undefined') { erly = {}; }

erly.productTour = (function() {
  var self = {};

  var selectors = {
    services:         ".product-tour .flexible .content-list li",
    bodyLinks:        ".product-tour a",
    slides:           ".product-tour .slideshow-container .slides .slide",
    slideViewport:    ".product-tour .slideshow-container .slides",
    slideButtons:     ".product-tour .request-types .button",
    productTourVideo: ".product-tour .about-video"
  };

  var el = function(selectorName) {
    return $(selectors[selectorName]);
  };

  self.bindings = {};

  self.bindings.scrollHeaders = function() {
    var links = el("bodyLinks");

    _.each(links, function(link) {
      link = $(link);
      var href = link.attr("href");

      if (href[0] === '#' && href[1]) {
        var target = $(href);

        link.click(function() {
          $("body").stop().animate({
            scrollTop: target.offset().top - 8
          }, 'slow');
        });
      }
    });
  };

  self.bindings.hoverServiceTitles = function() {
    _.each(el("services"), function(service) {
      service = $(service);
      var image = service.find("img");
      var title = service.find(".title");

      image.hover(function() {
        title.stop().animate({
          opacity: 1
        }, 'slow');
      }, function() {
        title.stop().animate({
          opacity: 0
        }, 'slow');
      });
    });
  };

  self.bindings.productTourVideo = function() {
    el("productTourVideo").click(erly.showProductVideo);
  };

  self.slideShow = {};

  self.slideShow.slideWidth = null; // calculated

  self.slideShow.init = function() {
    self.slideShow.slideWidth = el("slides").eq(0).outerWidth();

    self.slideShow.setLeftPositions();
    self.slideShow.centerText();
    self.slideShow.bindings.buttons();
    self.slideShow.selectButton(0, 0);
  };

  self.slideShow.calculateSlideOffset = function(slideNum) {
    return (slideNum * self.slideShow.slideWidth);
  };

  self.slideShow.selectButton = function(slideNum, animationTime) {
    if (typeof animationTime === 'undefined') {
      animationTime = 500;
    }

    var slideViewport = el("slideViewport");
    var buttons = el("slideButtons");

    slideViewport.animate({
      scrollLeft: self.slideShow.calculateSlideOffset(slideNum)
    }, animationTime, function() {
      buttons.removeClass("selected");
      buttons.eq(slideNum).addClass("selected");
    });
  };

  self.slideShow.setLeftPositions = function() {
    var slides = el("slides");

    _.each(slides, function(slide, index) {
      slide = $(slide);
      slide.css("left", self.slideShow.calculateSlideOffset(index));
    });
  };

  self.slideShow.centerText = function() {
    _.each(el("slides"), function(slide) {
      slide = $(slide);
      var slideHeight = slide.innerHeight();
      var innerHeight = slide.find("p").height();
      var heightDifference = slideHeight - innerHeight;
    });
  };

  self.slideShow.bindings = {};

  self.slideShow.bindings.buttons = function() {
    _.each(el("slideButtons"), function(button, index) {
      button = $(button);

      button.click(function() {
        self.slideShow.selectButton(index);
      });
    });
  };

  self.init = function() {
    $(document).ready(function() {
      self.bindings.scrollHeaders();
      self.bindings.hoverServiceTitles();
      self.bindings.productTourVideo();
      self.slideShow.init();
    });
  };

  return self;
})();

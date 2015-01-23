/*
 * info is an array of {src, startScale, endScale} and some
 * reasonable combination of top, left, bottom, right
 *
 * fadeTime is the transition fade duration in ms
 *
 * backupPlan is the image that will serve as the backup
 * in case nothing is large enough (it should be included
 * in info and it will be filtered out if it isn't needed)
 */
$.fn.fakekenburns = function(info, options) {
  var target = $(this);

  if (target.hasClass("fakekenburns")) {
    return;
  }
  target.addClass("fakekenburns");

  target.empty();
  target.css("overflow", "hidden");
  target.css("position", "relative");

  var images;
  var imagesInfo = [];

  var loadedCount = 0;
  var checkComplete = function() {
    loadedCount++;
    if (loadedCount === info.length) {
      var withoutBackup = _(imagesInfo).filter(function(v) {
        return !v.isBackup;
      });
      if (withoutBackup.length > 0) {
        imagesInfo = withoutBackup;
      }

      // The algorithm doesn't like just one image - duplicate if needed
      if (imagesInfo.length === 1) {
        imagesInfo[1] = imagesInfo[0];
      }

      // Add all the images to the container and put them
      // in the proper position
      $.each(imagesInfo, function(i, v) {
        var img = v.jqImg;
        img.css("position", "absolute");
        img.css("opacity", 0);
        img.height(v.startH);
        img.width(v.startW);

        if (v.direction) {
          // If a center point and direction are specified, then calculate
          // the starting position
          var cx = Math.round(v.centerX * v.startW / v.w);
          var cy = Math.round(v.centerY * v.startH / v.h);
          var containerW = target.width();
          var containerH = target.height();
          var boundingBox = {};
          if (v.direction[0] === "t") {
            var cssTop = Math.min(0, Math.round(containerH / 2 - cy));
            img.css("top", cssTop + "px");
            boundingBox.bottom = cssTop + v.endH;
          }
          else {
            var cssBottom = Math.min(0, Math.round(cy + containerH / 2 - v.startH));
            img.css("bottom", cssBottom + "px");
            boundingBox.top = cssBottom + v.endH;
          }

          if (v.direction[1] === "l") {
            var cssLeft = Math.min(0, Math.round(containerW / 2 - cx));
            img.css("left", cssLeft + "px");
            boundingBox.right = cssLeft + v.endW;
          }
          else {
            var cssRight = Math.min(0, Math.round(cx + containerW / 2 - v.startW));
            img.css("right", cssRight + "px");
            boundingBox.left = cssRight + v.endW;
          }

          // ensure we don't see gray when shrinking
          if (v.endH < v.startH && v.endW < v.startW) {
            var heightAdj = 0;
            var widthAdj = 0;
            if (boundingBox.top && boundingBox.top > 0) {
              heightAdj = boundingBox.top;
            }
            if (boundingBox.bottom && boundingBox.bottom < containerH) {
              heightAdj = containerH - boundingBox.bottom;
            }
            if (boundingBox.left && boundingBox.left > 0) {
              widthAdj = boundingBox.left;
            }
            if (boundingBox.right && boundingBox.right < containerW) {
              widthAdj = containerW - boundingBox.right;
            }
            if (widthAdj > 0 || heightAdj > 0) {
              if (widthAdj > heightAdj) {
                heightAdj = widthAdj * v.startH / v.startW;
              } else {
                widthAdj = heightAdj * v.startW / v.startH;
              }
              v.endH += heightAdj;
              v.endW += widthAdj;
            }
          }
        }
        else {
          $.each(["top", "left", "right", "bottom"], function(i, prop) {
            if (v[prop]) {
              img.css(prop, v[prop]);
            }
          });
        }

        target.append(img);
        if (i === 0) {
          img.animate({
            opacity: 1.0
          });
        }
      });

      images = target.find("img");

      var currentImageIndex = 0;
      var animateNext;
      animateNext = function() {
        var image = images.eq(currentImageIndex);
        var imageInfo = imagesInfo[currentImageIndex];

        // current w and h of the image
        var w = image.width();
        var h = image.height();

        var nextImageIndex = (currentImageIndex + 1) % imagesInfo.length;
        var nextImage = images.eq(nextImageIndex);
        var nextImageInfo = imagesInfo[nextImageIndex];

        // Create animation for fading b/w images
        var doTransition = function(time) {
          image.animate({
            height: imageInfo.endH,
            width: imageInfo.endW,
            opacity: 0
          }, time, imageInfo.easing, function() {
            image.height(imageInfo.startH);
            image.width(imageInfo.startW);
            image.css("opacity", 0);

            currentImageIndex = nextImageIndex;
            setTimeout(animateNext, 0);
          });

          nextImage.animate({
            height: nextImage.height() + Math.round((nextImageInfo.endH - nextImageInfo.startH) * time / nextImageInfo.time),
            width: nextImage.width() + Math.round((nextImageInfo.endW - nextImageInfo.startW) * time / nextImageInfo.time),
            opacity: 1.0
          }, time, nextImageInfo.easing);
        };

        var remainingTime = Math.round(imageInfo.time * (w - imageInfo.endW) / (imageInfo.startW - imageInfo.endW));
        var prefadeTime = Math.max(0, remainingTime - options.fadeTime);

        // Animate enough to get us to the next transition
        image.animate({
          height: h + Math.round((imageInfo.endH - imageInfo.startH) * prefadeTime / imageInfo.time),
          width: w + Math.round((imageInfo.endW - imageInfo.startW) * prefadeTime / imageInfo.time)
        }, prefadeTime, imageInfo.easing, function() {
          doTransition(Math.min(remainingTime, options.fadeTime));
        });
      };

      var setupHover = function(t) {
        t.hover(function() {
          if (images) {
            animateNext(true);
          }
        }, function() {
          target.find("img").stop(true);
        });
      };

      if (options.additionalHoverZones) {
        setupHover(options.additionalHoverZones);
      }
      setupHover(target);
    }
  };

  options.backupPlan.isBackup = true;
  info.push(options.backupPlan);
  // Preload all images into imagesInfo
  $.each(info, function(i, v) {
    var img = new Image();
    var jqImg = $(img);

    var fillPlan = function(imgWidth, imgHeight) {
      var baseScale = Math.max(target.width() / imgWidth, target.height() / imgHeight);
      // If successful, add it to the "good" list
      v.h = imgHeight;
      v.w = imgWidth;
      v.startW = Math.round(v.w * v.startScale * baseScale);
      v.endW = Math.round(v.w * v.endScale * baseScale);
      v.startH = Math.round(v.h * v.startScale * baseScale);
      v.endH = Math.round(v.h * v.endScale * baseScale);
      v.easing = "linear";
      v.jqImg = jqImg;

      // only if it meets a certain size criteria
      if (v.w >= 300 && v.h >= 200) {
        imagesInfo.push(v);
      }

      checkComplete();
    };

    if (v.dimensions) {
      fillPlan(v.dimensions.width, v.dimensions.height);
    }
    else {
      // onload for image.
      jqImg.load(function() {
        fillPlan(img.width, img.height);
      });
    }

    jqImg.error(function() {
      checkComplete();
    });

    img.src = v.src;
    img.alt = "image";
  });
};


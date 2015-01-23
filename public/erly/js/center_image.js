(function(erly) {
  var BLANK_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

  var delayedLoader = function(image, ajaxLoaderQualifier, w, h) {
    var _needsLoader = true;
    setTimeout(function() {
      if (_needsLoader) {
        image.animate({
          opacity: 0.01
        }, 1);

        var loaderImg = $('<img class="image-loader" src="/erly/img/ajax-loader' +
          (ajaxLoaderQualifier ? ajaxLoaderQualifier : '') +
          '.gif" alt="photo" />');
        loaderImg.css({
          left: (w - 32) / 2 + "px",
          top: (h - 32) / 2 + "px"
        }).animate({opacity: 1}, 1);

        image.first().after(loaderImg);
      }
    }, 1000);

    return {
      hide: function() {
        image.first().parent().find('img.image-loader').remove();
        _needsLoader = false;
      }
    };
  };

  var topAlign = function(result) {
    result.top = 0;
    if (result.letterbox) {
      result.letterbox.top = 0;
    }

    if (result.limitedStretch) {
      result.limitedStretch.top = 0;
    }
  };

  var getBestFit = function(w, h, containerWidth, containerHeight, maxStretch,
      faces) {
    var ar = w / h;
    var containerAR = containerWidth / containerHeight;
    faces = faces || [];
    var result = {};
    if (w >= h && (containerHeight * ar > containerWidth)) {
      result.height = containerHeight;
      result.width = Math.round(result.height * ar);
      result.top = 0;
      result.left = -Math.round((Math.round(containerHeight * ar) -
        containerWidth) / 2);

      if (faces.length > 0) { // attempt to slide l/r so that faces show.
        var minFaceX = faces[0].x;
        var maxFaceX = faces[0].x + faces[0].width;
        var avgFaceX = (faces[0].x + faces[0].width / 2) / faces.length;
        _(faces.slice(1)).forEach(function(face) {
          if (face.x < minFaceX) {
            minFaceX = face.x;
          }
          if (face.x + face.height > maxFaceX) {
            maxFaceX = face.x + face.width;
          }
          avgFaceX += (face.x + face.width / 2) / faces.length;
        });

        minFaceX *= (containerHeight * ar) / w;
        maxFaceX *= (containerHeight * ar) / w;
        if (result.left < -minFaceX && avgFaceX < (w / 2)) {
          result.left = -minFaceX;
        }
        else if ((-result.left + containerWidth) < maxFaceX &&
            avgFaceX > (w / 2)) {
          result.left = -(maxFaceX - containerWidth);
        }
      }

    }
    else {
      result.width = containerWidth;
      result.height = Math.round(result.width / ar);
      result.left = 0;
      result.top = Math.min(0,
        -Math.round((Math.round(containerWidth / ar) - containerHeight) / 3));

      if (faces.length > 0) {
        var minFaceY = faces[0].y;
        var maxFaceY = faces[0].y + faces[0].height;
        var avgFaceY = (faces[0].y + faces[0].height / 2) / faces.length;
        _(faces.slice(1)).forEach(function(face) {
          if (face.y < minFaceY) {
            minFaceY = face.y;
          }
          if (face.y + face.height > maxFaceY) {
            maxFaceY = face.y + face.height;
          }
          avgFaceY += (face.y + face.height / 2) / faces.length;
        });

        minFaceY *= (containerWidth / ar) / h;
        maxFaceY *= (containerWidth / ar) / h;
        if (result.top < -minFaceY && avgFaceY < (h / 2)) {
          result.top = -minFaceY;
        }
        else if ((-result.top + containerHeight) < maxFaceY &&
            avgFaceY > (h / 2)) {
          result.top = -(maxFaceY - containerHeight);
        }
      }
    }

    // Handle letterboxing
    if (w < containerWidth || h < containerHeight) {
      result.letterbox = {};
      // If it's a portrait image or landscape container
      if ((ar < 1 || containerAR > 1) && h > containerHeight) {
        result.letterbox.top = Math.round((containerHeight - h) / 3);
      }
      else {
        result.letterbox.top = Math.round((containerHeight - h) / 2);
      }
      result.letterbox.left = (containerWidth - w) / 2;
      result.letterbox.height = h;
      result.letterbox.width = w;
    }

    // Limited stretch
    if (w < containerWidth || h < containerHeight) {
      maxStretch = maxStretch || 1;
      result.limitedStretch = {};
      var scale = Math.min(Math.min(w * maxStretch, containerWidth) / w,
        Math.min(h * maxStretch, containerHeight) / h);
      result.limitedStretch.height = Math.round(h * scale);
      result.limitedStretch.width = Math.round(w * scale);
      if (result.limitedStretch.height > containerHeight) {
        result.limitedStretch.top = Math.round(
          (containerHeight - result.limitedStretch.height) / 3);
      }
      else {
        result.limitedStretch.top = Math.round(
          (containerHeight - result.limitedStretch.height) / 2);
      }
      result.limitedStretch.left = Math.round(
        (containerWidth - result.limitedStretch.width) / 2);
    }

    // Don't return invalid values in the results.  This could happen if
    // the image didn't load properly
    var cleanResult = function(r) {
      if (!r) {
        return;
      }

      if (!r.height) {
        delete r.height;
      }

      if (!r.width) {
        delete r.width;
      }

      r.top = r.top || 0;
      r.left = r.left || 0;
    };
    cleanResult(result);
    cleanResult(result.letterbox);
    cleanResult(result.limitedStretch);

    return result;
  };

  erly.centerImageAddLoader = function(image, width, height, options) {
    options = options || {};
    if (options.noLoader) { return $(); }

    if (!width && !height) {
      var storedArgs = image.data('center-letterbox');
      if (storedArgs) {
        width = storedArgs[0];
        height = storedArgs[1];
      }
    }

    var loader = image.data('loader');
    if (!loader) {
      loader = delayedLoader(image, options.ajaxLoaderQualifier || '',
        width, height);
      image.data('loader', loader);
    }
    return loader;
  };

  erly.centerImage = function(image, eventualWidth, eventualHeight, options) {
    if (!image || image.length === 0) {
      return;
    }

    if (image.length > 1) {
      image = image.eq(0);
    }

    if (image.hasClass("lazy-load")) {
      image.addClass("needs-center-letterbox");
      image.data("center-letterbox", [eventualWidth, eventualHeight, options]);
      return;
    }

    options = $.extend({
      opacity: 1,
      duration: 1,
      ajaxLoaderQualifier: ''
    }, options);

    if (!options.skipFaces) {
      if (image &&
          image.tmplItem &&
          image.tmplItem() &&
          image.tmplItem().data &&
          image.tmplItem().data.faces) {
        options.faces = image.tmplItem().data.faces;
      }
    }

    var container = image.parent();
    if (!eventualWidth) {
      eventualWidth = container.width();
      eventualHeight = container.height();
    }

    var loader = erly.centerImageAddLoader(image, eventualWidth, eventualHeight,
      options);

    // Animates the image to the final dimensions, taking into account
    // letterboxing if needed
    var animateImage = function(result) {
      loader.hide();
      var target = image;
      var letterbox = result.letterbox;

      delete result.letterbox;
      if (options.letterbox && letterbox) {
        if (!options.letterbox.onlyIfTooNarrow ||
          letterbox.width < eventualWidth) {
          result.opacity = options.letterbox.opacity;
        }
        else {
          result.opacity = 0;
        }
      }
      else {
        result.opacity = 1;
      }

      result.marginLeft = result.left;
      delete result.left;
      result.marginTop = result.top;
      delete result.top;

      image.animate(result, options.duration, function() {
        if (typeof options.callback === 'function') {
          options.callback(image);
        }
      });

      if (options.letterbox && letterbox) {
        target = image.parent().find('img.letterboxed');
        if (target.length === 0) {
          target = $("<img src='" + image.attr("src") + "'/>");
          target.addClass('letterboxed');
          target.css("position", "absolute");
          target.animate({
            opacity: 0.01
          }, 0);
          letterbox.opacity = 1;

          image.after(target);
        }

        target.animate(letterbox, options.duration);
      }
    };

    var result = {};
    var geoSrc = image.attr('data-geo-src');
    if (geoSrc) {
      image.attr('src', erly.util.convertGeoUriToUrl(geoSrc,
        eventualWidth, eventualHeight));

      result.height = eventualHeight;
      result.width = eventualWidth;
      result.marginTop = 0;
      result.marginLeft = 0;

      animateImage(result);
    }
    else {
      if (erly.browserSupport.useCanvas() && !options.noCanvas) {
        var drawImage = function(canvas) {
          var url = image.attr('src');
          var retryCount = 0;
          var tempImage = canvas.data('load');
          if (!tempImage) {
            tempImage = new Image();
            canvas.data('load', tempImage);
          }

          var callback = _.once(function() {
            if (typeof options.callback === 'function') {
              options.callback($(canvas));
            }
          });

          tempImage.onerror = function() {
            callback();
          };

          tempImage.onload = function() {
            if ($(this).attr('src') === BLANK_DATA_URL) {
              return;
            }

            canvas.removeData('load');
            if (!tempImage.width || !tempImage.height) {
              if (retryCount++ < 10) {
                setTimeout(tempImage.onload, 200);
              }
              return;
            }

            var result = getBestFit(tempImage.width, tempImage.height,
              eventualWidth, eventualHeight, options.limitedStretch,
              options.faces);
            if (options.limitedStretch && result.limitedStretch) {
              result = result.limitedStretch;
            }

            if (options.topAlign) {
              topAlign(result);
            }

            loader.hide();
            try {
              var context = canvas.get(0).getContext('2d');
              context.mozImageSmoothingEnabled = true;
              if (options.letterbox && result.letterbox) {
                if (!options.letterbox.onlyIfTooNarrow ||
                  result.letterbox.width < eventualWidth) {
                  context.globalAlpha = options.letterbox.opacity;
                }
                else {
                  context.globalAlpha = 0;
                }
              }

              context.drawImage(tempImage,
                result.left || 0, result.top || 0,
                result.width, result.height);

              if (options.letterbox && result.letterbox) {
                context.globalAlpha = 1;
                context.drawImage(tempImage,
                  result.letterbox.left || 0, result.letterbox.top || 0);
              }
            }
            catch (e) {
              erly.trackException(new Error('Problem drawing on canvas [' +
                JSON.stringify(result) + ']: ' + e.toString()),
                'center_image.js@centerImage:drawImage');
            }

            callback();
          };
          // webkit hack from http://groups.google.com/group/jquery-dev/browse_thread/thread/eee6ab7b2da50e1f
          tempImage.src = BLANK_DATA_URL;
          tempImage.src = url;
        };

        var canvas = image.parent().find('canvas');

        // If we haven't inserted the canvas element, yet, do it here
        if (canvas.length === 0) {
          canvas = $('<canvas></canvas>');
          canvas.attr('width', eventualWidth);
          canvas.attr('height', eventualHeight);
          canvas.css('image-rendering', 'optimizeQuality');
          image.after(canvas);

          canvas.animate({
            opacity: 0.01
          }, 0, function() {
            drawImage(canvas);
            image.hide();
            canvas.animate({opacity: 1}, options.duration);
          });
        }
        // Otherwise, animate it into the right size, then redraw
        else {
          loader.hide();
          if (canvas.width() !== eventualWidth ||
              canvas.height() !== eventualHeight) {
            canvas.animate({
              width: eventualWidth,
              height: eventualHeight
            }, options.duration, function() {
              canvas.attr('width', eventualWidth);
              canvas.attr('height', eventualHeight);
              drawImage(canvas);
              canvas.css({opacity: 1});
            });
          }
        }
      }
      else {
        // If we're not using the canvas rendering, measure the image
        // then try to animate it to the proper dimensions
        erly.getNaturalDimensions(image, function(naturalDimensions) {
          result = getBestFit(naturalDimensions.w, naturalDimensions.h,
            eventualWidth, eventualHeight, options.limitedStretch,
            options.faces);
          if (options.limitedStretch && result.limitedStretch) {
            result = result.limitedStretch;
          }

          if (options.topAlign) {
            topAlign(result);
          }

          animateImage(result);
        });
      }
    }
  };
}(erly));

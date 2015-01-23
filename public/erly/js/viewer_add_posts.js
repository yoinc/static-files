/*
 * Viewer add posts class
 */

(function(viewer) {
  var AddPosts = function(options) {
    if (!options) {
      options = {};
    }
    var carousel = options.carousel;
    var container = options.container;
    var collection = options.collection;


    var DOM = {
      teaseTemplate: "#tmplViewerAddPostsTease",
      unauthedTemplate: "#tmplViewerAddPostsUnauthed",
      ownerOnlyTemplate: "#tmplViewerAddPostsOwnerOnly",
      expandedTemplate: "#tmplViewerAddPostsExpanded"
    };

    var self = this;
    var _addPostsTease;
    var _addPostsExpanded;
    var _addPostsUnauthed;
    var _addPostsOwnerOnly;
    var _uploads;

    this.submitSelectedPhotos = function(newCollection, callback) {
      collection = newCollection;
      _uploads.setCollection(newCollection);
      _uploads.submitSelectedPhotos(callback);
    };

    this.postCreateResponse = function(data, target) {
      if (data.success) {
        if (!viewer.collection.userRole.member) {
          viewer.collection.userRole.member = true;
          erly.events.fire(viewer.ROLE_CHANGED);
        }

        erly.anchoredModal.close();
        erly.modal.close();

        if (data.data instanceof Array && data.data.length > 1) {
          var addPosts = function() {
            carousel.beginUpdate();
            _.each(data.data, function(val) {
              if (!val) {
                return;
              }

              carousel.addPost(val, null, true);
            });
            carousel.endUpdate();
          };

          if (target) {
            target.fadeOut(function() {
              target.remove();
              addPosts();
            });
          }
          else {
            addPosts();
          }
        }
        else {
          if (data.data instanceof Array) {
            data.data = data.data[0];
          }

          if (!data.data) {
            return;
          }

          carousel.addPost(data.data, target);
        }
      }
      else {
        erly.anchoredModal.close();
        if (data.error && /validate.*email/.test(data.error.message)) {
          erly.modal.showEmailVerificationAlert();
        }
        else {
          erly.modal.showAlert("Sorry", data.error.message);
        }
      }
    };

    function showFormModal(options) {
      options = options || {};
      var anchorElement = options.anchorElement;
      var triangleCssClass = options.triangleCssClass;
      var templateSelector = options.templateSelector;
      var data = options.data;
      var formSelector = options.formSelector;
      var request = options.request;
      var extraSetupFunc = options.extraSetupFunc;
      var beforeSubmit = options.beforeSubmit;
      var beforeSerialize = options.beforeSerialize;
      var success = options.success;
      var extraOptions = options.extraOptions;

      var template = $(templateSelector).tmpl(data);

      var onComplete = function() {
        var form;
        if (formSelector) {
          form = $(formSelector);
          if (form.length === 0) {
            throw new Error("Couldn't find form '" + formSelector +
              "' for modal.");
          }

          if (form.find('textarea:visible').length > 0) {
            form.find('textarea:visible').first().focus();
          }
          form.ajaxForm({
            datatype: 'text/json', // should be application/json
            success: success,
            beforeSerialize: beforeSerialize,
            beforeSubmit: beforeSubmit
          });
        }

        template.find('.button-bar .cancel').click(function () {
          erly.anchoredModal.close();
          erly.modal.close();
        });

        if (extraSetupFunc) {
          extraSetupFunc(template, form, request);
        }
      };

      var onClosed = function() {
        if (anchorElement) {
          anchorElement.removeClass('active');
        }
        if (typeof options.onClosed === 'function') {
          options.onClosed();
        }
      };

      var onUnfocusedEnter = function(ev) {
        if (formSelector && !$(ev.target).is('input[type=text]')) {
          $(formSelector).submit();
          return true;
        }
      };

      if (anchorElement) {
        var modalOptions = function() {
          var o = {
            html: template,
            position: 'below',
            triangleCssClass: triangleCssClass,
            cssClass: 'add-post',
            skipOverlay: true,
            centerLeft: true,
            stretch: options.stretch,
            top: anchorElement.offset().top + anchorElement.height() + 5,
            onUnfocusedEnter: onUnfocusedEnter,
            onClosed: onClosed,
            onComplete: onComplete
          };

          if (request) {
            o.centerModal = true;
          }

          return _.extend(o, extraOptions);
        };

        if (typeof request === 'undefined' || !request) {
          anchorElement.addClass('active');
        }

        erly.anchoredModal.open(anchorElement, modalOptions);
      }
      else if (options.data.inline && options.data.insertSelector) {
        $(options.data.insertSelector).append($(template));
        onComplete();
      }
      else {
        erly.modal.open({
          inline: true,
          scrolling: false,
          open: true,
          href: $(template),
          stretch: options.stretch,
          onUnfocusedEnter: onUnfocusedEnter,
          onClosed: onClosed,
          onComplete: onComplete
        });
      }

      return false;
    }

    function showPostModal(options) {
      if (container && container.find('.post').length > erly.viewer.MAX_POSTS) {
        erly.modal.showAlert('Sorry',
          'Erly Collections are currently limited to ' +
          erly.viewer.MAX_POSTS +
          ' items.  If you want to create a larger ' +
          ' collection, please let us know at ' +
          '<a href="mailto:feedback@erly.com">feedback@erly.com</a>.');
        return;
      }

      options = options || {};
      var request = options.request;
      var customBeforeSubmit = options.beforeSubmit;
      options.beforeSubmit = function(arr) {
        // Add the information necessary to re-request
        if (request) {
          arr.push({
            name: 'request',
            value: JSON.stringify(request.tmplItem().data)
          });
        }

        var order = carousel.getCurrentInsertOrder();
        if (order) {
          arr.push({
            name: 'order',
            value: order
          });
        }

        var submitting = customBeforeSubmit ? customBeforeSubmit() : true;
        if (submitting) {
          $("#modal .submit-loader").show();
          $("#modal input[type=submit]").
            attr('disabled', 'disabled').css('background', '#666');
        }

        return submitting;
      };

      options.success = function(data) {
        self.postCreateResponse(data, request);
      };

      showFormModal(options);
    }

    AddPosts.prototype.showPostModal = showPostModal;

    this.showAddNote = function(request, callback) {
      var extraOptions = {};

      if (request) {
        extraOptions.omitTriangle = true;
      }

      return showPostModal({
        anchorElement: $('#add_notes'),
        triangleCssClass: 'add-note-top-triangle',
        templateSelector: '#tmplAddNoteModal',
        data: {},
        formSelector: '#modal .add-note form',
        request: request,
        beforeSubmit: function() {
          return $('#modal .add-note form textarea').val().length > 0;
        },
        extraOptions: extraOptions,
        extraSetupFunc: function() {
          if (typeof callback === 'function') { callback(); }
        }
      });
    };

    this.showAddVideo = function(request, callback) {
      return showPostModal({
        anchorElement: $('#add_videos'),
        triangleCssClass: 'add-video-top-triangle',
        templateSelector: '#tmplAddVideoModal',
        data: {},
        formSelector: '#modal .add-link form',
        request: request,
        extraSetupFunc: function(template, form) {
          var urlInput = template.find('.specify-url input');
          var error = template.find('.error');
          var confirm = template.find('.confirm');
          var loader = template.find('.loader');
          var image = confirm.find('.image');
          var resultsContainer = template.find('.search-results');
          var showError = function(s) {
            error.show();
            error.html(s);
          };

          var doPreview = function(url, fromSearch) {
            if (urlInput.val().length === 0) {
              showError('Please specify a URL.');
              return;
            }

            if (url.length === 0) {
              showError('Please specify a URL');
              return;
            }

            resultsContainer.hide();
            var back = confirm.find('.back-to-search');
            back.hide();
            if (fromSearch) {
              back.show();
              back.unbind('click');
              back.click(function(e) {
                if (e.which > 1) {
                  return;
                }

                resultsContainer.show();
                confirm.hide();
              });
            }

            if (!url.match(/^https?\:/)) {
              url = "http://" + url;
            }

            if (url.match(/facebook\.com\/photo\.php/i)) {
              showError('Sorry, we currently can\'t import Facebook video ' +
                'links.  We do support YouTube and Vimeo links.');
              return;
            }

            $.ajax({
              url: '/scrape?url=' + encodeURIComponent(url),
              cache: true,
              success: function(data) {
                loader.hide();
                if (data.error || !data.embed) {
                  showError('Unable to find the video. ' +
                    ((data.error && data.error.message) || ""));
                  erly.modal.resize();
                }
                else {
                  error.hide();

                  if (typeof data === 'string') {
                    data = JSON.parse(data);
                  }

                  // TODO: in the case the user puts a video link in a generic
                  // link dialog, it should probably flip over to the correct
                  // add link dialog.  currently only works for actual videos
                  confirm.find('.title').html(data.title || '');
                  var desc = data.description || '';
                  if (desc.length > 140) {
                    desc = desc.substring(0, 140) + '...';
                  }
                  confirm.find('.description').html(erly.linebreaks(desc));
                  confirm.find('.duration').html(
                    erly.formatDuration(data.duration) || '');

                  image.find('img').remove();
                  image.append($('<img src="' + data.image + '"/>'));
                  data.type = data.type || 'video';
                  if (data.type === 'video') {
                    image.css('height',
                      data.imageDimensions.height * image.width() /
                        data.imageDimensions.width);
                  }
                  else {
                    image.css('height',
                      data.height * image.width() / data.width);
                  }
                  confirm.find('form input[type=hidden]').remove();
                  confirm.find('#postFields').html(
                    $('#tmplLinkFormFields').tmpl(data));

                  confirm.show();
                  erly.modal.resize();
                }
              }
            });

            template.find('.specify-url .note').hide();
            error.hide();
            confirm.hide();
            loader.show();
            erly.modal.resize();
          };

          var processInput = function() {
            var url = $.trim(urlInput.val());

            if (url.match(/^http/) ||
              url.match(/youtube\.com/i) ||
              url.match(/youtu\.be/i) ||
              url.match(/vimeo\,com/i)) {
              doPreview(url);
            }
            else {
              confirm.hide();

              resultsContainer.show();
              resultsContainer.html($('#tmplModalLoadingIndicator').tmpl());

              // Search YouTube - vimeo requires oauth :(
              $.getJSON('https://gdata.youtube.com/feeds/api/videos?q=' +
                encodeURIComponent(url) +
                '&alt=json&callback=?', function(results) {
                var videos = $('#tmplAddVideoSearchResult').tmpl(
                  _.map(results.feed.entry, function(v) {
                    var desc = v.media$group.media$description.$t;
                    if (desc.length > 100) {
                      desc = desc.substring(0, 100) + '...';
                    }

                    return {
                      picture: v.media$group.media$thumbnail[0].url,
                      title: v.title.$t,
                      duration: erly.formatDuration(
                        v.media$group.yt$duration.seconds
                      ),
                      description: desc,
                      url: v.link[0].href
                    };
                  })
                );

                resultsContainer.html(videos);

                resultsContainer.find('img').each(function() {
                  erly.centerImage($(this));
                });

                resultsContainer.find('.select-result').click(function(e) {
                  if (e.which > 1) {
                    return;
                  }

                  var data = $(this).tmplItem().data;
                  doPreview(data.url, true);
                  resultsContainer.hide();
                });
              });
            }
          };

          template.find('.specify-url input').keypress(function(e) {
            var code = (e.keyCode ? e.keyCode : e.which);
            if (code === 13) {
              processInput();
            }
          });
          template.find('.specify-url button').click(processInput);
          if (typeof callback === 'function') { callback(); }
        }
      });
    };

    /**
     * @private
     * @const
     */
    var ERLY_COLLECTION_PATH_REGEX = new RegExp(
      '(/collection/[0-9a-zA-Z_\\-]+(\\?|$)|/user/[0-9a-z]+/.*?)');

    /**
     * Replace only <> with entities, all others are allowed.
     */
    var probablyInsecureConvertEntities = function(s) {
      return $('<span></span>').html(
        s.replace('<', '&lt;').replace('>', '&gt;')).text();
    };

    this.showAddLink = function(request, callback) {
      return showPostModal({
        anchorElement: $('#add_links'),
        triangleCssClass: 'add-link-top-triangle',
        templateSelector: '#tmplAddLinkModal',
        data: {},
        formSelector: '#modal .add-link form',
        request: request,
        extraSetupFunc: function(template, form) {
          var urlInput = template.find('.specify-url input');
          var error = template.find('.error');
          var confirm = template.find('.confirm');
          var loader = template.find('.loader');
          var image = confirm.find('.image');
          var toolbar = confirm.find('.toolbar');
          var showError = function(s) {
            error.show();
            error.html(s);
            erly.modal.resize();
          };

          var doPreview = function() {
            var url = $.trim(urlInput.val());
            var origUrl = url;
            var linkedCollection = false;

            if (url.length === 0) {
              return showError('Please specify a URL');
            }

            if (!url.match(/^https?\:/)) {
              url = 'http://' + urlInput.val();
              urlInput.val(url);
            }

            if (url.length === 0) {
              return showError('Please specify a URL.');
            }

            if (url.indexOf(window.location.hostname) >= 0 &&
                ERLY_COLLECTION_PATH_REGEX.test(url)) {
              url = $.trim(url).replace(/(\?.*|$)/, '.json');
              linkedCollection = true;
            }
            else {
              url = '/scrape?url=' + encodeURIComponent(url);
            }

            $.ajax({
              url: url,
              cache: true,
              error: function() {
                loader.hide();
                showError('Unable to process your link.');
              },
              success: function(data) {
                if (typeof data === 'string') {
                  data = JSON.parse(data);
                }

                loader.hide();
                if (!linkedCollection && !data.success && !data.type) {
                  showError('Unable to process your link. ' +
                    ((data.error && data.error.message) || ""));
                }
                else {
                  error.hide();

                  data.type = data.type || 'link';

                  var inputTitle = confirm.find('input.title');
                  var displayTitle = confirm.find('div.title');

                  // XXXXXXXXXXXXXXXXXXXXXXX
                  // we're trusting goose here...
                  data.title = probablyInsecureConvertEntities(data.title);
                  displayTitle.text(data.title);
                  displayTitle.hover(function() {
                    inputTitle.css('display', 'block');
                    inputTitle.show();
                    displayTitle.hide();
                  });

                  var showDisplay = function() {
                    if (!inputTitle.is(':focus')) {
                      inputTitle.hide();
                      displayTitle.show();
                    }
                  };
                  inputTitle.hover(function(){}, showDisplay).blur(
                    showDisplay).change(function() {
                      displayTitle.text(inputTitle.val());
                    });

                  var text = probablyInsecureConvertEntities(data.text || '');
                  var textarea = confirm.find('.text');

                  textarea.commentTextarea({
                    handleEnterKey: false,
                    maxHeight: 400
                  });
                  _.defer(function() {
                    textarea.commentTextarea();
                  });

                  var handleEditField = function(field, defaultDisplayValue,
                      defaultValue, hiddenFieldSelector) {
                    var dirty = false;
                    field.keypress(function() {
                      dirty = true;
                    });
                    field.focus(function() {
                      if (!dirty) {
                        field.val('');
                      }
                    });
                    field.blur(function() {
                      if ($.trim(field.val()).length === 0 ||
                          $.trim(field.val()) === defaultDisplayValue) {
                        dirty = false;

                        field.val(defaultDisplayValue);
                        confirm.find(hiddenFieldSelector).val(defaultValue);
                      }
                      else {
                        confirm.find(hiddenFieldSelector).val($(this).val());
                      }
                    });

                    field.val(defaultDisplayValue);
                    confirm.find(hiddenFieldSelector).val(defaultValue);
                  };

                  handleEditField(inputTitle, data.title, data.title,
                    '#link_title');

                  if (data.type === 'photo') {
                    textarea.hide();
                  }
                  else {
                    handleEditField(textarea, text.length > 350 ?
                      text.slice(0, 350) + "..." : text, data.text,
                      '#link_text');
                  }

                  if (linkedCollection) {
                    data.link = erly.urlFor.collection(data);
                  }
                  data.link = data.link || origUrl;
                  data.title = data.title || origUrl;

                  $.each(data, function(k, v) {
                    confirm.find('#link_' + k).val(v);
                  });
                  confirm.find('#postFields').html(
                    $('#tmplLinkFormFields').tmpl(data));

                  if (!data.images) {
                    data.images = [];
                  }
                  if (data.image) {
                    data.images.unshift(data.image);
                  }

                  if (data.coverPhoto && data.coverPhoto.url) {
                    data.images.push(data.coverPhoto.url);
                  }

                  if (linkedCollection) {
                    confirm.find('#linkedChronicleData').val(JSON.stringify({
                      startDate: data.startDate,
                      ident: data.ident,
                      owner: data.owner,
                      metadataStyle: data.metadataStyle,
                      metadataPosition: data.metadataPosition
                    }));
                  }
                  else {
                    data.images.push('blank-image');
                  }

                  if (data.images !== null &&
                      typeof data.images !== 'undefined' &&
                      data.images.length > 0) {
                    if (data.images.length === 1) {
                      toolbar.hide();
                    }
                    image.show();
                    image.find('img, .blank-image').remove();
                    toolbar.find('.current').text('1');
                    toolbar.find('.total').text(data.images.length.toString());

                    _.each(data.images, function(v) {
                      if (v === 'blank-image') {
                        image.append(
                          $('<div class="blank-image">No photo selected</div>'));
                      }
                      else {
                        image.append(
                          $('<img src="' + v + '" style="display:none"/>'));
                      }
                    });

                    var imageIndex = 0;
                    var updateImage = function() {
                      confirm.find('.image img').hide();
                      confirm.find('.image canvas').remove();
                      confirm.find('.blank-image').hide();
                      var next = confirm.find('.image img').eq(imageIndex);
                      if (next.length === 0) {
                        confirm.find('.blank-image').show();
                        confirm.find('#link_image').val('');
                      }
                      else {
                        next.show();
                        erly.centerImage(next, null, null, {
                          limitedStretch: 2,
                          topAlign: true
                        });
                        confirm.find('#link_image').val(next.attr('src'));
                      }

                      toolbar.find('.current').text((imageIndex + 1).toString());
                      setTimeout(erly.modal.resize, 0);
                    };
                    toolbar.find('.prev').click(function() {
                      imageIndex--;
                      if (imageIndex === -1) {
                        imageIndex = data.images.length - 1;
                      }
                      updateImage();
                    });
                    toolbar.find('.next').click(function() {
                      imageIndex = (imageIndex + 1) % data.images.length;
                      updateImage();
                    });

                    updateImage();
                  }
                  else {
                    confirm.find('.toolbar').hide();
                    confirm.find('.image').hide();
                  }

                  confirm.show();
                }
                erly.modal.resize();
              }
            });

            template.find('.specify-url .note').hide();
            error.hide();
            confirm.hide();
            loader.show();
            erly.modal.resize();
          };

          template.find('.specify-url input').keypress(function(e) {
            var code = (e.keyCode ? e.keyCode : e.which);
            if (code === 13) {
              doPreview();
            }
          });
          template.find('.specify-url button').click(doPreview);
          if (typeof callback === 'function') { callback(); }
        }
      });
    };

    var _addPhotoDialogShowing = false;
    this.showAddPhoto = function(request, callback) {
      this.showAddPhotoDialog({
        anchorElement: $('#add_photos'),
        triangleCssClass: 'add-photo-top-triangle',
        request: request,
        callback: callback
      });
    };


    var _jsonpCallback;
    window.jsonFlickrApi = function(o) {
      _jsonpCallback(null, o);
    };

    var publicAlbumHandlers = {
      picasa: {
        tip: 'e.g. https://picasaweb.google.com/12345678901234567890/MyAlbum',
        getPublicAlbum: function(url, callback) {
          var pathParts = _.filter(url.split('/'), Boolean);
          var id = pathParts.pop();
          var user = pathParts.pop();
          $.ajax({
            url: 'http://picasaweb.google.com/data/feed/api/user/' +
              user +
              '/album/' +
              id +
              '?alt=json',
            dataType: 'jsonp',
            error: _(callback).bind(null, true),
            success: function(data) {
              data = data.feed;
              if (!data) {
                return callback(new Error("Couldn't open that album"));
              }

              var album = {
                cover_art: data.icon.$t,
                caption: data.title.$t,
                album_id: data.link[0].href,
                canonical_id: data.id.$t,
                photos: data.entry
              };

              callback(null, album);
            }
          });
        },
        getPhotos: function(album, callback, limit, offset) {
          callback(null, _(album.photos.slice(offset, offset + limit)).map(
              function(val) {
            return {
              id: val.gphoto$id.$t,
              art: val.media$group.media$thumbnail[
                val.media$group.media$thumbnail.length - 1].url,
              image: val.media$group.media$content[0].url,
              caption: val.summary.$t || val.title.$t,
              original: val.media$group.media$content[0].url,
              dimensions: {
                width: val.media$group.media$content[0].width,
                height: val.media$group.media$content[0].height
              },
              source: 'picasa'
            };
          }));
        }
      },
      flickr: {
        tip: 'e.g. http://flickr.com/photos/username/sets/123456789012345',
        getPublicAlbum: function(url, callback) {
          var pathParts = _.filter(url.split('/'), Boolean);
          var id = pathParts.pop();

          var handled = false;
          _jsonpCallback = function(err, data) {
            if (err) {
              return callback(err);
            }

            if (data.stat === 'fail') {
              return callback(data.message);
            }

            var ps = data.photoset;

            var album = {
              cover_art: [
                'http://farm', ps.farm,
                '.static.flickr.com/',
                ps.server, '/', ps.primary, '_', ps.secret, '_m','.jpg'
              ].join(''),
              cover_id: ps.primary,
              caption: ps.title._content,
              album_id: ps.id
            };

            callback(null, album);
            handled = true;
          };

          $.getJSON('http://api.flickr.com/services/rest' +
            '?method=flickr.photosets.getInfo&api_key=' +
            erly.FLICKR_CLIENT_APP_ID +
            '&format=json&photoset_id=' +
            id + 'callback=?').error(function() {
              if (!handled) {
                callback(true);
              }
          });
        },
        getPhotos: function(album, callback, limit, offset) {
          var handled = false;
          _jsonpCallback = function(err, data) {
            if (err) {
              return callback(err);
            }

            if (data.stat === 'fail') {
              return callback(data.message);
            }

            callback(null,
              _(data.photoset.photo).map(erly.flickr.convertToPhoto));
            handled = true;
          };

          $.getJSON('http://api.flickr.com/services/rest' +
            '?method=flickr.photosets.getPhotos&api_key=' +
            erly.FLICKR_CLIENT_APP_ID +
            '&format=json&extras=' + erly.flickr.photoExtras + '&photoset_id=' +
                album.album_id + 'callback=?').error(function() {
              if (!handled) {
                callback(true);
              }
          });
        }
      },
      dropbox: {
        tip: 'e.g. http://www.dropbox.com/gallery/userid/1/galleryname?h=abc123',
        getPublicAlbum: function(url, callback) {
          // Make sure the url is full un-escaped
          var parts = decodeURI(url).split('dropbox.com/gallery');

          // Make sure there's a protocol
          if (url.indexOf('://') < 0) {
            url = "http://";
          } else {
            url = "";
          }

          url += parts[0] + 'dropbox.com/gallery';

          // Now escape everything but the host
          for (var i = 1; i < parts.length; i++) {
            url += encodeURI(parts[i]);
          }

          $.ajax({
            url: '/scrape?url=' + encodeURIComponent(url),
            error: function(err) {
              callback(err);
            },
            success: function(data) {
              callback(null, data);
            }
          });
        },
        getPhotos: function(album, callback, limit, offset) {
          callback(null, _(album.photos.slice(offset, offset + limit)).map(
              function(val) {
            return {
              id: val.id,
              art: val.image,
              image: val.image,
              caption: val.caption,
              original: val.original,
              source: 'dropbox'
            };
          }));
        }
      }
    };

    this.showAddPhotoDialog = function(options) {
      var self = this;
      options = options || {};
      var extra = options.extraSetupFunc;
      delete options.extraSetupFunc;

      options.data = $.extend({
        hideExternalServices: !!erly.viewer.invite,
        showImageSearch: true
      }, options.data || {});
      options.stretch = {};
      options.stretch.height = {
        reduction: 100,
        minHeight: 400
      };
      if (!options.data.isAlbumImport) {
        options.stretch.width = {
          reduction: 100,
          minWidth: 785
        };
      }

      var templateSelector = options.data.templateSelector || '#tmplAddPhotoModal';

      return showPostModal($.extend(options, {
        templateSelector: templateSelector,
        formSelector: null,
        onClosed: function() {
          _addPhotoDialogShowing = false;
        },
        extraSetupFunc: function(template, form, request) {
          _addPhotoDialogShowing = true;
          var tabSelectors = template.find('.source-type-button');
          var tabPages = template.find('.tab-page');
          template.find('.source-type-button').click(function() {
            var tabIndex = tabSelectors.index($(this));

            tabSelectors.removeClass('selected');

            tabPages.hide();

            var newTab = tabPages.eq(tabIndex);
            newTab.show();

            if (typeof options.tabChanged === 'function') {
              options.tabChanged();
            }

            $(this).addClass('selected');
          });

          var initialSelectedIndex = options.initialSelectedIndex || 0;
          tabSelectors.eq(initialSelectedIndex).click();

          // Initialize the file upload tab
          _uploads.initializeForm(template, form, request, options);

          // Initialize Bing Image Search
          _uploads.initializeSearch(options);

          // Utility function for initializing other Photo services
          var initService = function(service) {
            var user = erly.getUserData();

            var connected = service === 'facebook' ?
              erly.session.isFacebookConnected() :
              user.services && user.services[service];

            var isAlbumImport = Boolean((options.data || {}).isAlbumImport);

            if (service === 'facebook') {
              // Initialize the Facebook tab
              _uploads.initializePhotoService({
                serviceName: 'facebook',
                singleSelect: Boolean((options.data || {}).singleSelect),
                request: request,
                connected: connected,
                container: template.find('.facebook').eq(0),
                friendsFunc: isAlbumImport ? null :
                                _.bind(_uploads.getFacebookFriends, _uploads),
                albumsFunc: isAlbumImport ?
                                function(user, callback, limit, offset) {
                                  _uploads.getFacebookAlbums('me', callback, limit, offset);
                                } :
                                _uploads.getFacebookAlbums,
                albumsClickFunc: options.data.albumsClickFunc ? function(elem, target, data) {
                  options.data.albumsClickFunc(elem, target, data, service, template);
                } : null,
                photosFunc: isAlbumImport ? null : _uploads.getFacebookPhotos,
                hasAlbumCheckBoxes: isAlbumImport,
                prepFunc: function(pic) {
                  return {
                    chronicle_id: collection.id,
                    type: 'photo',
                    caption: pic.name,
                    picture: pic.picture,
                    orig_url: pic.orig_url,
                    status: 'PENDING',
                    dimensions: {
                      width: pic.width,
                      height: pic.height
                    },
                    facebookIds: pic.facebookIds,
                    facebookTags: pic.facebookTags,
                    source: 'facebook'
                  };
                }
              });
            }
            else {
              _uploads.initializePhotoService({
                serviceName: service,
                singleSelect: Boolean((options.data || {}).singleSelect),
                publicAlbumHandler: publicAlbumHandlers[service],
                request: request,
                container: template.find('.' + service).eq(0),
                friendsFunc: null,
                connected: connected,
                hasAlbumCheckBoxes: isAlbumImport,
                albumsFunc: function(id, callback, limit, offset) {
                  _uploads.getAuthedAlbums(service,
                    function(err, collections) {
                      if (err) {
                        return callback(err);
                      }
                      _.each(collections, function(a) {
                        a.id = a.collection_id;
                      });

                      callback(null, collections);
                    },
                    limit, offset
                  );
                },
                albumsClickFunc: options.data.albumsClickFunc ? function(elem, target, data) {
                  options.data.albumsClickFunc(elem, target, data, service, template);
                } : null,
                photosFunc: isAlbumImport ? null :
                  function(album, callback, limit, offset, nextUrl) {
                    _uploads.getAuthedPhotos(
                      service, album.album_id, callback, limit, offset, nextUrl);
                  },
                prepFunc: function(pic) {
                  if (pic.video) {
                    return {
                      type: 'video',
                      link: pic.original,
                      chronicle_id: collection.id,
                      image: pic.image,
                      title: erly.util.filterCaption(pic.caption),
                      embed: pic.video.embed,
                      videoDimensions: pic.video.dimensions,
                      imageDimensions: pic.dimensions
                    };
                  }
                  else {
                    var prepared = {
                      chronicle_id: collection.id,
                      type: 'photo',
                      caption: erly.util.filterCaption(pic.caption),
                      picture: pic.image,
                      original: pic.original,
                      orig_url: pic.original,
                      status: 'PENDING',
                      source: pic.source,
                      photoIds: pic.id
                    };

                    if (pic.dimensions) {
                      prepared.dimensions = {
                        width: pic.dimensions.width,
                        height: pic.dimensions.height
                      };
                    }

                    return prepared;
                  }
                }
              });
            }
          };
          initService('facebook');
          initService('flickr');
          initService('picasa');
          initService('instagram');
          initService('smugmug');
          initService('dropbox');

          erly.events.subscribe(erly.events.SERVICE_CONNECTED, function(data) {
            erly.getUserData().services =
              _((erly.getUserData().services || {})).extend(data.user.services);
            initService(data.service);
          });

          if (typeof options.callback === 'function') { options.callback(); }
          if (typeof extra === 'function') {
            extra(template);
          }

          if (options.data.showPresetBackgrounds) {
            _uploads.initializePhotoService({
              serviceName: 'background-presets',
              singleSelect: true,
              container: template.find('.background-presets'),
              connected: true,
              albumsFunc: function(id, callback, limit, offset) {
                var themes = [];
                _.each(erly.STOCK_BACKGROUNDS, function(v, k) {
                  var coverIndex = erly.STOCK_BACKGROUND_COVERS[k] || 0;
                  if (coverIndex > v.length - 1) {
                    coverIndex = 0;
                  }
                  themes.push({
                    id: k,
                    original: k,
                    cover_art: erly.resolveStaticUrl(
                      v[coverIndex].replace('.jpg', '-thumb.jpg')),
                    caption: k,
                    source: 'stock_backgrounds'
                  });
                });

                callback(null, themes);
              },
              photosFunc:function(album, callback, limit, offset, nextUrl) {
                callback(null, _.map(erly.STOCK_BACKGROUNDS[album.id], function(v) {
                  var thumb = v.replace('.jpg', '-thumb.jpg');
                  return {
                    id:  erly.resolveStaticUrl(v),
                    art: erly.resolveStaticUrl(thumb)
                  };
                }));
              },
              prepFunc: function(pic) {
                return pic;
              }
            });
          }
        }
      }));
    };

    self._uploads = _uploads = new erly.viewer.Uploads(collection, carousel,
      self, function() {});

    if (!container) {
      return;
    }

    container.empty();
    _addPostsTease = $$(DOM.teaseTemplate).tmpl({});
    self._addPostsTease = _addPostsTease;
    container.append(_addPostsTease);

    _addPostsExpanded = $$(DOM.expandedTemplate).tmpl({});
    self._addPostsExpanded = _addPostsExpanded;
    container.append(_addPostsExpanded);

    _addPostsUnauthed = $$(DOM.unauthedTemplate).tmpl({});
    self._addPostsUnauthed = _addPostsUnauthed;
    container.append(_addPostsUnauthed);
    _addPostsUnauthed.click(function(e) {
      if (e.which > 1) {
        return;
      }
      erly.session.login();
//        window.location = erly.urlFor.home('#signup');
    });

    _addPostsOwnerOnly = $$(DOM.ownerOnlyTemplate).tmpl({});
    self._addPostsOwnerOnly = _addPostsOwnerOnly;
    container.append(_addPostsOwnerOnly);

    container.hover(_.bind(self.showExpanded, self), function() {
      if ($('#modal').length !== 0) {
        return;
      }

      self.tryingToShow = false;

      _addPostsTease.stop(true, true).fadeIn(function() {
        if (!self.tryingToShow) {
          _addPostsTease.show();
        }
      });
      _addPostsExpanded.stop(true, true).fadeOut();
      _addPostsUnauthed.stop(true, true).fadeOut();
      _addPostsOwnerOnly.stop(true, true).fadeOut();
    });

    var showModal = function(opener) {
      return function(ev) {
        if (!erly.session.isAuthenticated()) {
          erly.session.login();
          return false;
        }
        opener(null, function() {
          erly.events.subscribeOnce(erly.events.MODAL_CLOSE, function() {
            setTimeout(function() {
              if ($('#modal').length === 0) {
                _addPostsTease.stop(true, true).fadeIn();
                _addPostsExpanded.stop(true, true).fadeOut();
                _addPostsUnauthed.stop(true, true).fadeOut();
                _addPostsOwnerOnly.stop(true, true).fadeOut();
              }
            }, 250);
          });
        });

        return false;
      };
    };

    $('body').bind('dragover', function() {
      if ($('.anchored-modal').is(':visible') ||
          $('#colorbox').is(':visible') ||
          viewer.metadata.isEditing() ||
          !viewer.isCarouselShowing() ||
          !erly.session.isAuthenticated() ||
          viewer.isRestricted()) {
        return;
      }
      self.showByType('photo');
    });

    _addPostsExpanded.find('.add-photo').click(showModal(
      _(self.showAddPhoto).bind(self)));
    _addPostsExpanded.find('.add-note').click(showModal(self.showAddNote));
    _addPostsExpanded.find('.add-link').click(showModal(self.showAddLink));
    _addPostsExpanded.find('.add-video').click(showModal(self.showAddVideo));

    erly.events.subscribe(erly.viewer.CAROUSEL_CLOSING, function() {
      erly.anchoredModal.close(true);
      _addPostsExpanded.find('.add-post').removeClass('active');
      _addPostsExpanded.hide();
      _addPostsUnauthed.hide();
      _addPostsOwnerOnly.hide();
      _addPostsTease.show();
    });
  };

  AddPosts.prototype.showByType = function(type) {
    this.showExpanded();
    this._addPostsExpanded.find('.add-' + type).click();
  };

  AddPosts.prototype.showExpanded = function() {
    this.tryingToShow = true;
    this._addPostsTease.stop(true, true).hide();
    if (erly.userId || erly.viewer.invite) {
      if (erly.viewer.isRestricted() && !erly.viewer.collection.publicEvent) {
        this._addPostsOwnerOnly.stop(true, true).show();
      }
      else {
        this._addPostsExpanded.stop(true, true).show();
      }
    }
    else {
      this._addPostsUnauthed.stop(true, true).show();
    }
  };

  AddPosts.prototype.getSelectedPhotos = function() {
    return this._uploads.getSelectedPhotos();
  };

  viewer.AddPosts = AddPosts;
}(erly.viewer));

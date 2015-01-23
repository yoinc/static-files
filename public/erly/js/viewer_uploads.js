/*
 * Viewer add posts class
 */
(function(viewer) {
  var Uploads = function(collection, carousel, addPosts) {
    var self = this;

    var DOM = {
      selectAllDiv:       'div.select-all'
    };

    var _collection = collection;
    var _friendQuery;
    var _selectedPhotoCount = 0;
    var _selectedPhotos = this._selectedPhotos = {};
    var _submitFuncs = {};

    this.setCollection = function(newCollection) {
      _collection = newCollection;
    };

    function centerImages(rendered) {
      rendered.each(function() {
        var els = $(this).find('.art img').not('.image-loader');
        els = els.add($(this).find('.preview img').not('.image-loader'));
        erly.centerImage(els, null, null, {
          ajaxLoaderQualifier: '-222222'
        });
      });
    }

    // Walks the parent chain until it finds a parent with the .tab-page
    // CSS selector and then checks if it is visible
    function isActiveTab(el) {
      while (el.length > 0 && !el.hasClass('tab-page')) {
        el = el.parent();
      }

      return el.hasClass('tab-page') && el.is(':visible');
    }

    function updateCount(delta) {
      if (!delta) {
        delta = 0;
      }
      _selectedPhotoCount += delta;
      $('.add-photo .uploadCounter').text(_selectedPhotoCount);
      if (_selectedPhotoCount >= viewer.Uploads.MAX_PHOTOS) {
        $('.add-photo .at-limit').fadeIn();
      }
      else {
        $('.add-photo .at-limit').fadeOut();
      }
    }

    function togglePhoto(photo, serviceName, serviceOptions, e) {
      photo = $(photo);
      var data = photo.tmplItem().data;
      var check = photo.find('input');
      var checked = check.attr('checked') === 'checked';
      var isInput = false;

      if (e) {
        isInput = $(e.target).attr('type') === 'checkbox';
      }

      // If the checkbox was clicked, the checked value has already been
      // flipped, so flip it back
      if (isInput) {
        checked = !checked;
      }

      if (serviceOptions.singleSelect ||
          (serviceOptions.data || {}).singleSelect) {
        self.clearSelection();
      }

      if (checked) {
        check.removeAttr('checked');
        photo.removeClass('selected');
        data.selected = false;
        delete _selectedPhotos[serviceName][data.id];
        updateCount(-1);
      }
      else if (_selectedPhotoCount < viewer.Uploads.MAX_PHOTOS) {
        check.attr('checked', 'checked');
        photo.addClass('selected');
        data.selected = true;
        _selectedPhotos[serviceName][data.id] = data;
        updateCount(1);
      }
      else {
        check.removeAttr('checked');
        photo.removeClass('selected');
      }
    }

    this.getSatchelPhotos = function(cb) {
      $.get('/upload/pending', {}, function(data) {
        cb(null, data);
      }, 'json');
    };

    this.initializeSearch = function(options) {
      var searchContainer = $('.bing .photo-container');
      searchContainer.show();

      var searchButton = searchContainer.find('.search-icon');
      var searchInput = searchContainer.find('input');
      var resultsContainer = searchContainer.find('.selectphoto');

      _selectedPhotos.bing = {};

      var lastSearchResults;

      var renderResults = function(results) {
        var photos = $('#tmplFacebookPhoto').tmpl(_.map(results, function(p) {
          var data = {
            // Use the full size image for event form
            art: (options.data || {}).isEventForm ? p.src : p.thumb,
            id: p.src,
            src: p.src,
            width: p.width,
            height: p.height
          };
          data.selected = !!_selectedPhotos.bing[p.src];
          return data;
        }));
        resultsContainer.append(photos);
        centerImages(photos);

        photos.click(function(e) {
          togglePhoto(this, "bing", options, e);
        });
      };

      var doSearch = function() {
        var query = $.trim(searchInput.val());
        if (query.length === 0) {
          return;
        }

        searchContainer.find('.search-container').addClass('searching');

        resultsContainer.html($('#tmplModalLoadingIndicator').tmpl());
        erly.services.bingImageSearch(query, 0, function(err, results) {
          if (err) {
            erly.modal.showAlert('Sorry', 'There was an error with your ' +
            'search.  Please try again later.');
            return;
          }

          if (results.length === 0) {
            resultsContainer.find('.vcenter').html('Sorry, ' +
            'no results were found.');
            return;
          }

          lastSearchResults = results;

          resultsContainer.empty();
          renderResults(results);
        });
      };

      var loadingMore = false;
      resultsContainer.scroll(function() {
        if (!lastSearchResults || lastSearchResults.length === 0 ||
          loadingMore) {
          return;
        }

        var scrollPosition = resultsContainer.scrollTop() +
          resultsContainer.height();
        var bottom = resultsContainer[0].scrollHeight;

        if (scrollPosition >= bottom) {
          resultsContainer.append($('#tmplModalLoadingIndicatorWithClear').tmpl());
          loadingMore = true;
          lastSearchResults.next(function(err, results) {
            loadingMore = false;
            if (err) {
              erly.trackException(err,
                'viewer_uploads.js@resultsContainer.scroll');
              return;
            }

            resultsContainer.find('.loader').remove();

            if (results.length > 0) {
              renderResults(results);
            }
            lastSearchResults = results;
          });
        }
      });

      searchInput.keypress(function(e) {
        if (e.which === 13) {
          doSearch();
          return false;
        }

        return true;
      });
      searchButton.click(function(e) {
        if (e.which > 1) {
          return;
        }

        doSearch();
      });

      _submitFuncs.bing = function(callback) {
        var posts = [];
        var order = carousel ? carousel.getCurrentInsertOrder() : 200;

        _(_selectedPhotos.bing).each(function(pic) {
          var post = {
            type: 'photo',
            picture: pic.src,
            orig_url: pic.src,
            status: 'PENDING',
            dimensions: {
              width: pic.width,
              height: pic.height
            },
            source: 'bing'
          };
          post.order = order;
          posts.push(post);

          if (order) {
            order -= 0.0001;
          }
        });

        if (posts.length === 0) {
          return callback(null, []);
        }

        $.ajax({
          url: erly.urlFor.collection(_collection, 'posts'),
          type: 'POST',
          data: JSON.stringify(posts),
          contentType: 'application/json; charset=utf-8',
          success: function(data) {
            if (data.success) {
              callback(null, data.data);
            }
            else {
              callback(data.error);
            }
          },
          error: function() {
            callback(arguments);
          }
        });
      };
    };

    this.initializeForm = function(template, form, request, options) {
      options = options || {};
      var serviceName = viewer.Uploads.SATCHEL_SERVICE_NAME;
      _selectedPhotos[serviceName] = {};

      var selectFile = $('#selectFile');
      var uploadForm = $('#uploadForm');
      var fileContainer = $('#fileupload .files');

      // Hack to move the "drag photos" box to after all the thumbs of
      // uploaded photos, since the jquery fileupload doesn't give us
      // the proper event.
      var photoHelper = $('#fileupload .add-photo-helper');
      var showPhotoHelper = function() {
        if (_selectedPhotoCount < viewer.Uploads.MAX_PHOTOS) {
          fileContainer.append(photoHelper);

          photoHelper.find('.choose').append(uploadForm);
          photoHelper.fadeIn(function() {
            // HACK: IE8
            photoHelper.css('filter', 'alpha(opacity=100)');
          });

          // And scroll to the bottom
          fileContainer.scrollTop(100000);
        }
        else {
          photoHelper.hide();
        }
      };

      var satchelCount = 0;
      var updateSatchelCount = function() {
        $('#satchel_album .label .count').text(satchelCount);
        if (satchelCount === 1) {
          $('#satchel_album .label .plural').hide();
        }
        else if (satchelCount === 0) {
          $('#satchel_view').hide();
          $('#fileupload div.navigation').hide();
          template.find('.upload-container').removeClass('nav-visible');
          $('#satchel_album').hide();
          $('.files').show();
        }
      };

      // Start fetching the satchel.  When it returns decide which div to show.
      this.getSatchelPhotos(function(err, items) {
        if (err) {
          console.warn('Error fetching satchel photos');
        }

        $('.waiting').hide();
        if (err || !items || items.length === 0) {
          $('#centerSelection').show();
          return;
        }

        satchelCount = items.length;
        updateSatchelCount();

        // Show satchel album icon and the drag photos box.
        var fdiv = $('.files');
        var satchel_album_div = fdiv.find('#satchel_album');
        fdiv.show();
        satchel_album_div.show();

        // Render satchel album view.
        var satchel_div = $('#satchel_view');
        var nav_div = $('#fileupload div.navigation');
        var photos = $('#tmplSatchelPhoto').tmpl(_(items).map(function(p) {
          return $.extend({
            singleSelect: (options.data || options || {}).singleSelect,
            satchelItem: true
          }, p);
        }));
        satchel_div.append(photos);
        centerImages(photos);

        // Hook up clicks for the satchel album and the back button.
        satchel_album_div.click(function() {
          fdiv.hide();
          nav_div.show();
          template.find('.upload-container').addClass('nav-visible');
          satchel_div.show();
        });
        nav_div.find('div.photosGoBack').click(function() {
          satchel_div.hide();
          nav_div.hide();
          template.find('.upload-container').removeClass('nav-visible');
          fdiv.show();
        });

        // Hook up select all button.
        var selectAll = nav_div.find(DOM.selectAllDiv);
        selectAll.show();
        selectAll.unbind('click');
        selectAll.click(function(event) {
          var photos = satchel_div.find('.satchel-photo');
          if (!photos || photos.length === 0) {
            return false;
          }

          var checkbox = $(this).find('input');

          // If the user clicked outside of the checkbox
          if (!checkbox.is(event.target)) {
            if (checkbox.attr('checked') === 'checked') {
              checkbox.removeAttr('checked');
            } else {
              checkbox.attr('checked', 'checked');
            }
          }

          var isChecked = checkbox.attr('checked') === 'checked';
          photos.each(function() {
            var photo = $(this);
            var photoChecked = photo.find('input:checked').length === 1;
            if (isChecked !== photoChecked) {
              togglePhoto(photo, serviceName, options, null);
            }
          });
        });

        // Set up photo helper.
        showPhotoHelper();
      });

      // Set up file upload.
      var fileuploadOptions = options.fileuploadOptions || {};
      $('#fileupload').fileupload($.extend({
        maxFileSize: 15000000,
        maxNumberOfFiles: viewer.Uploads.MAX_PHOTOS,
        autoUpload: true,
        acceptFileTypes: /(\.|\/)(gif|jpe?g|png)$/i,
        dropZone: $('#fileupload')
      }, fileuploadOptions));

      // Open download dialogs via iframes,
      // to prevent aborting current uploads:
      $('#fileupload .files a:not([target^=_blank])').live('click', function(e) {
        e.preventDefault();
        $('<iframe style="display:none;"></iframe>').prop('src', this.href).appendTo('body');
      });
      var singleSelect = options.singleSelect;
      singleSelect = singleSelect || (options.data || {}).singleSelect;

      var shouldHideDropOutlineBackground = false;
      $('#fileupload').bind('fileuploadadd', function(e, data) {
        fileContainer.show();
        $('#centerSelection').hide();
        photoHelper.hide();
        setTimeout(showPhotoHelper, 1000);
      }).bind('fileuploadprogress', function(e, data) {
        $(data.context).find('div.progress-text').text(parseInt(data.loaded / data.total * 100, 10) + '%');
      }).bind('fileuploaddone', function(e, data) {
        // Mimic togglePhoto
        var d = data.result[0];
        if (!d.error) {
          if (singleSelect) {
            self.clearSelection();
            d.singleSelect = singleSelect;
          }
          d.selected = true;
          d.satchelItem = true;
          updateCount(1);

          // The result has 'pending_id', but we expect all the items have 'id',
          // so set it here.
          if (d.pending_id) {
            d.id = d.pending_id;
            _selectedPhotos[serviceName][d.pending_id] = d;
          }
        }
      }).bind('fileuploadrendered', function(e, data) {
        centerImages(e.rendered);
      }).bind('fileuploadstart', function(e, data) {
        template.find('.button-bar input[type=submit]').attr('disabled', 'disabled');
      }).bind('fileuploadalways', function() {
        template.find('.button-bar input[type=submit]').removeAttr('disabled');
      }).bind('fileuploaddragover', function() {
        $('.drop-outline').css('background-color', '#eee');
        shouldHideDropOutlineBackground = false;

        $(document).unbind('dragleave');
        $(document).bind('dragleave', function(e) {
          shouldHideDropOutlineBackground = true;
          setTimeout(function() {
            if (shouldHideDropOutlineBackground) {
              $('.drop-outline').css('background-color', 'transparent');
            }
          }, 500);
        });
      });

      $('.satchel-or-uploaded .remove').die('click');
      $('.satchel-or-uploaded .remove').live('click', function(e) {
        // call delete without waiting for response.
        var data = $(this).parent().tmplItem().data;
        if (data.id) {
          $.post('/upload/pending/delete/' + data.id);
          if (e.target.parentNode.parentNode.className === 'satchel-photo') {
            // Only update the satchel count if the deleted photo is already
            // in the satchel "album", not a newly-uploaded photo.
            satchelCount--;
            updateSatchelCount();
          }
        }
        var downloadTemplate = $(this).parent().parent();
        downloadTemplate.fadeOut(function() {
          if (data.selected) {
            data.selected = false;
            delete _selectedPhotos[serviceName][data.id];
            updateCount(-1);
          }
          downloadTemplate.remove();
          showPhotoHelper();
        });
      });

      $('.satchel-or-uploaded .preview .rotate').die('click');
      $('.satchel-or-uploaded .preview .rotate').live('click', function(e) {
        var image = $(this).parent().find('img');
        var cssRotation = image.data('rotation') || 0;
        var currentRotation = (cssRotation + 90) % 360;

        image.css('-webkit-transform', 'rotate(' + currentRotation + 'deg)');
        image.css('-moz-transform', 'rotate(' + currentRotation + 'deg)');
        image.css('filter', 'progid:DXImageTransform.Microsoft.BasicImage(rotation=' +
        currentRotation / 90 +
        ')');

        var data = image.tmplItem().data;
        var swap = data.width;
        data.width = data.height;
        data.height = swap;

        image.data('rotation', currentRotation);

        e.preventDefault();
      });

      var clickHandler = function(e) {
        var photo = $(this).parent().parent();
        togglePhoto(photo, serviceName, options, e);
      };
      $('.preview img').die('click');
      $('.preview img').live('click', clickHandler);
      $('.preview canvas').die('click');
      $('.preview canvas').live('click', clickHandler);
      $('.preview input').die('click');
      $('.preview input').live('click', clickHandler);

      _submitFuncs.fileUploads = function(callback) {
        var posts = [];
        var order = carousel ? carousel.getCurrentInsertOrder() : 200;
        $('.satchel-or-uploaded').each(function(i, val) {
          var pic = $(val);
          var data = pic.tmplItem().data;
          if (!data.selected || !data.url) {
            // Ignore satchel items or uploaded photos that are not selected.
            return;
          }

          var image = pic.find('.preview img');
          var caption = pic.find('.title input').val();
          posts.push({
            type: 'photo',
            caption: caption,
            picture: data.url,
            rotation: image.data('rotation') || 0,
            dimensions: {
              width: data.width,
              height: data.height
            },
            orig_url: data.origUrl || data.orig_url,
            pending_id: data.id, // satchel id, deletes from satchel
            status: 'PENDING',
            order: order,
            request: request ? JSON.stringify(request.tmplItem().data) : undefined
          });

          if (order) {
            order -= 0.0001;
          }
        });

        if (posts.length === 0) {
          return callback(null, []);
        }

        $.ajax({
          url: erly.urlFor.collection(_collection, 'posts'),
          data: JSON.stringify(posts),
          type: 'post',
          contentType: 'application/json; charset=utf-8',
          success: function(data) {
            if (data.success) {
              callback(null, data.data);
            }
            else {
              callback(data.error);
            }
          },
          error: function() {
            // might not be kosher with callback type
            callback(arguments);
          }
        });
      };

      // Post all at once from all tabs
      $('.add-photo input[type=submit]').click(function() {
        $(this).attr('disabled', 'disabled');

        var loader = $('#modal .add-photo .posting-loader');
        loader.show();
        $('#modal .add-photo .tab-page').hide();

        self.submitSelectedPhotos(function(err, results) {
          if (err) {
            $(this).removeAttr('disabled');
            return;
          }

          addPosts.postCreateResponse({
            success: true,
            data: results
          }, request);
        });
      });
    };

    this.submitSelectedPhotos = function(callback) {
      async.parallel(_submitFuncs, function(err, results) {
        if (err) {
          callback(err);
          return;
        }

        var posts = [];
        _.each(results, function(v, k) {
          posts = posts.concat(v);
        });

        callback(null, posts);
      });
    };

    this.getAuthedAlbums = function(service, cb, limit, offset, nextUrl) {
      var options = {
        limit: limit,
        offset: offset
      };

      if (nextUrl) {
        options = {
          nextUrl: nextUrl
        };
      }
      $.get('/upload/authed_albums/' + service, options, function(data) {
        cb(null, data);
      }, 'json');
    };

    this.getAuthedPhotos = function(service, album_id, cb, limit, offset,
        nextUrl) {
      var options = {
        album_id: album_id,
        limit: limit,
        offset: offset
      };

      if (nextUrl) {
        options = {
          nextUrl: nextUrl
        };
      }
      $.get('/upload/authed_photos/' + service, options, function(data) {
        cb(null, data);
      }, 'json');
    };

    this.clearSelection = function() {
      $('.content-container').find('.fbalbum').
        add($('.content-container').find('.fbphoto')).
        add($('.content-container').find('.satchel-or-uploaded')).
        removeClass('selected');
      $('.content-container').find(
        'input[type=checkbox]').removeAttr('checked');
      _(_.keys(_selectedPhotos)).each(function(serviceName) {
        _selectedPhotos[serviceName] = {};
      });
      _selectedPhotoCount = 0;
    };

    this.initializePhotoService = function(options) {
      if (!options) {
        options = {};
      }
      var serviceName = options.serviceName;
      var request = options.request;
      var container = options.container;
      var friendsFunc = options.friendsFunc;
      var albumsFunc = options.albumsFunc;
      var photosFunc = options.photosFunc;
      var prepFunc = options.prepFunc;
      var hasAlbumCheckBoxes = options.hasAlbumCheckBoxes;
      var albumsClickFunc = options.albumsClickFunc;
      // Reset from previous forms
      _selectedPhotos[serviceName] = {};
      _selectedPhotoCount = 0;

      // Behavior
      var vsc = 0;
      var fdiv = container.find('.photo-container div.selectphoto.friends');
      var adiv = container.find('.photo-container div.selectphoto.albums');
      var pdiv = container.find('.photo-container div.selectphoto.photos');
      var self = this;

      var prevdivs = [];
      var topDiv = fdiv;
      if (!friendsFunc) {
        topDiv = adiv;
      }
      var activeDiv = topDiv;
      container.find('div.selectphoto').hide();
      activeDiv.show();

      if (!options.connected && 'dropbox' !== serviceName) {
        topDiv.html($('#tmplAuthLink').tmpl({
          service: options.serviceName,
          albumByUrl: !!options.publicAlbumHandler
        }));
        topDiv.find('.auth-service').each(function() {
          erly.services.bindConnect(options.serviceName, $(this));
        });
      }

      if ('dropbox' === serviceName) {
        topDiv.html('');
      }

      var updateNav = function() {
        container.find('div.navigation').hide();
        container.find('div.albumUrl').hide();
        container.find('div.friend-search').hide();
        container.find('.tab-page').removeClass('nav-visible');
        if ((activeDiv === adiv && !options.publicAlbumHandler && prevdivs.length === 0)) {
        }
        else if (activeDiv === fdiv) {
          container.find('div.friend-search').show();
          container.find('.tab-page').addClass('nav-visible');
        }
        else if (activeDiv === adiv && options.publicAlbumHandler) {
          container.find('div.albumUrl').show();
          container.find('.tab-page').addClass('nav-visible');
        }
        else {
          container.find('div.navigation').show();
          container.find('.tab-page').addClass('nav-visible');
          if (!options.singleSelect) {
            container.find(DOM.selectAllDiv).show();
          }
          container.find('div.photosGoBack').show();
          container.find('div.albumUrl').hide();
        }
      };
      updateNav();

      // back button
      container.find('div.photosGoBack').unbind('click');
      container.find('div.photosGoBack').click(function() {
        if (!isActiveTab($(topDiv))) {
          return;
        }

        var prevdiv = prevdivs.pop();
        container.find('div.selectphoto').hide();
        prevdiv.show();
        prevdiv.scrollTop(prevdiv.data('scrollTop'));
        activeDiv = prevdiv;

        updateNav();
      });

      var drillDown = function(items) {
        activeDiv.data('scrollTop', activeDiv.scrollTop());
        prevdivs.push(activeDiv);
        if (activeDiv === adiv) {
          adiv.hide();
          pdiv.empty().show();
          activeDiv = pdiv;
        }
        else if (activeDiv === fdiv) {
          fdiv.hide();
          adiv.empty().show();
          activeDiv = adiv;
        }

        updateNav();
        $.colorbox.resize();
      };

      var handlePhotos = function(err, items) {
        if (err) {
          return console.warn('Error fetching photos');
        }
        if (!items || items.length === 0) {
          var emptyMessage = $('<div class="empty"></div>');
          emptyMessage.text('You have already added all photos from this album.');
          pdiv.append(emptyMessage);
        }
        else {
          var photos = $('#tmplFacebookPhoto').tmpl(items);
          photos.each(function(index) {
            var data = $(this).tmplItem().data;
            if (_selectedPhotos[serviceName][data.id]) {
              $(this).addClass('selected');
              $(this).find('input').attr('checked', 'checked');
            }
          });
          pdiv.append(photos);
          centerImages(photos);
          photos.click(function(e) {
            togglePhoto(this, serviceName, options, e);
          });
        }
      };

      var atBottomOfScroll = function(el, callback) {
        var lastTriggered = -1;
        el = $(el);

        if (!el.hasClass('infinite-scroll-tracking')) {
          el.unbind('scroll');
          el.addClass('infinite-scroll-tracking');

          el.scroll(function() {
            // REVIEW: These measurements don't work if the tab is not
            //         showing.  Probably shouldn't start loading
            //         photos until the tab is selected.
            var scrollPosition = el.scrollTop() + el.height();
            var bottom = el[0].scrollHeight;

            if (scrollPosition >= bottom) {
              // only trigger the callback once per position
              if (lastTriggered !== scrollPosition) {
                callback(function() {
                  // Check again to see if we need to load more
                  el.scroll();
                });
                lastTriggered = scrollPosition;
              }
            }
          });

          // TODO: Also need to handle the window resize case

          el.scroll();
        }
      };

      var unbindScrollTracking = function(el) {
        el = $(el);
        el.unbind('scroll');
        el.removeClass('infinite-scroll-tracking');
      };

      var handleInfiniteScroll = function(err, container, fetchFunc, renderFunc, items, id, limit, offset, unfiltered_length, nextUrl) {
        if (err) {
          container.find('.modal-loading-wrapper').remove();
          container.html('<center>Unable to load photo data at this time. ' +
          'Please try again later.</center>');
          erly.trackException(err, 'viewer_uploads.js@handleInfiniteScroll');
          return;
        }

        unbindScrollTracking(container);
        // use unfiltered_length if available, otherwise use original code
        var done = (unfiltered_length || (items || []).length) < limit;

        var nextFetchUrl;
        if (nextUrl) {
          nextFetchUrl = nextUrl;
          done = false;
        }

        container.find('div.loader').remove();
        renderFunc(err, items);

        var findSpinner = function() {
          return container.find('.modal-loading-wrapper');
        };

        atBottomOfScroll(container, function(callback) {
          var spinner = findSpinner();

          if (done) {
            unbindScrollTracking();
            return spinner.remove();
          }

          if (spinner.length === 0) {
            container.append($('#tmplModalLoadingIndicatorWithClear').tmpl());
            spinner = findSpinner();
            container.scrollTop(container[0].scrollHeight);

            offset += limit;

            fetchFunc(id, function(err, items, unfiltered_length, nextUrl) {
              spinner.remove();
              if (!items || items.length === 0 || unfiltered_length < limit) {
                done = true;
              }
              if (nextUrl) {
                nextFetchUrl = nextUrl;
                done = false;
              }
              renderFunc(err, items, false);
              _.defer(callback);
            }, limit, offset, nextFetchUrl);
          }
        });
      };

      var albumClickHandler = function(e) {
        var data = $(this).tmplItem().data;
        if (typeof photosFunc === 'function') {
          drillDown();
          activeDiv.html($('#tmplModalLoadingIndicator').tmpl());

          var limit = Uploads.MAX_PHOTOS;
          // Increase the limit by the number of existing ids for this
          // services so we don't incorrectly return 0 items
          limit += _.reduce(erly.viewer.existIds, function(memo, v, k) {
            if (k.indexOf(serviceName) === 0) {
              return memo + 1;
            }
            return memo;
          }, 0);

          var fn = data.publicAlbum ? options.publicAlbumHandler.getPhotos :
            photosFunc;

          var filteredPhotos = function(album, callback, limit, offset, nextUrl) {
            fn(album, function(err, data, unfiltered_length, nextUrl) {
              if (err) {
                return callback(err);
              }
              var dataNextUrl = null;
              if (data.photos) {
                dataNextUrl = data.nextUrl;
                data = data.photos;
              }
              if (!unfiltered_length) {
                unfiltered_length = (data || []).length;
              }
              data = _.filter(data, function(photo) {
                var source = photo.source;
                var photoId = photo.id;
                if (erly.viewer.existIds[source + photoId]) {
                  return 0;
                }
                else {
                  return 1;
                }
              });
              callback(null, data, unfiltered_length, dataNextUrl);
            }, limit, offset, nextUrl);
          };

          filteredPhotos(data, function(err, items, unfiltered_length, nextUrl) {
            handleInfiniteScroll(err, pdiv, filteredPhotos, handlePhotos, items, data, limit, 0, unfiltered_length, nextUrl);
          }, limit, 0);
        }
        else if (typeof albumsClickFunc === 'function') {
          albumsClickFunc($(this), $(e.target), data);
        }
      };

      if (options.publicAlbumHandler) {
        var input = container.find('.albumUrl input');
        input.focus(erly.enterTextField).blur(erly.leaveTextField);
        input.attr('placeholder', options.publicAlbumHandler.tip);

        var error = container.find('.albumUrl .error');
        var loader = container.find('img.loader');

        container.find('.albumUrl button').unbind('click');
        container.find('.albumUrl button').click(function(e) {
          if (e.which > 1) {
            return;
          }

          error.hide();
          options.publicAlbumHandler.getPublicAlbum(input.val(), function(err, album) {
            loader.hide();

            if (err) {
              error.text("Sorry, we couldn't import that album");
              error.show();
              return;
            }
            input.val('');

            if (adiv.find('.photo-auth').length > 0) {
              container.find('div.selectphoto').hide();
              adiv.empty();
              adiv.show();
            }

            album.publicAlbum = true;

            var newAlbum = $$('#tmplFacebookAlbum').tmpl(album);
            adiv.find('div.loader').remove();
            adiv.find('div.sorry').remove();
            adiv.prepend(newAlbum);

            newAlbum.animate({
              opacity: 0
            }, 0);

            adiv.animate({
              scrollTop: 0
            }, function() {
              newAlbum.animate({
                opacity: 1
              });
            });

            centerImages(newAlbum);
            newAlbum.click(albumClickHandler);
          });

          loader.show();
        });
      }

      _submitFuncs[serviceName] = function(callback) {
        var posts = [];
        var order = carousel ? carousel.getCurrentInsertOrder() : 200;

        _(_selectedPhotos[serviceName]).each(function(pic) {
          var post = prepFunc(pic);
          if (request) {
            post.request = JSON.stringify(request.tmplItem().data);
          }
          post.order = order;
          posts.push(post);

          if (order) {
            order -= 0.0001;
          }
        });

        if (posts.length === 0) {
          return callback(null, []);
        }

        $.ajax({
          url: erly.urlFor.collection(_collection, 'posts'),
          type: 'POST',
          data: JSON.stringify(posts),
          contentType: 'application/json; charset=utf-8',
          success: function(data) {
            if (data.success) {
              callback(null, data.data);
            }
            else {
              callback(data.error);
            }
          },
          error: function() {
            callback(arguments);
          }
        });
      };

      container.find(DOM.selectAllDiv).unbind('click');
      container.find(DOM.selectAllDiv).click(function(event) {
        var checkbox = $(this).find('input');

        // If the user clicked outside of the checkbox
        if (!checkbox.is(event.target)) {
          if (checkbox.attr('checked') === 'checked') {
            checkbox.removeAttr('checked');
          } else {
            checkbox.attr('checked', 'checked');
          }
        }

        var photos = pdiv.find('.fbphoto');

        if (!photos || photos.length === 0) {
          return false;
        }

        var isChecked = checkbox.attr('checked') === 'checked';

        photos.each(function() {
          var photo = $(this);
          var photoChecked = photo.find('input:checked').length === 1;
          if (isChecked !== photoChecked) {
            togglePhoto(photo, serviceName, options, null);
          }
        });

        return true;
      });

      var handleAlbums = function(err, items) {
        if (err) {
          return console.warn('Error fetching albums:' + err);
        }
        if ((!items || items.length === 0) && (adiv.children().length === 0)) {
          var sorry = $('<div class="sorry" >Sorry, we couldn\'t find any photo albums.</div>');
          sorry.css('text-align', 'center');
          sorry.css('color', '#666');
          adiv.html(sorry);
        }
        else {
          var albums = $('#tmplFacebookAlbum').tmpl(items, {
            hasAlbumCheckBoxes: hasAlbumCheckBoxes
          });

          adiv.append(albums);
          _.defer(function() {
            centerImages(albums);
          });

          albums.click(albumClickHandler);
        }
      };

      var handleFriends = function(err, items) {
        if (err) {
          return console.warn('Error fetching friends:' + err);
        }
        if ((!items || items.length === 0) && fdiv.children().length === 0) {
          var sorry = $('<div class="friends">Sorry, we couldn\'t find any matching friends.</div>');
          sorry.css('text-align', 'center');
          sorry.css('color', '#666');
          fdiv.html(sorry);
        }
        else {
          var friends = $('#tmplFacebookAlbum').tmpl(items);

          fdiv.append(friends);
          centerImages(friends);

          friends.click(function() {
            var data = $(this).tmplItem().data;
            drillDown();
            activeDiv.html($('#tmplModalLoadingIndicator').tmpl());

            albumsFunc(data, function(err, items) {
              handleInfiniteScroll(err, adiv, albumsFunc, handleAlbums, items, data, 24, 0);
            }, 24, 0);
          });
        }
      };

      var fetchFriends = function() {
        // Clear cached results
        delete self.friends;

        fdiv.html($('#tmplModalLoadingIndicator').tmpl());

        // Ugliness to fit with the generic infinite scroller
        var friendsFuncWrapper = function(dummy, callback, limit, offset) {
          friendsFunc(callback, limit, offset);
        };
        friendsFunc(function(err, items) {
          handleInfiniteScroll(err, fdiv, friendsFuncWrapper, handleFriends, items, null, 24, 0);
        }, 24, 0);
      };

      if (options.connected) {
        if (topDiv.find('.photo-auth')) {
          topDiv.html($('#tmplModalLoadingIndicatorWithClear').tmpl());
        }
        if (friendsFunc) {
          fetchFriends();
        }
        else {
          albumsFunc(serviceName, function(err, items) {
            handleInfiniteScroll(err, adiv, albumsFunc, handleAlbums, items, serviceName, 24, 0);
          }, 24, 0);
        }
      }

      // Bind the search friends stuff
      if (serviceName === 'facebook') {
        var friendSearch = container.find('.friend-search');
        var friendSearchInput = friendSearch.find('input');
        var searchButton = friendSearch.find('.search-icon');
        var clearSearchButton = friendSearch.find('.clear-search-icon');

        var doSearch = function() {
          _friendQuery = $.trim(friendSearchInput.val());

          if (_friendQuery) {
            searchButton.hide();
            clearSearchButton.css('display', 'inline-block');
          }
          else {
            searchButton.show();
            clearSearchButton.hide();
          }
          fetchFriends();
        };

        friendSearchInput.keypress(function(e) {
          if (e.which === 13) {
            doSearch();
          }
          return true;
        });

        searchButton.click(function(e) {
          if (e.which > 1) {
            return true;
          }

          doSearch();
        });

        clearSearchButton.click(function(e) {
          if (e.which > 1) {
            return true;
          }

          friendSearchInput.val('');

          if (_friendQuery) {
            doSearch();
          }
        });
      }

      updateNav();
    };

    this.getFacebookPhotos = function(album, callback, limit, offset) {
      album = album.album_id || album;
      if (!erly.session.isFacebookConnected()) {
        return callback(null, []);
      }

      var res_photos = [];
      var batch = [];

      if (album === 'self_photos') {
        batch.push({
          method: 'POST',
          relative_url: 'method/fql.query?' +
          $.param({
            query: 'SELECT object_id, src_small, src_big, caption, images, ' +
            'owner, src_big_width, src_big_height ' +
            'FROM photo WHERE pid IN (SELECT pid FROM photo_tag WHERE ' +
            'subject=me())' +
            ' ORDER BY created DESC LIMIT ' +
            offset +
            ',' +
            limit
          })
        });
      }
      else {
        batch.push({
          method: 'POST',
          relative_url: 'method/fql.query?' +
          $.param({
            query: 'SELECT object_id, src_small, src_big, caption, images, ' +
            'owner, src_big_width, src_big_height ' +
            'FROM photo WHERE aid="' +
            album +
            '" ORDER BY created LIMIT ' +
            offset +
            ',' +
            limit
          })
        });
      }

      erly.facebookBatchCall(batch, function(err, res) {
        if (err) {
          return callback(err);
        }
        var unfiltered_length = (res.data || []).length;
        _.each(res[0] || [], function(photo) {
          // when retrieving photos from outside, first check existences in the
          // collection
          if (erly.viewer.existIds['facebook' + photo.id]) {
            return;
          }
          photo.id = photo.object_id;
          photo.art = photo.src_small;
          photo.picture = photo.src_big;
          photo.source = 'facebook';
          photo.name = photo.caption;
          photo.width = photo.src_big_width;
          photo.height = photo.src_big_height;

          // pick smallest that is larger than 170x120 for art
          var closest = null;
          if (_.isArray(photo.images)) {
            _(photo.images).forEach(function(photo) {
              if (photo.width >= 170 && photo.height >= 128) {
                if (!closest ||
                closest.width > photo.width &&
                closest.height > photo.height) {
                  closest = {
                    height: photo.height,
                    width: photo.width,
                    source: photo.source
                  };
                }
              }
            });
          }
          if (closest) {
            photo.art = closest.source;
          }
          photo.facebookIds = {
            id: photo.object_id
          };
          photo.facebookTags = [];
          if (photo.owner) {
            photo.facebookTags.push({
              id: photo.owner
            });
          }
          if (_.isArray((photo.tags || {}).data)) {
            photo.facebookTags = _(photo.facebookTags).concat(_(photo.tags.data).filter(function(v) {
              return !!v.id;
            }));
          }
          // pick largest item for orig_url
          if (_.isArray(photo.images)) {
            var best = _(photo.images).detect(function(best, next) {
              if (next.height > best.height || next.width > best.width) {
                best = next;
              }
              return best;
            });

            if (best) {
              photo.orig_url = best.source;
            }
          }
          photo.orig_url = photo.orig_url || photo.picture;

          res_photos.push(photo);
        });
        callback(null, res_photos, unfiltered_length);
      });
    };

    this.getFacebookAlbums = function(user, callback, limit, offset) {
      user = user.id || user;
      if (!erly.session.isFacebookConnected()) {
        return callback(null, []);
      }

      if (user === 'me') {
        user = 'me()';
      }

      var res_albums = [];
      var batch = [{
        method: 'POST',
        relative_url: 'method/fql.query?' +
        $.param({
          query: 'SELECT aid, cover_object_id, location, created, ' +
          'name ' +
          'FROM album WHERE owner=' +
          user +
          ' ORDER BY created DESC LIMIT ' +
          offset +
          ',' +
          limit
        })
      }];

      if (user === 'me()') {
        batch.push({
          method: 'POST',
          relative_url: 'method/fql.query?' +
          $.param({
            query: 'SELECT pid, created ' +
            'FROM photo_tag WHERE subject=' +
            user +
            ' ORDER BY created DESC LIMIT ' +
            offset +
            ',' +
            limit
          })
        });
      }

      erly.facebookBatchCall(batch, function(err, res) {
        if (err) {
          return callback(err);
        }

        var albums = res[0];
        var tagphotos = res[1] || null;

        if (albums) {
          var pushAlbum = function(album) {
            if (album.cover_object_id !== '0') {
              res_albums.push({
                album_id: album.aid,
                location: album.location,
                created_at: new Date(album.created * 1000),
                caption: album.name,
                cover_art_id: album.cover_object_id,
                cover_art: 'https://graph.facebook.com/' +
                album.cover_object_id +
                '/picture?type=normal&access_token=' +
                encodeURIComponent(erly.oauthToken)
              });
            }
          };

          _.each(albums, function(album) {
            pushAlbum(album);
          });
        }

        if (tagphotos && tagphotos.length > 0) {
          res_albums.unshift({
            album_id: 'self_photos',
            caption: 'Photos of Me',
            cover_art: 'https://graph.facebook.com/me' +
            '/picture?type=normal&access_token=' +
            encodeURIComponent(erly.oauthToken)
          });
        }

        res_albums = _.reject(res_albums, function(album) {
          return !album.cover_art;
        });

        callback(null, res_albums);
      });
    };

    this.getFacebookFriends = function(callback, limit, offset) {
      if (!erly.session.isFacebookConnected()) {
        return callback(null, []);
      }
      var self = this;

      var done = function() {
        callback(null, self.friends.slice(offset, offset + limit));
      };

      if (self.friends) {
        return done();
      }

      var textQuery = _friendQuery ?
        "strpos(lower(name), '" + _friendQuery + "') >= 0 AND " :
        "";

      var batch = [{
        method: 'POST',
        relative_url: 'method/fql.multiquery?' +
        $.param({
          "queries": JSON.stringify({
            friends: "SELECT name, uid FROM user " +
            "WHERE " +
            textQuery +
            "uid IN (SELECT owner FROM album " +
            "WHERE owner IN (SELECT uid2 FROM friend WHERE uid1=me()))",
            owners: "SELECT name, uid FROM user " +
            "WHERE " +
            textQuery +
            "uid IN (SELECT owner FROM album " +
            "WHERE aid IN (SELECT aid FROM photo " +
            "WHERE pid IN (SELECT pid FROM photo_tag WHERE subject=me())))"
          })
        })
      }];

      erly.facebookBatchCall(batch, function(err, res) {
        if (err) {
          return callback(err);
        }

        var mapToAlbumObj = function(v) {
          return {
            caption: v.name + "'s Albums",
            cover_art: 'https://graph.facebook.com/' + v.uid +
            '/picture?type=large',
            id: v.uid
          };
        };

        if (!res[0][0] || !res[0][1]) {
          return callback("Couldn't get Facebook friends");
        }

        var friends = _(res[0][0].fql_result_set).map(mapToAlbumObj);
        var owners = _(res[0][1].fql_result_set).map(mapToAlbumObj);

        // owners go first
        friends = owners.concat(friends);

        self.friends = [];
        if (!_friendQuery) {
          self.friends.push({
            caption: 'My Albums',
            cover_art: 'https://graph.facebook.com/' +
            erly.getUserData().facebookId +
            '/picture?type=large',
            id: 'me'
          });
        }

        // dedupe
        var hash = {};
        _.each(friends, function(friend) {
          if (!hash[friend.id]) {
            self.friends.push(friend);
            hash[friend.id] = true;
          }
        });

        done();
      });
    };
  };

  Uploads.prototype.getSelectedPhotos = function() {
    return _.flatten(_.map(_.values(this._selectedPhotos), _.values));
  };

  /** @const */
  Uploads.MAX_PHOTOS = 250;

  // NOTE: 23 b/c we will add the user's own albums to the list
  Uploads.MAX_FACEBOOK_ALBUMS = 23;

  viewer.Uploads = Uploads;

  viewer.Uploads.SATCHEL_SERVICE_NAME = 'satchel';
}(erly.viewer));

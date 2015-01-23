/*!
 * Wrapper around add photo dialog to allow importing from 3rd party services.
 */
(function(erly) {
  var albumImporter = {};

  var _ap = null;
  var _retrievePhotos = null;
  var _pickedAlbum = null;

  var _normalizeAlbumFields = function(data) {
    return {
      album_id: data.album_id,
      caption: data.caption,
      location: data.location,
      startDate: data.created_at,
      coverArt: data.cover_art,
      coverArtId: data.cover_art_id
    };
  };

  // attempt to get the best cover photo url by correlating against the photos
  // in the album.  fall back to the first image in the album, or the original
  // coverArt (crappy one) if there aren't any albumPhotos.
  var _pickCoverPhotoUrl = function(albumPhotos, albumData) {
    var foundCover = null;
    if (albumData.source !== 'facebook') {
      _(albumPhotos).forEach(function(photo) {
        if (albumData.coverArt === photo.art) {
          foundCover = photo.original;
        }
      });
    }
    else {
      _(albumPhotos).forEach(function(photo) {
        if (albumData.coverArtId === photo.id ) {
          foundCover = photo.picture;
        }
      });
    }
    if (foundCover) {
      return foundCover;
    }
    else if (albumPhotos.length > 0) {
      return albumPhotos[0].original || albumPhotos[0].picture;
    } else {
      return albumData.coverArt;
    }
  };

  albumImporter.init = function() {
    _ap = new erly.viewer.AddPosts({});
  };

  albumImporter.showModal = function() {
    _ap.showAddPhotoDialog({
      data: {
        title: 'Import an existing photo album',
        isAlbumImport: true,
        albumsClickFunc: function(elem, target, data, service, template) {
          // this is called when an album is clicked on
          var check = elem.find('input') || elem;
          var checked = check.attr('checked') === 'checked';
          if (target.attr('type') === 'checkbox') {
            checked = !checked;
          }
          if (!checked) {
            if (_pickedAlbum) {
              template.find('input[type=checkbox]').removeAttr('checked');
            }
            check.attr('checked', 'checked');
            _pickedAlbum = _normalizeAlbumFields(data);
            _pickedAlbum.source = service;
          } else {
            _pickedAlbum = null;
            check.removeAttr('checked');
          }
          if (!_pickedAlbum) {
            return;
          }

          // start pulling the first batch of the photos before going to the next
          // screen?
          if (service === 'facebook') {
            _retrievePhotos = _ap._uploads.getFacebookPhotos;
          } else {
            _retrievePhotos = _(_ap._uploads.getAuthedPhotos).bind(_ap._uploads, service);
          }
        }
      },
      extraSetupFunc: function(template) {
        template.find('.import-album input.continue').click(function() {
          if (_pickedAlbum) {
            _retrievePhotos(_pickedAlbum.album_id, function(err, data) {
              erly.eventForm.prefillFromAlbum(_pickedAlbum, data.photos || []);
              erly.modal.close();
            }, 500, 0);
          }
          else {
            console.log('didnt select a album yet');
          }
        });

        // size correctly..
        $.colorbox.resize();
      }
    });
  };

  albumImporter.importAlbum = function(chronicle, photos, albumData, callback) {
    var order = 200;
    var postData = _(photos).map(function(pic) {
      if (pic.video) {
        return {
          type: 'video',
          link: pic.original,
          chronicle_id: chronicle.id,
          image: pic.image,
          order: order -= 0.0001,
          title: erly.util.filterCaption(pic.caption),
          embed: pic.video.embed,
          videoDimensions: pic.video.dimensions,
          imageDimensions: pic.dimensions
        };
      }
      else {
        var picture = albumData.source === 'facebook' ? pic.picture : pic.image;
        if (!picture) { return null; }
        return {
          chronicle_id: chronicle.id,
          type: 'photo',
          caption: pic.name || erly.util.filterCaption(pic.caption),
          picture: picture,
          order: order -= 0.0001,
          orig_url: pic.orig_url || pic.original,
          status: 'PENDING',
          dimensions: {
            width: pic.width || pic.dimensions.width,
            height: pic.height || pic.dimensions.height
          },
          source: albumData.source
        };
      }
    });
    postData = _.filter(postData, Boolean);

    async.parallel([
      function(callback) {
        $.ajax({
          type: 'post',
          url: erly.urlFor.collection(chronicle, 'posts'),
          data: JSON.stringify(postData),
          contentType: 'application/json; charset=utf-8',
          success: function(data) {
            if (data.success) {
              callback();
            }
            else {
              callback(new Error('Error importing external photos'));
            }
          }
        });
      },
      function(callback) {
        $.ajax({
          type: 'post',
          url: erly.urlFor.collection(chronicle, 'cover_photo'),
          data: JSON.stringify({
            coverPhotoUrl: _pickCoverPhotoUrl(photos, albumData)
          }),
          contentType: 'application/json; charset=utf-8',
          success: function(data) {
            if (data.success) {
              callback();
            }
            else {
              callback(new Error('Error setting cover photo'));
            }
          }
        });
      }
    ], callback);
  };

  erly.albumImporter = albumImporter;
}(erly));

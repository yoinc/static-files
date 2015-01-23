/*!
 * Service handling
 */

(function(erly) {
  var services = {};

  services.services = {
    facebook: {
      name: 'facebook',
      title: 'Facebook'
    },
    google: {
      name: 'google',
      title: 'Google',
      windowSize: {width: 960, height: 500}
    },
    yahoo: {
      name: 'yahoo',
      title: 'Yahoo!',
      windowSize: {width: 500, height: 500}
    },
    flickr: {
      name: 'flickr',
      title: 'Flickr',
      windowSize: {width: 900, height: 650}
    },
    picasa: {
      name: 'picasa',
      title: 'Picasa',
      windowSize: {width: 960, height: 500}
    },
    instagram: {
      name: 'instagram',
      title: 'Instagram',
      windowSize: {width: 1024, height: 500}
    },
    smugmug: {
      name: 'smugmug',
      title: 'SmugMug',
      windowSize: {width: 960, height: 556}
    }
  };

  services.addressBook = [
    services.services.google,
    services.services.yahoo
  ];

  services.photos = [
    services.services.flickr,
    services.services.picasa,
    services.services.instagram,
    services.services.smugmug
  ];

  services.photosWithFB = _.flatten([
    services.services.facebook,
    services.photos
  ]);

  services.bindConnect = function(service, domId) {
    $(domId).click(function(e) {
      services.connect(service, domId);
      e.preventDefault();
      return false;
    });
  };

  services.authWindowRef = null;

  services.connect = function(serviceName, domId) {
    serviceName = serviceName.toLowerCase();
    if (serviceName === 'facebook') {
      return erly.session.facebookConnectToExistingAccount(function(err) {
        services.importWindowClosed({
          success: !err,
          service: 'facebook',
          user: {
            id: erly.userId,
            services: []
          }
        });
      });
    }
    var url = '/auth/' + serviceName;

    var size = services.services[serviceName] || {};
    size = size.windowSize || {width: 500, height: 500};
    if (services.authWindowRef !== null &&
        !services.authWindowRef.closed) {
      services.authWindowRef.close();
    }
    services.authWindowRef = window.open(url, '_erlyAuthWindow',
      'width=' + size.width + ', height=' + size.height);
    return false;
  };

  services.enableSettingsButtons = function(options) {
    if (typeof options === 'undefined') {
      options = {};
    }

    if (typeof options.allowDisconnect === 'undefined') {
      options.allowDisconnect = true;
    }

    $('.services .service-toggle').live('click', function(_, service) {
      var self = $(this);
      var serviceName = self.attr('id').replace('service-', '');
      var data = self.tmplItem().data;

      if (!self.find('.connected').length) {
        services.connect(serviceName, self);
      } else {
        if (options.allowDisconnect) {
          erly.modal.showConfirm('Disconnect Service',
            'Are you sure you want to unlink your ' + data.service.title +
              ' and Erly accounts?',
            'Unlink', function() {
            var id = self.attr('id');
            var service = id.replace('disconnect_', '');

            $('#form_' + service).ajaxSubmit({
              datatype: 'application/json',
              success: function(data, textStatus, jqXHR) {
                var serviceName = data.service;

                if (data.success) {
                  var template = $('#tmplService').tmpl({
                    user: data.user,
                    service: services.services[serviceName],
                    connected: false
                  });

                  $('.service-' + serviceName).replaceWith(template);

                  erly.events.fire(erly.events.SERVICE_DISCONNECTED, serviceName);
                }
              }
            });
          }, {type: 'warning'});
        }
      }
    });
  };

  services.importWindowClosed = function(data) {
    if (data.success) {
      erly.events.fire(erly.events.SERVICE_CONNECTED, data);
    } else {
      erly.events.fire(erly.events.SERVICE_CONNECTION_DENIED, data);
    }
  };

  services.isConnected = function(user, name) {
    if (name === 'facebook') {
      return user.facebookId && user.oauthToken;
    }
    return user.services && user.services[name];
  };

  services.getPhotoServices = function(user) {
    return erly.session.canDisconnectFacebook() ?
      services.photosWithFB : services.photos;
  };

  services.bingImageSearch = function(query, offset, callback) {
    // Don't go over 1000 results
    if (offset >= 1000) {
      return callback(null, []);
    }

    // Use JSONP to get the data
    $.ajax({
      url: '/bingsearch?offset=' + offset + '&query=' + query,
      dataType: 'json',
      success: function(data) {
        var results = data;
        var all = {};
        _.each(results, function(image) {
          all[image.MediaUrl] = {
            height: image.Height,
            thumb: image.Thumbnail.MediaUrl,
            width: image.Width
          };
        });

        if (results && results.length > 0) {
          $.ajax({
            type: 'POST',
            url: '/_/gsafelookup_filter',
            data: {
              urls: _.map(results, function(image) {
                return image.MediaUrl;
              })
            },
            success: function(urls) {
              var filtered = [];
              _.each(urls, function(u) {
                filtered.push({
                  src: u,
                  height: all[u].height,
                  thumb: all[u].thumb,
                  width: all[u].width
                });
              });

              // Iterator-ish next function
              filtered.next = function(nextCallback) {
                erly.services.bingImageSearch(query, offset + 50, nextCallback);
              };

              callback(null, filtered);
            }
          });
        }
        else {
          callback(null, []);
        }
      }
    });
  };

  erly.services = services;
}(erly));

/*global exports: true */

var _;
if (typeof exports !== 'undefined') {
  _ = require('underscore');
}

(function(erly) {
  erly.flickr = {
    photoExtras: ['geo', // lat/lng data
     'date_taken', // -> datetaken
     'date_upload', // -> dateupload
     'url_b', // old "large", not usually provided (1024 on longest side)
     'url_m', // medium - 500 on longest side
     'url_o', // original - original dims
     'url_l', // large - 1024 on longest side
     'url_s', // small - 240 on longest side
     'url_t', // thumbnail - 100 on longest side
     'url_z', // medium - 640 on longest side
     'media'].join(','),
    parseFlickrDate: function(dt) {
      return new Date(dt.replace(' ', 'T') + 'Z');
    },
    convertToPhoto: function(photo) {
      // Sort {key}_{size} into a hash of sizes
      var sizes = _.keys(photo).reduce(function(sz, key) {
        if (/^(url|width|height)_([a-z])$/.test(key)) {
          var k = RegExp.$1;
          var s = RegExp.$2;
          sz[s] = sz[s] || {};
          sz[s][k] = photo[key];
        }
        return sz;
      }, {});

      // Pick only fully formed sizes (ones with url, width, and height)
      _(sizes).filter(function(sz) {
        return sz.height && sz.url && sz.width;
      });

      // Pick thumb, large and original from sizes using a fallback
      var thumb = sizes.s || sizes.m || sizes.t || {};
      var large = sizes.l || sizes.b || sizes.z ||
          sizes.m || sizes.s || sizes.t || {};
      var original = sizes.o || large;

      var created_at = photo.datetaken || photo.dateupload;
      if (/^\d+$/.test(created_at)) {
        created_at = new Date(parseInt(created_at, 10) * 1000);
      }
      else {
        created_at = erly.flickr.parseFlickrDate(created_at);
      }

      var item = {
        id: photo.id,
        art: thumb.url,
        image: large.url,
        original: original.url,
        caption: photo.title,
        created_at: created_at,
        dimensions: {
          width: parseInt(large.width, 10),
          height: parseInt(large.height, 10)
        },
        source: 'flickr'
      };

      if (photo.media === 'video') {
        item.video = {};
        item.video.dimensions = {
          width: photo.width_o,
          height: photo.height_o
        };
        item.video.embed = '<object type="application/x-shockwave-flash" ' +
        'width="' + photo.width_o + '" height="' + photo.height_o + '" ' +
        'data="http://www.flickr.com/apps/video/stewart.swf?v=71377" ' +
        'classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"> ' +
        '<param name="flashvars" value="intl_lang=en-us&photo_secret=' +
        photo.secret + '&photo_id=' + photo.id +
        '"></param> <param name="movie" ' +
        'value="http://www.flickr.com/apps/video/stewart.swf?v=71377">' +
        '</param> <param name="bgcolor" value="#000000"></param> ' +
        '<param name="allowFullScreen" value="true"></param>' +
        '<embed type="application/x-shockwave-flash" ' +
        'src="http://www.flickr.com/apps/video/stewart.swf?v=71377" ' +
        'bgcolor="#000000" allowfullscreen="true" ' +
        'flashvars="intl_lang=en-us&photo_secret=' + photo.secret +
        '&photo_id=' + photo.id + '" height="' + photo.height_o +
        '" width="' + photo.width_o + '"></embed></object>';
      }

      if (photo.latitude > 0 && photo.longitude > 0) {
        item.location = {
          latitude: photo.latitude,
          longitude: photo.longitude
        };
      }

      return item;
    }
  };
}(typeof exports !== 'undefined' ? exports : erly));

(function(cms) {
  var mode = "";

  // forward declarations
  var stylify,
      addCollapsable,
      addListener,
      addPhotoSnap,
      escape,
      getContent,
      fetch,
      findContent,
      getUsers;

  function renderData(data) {
    var output = stylify(data);
    $('#explorer').html(output);
    addCollapsable();
    addListener();
    addPhotoSnap();
  }

  function isCollapsable(obj) {
    return $.isArray(obj) || $.isPlainObject(obj);
  }

  function shorten(v) {
    if (v.length <= 90) {
      return v;
    } else {
      return v.substr(0,60) + '...' + v.substr(v.length-30, 30);
    }
  }

  function annotatePair(k, v, depth) {
    var link;

    if (mode === "user/getUsers") {
      switch(k) {
        case 'id':
          if (depth !== 1) {
            return false;
          }

          link = '/user/get/' + v;
          return ('<span class="collapser">' + escape(k) + '</span>: ' +
                  '<a href="' + link + '" class="getUser" uid="' + v + '">' + v + '</a>');
        case 'profile_picture':
          return ('<span class="collapser">' + escape(k) + '</span>: ' +
                  '<a href="' + v + '">' + shorten(v) + '</a>');

        default: return false;
      }
    } else if (mode === "user/getPosts" || mode === "user/getChronicle") {
      switch(k) {
        case 'original':
        case 'orig_url':
        case 'link':
        case 'picture':
          return ('<span class="collapser">' + escape(k) + '</span>: ' +
                  '<a href="' + v + '">' + shorten(v) + '</a>');
        case 'facebookId':
          link = 'http://graph.facebook.com/' + v;
          return ('<span class="collapser">' + escape(k) + '</span>: ' +
                  '<a href="' + link + '">' + v + '</a>');
        case 'chronicle_id':
          link = '/chronicle/get/' + v;
          return ('<span class="collapser">' + escape(k) + '</span>: ' +
                  '<a href="' + link + '" class="getChronicle" cid="' + v + '">' + v + '</a>');
        default: return false;
      }
    }
    return false;
  }

  function annotateValue(v, depth) {
    if(mode==="user/getFriendIds") {
      var link = '/user/get/' + escape(v);
      return ('<a href="' + link + '">' + v + '</a>');
    }
    return false;
  }

  stylify = function(obj, depth) {
    var result;

    depth = depth || 0;
    var ul = '<ul class="collapsable"><li>',
        div_ul = ',</li><li>',
        close_ul = '</li></ul>';
    var ula = '<ul class="collapsable"><li><span class="collapser">-</span>',
        div_ula = ',</li><li><span class="collapser">-</span>',
        close_ula = '</li></ul>';

    if ($.isPlainObject(obj)) {
      result = $.map(obj, function(v, k){
        var collapsable = isCollapsable(obj);
        var val = annotatePair(k, v, depth);
        if(val===false) {
          val = stylify(v, depth+1);
          return ((collapsable ? '<span class="collapser">' : '<span>') + escape(k) + '</span>: ' + val);
        }
        else {
          return val;
        }
      });
      return ('{' + ul + result.join(div_ul) + close_ul + '}');
    } else if ($.isArray(obj)) {
      result = $.map(obj, function(v) {
        return stylify(v, depth+1);
      });
      return ('[' + ula + result.join(div_ula) + close_ula + ']');
    } else {
      var val = annotateValue(obj, depth);
      if(val===false) {
        return escape(obj);
      }
      else {
        return val;
      }
    }
  };

  escape = function(s) {
    return ((s === null) ? "" : s).toString().replace(/[&"<>\\]/g, function(s) {
        switch(s) {
          case "&":
            return "&amp;";
          case "\\":
            return "\\\\";
          case '"':
            return '\"';
          case "<":
            return "&lt;";
          case ">":
            return "&gt;";
          default:
            return s;
        }
    });
  };

  addCollapsable = function() {
    var collapsers = $('#explorer').find('ul.collapsable').find('.collapser');
    collapsers.click(function(e) {
      e.preventDefault();
      var collapsed = $(this).hasClass('collapsed');
      if(collapsed) {
        $(this).removeClass('collapsed');
        $(this).siblings('.collapsable').show()
               .siblings('.ellipses').remove();
        if($(this).text()==='+') {
          $(this).text('-');
        }
      } else {
        $(this).addClass('collapsed');
        $(this).siblings('.collapsable').hide()
               .before('<span class="ellipses">&nbsp;…&nbsp;</span>');
        if($(this).text()==='-') {
          $(this).text('+');
        }
      }
    });
  };

  addListener = function() {
    $('a.getUser').click(function(evt){
      evt.preventDefault();
      var uid = $(evt.target).attr('uid');
      getContent('user', 'get', uid);
    });
    $('a.getChronicle').click(function(evt){
      evt.preventDefault();
      var cid = $(evt.target).attr('cid');
      getContent('chronicle', 'get', cid);
    });
  };

  addPhotoSnap = function() {
    var _rImg = /^https?:\/\/.*\.(jpg|jpeg|png|gif)$/i;
    $.each($('a[href]'), function(i, a){
      if(_rImg.test($(a).attr('href'))) {
        $(a).hover(function(e) {
          $('body').append('<p id="photoSnap"><img src="' + $(a).attr('href') + '" /></p>');
          $('#photoSnap')
            .css('top', (e.pageY - 10) + 'px')
            .css('left', (e.pageX + 30) + 'px')
            .fadeIn('slow');
        },
        function(){
          $('#photoSnap').remove();
        });
        $(a).mousemove(function(e){
          $('#photoSnap')
            .css('top', (e.pageY - 10) + 'px')
            .css('left', (e.pageX + 30) + 'px');
        });
      }
    });
  };

  function init() {
    $('#fetch').click(function(evt) {
      fetch(evt);
    });

    var inputs = $('#uid,#val');

    inputs.keypress(function(evt){
      if (evt.which === 13) {
        fetch(evt);
        return false;
      } else {
        return true;
      }
    });

    $('#model').change(function(e) {
      $.get('/cms/console/opts/' + $('#model').val(), function(opts) {
        $('#content').html('');
        _.each(opts, function(opt) {
          $('#content').append('<option value="' + opt + '">' + opt + '</option>');
        });
      });
    });

    $('#content').change(function(e) {
      if ($('#content').val() === 'find') {
        $('#hint').html('example: {"email":"username@gmail.com"} <br/> {"facebookId":"123456789"}');
      } else {
        $('#hint').html('');
      }
    });

    function changePlaceholder(hint) {
      $('#uid').val('');
      $('#uid').attr('placeholder', hint);
    }

    $('#content').change(function(e){
      if ($('#content').val() === 'find') {
        changePlaceholder("JSON query");
      } else {
        changePlaceholder("Id");
      }
    });

    var queryPairs = window.location.search.slice(1).split('&');
    var query = {};
    _.each(queryPairs, function(pair) {
      var parts = pair.split('=');
      query[parts[0]] = parts[1];
    });

    if (query.model &&
        query.action && query.action === 'get' &&
        query.id) {
      $('#model').val(query.model);
      $('#content').val(query.action);
      $('#uid').val(query.id);
      $('#fetch').click();
    }
  }

  fetch = function(evt) {
    var model   = $('#model').val();
    var content = $('#content').val();
    var uid = $('#uid').val();

    if (model === 'user' && !uid || uid.toUpperCase() === "ALL") {
      getUsers();
    } else if (content === 'find') {
      findContent(model, content);
    } else {
      getContent(model, content, uid);
    }
  };

  getContent = function(model, content, id) {
    $.get('/cms/console/' + model + '/' + content + '/' + id, function(data) {
      mode = model + '/' + content;
      renderData(data);
    });
  };

  findContent = function(model, content) {
    var url = '/cms/console/' + model + '/find';

    $.ajax({
      url: url,
      type: 'POST',
      data: {
        findQuery: $('#uid').val()
      },
      success: function(result) {
        if (result && result.data) {
          renderData(result.data);
        }
      }
    });
  };

  getUsers = function() {
    $.get('/cms/console/users', function(data) {
      mode = "user/getUsers";
      renderData(data);
    });
  };

  cms.console = {
    init: init
  };
}(erly.cms));
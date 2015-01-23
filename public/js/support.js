var okhsupport = {
};

okhsupport.init = function(appHost) {
  var _socket = null;
  var _currentRoomId = null;
  var _rooms = null;
  var _stickers = null;
  var _pollTecateTimeoutHandle;
  var _precanned = {};

 var isoDateString = function(d) {
    function pad(n){
      return n < 10 ? '0' + n : n;
    }

    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth()+1) + '-' +
      pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' +
      pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + 'Z';
  };

  var renderMessage = function(msg) {
    var msgEl = $($('#messageTemplate' + msg.type).html());
    if (msg.type === 0) {
      msgEl.find('.body').html(msg.body);
    } else if (msg.type === 1) {
      msgEl.find('img').attr('src', msg.galleryThumbUrl).click(function() {
        $(this).hide();
        msgEl.find('video').attr('src', msg.videoUrl).show();
      });
    } else if (msg.type === 2) {
      msgEl.find('img').attr('src', msg.galleryThumbUrl);
    } else if (msg.type === 7) {
      var stickerId = parseInt(msg.stickerId, 10) - 1;
      msgEl.find('img').attr('src', _stickers.stickerImagesBaseURL + '/' +
        _stickers.stickers[stickerId].sFrames[0].framePath);
    }

    msgEl.find('.timestamp').html(new Date(msg.sent).toString());
    $('#roomHistory').append(msgEl);

    msgEl.addClass(msg.fromId === '500000000000000000000003' ?
      'fromSelf' : 'fromOther');

    $('#roomHistory').scrollTop(500000);
  };

  var pollTecate = function(tecate, roomId) {
    $.get('http://' + tecate + '/list_streams?tag=' + roomId,
    function(data) {
      $('#videoChatStatus').html(data.length > 0 ? 'VIDEO CHAT <b>ON</b>' :
        'video chat off');
    });
    _pollTecateTimeoutHandle = setTimeout(function() {
      pollTecate(tecate, roomId);
     }, 10000);
  };

  var pollRoomPresence = function() {
    if (_currentRoomId) {
      $.post('/room/' + _currentRoomId +'/presence', {
        inRoom: 1
      });
    }

    setTimeout(pollRoomPresence, 10000);
  };

  var selectRoom = function(roomId, roomName, userId) {
    $('#roomHistory').html('');


    _currentRoomId = roomId;
    $.get('/room/' + roomId + '/history?limit=500', function(data) {
      data.data.messages.sort(function(a, b) {
        return a.sent - b.sent;
      });

      _.each(data.data.messages, function(msg) {
        renderMessage(msg);
      });

      $('#roomComposer').show();
      $('#precannedMessageList').show();
      $('#roomTextComposerInput').focus();
    });

    $('#videoChatStatus').html('-');
    clearTimeout(_pollTecateTimeoutHandle);
    $.get('/room/' + roomId, function(data) {
      var tecate = data.data.room.tecate;
      var parts = tecate.split(':');
      tecate = parts[0] + ':' + (parseInt(parts[1], 10) - 1);
      pollTecate(tecate, roomId);
    });

    $.post('/room/' + _currentRoomId +'/presence', {
      inRoom: 1
    });

    $.get('/_support/userInfo?userId=' + userId, function(data) {
      var username = data.data.username;
      $('#roomName').html('"' + roomName + '" (' +
        (username.length ? '@' + username + ' - ' : '') +
        data.data.model + ')');
    });
  };

  var sendTextMessage = function() {
    var text = $.trim($('#roomTextComposerInput').val());
    if (text) {
      $.post('/room/' + _currentRoomId + '/message/0?placeholderId=0', {
        type: 0,
        message: text
      }, function() {
        $('#roomTextComposerInput').val('');
      });
    }
  };

  var refreshRoomList = function() {
    var path = '/_support/rooms';
    if (_currentRoomId) {
      path += '?currentRoomId=' + _currentRoomId;
    }
    $.get(path, function(data) {
      _rooms = data.data.rooms;
      _rooms.sort(function(a, b) {
        return ((b.lastSupportNeed.timestamp) || 0) -
          ((a.lastSupportNeed.timestamp) || 0);
      });

      // Get the position of the current room
      var oldSelectedRoomOffsetFromTop = -1;
      if (_currentRoomId) {
        oldSelectedRoomOffsetFromTop =
          $('#roomList > div.roomListRoom.' + _currentRoomId).position().top;
      }

      $('#roomList').html('');

      var removeDupe = {};
      _.each(data.data.rooms, function(room) {
        if (removeDupe[room._id]) {
          return;
        }
        removeDupe[room._id] = true;

        var roomEl = $($('#roomListRoomTemplate').html());
        var userId = room.userIds[1];
        var roomName = room.userNames[userId];
        roomEl.find('.name').html(roomName);
        roomEl.find('.lastText').html(room.lastSupportNeed.text);
        roomEl.find('.lastTimestamp').attr('title',
            isoDateString(new Date(room.lastSupportNeed.timestamp))).timeago();
        roomEl.addClass(room._id);
        roomEl.click(function() {
          selectRoom(room._id, roomName, userId);
          $('#roomList > div.roomListRoom').removeClass('selected');
          roomEl.addClass('selected');
        });

        if (room._id === _currentRoomId) {
          roomEl.addClass('selected');
          roomEl[0].scrollIntoView();
        }

        $('#roomList').append(roomEl);
      });

      if (oldSelectedRoomOffsetFromTop !== -1) {
        // Let the DOM settle?
        setTimeout(function() {
            $('#roomList').scrollTop($('#roomList > div.roomListRoom.' +
              _currentRoomId).position().top - oldSelectedRoomOffsetFromTop);
        }, 50);
        $('#roomList').scrollTop(0);
      }
    });

    setTimeout(refreshRoomList, 10000);
  };

  var usePrecannedMessage = function(name) {
    $('#roomTextComposerInput').focus().val(_precanned[name]);
    $.post('/_support/precannedUsed', {
      name: name
    });
  };

  var refreshPrecannedMessages = function() {
    $.get('/_support/precanned', function(data) {
      if (data.data.precanned.length === 0) {
        return $('#precannedMessages').html('None');
      } else {
        $('#precannedMessages').html('');
      }

      _precanned = {};

      _.each(data.data.precanned, function(msg) {
        _precanned[msg._id] = msg.body;

        var msgEl = $($('#precannedMessageTemplate').html());
        msgEl.find('.name').html(msg._id + ' (' + (msg.usageCount || 0) +
            ')');
        msgEl.find('.body').html(msg.body);

        msgEl.click(function() {
          $('#addPrecannedMessageName').val(msg._id);
          $('#addPrecannedMessageBody').val(msg.body);
        });

        $('#precannedMessages').append(msgEl);
      });
    });
  };

  var refreshPrecannedMessagesPeriodically = function() {
    refreshPrecannedMessages();
    setTimeout(refreshPrecannedMessagesPeriodically, 30000);
  };

  var offsetSelectedRoom = function(offset) {
    var index = -1;
    if (_currentRoomId) {
      _.each(_rooms, function(room, i) {
        if (room._id === _currentRoomId) {
          index = i;
        }
     });

     index += offset;
     index = Math.min(_rooms.length - 1, index);
     index = Math.max(0, index);
    } else {
      index = 0;
    }

    if (index !== -1) {
      $('#roomList > div.roomListRoom').eq(index).click();
    }
  };

  _socket = io.connect(appHost, {
    'sync disconnect on unload': true
  });

  _socket.on('message', function(msg) {
    if (msg.roomId === _currentRoomId) {
      renderMessage(msg);
    }
  });

  $.get('/stickers', function(data) {
    _stickers = data.data;
  });

  $('#roomTextComposerInput').keypress(function (e){
    if (e.which === 13) {
      // Check for precanned stuff
      var currentText = $('#roomTextComposerInput').val();
      var $index = currentText.indexOf('$');
      if ($index !== -1) {
        var name = currentText.substring($index + 1);
        name = name.split(/\s/)[0];
        if (name !== '$') {
          if (name === 'dismiss') {
            $.post('/_support/dismissRoom', {
              id: _currentRoomId
            });
            $('#roomTextComposerInput').focus().val('');
            var roomListRoom = $('.roomListRoom.' + _currentRoomId);
            var prev = roomListRoom.prev();
            var next = roomListRoom.next();
            if (prev.length > 0) {
              prev.click();
            } else if (next.length > 0) {
              next.click();
            } else {
              $('#roomHistory').html('');
              $('#roomName').html('');
              _currentRoomId = null;
            }
            roomListRoom.remove();
            return false;
          } else {
            var precannedMessage = _precanned[name];
            if (precannedMessage) {
              usePrecannedMessage(name);
              return false;
            } else {
              window.alert('Unrecognized precanned message "' + name +
                '". If you want to send a $, use $$.');
              return false;
            }
          }
        }
      }
      sendTextMessage();
    }
  });

  $('#roomTextComposerButton').click(sendTextMessage);

  $('body').keypress(function(e) {
    if (e.which === 63232 && e.ctrlKey) {
      offsetSelectedRoom(-1);
      return false;
    }
    if (e.which === 63233 && e.ctrlKey) {
      offsetSelectedRoom(1);
      return false;
    }
  });

  $('#addPrecannedMessageButton').click(function() {
    var name = $.trim($('#addPrecannedMessageName').val());
    var body = $.trim($('#addPrecannedMessageBody').val());

    if (name.length === 0 || body.length === 0) {
      window.alert('Name and body are required!');
      return;
    }

    $.post('/_support/precanned', {
      name: name,
      body: body
    }, function(result) {
      if (result.success) {
        refreshPrecannedMessages();
      } else {
        window.alert('Error: ' + JSON.stringify(result));
      }
    });
  });
  
  $('#deletePrecannedMessageButton').click(function() {
    var name = $.trim($('#addPrecannedMessageName').val());
    if (name.length === 0) {
      window.alert('Name is required!');
      return;
    }
    
    if (window.confirm('Are you sure you want to remove "' + name + '"?')) {
      $.post('/_support/precannedDelete', {
        name: name,
      }, function(result) {
        if (result.success) {
          refreshPrecannedMessages();
        } else {
          window.alert('Error: ' + JSON.stringify(result));
        }
      });
    }
  });

  refreshRoomList();
  refreshPrecannedMessagesPeriodically();
  pollRoomPresence();
};

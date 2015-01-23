pb.ui.roomlist = (function(pb) {
  var _el = null;
  var _mappedFriends = {};
  var _roomsReceived = false;

  function _refreshPresence(roomId) {
    $.get('/room/' + roomId + '/presence', function(data) {
      _.each(data, function(v) {
        _onPresence(null, {
          userId: v.userId,
          presence: v.online ? 1 : 0,
          lastSeen: v.lastSeen
        });
      });
    });
  }

  function getRoom(roomId) {
    return _el.find('#room-' + roomId);
  }

  function _onNewRoom(e, room, action, actionData) {
    _el.find('.empty').hide();
    var newRoom = $(pb.tmpl.render('roomlist.room', {room: room}));
    _el.find('.room-list').append(newRoom);

    newRoom.find('.members').collapse({ toggle: false });

    newRoom.find('.members').on('dblclick', 'div.user', function(e) {
      var userId = $(this).data('id');
      if (userId !== pb.model.session.getUserId()) {
        var existing = pb.model.room.getPrivateConversation(userId);
        if (existing) {
          pb.pubsub.publish(pb.events.ACTIVATE_ROOM, existing._id);
        }
        else {
          pb.model.room.create({
            userIds: [$(this).data('id')]
          });
        }
      }
      e.stopPropagation();
      e.preventDefault();
      return false;
    });

    newRoom.find('.member-toggle').click(function(e) {
      newRoom.find('.members').toggle();
      var curText = $(this).text();
      var shown = curText === '+';
      if (shown) {
        _refreshPresence(room._id);
      }
      $(this).text(shown ? '-' : '+');
      e.preventDefault();
      e.stopPropagation();
      return false;
    });

    newRoom.find('button.save-nick').click(function() {
      var nick = newRoom.find('input.nick').val();
      $.post('/room/' + room._id + '/nick/' + $.trim(nick), function() {
        newRoom.find('.display-name.self').text(nick);
        $('#update_nick_' + room._id).modal('hide');
      });
    });

    newRoom.find('.close-room').click(function() {
      pb.pubsub.publish(pb.events.ROOM_CLOSE, room._id);
      e.stopPropagation();
      e.preventDefault();
      return false;
    });

    newRoom.click(function(e) {
      if ($(e.target).hasClass('member-toggle')) {
        return;
      }
      var roomId = $(this).attr('id').replace('room-', '');
      $(this).find('.activity').text('');
      pb.pubsub.publish(pb.events.ACTIVATE_ROOM, roomId);
    });

    // switch to room if you created it.
    if (_roomsReceived && room.creatorId === pb.model.session.getUserId()) {
      pb.pubsub.publish(pb.events.ACTIVATE_ROOM, room._id);
    }
    else if (action === 'create' &&
        actionData.sourceRoomId === pb.ui.roompanel.getActiveRoomId()) {
      pb.pubsub.publish(pb.events.ACTIVATE_ROOM, room._id);
    }
  }

  function _onRoomClose(e, roomId) {
    getRoom(roomId).hide();
  }

  function _onRoomMessage(e, msg) {
    var activeRoomId = pb.ui.roompanel.getActiveRoomId();
    if (activeRoomId && msg.roomId !== activeRoomId) {
      var roomObject = pb.model.room.get(msg.roomId);
      if (roomObject && !roomObject.isGroup) {
        pb.sound.play(pb.sound.DING);
      }
      var roomActivityEl = getRoom(msg.roomId).find('.activity');
      if (roomActivityEl.length > 0) {
        roomActivityEl.text('* new');
      }
    }
  }

  function _onRoomsReceived(e, rooms) {
    _roomsReceived = true;

    // Choose the correct initial room, based on hash, then cookie, then
    // first room
    var initialRoomId = null;
    var validateRoomId = function() {
      var valid = false;
      _.each(rooms, function(room) {
        if (room._id === initialRoomId) {
          valid = true;
        }
      });

      if (!valid) {
        initialRoomId = null;
      }
    };

    initialRoomId = window.location.hash.substring(1);
    validateRoomId();

    if (!initialRoomId && $.cookie('last_room')) {
      initialRoomId = $.cookie('last_room');
      validateRoomId();
    }

    if (!initialRoomId && rooms.length > 0) {
      initialRoomId = rooms[0]._id;
      validateRoomId();
    }

    if (initialRoomId) {
      pb.pubsub.publish(pb.events.ACTIVATE_ROOM, initialRoomId);
    }
    else {
      // Show the user a message helping him/her to create a room
      $('.rooms .empty').show();
    }
  }

  function _onPresence(e, update) {
    _el.find('.user-' + update.userId + ' span.status').text(
      update.presence === 0 ? '(offline)' : '(online)');
  }

  function _onRoomActivated(e, roomId) {
    _el.find('.room.active').find('.members').hide();
    _el.find('.room').removeClass('active');
    var roomEl = getRoom(roomId);
    roomEl.addClass('active');
    roomEl.show();
    roomEl.find('.members').show();
    _el.find('.inviter').show();
    _refreshPresence(roomId);

    // Set the location in the browser
    window.location.hash = roomId;
    // And save to a cookie
    $.cookie('last_room', roomId);
  }

  function _onRoomUpdate(e, room) {
    var roomEl = getRoom(room._id);
    roomEl.find('.members').html(pb.tmpl.render('roomlist.members', room));
    roomEl.find('.title').text(room.title);
  }

  function _onRoomAlreadyCreated(e, roomId) {
    pb.pubsub.publish(pb.events.ACTIVATE_ROOM, roomId);
  }

  function init(el) {
    _el = el;
    _el.html(pb.tmpl.render('roomlist.list'));

    _el.find('button.create-room').click(function() {
      pb.model.room.create({
        emails: [_el.find('input#create_email').val()]
      });
      $('#create_modal').modal('hide');
    });

    _el.find('button.invite-room').click(function() {
      pb.model.room.invite({
        roomId: pb.ui.roompanel.getActiveRoomId(),
        emails: [_el.find('input#add_email').val()]
      });
      $('#invite_modal').modal('hide');
    });

    var facebookSource = function(query, callback) {
      pb.model.session.getContacts(function(items) {
        callback(_.map(items, function(item) {
          var label = item.name + ' - (' + item.fbId + ')';
          _mappedFriends[label] = item;
          return label;
        }));
      });
    };

    $('input#create_facebook').typeahead({
      source: facebookSource,
      updater: function(item) {
        var selected = _mappedFriends[item];
        pb.model.room.create({
          fbIds: [selected.fbId]
        });
        $('#create_modal').modal('hide');
        return item;
      }
    });

    $('input#add_facebook').typeahead({
      source: facebookSource,
      updater: function(item) {
        var selected = _mappedFriends[item];
        pb.model.room.invite({
          roomId: pb.ui.roompanel.getActiveRoomId(),
          fbIds: [selected.id]
        });
        $('#invite_modal').modal('hide');
        return item;
      }
    });

    pb.pubsub.subscribe(pb.events.NEW_ROOM, _onNewRoom);
    pb.pubsub.subscribe(pb.events.ROOM_CLOSE, _onRoomClose);
    pb.pubsub.subscribe(pb.events.ROOM_MESSAGE, _onRoomMessage);
    pb.pubsub.subscribe(pb.events.PRESENCE, _onPresence);
    pb.pubsub.subscribe(pb.events.ROOM_UPDATE, _onRoomUpdate);
    pb.pubsub.subscribe(pb.events.ROOM_ACTIVATED, _onRoomActivated);
    pb.pubsub.subscribe(pb.events.ROOM_ALREADY_CREATED,
        _onRoomAlreadyCreated);
    pb.pubsub.subscribe(pb.events.ROOMS_RECEIVED,
        _onRoomsReceived);
  }

  function isRoomVisible(roomId) {
    return getRoom(roomId).is(':visible');
  }

  return {
    init: init,
    isRoomVisible: isRoomVisible
  };
}(pb));

pb.model.room = (function(pb) {
  var _rooms = {};

  function create(options) {
    $.post('/room/create', {
      fbIds: options.fbIds,
      emails: options.emails,
      userIds: options.userIds
    }, function(data) {
      if (data.data.alreadyCreated === true) {
        pb.pubsub.publish(pb.events.ROOM_ALREADY_CREATED, data.roomId);
      }
    });
  }

  function invite(options) {
    $.post('/room/' + options.roomId + '/invite', {
      fbIds: options.fbIds,
      emails: options.emails,
      userIds: options.userIds
    }, function() {
      // TODO: Notify the inviter that this person has been invited
    });
  }

  function get(roomId) {
    return _rooms[roomId];
  }

  function getAll() {
    return _rooms;
  }

  /**
   * Checks if a private conversation with the specified userId already
   * exists.
   */
  function getPrivateConversation(userId) {
    var privateConversation = null;
    _.each(_rooms, function(room) {
      if (!room.isGroup) {
        if (room.userIds[0] === userId || room.userIds[1] === userId) {
          privateConversation = room;
        }
      }
    });

    return privateConversation;
  }

  function _updateRoom(roomData) {
    var room = roomData.room;
    var action = roomData.action;
    var actionData = roomData.actionData;

    var isNew = !_rooms[room._id];


    var historyStartTime = pb.model.session.getRoomHistoryStartTime(room._id);
    room.hidden = !room.lastMessage ||
        (room.lastMessage.sent < historyStartTime);

    // determine room title.  if 2 people, conversation
    if (!room.title && !room.isGroup) {
      var myUserId = pb.model.session.getUserId();
      var otherIndex = (room.userIds[0] === myUserId) ? 1 : 0;
      room.title = room.userNames[room.userIds[otherIndex]];
    } else {
      if (!room.title) {
        room.title = 'Untitled Room with: ' + _.map(room.userIds,
          function(userId) {
            return room.userNames[userId];
          }).join(', ');
      }
    }

    _rooms[room._id] = room;

    if (isNew) {
      pb.pubsub.publish(pb.events.NEW_ROOM, room, action, actionData);
    }
    else {
      pb.pubsub.publish(pb.events.ROOM_UPDATE, room, action, actionData);
    }
  }

  function _onUser() {
    var roomList = pb.model.session.getRoomList();
    _.each(roomList, function(room) {
      _updateRoom({
        room: room
      });
    });

    pb.pubsub.publish(pb.events.ROOMS_RECEIVED, roomList);
  }

  function _onChannelRoom(e, roomData) {
    _updateRoom(roomData);
  }

  /**
   * INCREMENTALLY loads history for the specified room
   */
  function loadHistory(roomId) {
    var room = _rooms[roomId];

    // If we've already loaded all the history, don't try again
    if (room.loadedCompleteHistory) {
      return;
    }

    var url = '/room/' + roomId + '/history?limit=500';
    if (room.oldestMessageSent) {
      url += '&olderThan=' + room.oldestMessageSent;
    }

    $.get(url, function(data) {
      var messages = data.data.messages || [];

      if (messages.length === 0) {
        room.loadedCompleteHistory = true;
      }

      room.oldestMessageSent = _.reduce(messages, function(memo, msg) {
        return Math.min(msg.sent, memo);
      }, room.oldestMessageSent || Number.MAX_VALUE);

      pb.pubsub.publish(pb.events.ROOM_HISTORY, roomId,
        messages);
    });
  }

  function init() {
    pb.pubsub.subscribe(pb.events.SESSION_USER, _onUser);
    pb.pubsub.subscribe(pb.events.CHANNEL_ROOM, _onChannelRoom);
  }

  return {
    create: create,
    get: get,
    getAll: getAll,
    getPrivateConversation: getPrivateConversation,
    init: init,
    invite: invite,
    loadHistory: loadHistory
  };
}(pb));


// room panel manages all the rooms.
pb.ui.roompanel = (function(pb) {
  var _el = null;
  var _activeRoom = null;
  // room ui elements
  var _rooms = {};

  function getActiveRoomId() {
    if (_activeRoom) {
      return _activeRoom.data('id');
    }
  }

  function _onRoomClose(e, roomId) {
    var wasActiveRoom = (getActiveRoomId() === roomId);
    if (_rooms[roomId]) {
      _rooms[roomId].onRoomClose();
      delete _rooms[roomId];
    }

    // If this is the current room, activate another one
    if (wasActiveRoom) {
      var allRoomKeys = _.keys(pb.model.room.getAll());
      allRoomKeys = _.filter(allRoomKeys, function(id) {
        return id !== roomId && pb.ui.roomlist.isRoomVisible(id);
      });

      if (allRoomKeys.length > 0) {
        pb.pubsub.publish(pb.events.ACTIVATE_ROOM, allRoomKeys[0]);
      }
      else {
        // Show the no active room msg
        $('.left-panel .rooms .empty').show();
        $('.right-panel .empty').show();
      }
    }
  }

  function _onRoomMessage(e, message) {
    var roomId = message.roomId;
    if (!_rooms[roomId]) {
      console.log('got message for an unknown room');
    } else {
      _rooms[roomId].onRoomMessage(message);
    }
  }

  function _onRoomMessageDeleted(e, message) {
    var roomId = message.roomId;
    if (!_rooms[roomId]) {
      console.log('got message for an unknown room');
    } else {
      _rooms[roomId].onRoomMessageDeleted(message);
    }
  }

  function _onRoomHistory(e, roomId, messages) {
    if (!_rooms[roomId]) {
      console.log('got history for a room i dont know about');
    } else {
      _rooms[roomId].onRoomHistory(roomId, messages);
    }
  }

  function _onRoomPresence(e, message) {
    var roomId = message.roomId;
    if (_rooms[roomId]) {
      _rooms[roomId].onRoomPresence(message);
    }
  }

  function _onRoomUpdate(e, room) {
    _rooms[room._id].onRoomUpdate(room);
  }

  function _onActivateRoom(e, roomId) {
    var room = pb.model.room.get(roomId);

    // hide any currently active room if we are switching to another
    if (_activeRoom && _activeRoom.data('id') !== room._id) {
      _activeRoom.onRoomHide();
      _activeRoom.hide();
    }

    // show existing or create new room ui object
    if (_rooms[room._id]) {
      _rooms[room._id].show();
    } else {
      _rooms[room._id] = $(pb.tmpl.render('room.chrome')).pbRoom(room);
      _el.append(_rooms[room._id]);
    }

    // hide the "empty" message if this is the first room we've activated
    if (!_activeRoom) {
      _el.find('.empty').hide();
    }
    _activeRoom = _rooms[room._id];
    _activeRoom.onRoomShown();

    // publish that we've activated a room to people who care (roomlist)
    pb.pubsub.publish(pb.events.ROOM_ACTIVATED, roomId);
  }

  function init(el) {
    _el = el;
    _el.html(pb.tmpl.render('room.panel'));

    pb.pubsub.subscribe(pb.events.ACTIVATE_ROOM, _onActivateRoom);
    pb.pubsub.subscribe(pb.events.ROOM_CLOSE, _onRoomClose);
    pb.pubsub.subscribe(pb.events.ROOM_UPDATE, _onRoomUpdate);
    pb.pubsub.subscribe(pb.events.ROOM_PRESENCE, _onRoomPresence);
    pb.pubsub.subscribe(pb.events.ROOM_HISTORY, _onRoomHistory);
    pb.pubsub.subscribe(pb.events.ROOM_MESSAGE, _onRoomMessage);
    pb.pubsub.subscribe(pb.events.ROOM_MESSAGE_DELETED, _onRoomMessageDeleted);
  }

  return {
    getActiveRoomId: getActiveRoomId,
    init: init
  };
}(pb));

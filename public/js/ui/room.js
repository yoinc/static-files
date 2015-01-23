(function( $ ){
  var methods = {
    init : function(room) {
      this.data('id', room._id);

      this.roomRenderingState = {};
      var roomEl = this;

      function _postTitle() {
        $.post('/room/' + room._id + '/title', {
          title: roomEl.find('.room-title-edit-form input.title').val()
        });
        roomEl.find('.room-title-edit-form').hide();
      }

      roomEl.find('.room-title-edit-form button').click(function() {
        _postTitle();
      });

      roomEl.find('.room-title-edit-form input').keypress(function(e) {
        if (e.which === 13) {
          _postTitle();
        }
      });
      roomEl.find('.room-title').text(room.title).dblclick(function() {
        var roomTitle = $(this).text();
        roomEl.find('.room-title-edit-form').show().
          find('input.title').val(roomTitle);
        $(this).text('');
      });

      roomEl.find('.leave-button').click(function() {
        if (window.confirm("Are you sure you want to leave this room?")) {
          $.post('/room/' + room._id + '/leave', {
            deleteMessages: '0'
          }, function(res) {
            if (res.success) {
              pb.pubsub.publish(pb.events.ROOM_CLOSE, room._id);
            }
          });
        }
      });

      roomEl.delegate('div.user-video div.thumbnail', 'click', function() {
        var img = $(this);

        var video = img.siblings('video');
        video.attr('src', video.attr('data-src'));
        video.attr('autoplay', 'autoplay');
        video.on('ended', function() {
          $.post('/room/' + room._id + '/recordVideoViews', {
            messageIds: video.attr('data-id')
          });
        });
        video.show();
        img.hide();
      });

      var _publishingState = {};
      this._publishingState = _publishingState;

      // TODO(walt): fix all this publishingState stuff.
      // TODO(walt): fix where we get the tecate host from.
      var tecateHost = null;  //pb.model.session.getTecateHost();
      function _startPublishing() {
        if (!_publishingState.started) {
          var myId = pb.model.session.getUserId();
          _publishingState.streamName = room._id + myId + new Date().getTime();
          _publishingState.tecateHost = tecateHost;
          $.getJSON('http://' + tecateHost.hostName + ':' +
                    tecateHost.httpPort + '/prepare?callback=?', {
                streamName: _publishingState.streamName,
                publisherId: myId,
                fromFlash: true,
                tags: room._id
          }, function(data) {
            if (data === 'ok') {
              // tell swf to connect to tecatehost
              pb.pubsub.publish(pb.events.PUBLISH_CONNECT, tecateHost);
              // tell the swf to publish to streamName!
              pb.pubsub.publish(pb.events.PUBLISH_START,
                _publishingState.streamName);

              pb.ui.ptvoverlay.show();
              $.post('/room/' + room._id + '/publishers', {
                hostName: tecateHost.hostName,
                iosPort: tecateHost.iosPort,
                rtmpPort: tecateHost.rtmpPort,
                visible: true,
                isNew: true,
                streamName: _publishingState.streamName
              }, function(data) {
                if (data.success) {
                  _publishingState.started = true;
                  _publishingState.recording = true;
                  $.getJSON('http://' + tecateHost.hostName + ':' +
                      tecateHost.httpPort + '/start_record?callback=?', {
                        streamName: _publishingState.streamName
                      }, function() {});
                }
              });

            }
          });

        } else {
          pb.ui.ptvoverlay.show();
          // move swf from being hidden
          pb.pubsub.publish(pb.events.PUBLISH_RESUME);
          $.post('/room/' + room._id + '/publishers', {
            hostName: _publishingState.tecateHost.hostName,
            iosPort: _publishingState.tecateHost.iosPort,
            rtmpPort: _publishingState.tecateHost.rtmpPort,
            visible: true,
            streamName: _publishingState.streamName
          }, function(data) {
            if (data.success) {
              if (!_publishingState.recording) {
                _publishingState.recording = true;
                $.getJSON('http://' + tecateHost.hostName + ':' +
                    tecateHost.httpPort + '/start_record?callback=?', {
                      streamName: _publishingState.streamName
                    }, function() {});
              }
            }
          });
        }
      }

      function _stopPublishing() {
        // hide swf
        pb.ui.ptvoverlay.hide();
        pb.pubsub.publish(pb.events.PUBLISH_PAUSE);
        $.getJSON('http://' + tecateHost.hostName + ':' +
            tecateHost.httpPort + '/stop_record?callback=?', {
              streamName: _publishingState.streamName
            }, function(data) {
              data.data.type = 1;
              $.post('/room/' + room._id + '/message', data.data, function() {
              });
            });
        $.post('/room/' + room._id + '/publishers', {
          hostName: _publishingState.tecateHost.hostName,
          iosPort: _publishingState.tecateHost.iosPort,
          rtmpPort: _publishingState.tecateHost.rtmpPort,
          streamName: _publishingState.streamName,
        });
        _publishingState.recording = false;
      }

      roomEl.find('.push-video').mousedown(_startPublishing)
        .bind('mouseup', _stopPublishing);

      var _postMessage = _.bind(methods.postMessage, this);
      roomEl._composeState = {};


      this.find('.composer button.btn').click(_postMessage);
      this.find('.composer textarea.chat-message').keypress(function(e) {
        if (e.which === 13) {
          // request permission to display desktop notifications
          // must be inside a user action event handler
          if (window.webkitNotifications &&
              // 1 = PERMISSION_NOT_ALLOWED
              window.webkitNotifications.checkPermission() === 1) {
              window.webkitNotifications.requestPermission(function() {
                console.log('request permission callback..', arguments);
              });
          }

          if (!e.ctrlKey) {
            _postMessage();
          }
        } else {
          var val = $(this).val();
          if ($.trim(val).length > 0) {
            if (!roomEl._composeState.placeholderId) {
              roomEl._composeState.placeholderId = Math.round(Math.random() *
                2147483647);
              $.post('/room/' + room._id + '/message', {
                isPlaceholder: true,
                placeholderId: roomEl._composeState.placeholderId
              }, function(data) {
                console.log('placeholder result', data);
              });
            }
          }
        }
      });
      // backspace isnt captured by keypress
      this.find('.composer textarea.chat-message').keyup(function(e) {
        if (e.which === 8) {
          if (roomEl._composeState.placeholderId) {
            var val = $(this).val();
            if ($.trim(val).length === 0) {
              $.post('/room/' + room._id + '/message/0?placeholderId=' +
                roomEl._composeState.placeholderId, {
                  '_method': 'DELETE'
                  });
              roomEl._composeState = {};
            }
          }
        }
      });

      roomEl.find('.composer .upload-wrapper input').fileupload({
        dataType: 'json',
        add: _.bind(function(e, data) {
          // Create a placeholder message to display upload progress
          var history = this.find('.history');

          // TODO: Need to handle multiple files?
          this.progressBarId = 'progress-' + Math.round(Math.random() * 100000);
          history.append(pb.tmpl.render('room.message', {
            renderMentions: methods.renderMentions,
            roomRenderingState: this.roomRenderingState,
            message: {
              body: 'Uploading ' + data.files[0].name +
                  '...<div class="progress self" id="' +
                  this.progressBarId + '"><div class="bar">&nbsp;</div></div>',
              fromId: pb.model.session.getUserId(),
              safe: true,
            },
            room: room
          }));
          data.submit();
          this.scrollToBottom();
        }, this),
        done: _.bind(function() {
          // Just clean up the progress message, the real message will come
          // over the channel
          this.find('#' + this.progressBarId).parents(
              '.message').remove();
        }, this),
        dropZone: this.find('.room-canvas'),
        progressall: _.bind(function(e, data) {
          var progress = parseInt(data.loaded / data.total * 100, 10);
          this.find('#' + this.progressBarId + ' .bar').css(
              'width', progress + '%');
        }, this),
        url: '/room/' + room._id + '/upload'
      });

      roomEl.find('.room-chrome').scroll(function() {
        var chrome = $(this);
        if (chrome.scrollTop() === 0) {
          pb.model.room.loadHistory(room._id);
        }
      });

      pb.model.room.loadHistory(room._id);
      this.find('.room-title').text(room.title);

      return this;
    },
    onRoomClose: function() {
      this.hide();
    },
    renderMentions: function(text, message) {
      if (message.mentions) {
        _.each(message.mentions, function(val, key) {
          text = text.replace(new RegExp(key, 'g'), '<div class="mention">' +
            key + '</div>');
        });
      }
      return text;
    },
    onRoomMessageDeleted: function(message) {
      this.find('.history .message#' + message.messageId).remove();
    },
    onRoomMessage: function(message) {
      if (message.isPlaceholder &&
          message.fromId === pb.model.session.getUserId()) {
        return;
      }
      var room = pb.model.room.get(message.roomId);
      room.oldestMessageSent = Math.min(message.sent,
          room.oldestMessageSent || Number.MAX_VALUE);
      this.find('.history .empty').remove();

      var roomChrome = this.find('.room-chrome');
      var history = this.find('.history');
      var atBottom = roomChrome.scrollTop() >
          (history.height() -roomChrome.height() - 10) ||
          (history.height() <= roomChrome.height());
      var existingMessage = this.find('.history .message#' + message._id);

      if (existingMessage.length > 0) {
        $(existingMessage[0]).replaceWith(pb.tmpl.render('room.message', {
          renderMentions: methods.renderMentions,
          roomRenderingState: this.roomRenderingState,
          message: message,
          room: room
        }));
      } else {
        history.append(pb.tmpl.render('room.message', {
          renderMentions: methods.renderMentions,
          roomRenderingState: this.roomRenderingState,
          message: message,
          room: room
        }));
      }

      var mentioned = false;
      _.each(message.mentions, function(id) {
        if (id === pb.model.session.getUserId()) {
          mentioned = true;
        }
      });

      if (mentioned && (document.webkitHidden === true ||
          document.hidden === true || !document.hasFocus())) {
        pb.sound.play(pb.sound.DING);
        this.sendDesktopNotification(room, message);
      }

      if (atBottom) {
        this.scrollToBottom();
      }
    },
    onRoomHistory : function(roomId, messages) {
      var room = pb.model.room.get(roomId);
      var history = this.find('.history');
      var chrome = this.find('.room-chrome');

      var initialLoad = history.children().length === 0;

      var filteredMessages = _.filter(messages, function(message) {
        return message.sent >= pb.model.session.getRoomHistoryStartTime(
              message.roomId);
      });

      if (messages.length > 0 || initialLoad) {
        var oldHeight = history.height();
        var oldScrollTop = chrome.scrollTop();
        history.prepend(pb.tmpl.render('room.messages', {
          // NOTE: If this is the first load, we need to maintain state
          //       for subsequent messages.  Otherwise, we just keep an
          //       isolated render state for blocks of history.
          renderMentions: methods.renderMentions,
          roomRenderingState: initialLoad ? this.roomRenderingState : {},
          room: room,
          messages: filteredMessages
        }));

        if (initialLoad) {
          this.scrollToBottom();
        }
        else {
          chrome.scrollTop(oldScrollTop + (history.height() - oldHeight));
        }
      }
    },
    onRoomUpdate : function(room) {
      this.find('.room-title').text(room.title);
    },
    onRoomHide : function() {
      var publishingState = this._publishingState;
      if (publishingState && publishingState.started) {

        pb.pubsub.publish(pb.events.PUBLISH_STOP);

        $.post('/room/' + this.data('id') + '/publishers', {
            _method: 'DELETE'
          }, function() {
            publishingState.started = false;
          });
      }
      $.post('/room/' + this.data('id') + '/presence', {inRoom: 0});
    },
    onRoomShown : function() {
      $.post('/room/' + this.data('id') + '/presence', {inRoom: 1});
    },
    onRoomPresence: function(message) {
      console.log('room presence', message);
      // TODO
    },
    postMessage : function() {
      var val = this.find('.composer .chat-message').val();
      if ($.trim(val).length === 0) {
        return;
      }
      var url = '/room/' + this.data('id') + '/message';

      if (this._composeState.placeholderId) {
        url += '/0?placeholderId=' + this._composeState.placeholderId;
        this._composeState = {};
      }
      $.post(url, {
        message: val
      }, function() {
        $('.composer .chat-message').val('');
      });
    },
    scrollToBottom: function() {
      var history = this.find('.history');
      this.find('.room-chrome').scrollTop(history.height());

      // Some images might take a while to load, so do it again
      history.waitForImages(_.bind(function() {
        this.find('.room-chrome').scrollTop(history.height());
      }, this));
    },
    destroy : function( ) {
      // unsubscribe ?
    },
    sendDesktopNotification : function (room, message) {
      if (!window.webkitNotifications ||
          window.webkitNotifications.checkPermission() !== 0) {
        return;
      }
      var fromName = message.fromName;
      if (!fromName) {
        fromName = room.userNames[message.fromId];
      }
      var content = fromName + ": " + $('<div/>').html(message.body).text();
      var notif = window.webkitNotifications.createNotification(
        '/img/pickle.png', room.title, content);

      if (notif === undefined) {
        console.log("couldn't create desktop notification");
        return;
      }

      notif.ondisplay = function () {
        setTimeout(function () {
          notif.close();
        }, 3000);
      };
      notif.show();
    },
  };

  $.fn.pbRoom = function() {
   // Method calling logic
    var newRoom = methods.init.apply(this, arguments);
    newRoom.onRoomClose = _.bind(methods.onRoomClose, this);
    newRoom.onRoomHide = _.bind(methods.onRoomHide, this);
    newRoom.onRoomShown = _.bind(methods.onRoomShown, this);
    newRoom.onRoomHistory = _.bind(methods.onRoomHistory, this);
    newRoom.onRoomPresence = _.bind(methods.onRoomPresence, this);
    newRoom.onRoomMessage = _.bind(methods.onRoomMessage, this);
    newRoom.onRoomMessageDeleted = _.bind(methods.onRoomMessageDeleted, this);
    newRoom.onRoomUpdate = _.bind(methods.onRoomUpdate, this);
    newRoom.scrollToBottom = _.bind(methods.scrollToBottom, this);
    newRoom.sendDesktopNotification = _.bind(methods.sendDesktopNotification,
        this);
    return newRoom;
  };
})($);

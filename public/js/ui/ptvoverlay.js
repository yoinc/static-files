pb.ui.ptvoverlay = (function(pb) {
  var _el = null;
  var _swfPublisher = null;
  var _activeSubscribers = [];
  var _subscriberMap = {};
  var _overlayHandles = {};

  function hideOverlay() {
    $('.ptv-overlay').css('top', '');
  }

  function showOverlay() {
    $('.ptv-overlay').css('top', '112px');
  }

  function _onPublisherActivity(e, activity) {
    var activeRoomId = pb.ui.roompanel.getActiveRoomId();

    if (!activeRoomId || activeRoomId !== activity.roomId) {
      console.log('dont care about publish activity for nonactivated room');
      return;
    }

    switch(activity.type) {
      case "delete":
        _onSubscriberStop(activity);
        break;
      case "update":
        if (activity.visible) {
          _onSubscriberStart(activity);
        }
        else {
          _onSubscriberPause(activity);
        }
        break;
    }
  }

  function _updateOverlayVisibility() {
    var totalHandles = 0;
    _.each(_overlayHandles, function(v) {
      totalHandles += v;
    });

    if (totalHandles > 0) {
      showOverlay();
    } else {
      hideOverlay();
    }
  }


  function _onSubscriberStart(publishActivity) {
    // create subscriber swf if doesnt exist.
    var subscriberEntry = _subscriberMap[publishActivity.streamName];
    if (!subscriberEntry) {
      var newSubContainer = $('<div class="subscriber" id="subscriber_' +
          _activeSubscribers.length + '"></div>');
      _el.find('div.subscribers').append(newSubContainer);
      newSubContainer.flash({
        swf: 'swf/RoomSubscriber.swf',
        width: 288,
        height: 288,
        flashvars: { subscriberIndex: _activeSubscribers.length }
      });
      _subscriberMap[publishActivity.streamName] = {
        el: null,
        streamName: publishActivity.streamName,
        tecateHost: publishActivity.hostName,
        rtmpPort: publishActivity.rtmpPort
      };
      _activeSubscribers.push(_subscriberMap[publishActivity.streamName]);
      _overlayHandles[publishActivity.streamName] = 1;
      _updateOverlayVisibility();
    } else {
      if (subscriberEntry.el) {
        _asyncSwfCall(subscriberEntry.el, 'resume');
        subscriberEntry.el.css('top', '0px');
        _overlayHandles[publishActivity.streamName] = 1;
        _updateOverlayVisibility();
      } else {
        console.log('subscriber flash not ready yet!  discarding for now.');
      }
    }
  }

  function _onSubscriberPause(publishActivity) {
    // hide subscriber swf keyed by publisherId
    var subscriberEntry = _subscriberMap[publishActivity.streamName];
    if (subscriberEntry && subscriberEntry.el) {
      _asyncSwfCall(subscriberEntry.el, 'pause');
      subscriberEntry.el.css('top', '-2000px');
      _overlayHandles[publishActivity.streamName] = 0;
      _updateOverlayVisibility();
    } else {
      console.log('ignoring a subscriber entry i dont have yet.');
    }
  }

  function _onSubscriberStop(publishActivity) {
    // stop/hide/kill one subscriber swf, if it exists.
    var subscriberEntry = _subscriberMap[publishActivity.streamName];
    if (subscriberEntry && subscriberEntry.el) {
        _asyncSwfCall(subscriberEntry.el, 'stop');
        subscriberEntry.el.parent().remove();
        delete _subscriberMap[publishActivity.streamName];
        _.each(_activeSubscribers, function(sub, index) {
          if (sub.streamName === publishActivity.streamName) {
            _activeSubscribers.splice(index, 1);
          }
        });
      _overlayHandles[publishActivity.streamName] = 0;
      _updateOverlayVisibility();
    } else {
      console.log('ignoring a subscriber entry i dont have yet.');
    }

  }

  function _hidePublisher() {
    // _el.find("div.publisher").hide();
    _asyncSwfCall(_swfPublisher, 'setCameraAttached', false);
    _el.find('div.publisher object').css('top', '-2000px');
    _overlayHandles.self = 0;
    _updateOverlayVisibility();
  }

  function _showPublisher() {
    _asyncSwfCall(_swfPublisher, 'setCameraAttached', true);
    _el.find('div.publisher object').css('top', '0px');
    _overlayHandles.self = 1;
    _updateOverlayVisibility();
  }

  function _onPublishConnect(e, tecateHost) {
    console.log(tecateHost);
    _asyncSwfCall(_swfPublisher, 'connect',
        tecateHost.hostName + ':' + tecateHost.rtmpPort);
  }

  function _onPublishPause() {
    // hide publisher swf
    _hidePublisher();
    // detach camera from video
  }

  function _onPublishResume() {
    _showPublisher();
    _el.find("div.publisher").show();
    // show publisher swf
  }

  function _onPublishStart(e, streamName) {
    _asyncSwfCall(_swfPublisher, 'startPublishing', streamName);
    _showPublisher();

    // and show it
  }

  function _onPublishStop() {
    _asyncSwfCall(_swfPublisher, 'disconnect');
    _hidePublisher();

    // and hide it

    // stop/hide/kill all subscriber swfs
    //
  }

  function _asyncSwfCall(swf, name) {
    var args = Array.prototype.slice.call(arguments, 2);
    args.unshift(name);
    swf[0].extCallAsync.apply(swf[0], args);
  }

  function onSwfPublisherReady() {
    console.log('swf is ready');
    _swfPublisher = _el.find("div.publisher object");
    _hidePublisher();
  }

  function onSwfSubscriberReady(subscriberIndex) {
    console.log('subscriber ' + subscriberIndex + ' is ready');
    var subscriberEntry = _activeSubscribers[subscriberIndex];
    subscriberEntry.el = _el.find('div.subscribers #subscriber_' +
        subscriberIndex + ' object');
    console.log(subscriberEntry);
    _asyncSwfCall(subscriberEntry.el, 'play', subscriberEntry.tecateHost +
        ':' + subscriberEntry.rtmpPort, subscriberEntry.streamName);
  }

  function init(el) {
    // setup dom
    _el = el;
    _el.html(pb.tmpl.render('ptvoverlay.main'));

    _el.find("div.publisher").flash('swf/RoomPublisher.swf');
    // _el.find("div.publisher").hide();
    $(document.body).on('show', '.modal', function() {
      _el.css('top', '1200px');
    });
    $(document.body).on('hidden', '.modal', function() {
      _el.css('top', '112px');
      _el.show();
    });

    // initialize hidden, not connected publisher swf
    pb.pubsub.subscribe(pb.events.PUBLISHER_ACTIVITY, _onPublisherActivity);

    pb.pubsub.subscribe(pb.events.PUBLISH_CONNECT, _onPublishConnect);
    pb.pubsub.subscribe(pb.events.PUBLISH_PAUSE, _onPublishPause);
    pb.pubsub.subscribe(pb.events.PUBLISH_RESUME, _onPublishResume);
    pb.pubsub.subscribe(pb.events.PUBLISH_START, _onPublishStart);
    pb.pubsub.subscribe(pb.events.PUBLISH_STOP, _onPublishStop);  }

  return {
    init: init,
    onSwfPublisherReady: onSwfPublisherReady,
    onSwfSubscriberReady: onSwfSubscriberReady,
    hide: hideOverlay,
    show: showOverlay,
  };
}(pb));

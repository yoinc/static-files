var tecate = {
};

tecate.init = function(rooms) {
  $('span#roomCount').html(rooms.length);
  var userCount = 0;
  _.each(rooms, function(r) {
    var roomEl = $($('div#roomTemplate').html());
    if (r.isGroup) {
      roomEl.find('div.title').html(r.title);
    } else {
      roomEl.find('div.title').html('Private chat between ' +
        r.userNames[r.userIds[0]] + ' and ' + r.userNames[r.userIds[1]]);
    }

    var title = roomEl.find('div.title');
    var users = roomEl.find('div.users');
    title.append($('<span> (' + _.keys(r.streams).length + ')</span>'));
    title.click(function() {
      users.toggle();
    });

    _.each(r.userIds, function(userId) {
      var userEl = $($('div#userTemplate').html());
      var name = r.userNames[userId];
      userEl.find('span.userName').html(name);
      var rs = r.streams[userId];
      if (rs) {
        userCount++;
        userEl.find('span.debug').html(' (' + rs.publisherDebug
          .replace(name, '')
          .replace(' / ', '') + ')');
        if (rs.publisherStats.avgPing) {
          userEl.find('span.publisherPing').html(
            rs.publisherStats.avgPing + ' (' +
            rs.publisherStats.numPing + ')');
        }

        var subscriberStats = userEl.find('div.subscriberStats');
        userEl.find('div.header').click(function() {
          subscriberStats.toggle();
        });

        var hadSubStats = false;
        _.each(rs.subscriberStats, function(ss, subscriberId) {
          var header = '<tr><td class="name" colspan="2">' +
            r.userNames[subscriberId] + '</td></tr>';
          var rows = '';
          _.each(ss, function(v, k) {
            rows += '<tr>' +
              '<td class="key">' + k + '</td>' +
              '<td class="value">' + v + '</td>' +
              '</tr>';
          });

          subscriberStats.append($('<table>' +
           header + rows + '</table>'));
          hadSubStats = true;
        });
        if (!hadSubStats) {
          userEl.find('div.subscribers').hide();
        }
        userEl.find('div.audio').append(
          tecate.packetLossTemplate(rs.audioPacketLoss));
        userEl.find('div.video').append(
          tecate.packetLossTemplate(rs.videoPacketLoss));
      } else {
        userEl.addClass('offline');
      }

      users.append(userEl);
    });

    $('div#rooms').append(roomEl);
  });
  $('span#userCount').html(userCount);
};

tecate.packetLossTemplate = function(packetLoss) {
  var el = $($('div#packetLossTemplate').html());
  el.html(
    Math.round(packetLoss.packetLossPercentage * 100 * 100) / 100 + '% (' +
    packetLoss.totalPacketCount + ')');
  return el;
};

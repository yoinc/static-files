pb.ui.invite = (function(pb) {

  function init(el, data) {
    var _el = el;
    if (data.error) {
      return;
    }
    if (data.family === 'Mobile Safari') {
      _el.html(pb.tmpl.render('invite.ios', data));

      $('#open_app').attr('href', data.iosDeepLink);
      $('#header #coachmark').show();
      $('#open_app').show();
    } else if (data.family === 'Android') {
      _el.html(pb.tmpl.render('invite.android', data));
    } else {
      _el.html(pb.tmpl.render('invite.other', data));
      $('div.message').text('Please visit the link on a mobile browser.');
    }
    if (data.redirectLink) {
      window.location.href = data.redirectLink;
    }
  }

  function collectContactInfo() {
    $('#contactInfoError').hide();
    $('#contactInfoSuccess').hide();

    var contactInfo = $.trim($('#contactInfo').val());
    if (contactInfo.length === 0) {
      $('#contactInfoError').show();
      return;
    }

    $.ajax({
      type: "POST",
      url: "/invite/collectContactInfo",
      data: {
        contactInfo: contactInfo
      },
      success: function() {
        $('#contactInfoSuccess').show();
      },
      dataType: 'json'
    });

    return false;
  }

  function sendInstallLink() {
    $('#sendInstallLinkError').hide();
    $('#sendInstallLinkSuccess').hide();

    var phone = $.trim($('#sendInstallLinkPhone').val());
    if (phone.length === 0) {
      $('#sendInstallLinkError').html('Please enter a phone number').show();
      return;
    }

    $.ajax({
      type: "POST",
      url: "/invite/sendInstallLink",
      data: {
        phone: phone
      },
      success: function(data) {
        if (data.success) {
          $('#sendInstallLinkSuccess').show();
        } else {
          $('#sendInstallLinkError').html(data.error).show();
        }
      },
      dataType: 'json'
    });

    return false;
  }

  return {
    init: init,
    collectContactInfo: collectContactInfo,
    sendInstallLink: sendInstallLink
  };
}(pb));

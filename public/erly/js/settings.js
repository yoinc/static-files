/*!
 * Settings handler
 */

(function(erly) {
  var settings = {};

  settings.init = function() {
    if (erly.maintenanceMode) {
      $('.settings .body-contents').html(
          'Erly is undergoing maintenance, please try back later.');
    }
    else {
      erly.events.subscribe(erly.events.AUTHENTICATED, settings.onUserData);
      erly.events.subscribe(erly.events.NOT_AUTHENTICATED, settings.onUserData);
    }
  };

  /**
   * Prepare a form element as an upload widget for uploading a profile
   * picture.
   */
  settings.uploadize = function(el, form, klass, saveImmediate) {
    var error = form.find('.error-container').add(
      form.parent().find('.error-container'));
    error.hide();

    var showFormError = function(msg) {
      error.text(msg).show();
    };

    var loader = form.find('.profile-loader');
    el.fileupload({
      url: erly.urlFor.session('upload_profile_picture'),
      maxNumberOfFiles: 1,
      autoUpload: true,
      uploadTemplate: 'none',
      downloadTemplate: 'none',
      dropZone: el
    }).bind('fileuploadstart', function(e, data) {
      loader.show();
    }).bind('fileuploadalways', function(e, data) {
      loader.hide();
    }).bind('fileuploadfail', function(e, data) {
      showFormError(
        data.jqXHR.status === 413 ?
          'Please upload a file up to 5 MB' :
          'There was a problem with your upload');
    }).bind('fileuploaddone', function(e, data) {
      if (!data.result.fullUrl) {
        showFormError(data.result.error ||
          'There was a problem with your upload');
        return;
      }

      var img = $('<img />');
      img.attr({
        src: data.result.fullUrl,
        width: 40,
        height: 40
      });
      if (klass) {
        el.find('img.' + klass).remove();
      }
      else {
        el.find('img').remove();
      }
      el.append(img);
      if (klass) {
        img.addClass(klass);
      }
      if (saveImmediate) {
        $.ajax({
          type: 'POST',
          url: erly.urlFor.settings('change_profile_picture'),
          data: {picture: data.result.fullUrl},
          success: function() {
            erly.events.fire(erly.events.PROFILE_PICTURE_CHANGED);
          }
        });
      }
      else {
        form.find('input[name=picture]').val(data.result.fullUrl);
      }

      // Destroy and reload so we can replace as needed
      el.fileupload('destroy');
      settings.uploadize(el, form, klass);
    });
  };

  var updateProfilePicRemoveLink = function(form) {
    var removeLink = form.find('a.remove-picture');
    if (form.find('img.picture').length === 0) {
      removeLink.hide();
    }
    else {
      removeLink.show();
    }
  };

  settings.onUserData = function(user) {
    if (!user || user.authenticated === false || _.keys(user).length === 0) {
      $('.settings .body-contents').html('Please log in to view your settings');
      return;
    } else {
      $('.settings .body-contents').empty();
    }

    var locals = {
      user: user,
      services: erly.services
    };
    settings.currentLocals = locals;
    $("#tmplSettings").tmpl(locals).appendTo(".settings .body-contents");
    settings.bindForm();
    settings.bindEmailForm();
    settings.checkboxToggles();
    erly.services.enableSettingsButtons({allowDisconnect: true});
    settings.enableSettingsButtonReplacement();

    var picForm = $('form.profile-picture');
    settings.uploadize(picForm.find('div.add-pic'), picForm, 'picture');
    picForm.find('a.upload-new').click(function() {
      picForm.find('div.add-pic input').click();
    });
    picForm.find('a.remove-picture').click(settings.clearProfilePicture);
    picForm.submit(settings.changeProfilePicture);

    var form = $('form.display-name');
    form.submit(settings.updateDisplayName);

    $('a.remove-user').click(function() {
      erly.track.userDeletion(false);
      erly.modal.showConfirm(
        'Delete Account',
        'Deleting your account will delete all Events you own ' +
        'and remove you and your items from Events where you ' +
        'are a contributor.  Do you want to proceed?',
        'Delete Account',
        function() {
          $.ajax({
            url: erly.urlFor.settings('remove_user'),
            type: 'post',
            data: settings.userRemovalNonce,
            complete: function() {
              erly.track.userDeletion(true, function() {
                erly.redirectTo('home', '#user-removed');
              });
            }
          });
        },
        {
          type: 'remove',
          onComplete: function () {
            $('#colorbox .close-modal').css('top', '-11px');
          }
        }
      );
    });
  };

  settings.bindForm = function() {
    $(".settings form").ajaxForm({
      datatype: 'application/json',
      success: function(data, textStatus, jqXHR) {
        if (data.success) {
          settings.updated();
          erly.events.fire(erly.events.SETTINGS_UPDATED, data);
        }
      },
      beforeSerialize: function() {
        if (typeof $(".chronicle-updates").attr("checked") === 'undefined') {
          $("input[name='notificationSettings[updates]']").attr("value", "0");
        }
      }
    });
  };

  var yellowFade = function(obj, delay, callback) {
    obj = $(obj);

    if (typeof delay === 'undefined' || !delay) {
      delay = 2000;
    }

    obj.effect("highlight", {}, delay, callback);
  };

  settings.updated = function() {
    var updated = $(".settings-updated");
    updated.show();

    setTimeout(function() {
      updated.fadeOut(2000);
    }, 3500);
  };

  settings.checkboxToggles = function() {
    var updates = $(".chronicle-updates");

    updates.click(function() {
      if ($(this).attr("checked")) {
        if ($(".batch-updates input:checked").length === 0) {
          $($(".batch-updates input")[0]).attr("checked", "checked");
        }

        $(".batch-updates").show();
      } else {
        $(".batch-updates").hide();
      }
    });

    if ($("input[name='notificationSettings[updates]']:checked").length > 0) {
      updates.attr("checked", "checked");
    } else {
      $(".batch-updates").hide();
    }
  };

  settings.enableSettingsButtonReplacement = function() {
    erly.events.subscribe(erly.events.SERVICE_CONNECTED, function(data) {
      var user = data.user;
      // If this is a facebook connection, refresh to allow other
      // facebook-related widgets to be updated
      if (data.service === 'facebook') {
        return window.location.reload();
      }

      var service = erly.services.services[data.service];

      var template = $("#tmplService").tmpl({
        user: user,
        service: service,
        connected: true
      });

      $(".service-" + service.name).replaceWith(template);
      erly.track.servicePaired();
    });

    erly.events.subscribe(erly.events.SERVICE_DISCONNECTED, function(service) {
      // If this is a facebook connection, refresh to allow other
      // facebook-related widgets to be updated
      if (service === 'facebook') {
        return window.location.reload();
      }
    });
  };

  var extractEmail = function(el) {
    var email = el.siblings(".data").html();
    return $.trim(email);
  };

  settings.bindEmailForm = function() {
    $('.email-addresses form').submit(function() {
      var form = $(this);
      var email = $.trim(form.find('input[name=email]').val());
      if (!email || !erly.validate.EMAIL_REGEX.test(email)) {
        $('.email-addresses .error').text('Please input a valid email');
        return;
      }
      $.ajax({
        url: erly.urlFor.settings('pending_email'),
        type: 'post',
        data: {email: email, op: 'add'},
        success: function(data) {
          if (data.success) {
            erly.modal.showAlert(
              'Email sent',
              'We have sent a verification message to your email.  ' +
              'Please follow the instructions to officially add this email' +
              ' to your account.');
            settings.refreshEmail(form.parents('.settings').first(), data);
          }
          else {
            $('.email-addresses .error').text(data.error.message);
          }
        }
      });
    });

    $('.email-addresses .resend').click(function() {
      var email = extractEmail($(this));
      erly.resendEmailVerification(email);
    });

    $('.email-addresses .remove-pending').click(function() {
      var el = $(this);
      var email = extractEmail(el);
      $.ajax({
        url: erly.urlFor.settings('pending_email'),
        type: 'post',
        data: {email: email, op: 'remove'},
        success: function(data) {
          if (data.success) {
            settings.refreshEmail(el.parents('.settings').first(), data);
          }
          else {
            $('.email-addresses .error').text(data.error.message);
          }
        }
      });
    });

    $('.email-addresses .make-primary').click(function(e) {
      if (e.which > 1) {
        return;
      }

      var el = $(this);
      var email = extractEmail(el);
      $.ajax({
        url: erly.urlFor.settings('set_primary_email'),
        type: 'post',
        data: {email: email},
        success: function(data) {
          if (data.success) {
            settings.refreshEmail(el.parents('.settings').first(), data);
          }
          else {
            $('.email-addresses .error').text(data.error.message);
          }
        }
      });
    });

    $('.email-addresses .remove').click(function() {
      var el = $(this);
      var emailAddress = extractEmail(el);

      var text = 'Remove email address';
      var question =
        'Are you sure you want to  remove ' + emailAddress +
        ' from your account?';
      var confirmationText = 'Remove';

      erly.modal.showConfirm(text, question, confirmationText, function() {
        settings.removeEmail(el);
      }, {type: 'remove'});
    });
  };

  settings.removeEmail = function(el) {
    el = $(el);
    var email = extractEmail(el);

    $.ajax('/session/remove_email', {
      type: 'POST',
      data: {email: email},
      success: function(data) {
        if (data.success) {
          el.parents(".email").fadeOut(1000);
        }
      }
    });
  };

  settings.refreshEmail = function(container, user) {
    if (user.email) {
      settings.currentLocals.user.email = user.email;
    }
    settings.currentLocals.user.emails = user.emails;
    settings.currentLocals.user.pendingEmails = user.pendingEmails;
    container.empty().append($('#tmplEmailAddresses').tmpl(
      settings.currentLocals));
    settings.bindEmailForm();
  };

  settings.clearProfilePicture = function() {
    var form = $('form.profile-picture');
    $.ajax({
      type: 'POST',
      url: erly.urlFor.settings('change_profile_picture'),
      data: {picture: ''},
      success: function(data) {
        if (data.error) {
          form.find('.status').text(data.error.message || data.error);
        }
        else {
          form.find('.add-pic img.picture').remove();
          form.find('.status').text('Removed');
          updateProfilePicRemoveLink(form);
        }
      }
    });
  };

  settings.changeProfilePicture = function() {
    var form = $(this);
    if (!$.trim(form.find('input[name=picture]').val())) {
      return form.find('.status').text('Select a picture to upload.');
    }
    $.ajax({
      type: 'POST',
      url: erly.urlFor.settings('change_profile_picture'),
      data: form.serialize(),
      success: function(data) {
        if (data.error) {
          form.find('.status').text(data.error.message || data.error);
        }
        else {
          form.find('.status').text('Updated');
          updateProfilePicRemoveLink(form);
        }
      }
    });
  };

  settings.sendResetPasswordNotification = function(email) {
    $.ajax({
      type: 'POST',
      url: erly.urlFor.session('forgot_password'),
      data: {email: email},
      success: function(data) {
        $('.reset-password .link').hide();
        $('.reset-password .status').show();
      }
    });
  };

  settings.updateDisplayName = function() {
    var form = $(this);
    $.ajax({
      type: 'POST',
      url: erly.urlFor.settings('update_display_name'),
      data: form.serialize(),
      success: function(data) {
        form.find('.status').text('Saved');
      }
    });
  };

  erly.settings = settings;
}(erly));

/*!
 * Invite panel
 */
(function(viewer) {
  var invites = {};

  var _modal = null;
  var _collectionLink = null;

  var _invitedCount = 0;
  var _submittedCount = 0;
  // private
  var _bindModalHooks;
  var _submitInvites;
  var _enableClipboardWidget;
  var _showConfirmationPopup;
  var _openEmailPreview;

  invites.showInvitePanel = function(collection, isNewCollection, hideAddContent) {
    var base = window.location.protocol + '//' + window.location.host;
    _collectionLink = base + erly.urlFor.collection(collection);
    _invitedCount = 0;
    _submittedCount = 0;
    if (!isNewCollection) {
      isNewCollection = false;
    }
    _modal = $$('#tmplInvitePanelModal').tmpl(collection || {}, {
      isNewCollection: isNewCollection,
      ownerOnly: collection.ownerOnly,
      isInFuture: !collection.isAlbum &&
        erly.normalizeDate(collection.startDate) > new Date(),
      collectionLink: _collectionLink,
      hideAddContent: hideAddContent,
      userIsInvite: !!erly.viewer.invite
    });
    if (isNewCollection) {
      _modal.find('.invite-panel').addClass('new-collection');
    }
    erly.modal.open({
      href: _modal,
      inline: true,
      close: '',
      onComplete: function() {
        _bindModalHooks();

        if (_modal.find('.content-container').length > 1) {
          _modal.find('.or').show();
        }
      },
      onClosed: function() {
        if (_invitedCount > 0 || _submittedCount > 0) {
          _showConfirmationPopup(_invitedCount, _submittedCount);
        }
      }
    });
  };

  invites.showEmailPanel = function(collection, rsvps) {
    var modal = $$('#tmplEmailPanelModal').tmpl({
      collection: collection,
      formUrl: erly.urlFor.collection(collection, 'group_email_message'),
      rsvps: rsvps
    });
    modal.find('.content-container #email_message_panel_form textarea').focus(erly.enterTextField).blur(erly.leaveTextField);
    var form;

    // check form validity and display errors
    var checkValidity = function() {
      var errors = {};

      form.find('.error').text('').hide();

      if (!$.trim(form.find('input[name=subject]').val())) {
        errors.subject = 'The email subject cannot be empty.';
      }
      else if (!$.trim(form.find('textarea[name=message]').val())) {
        errors.message = 'The email message cannot be empty.';
      }

      if (form.find('.email-list input:checked').length === 0) {
        errors.receivers = 'Please select at least one recipient group.';
      }

      var valid = _.isEmpty(errors);

      if (!valid) {
        _.each(errors, function(message, fieldName) {
          var el = form.find('.error.' + fieldName);
          if (message) {
            el.text(message).show();
          }
        });
      }

      return valid;
    };

    var countCheckedPeople = function(checkboxes) {
      var total = 0;

      _.each($$(checkboxes), function(checkbox) {
        checkbox = $$(checkbox);

        if (checkbox.is(':checked')) {
          var name = checkbox.attr('name');

          if (!rsvps[name]) {
            throw new Error("Could not find rsvps[name] with name: '" + name + "'");
          }

          total += rsvps[name].length;
        }
      });

      return total;
    };

    erly.modal.open({
      href: modal,
      inline: true,
      close: '',
      onComplete: function() {
        form = $$('#email_message_panel_form');
        form.find("input[name=subject]").focus();

        form.find('.email-preview').click(function() {
          var message = $.trim(form.find('textarea[name=message]').val());
          var subject = $.trim(form.find('input[name=subject]').val());
          _openEmailPreview($(this), message, subject);
        });

        form.submit(function(event) {
          event.preventDefault();

          form.ajaxSubmit({
            beforeSubmit: checkValidity,
            success: function(data) {
              if (data.success) {
                var peopleCount = countCheckedPeople(form.find('.email-list input[type=checkbox]'));
                var eventName = erly.viewer.collection.title;

                var title = 'Your message has been sent';
                var body = 'We have emailed ' +
                           erly.util.pluralize(peopleCount, 'person', 'people') +
                           ' from ' +
                           eventName;

                erly.modal.showAlert(title, body);
              } else {
                throw new Error(data.message ? data.message :
                  'Unknown Error in showEmailPanel');
              }
            }
          });
        });
      }
    });

    $('#email_message_panel_form').find('.buttons input.cancel-button').click(function() {
      erly.modal.close();
    });
  };

  invites.showShareLinkPanel = function(collection) {
    var base = window.location.protocol + '//' + window.location.host;
    _collectionLink = base + erly.urlFor.collection(collection);
    _modal = $$('#tmplShareLinkModal').tmpl(collection || {}, {
      collectionLink: _collectionLink
    });
    erly.modal.open({
      href: _modal,
      inline: true,
      close: '',
      onComplete: function() {
        _bindModalHooks();
        _modal.find('.share-link').select();
      }
    });
  };

  _showConfirmationPopup = function(newCounts, invitedCount) {
    var reopenInvitePanel = function(template) {
      template.find('.button-bar .cancel').unbind('click').click(
        function() {
          erly.viewer.invites.showInvitePanel(erly.viewer.collection);
        }
      );
    };

    var title = 'Your invites have been sent';
    var text = 'Thanks! We have invited ';
    var alreadyText = 'already been invited to ';
    if (viewer.collection.pastEvent) {
      title = 'Invitations sent';
      text = 'Thanks! We have invited ';
      alreadyText = 'already been invited to ';
    }

    if (newCounts === 0 && invitedCount > 0) {
      erly.modal.showConfirm('Oops',
        (invitedCount === 1 ? 'That person has ' : 'Those people have ') +
        alreadyText + viewer.collection.title + '.',
        'OK',
        function() { erly.modal.close(); },
        {
          onComplete: reopenInvitePanel,
          cancelText: 'Invite More' }
      );
      return;
    }

    erly.modal.showConfirm(title,
      text + erly.util.pluralize(newCounts, 'person', 'people') + ' to ' +
      (viewer.collection.isAlbum ? 'contribute to the album ' : '') +
      viewer.collection.title + '.', 'Done',
      function() { erly.modal.close(); },
      { onComplete: reopenInvitePanel,
        cancelText: 'Invite More' }
    );
  };

  _enableClipboardWidget = function() {
    var flashvars = {
      text: _collectionLink,
      bgcolor: 'white'
    };
    var params = {
      quality: 'high',
      wmode: 'transparent',
      allowscriptaccess: 'always'
    };
    var attributes = {
      name: 'clippy'
    };
    var swfCallback = function(status) {
      if (!status.success) {
        $('.clippy-container').hide();
      }
    };

    try {
      // This seems to fail for people who use Webwasher
      swfobject.embedSWF('/swf/clippy.swf', 'clippy_alternative_content', '30',
        '30', '9.0.0', false, flashvars, params, attributes, swfCallback);
    }
    catch(e) {
      erly.trackException('Clippy fail: ' + e.message || e.toString(),
        'viewer_invite.js@_enableClipboardWidget');
      return;
    }

    var clippyContainer = $('.clippy-container');
    var copied = clippyContainer.find('.copied');
    var hover  = clippyContainer.find('.hover');

    clippyContainer.hover(function() {
      copied.hide();
      hover.show();
    }, function() {
      hover.hide();
    });

    clippyContainer.mousedown(function() {
      hover.hide();
      copied.show();

      setTimeout(function() {
        copied.fadeOut(1000);
      }, 1250);

      // make sure the click handler falls through
      // to the flash clipboard
      return true;
    });

  };

  _openEmailPreview = function(link, message, subject) {
    var tmplItem = link.tmplItem();
    var collection = tmplItem.data;
    if (collection.hasOwnProperty('collection')) {
      collection = tmplItem.data.collection;
    }
    var collection_url = erly.urlFor.collection(collection, 'email_preview');
    var type = "added";
    if (!tmplItem.hasOwnProperty('isInFuture')) {
      type= "message";
    }
    collection_url += '?type=' + type;
    if (message) {
      collection_url += '&message=' + encodeURIComponent(message);
    }
    if (subject) {
      collection_url += '&subject=' + encodeURIComponent(subject);
    }
    window.open(collection_url, '_erlypreview');
  };


  _submitInvites = function(callback) {
    // process the raw data in the textfield, and
    // submit the tag request
    callback();
  };

  _bindModalHooks = function() {
    _modal.find('.add-content button').each(function() {
      $(this).click(function() {
        erly.modal.close();
        viewer.toggleCarousel();
        var self = this;
        _.delay(function() {
          viewer.addPosts.showByType($(self).data('type'));
        }, 500);
      });
    });

    // Facebook invite stuff
    _modal.find('button#inviteFacebook').click(function() {
      var scrollTop = $(window).scrollTop();
      $('#colorbox, #cboxOverlay').fadeOut();
      var msg = erly.viewer.collection.owner.name + ' invites you to ' +
        '"' + erly.viewer.collection.title + '" on ' +
        erly.dateFormatters.formatDateShortDayShortMonth(
          erly.viewer.collection.displayStartDate) + '.';
      FB.ui({
        method: 'apprequests',
        message: msg,
        data: {
          collectonId: erly.viewer.collection.id
        }
      }, function(result) {
        // Preserve scroll position b/c FB scrolls to the top...
        $(window).scrollTop(scrollTop);
        if (result) {
          _modal.find('#inviteFacebookStatus').text(result.to.length +
            ' Facebook friend' +
            (result.to.length === 1 ? ' was ' : 's were ') +
              'invited.');
          var inviteList = {};
          _.each(result.to, function(v) {
            inviteList['fbid_' + v] = 'pending';
          });

          // Save request id and event information to server
          $.ajax({
            type: 'POST',
            url: erly.urlFor.collection(viewer.collection, 'fbrequest'),
            data: {
              fbRequestId: result.request,
              chronicleId: erly.viewer.collection.id,
              requesterId: erly.getUserData().id,
              inviteList: inviteList
            },
            success: function() {
              viewer.Details.instance.updateAttendance(true, 'pending');
            },
            error: function() {
              erly.trackException(arguments);
            }
          });
        }
        $('#colorbox, #cboxOverlay').fadeIn();
      });
    });

    // email preview button
    _modal.find('.email-preview').click(function() {
      var message = $.trim(_modal.find('.personal-message').val());
      _openEmailPreview($(this), message);
    });

    _modal.find('button.return').click(function() {
      erly.modal.close();
    });

    // enabling the clippy stuff
    _enableClipboardWidget();

    // allow easy selection of the url
    _modal.find('.share-link').click(function(event) {
      $(this).select();
      return true;
    });

    _modal.find('.content-container .tagging-form textarea')
      .focus(erly.enterTextField).blur(erly.leaveTextField);

    _modal.find('.import-contacts .import-tip').hover(function() {
        _modal.find('.import-contacts .import-tip-container').show();
      }, function() {
        _modal.find('.import-contacts .import-tip-container').hide();
    });

    _modal.find('.content-header .email-tip').hover(function() {
        _modal.find('.content-header .email-tip-container').show();
      }, function() {
        _modal.find('.content-header .email-tip-container').hide();
    });


    // enables autocomplete on a container with a textarea and a submit button.
    viewer.tags.enableAutoComplete(_modal.find('.tagging-form'),
        function(newCounts, submittedCount) {
      _invitedCount = newCounts;
      _submittedCount = submittedCount;
      erly.modal.close();
    });

    var addMessageLink = _modal.find('a.add-message');

    addMessageLink.click(function() {
      _modal.find('textarea.personal-message').show();
      erly.modal.resize();
      addMessageLink.hide();
    });
  };

  viewer.invites = invites;
}(erly.viewer));


/*!
 * Handles privacy popups
 */

(function(viewer) {
  var dialogs = {};

  var _openDialog = function(template, data, setup, enableClose, options) {
    erly.anchoredModal.close();
    erly.modal.close();
    erly.modal.open(_.extend(options || {}, {
      html: $(template).tmpl(data || {}),
      // Prevent clicking on background or escape key from closing the modal
      overlayClose: enableClose || false,
      escKey: enableClose || false,
      onComplete: function() {
        // Remove close button
        if (!enableClose) {
          $('.modal .close-modal').remove();
        }
        erly.modal.resize();
        if (typeof setup === 'function') { setup(); }
      }
    }));
  };

  dialogs.showPasswordDialog = function(ownerName, ident) {
    _openDialog('#tmplPasswordDialog', {name: ownerName}, function() {
      var form = $('.modal').find('form');
      form.submit(function(e) {
        form.find('.error').text('');
        $.ajax({
          type: 'post',
          url: erly.urlFor.collection({ident: ident}, 'validate_password'),
          data: form.serialize(),
          success: function(data) {
            if (data.valid) {
              window.location.reload();
            }
            else {
              form.find('.error').text('Invalid or incorrect password');
              erly.modal.resize();
              form.find('input:text').focus();
            }
          }
        });

        e.preventDefault();
        return false;
      });
      form.find('input:text').focus();
      form.find('div.submit-button').click(function(e) {
        if (e.which > 1) {
          return true;
        }

        form.submit();
      });
    });
  };

  dialogs.showDeletedCollectionDialog = function() {
    _openDialog('#tmplDeletedCollection');
  };

  dialogs.showDeletedCollectionItemDialog = function() {
    _openDialog('#tmplDeletedCollectionItem', null, null, true);
  };

  dialogs.showCalendarExportDialog = function() {
    _openDialog('#tmplCalendarExportDialog', null, null, true);
  };

  viewer.dialogs = dialogs;
}(erly.viewer));

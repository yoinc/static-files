/*!
 * Contact import widget
 */

(function(widgets) {
  var importContacts = {};

  widgets.importStatuses = {
    PROCESSED: 'processed',
    WAITING: 'waiting',
    NONE: 'none',
    ERR: 'error'
  };

  importContacts.pollConnectedContact = function(serviceData, callback) {
    var serviceName = serviceData.service;

    $.ajax(erly.urlFor.syncStatus(serviceName), {
      success: function(data) {
        var status = data.status;
        var importStatusOptions = widgets.importStatuses;

        switch(data.status) {
          case importStatusOptions.PROCESSED:
            erly.events.fire(erly.events.SERVICE_DATA_IMPORTED, data);
            break;
          case importStatusOptions.WAITING:
            erly.events.fire(erly.events.SERVICE_DATA_IMPORTING, data);

            setTimeout(function() {
              importContacts.pollConnectedContact(serviceData);
            }, 3000);

            break;
          case importStatusOptions.NONE:
            erly.events.fire(erly.events.SERVICE_DATA_NOT_CONNECTED, data);
            break;
          default:
            erly.events.fire(erly.events.SERVICE_DATA_IMPORT_ERROR, data);
            break;
        }

        if (callback) {
          callback(serviceName, status);
        }
      }
    });
  };

  importContacts.serviceDataAlreadyImported = function(serviceName) {
    $("#import_contacts").remove();
  };

  importContacts.serviceDataImported = function(serviceData) {
    // Refresh contacts
    erly.contacts.fetchData(true);

    var el = $("#import_contacts");

    var completionNote = $("#tmplImportedContacts").tmpl(serviceData);
    completionNote.insertAfter(el);

    importContacts.serviceDataAlreadyImported(serviceData.service);
    $(".importing-contacts").remove();
    el.hide();

    setTimeout(function() {
      completionNote.fadeOut();
    }, 5000);

    erly.getUserData().services[serviceData.service] = true;
  };

  importContacts.serviceImporting = function(serviceData) {
    var el = $("#import_contacts");

    el.hide();
    $("#tmplImportingContacts").tmpl(serviceData).insertAfter(el);

    erly.events.resubscribe(erly.events.SERVICE_DATA_IMPORTED, function() {
      importContacts.serviceDataImported(serviceData);
    });

    importContacts.pollConnectedContact(serviceData);
  };

  importContacts.bind = function() {
    var addressBookServices = erly.services.addressBook;
    var statuses = widgets.importStatuses;

    async.any(addressBookServices, function(service, cb) {
      var userServices = erly.getUserData().services;
      var serviceName = service.name;

      if (userServices && typeof userServices[serviceName] !== 'undefined') {
        importContacts.serviceDataAlreadyImported(serviceName);
        cb(true);
      } else {
        importContacts.pollConnectedContact({service: serviceName}, function(_, result) {
          switch(result) {
            case statuses.PROCESSED:
              importContacts.serviceDataImported({service: serviceName});
              cb(true);
              break;
            case statuses.WAITING:
              importContacts.serviceImporting({service: serviceName});
              cb(true);
              break;
            default:
              cb(false);
              break;
          }
        });
      }
    }, function(connectedOrImportingAnyService) {
      if (!connectedOrImportingAnyService) {
        erly.events.resubscribe(erly.events.SERVICE_CONNECTED,
          importContacts.serviceImporting);
      }
    });
  };

  widgets.importContacts = importContacts;
}(erly.widgets = erly.widgets || {}));

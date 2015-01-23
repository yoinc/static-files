/*!
 * Signup confirmation handling
 */

(function(erly) {
  erly.signupConfirmation = {
    init: function() {
      var user = this.user;
      if (!user) { throw new Error('No user defined!'); }
      $(document).ready(function() {
        var locals = {
          user: user,
          // always show Facebook as the first connected photo service
          photoServices: erly.services.photosWithFB,
          addressBookServices: erly.services.addressBook
        };

        erly.session.ensureAuthenticated(function() {
          $("#tmplSignupConfirmation").tmpl(locals).
            appendTo(".signup-confirmation");
          erly.services.enableSettingsButtons({allowDisconnect: false});
          erly.settings.enableSettingsButtonReplacement();
        });
      });
    }
  };
}(erly));

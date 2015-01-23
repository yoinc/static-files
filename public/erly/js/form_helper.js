/*!
 * Helper class for processing various forms.
 */
(function(erly) {
  /*
   * Make a new form helper.
   * Form should have the tmplFormErrorContainer template for errors.
   * @constructor
   */
  erly.FormHelper = function(form) {
    this.form_ = form;
    this.errorContainer_ = form.find('.error-container');
    this.errorList_ = this.errorContainer_.find('.errors');
    if (this.errorContainer_.length === 0 || this.errorList_.length === 0) {
      throw new Error('bad form, no error container');
    }
  };

  /*
   * Clear any errors on the form.
   */
  erly.FormHelper.prototype.clearErrors = function() {
    this.form_.find('.error-shadow').removeClass('error-shadow');
    this.errorList_.empty();
    this.errorContainer_.hide();
  };

  /*
   * Display an error on the form. If 'el' is given, highlight it with
   * .error-shadow class.
   */
  erly.FormHelper.prototype.showError = function(msg, el) {
    if (el) el.addClass('error-shadow');
    this.errorList_.append('<li>' + msg + '</li>');
    this.errorContainer_.show();
  };

  /*
   * Some common validation routines. Returns true if validation passes.
   * Checks any 'input' field not marked optional, and validates 'email'
   * field if it exists.
   */
  erly.FormHelper.prototype.validateCommon = function(opt_els) {
    this.clearErrors();

    var ok = true;
    var els = opt_els || this.form_.find('input:text').add(
      this.form_.find('input:password'));

    // Trim all fields
    els.each(function(index) {
      if ($(this).val()) {
        $(this).val($.trim($(this).val()));
      }
    });

    // Check for required fields (any text/password field not marked optional).
    var emptyRequired = (els).filter(function(index) {
      return !$(this).val() && !$(this).attr('optional');
    });
    if (emptyRequired.length > 0) {
      this.showError('Please fill in all required fields', emptyRequired);
      ok = false;
    }

    // Validate email field if present.
    var emailEl = this.form_.find('input[name=email]');
    if (emailEl.length > 0 && emailEl.val() &&
        !erly.validate.EMAIL_REGEX.test(emailEl.val())) {
      this.showError('The email address is not valid', emailEl);
      ok = false;
    }

    return ok;
  };
}(erly));

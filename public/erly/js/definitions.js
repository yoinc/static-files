/*global exports: true */
/*global module: true */

/*!
 * Definitions shared between server and client
 */

(function(erly) {
  var definitions = {
    COOKIE_NAME_AND_EMAIL: 'erlynae'
  };

  if (erly) {
    erly.definitions = definitions;
  } else {
    module.exports = definitions;
  }
}(typeof erly !== 'undefined' ? erly : null));

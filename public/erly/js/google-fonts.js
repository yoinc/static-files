(function() {
  window.WebFontConfig = {
    google: {
      families: [
        'League Script',
        'Philosopher',
        'Bad Script',
        'Monoton',
        'Carter One',
        'Raleway:100'
      ]
    },
    fontactive: function(family, desc) {
      erly.events.fire(erly.events.FONT_LOADED, family);
    }
  };

  var wf = document.createElement('script');
  wf.src = ('https:' === document.location.protocol ? 'https' : 'http') +
      '://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js';
  wf.type = 'text/javascript';
  wf.async = 'true';
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(wf, s);
}());

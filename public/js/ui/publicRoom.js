pb.ui.publicRoom = (function(pb) {

  function init(el, data) {
    var _el = el;
    if (data.error) {
      return;
    }
    _el.html(pb.tmpl.render('publicroom.placeholder', data));
    if (data.redirectLink) {
      window.location.href = data.redirectLink;
    }
  }

  return {
    init: init
  };
}(pb));

$(function() {
  $('button').click(function() {
    var button = $(this);
    var messageId = button.parents('li').data('id');
    var action;
    if (button.hasClass('approve')) {
      action = 'approve';
    } else if (button.hasClass('reject')) {
      action = 'reject';
    }
    if (!action) {
      return;
    }
    $.post('/_admin/flagAction', {
      action: action,
      messageId: messageId
    }, function(data) {
      if (data.success) {
        button.parents('li').remove();
      }
    });
  });
});

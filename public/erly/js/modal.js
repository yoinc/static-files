/**
 * Modal functions
 */

(function(erly) {
  var modal = {};

  modal.bindHooks = function() {
    $('.close-modal').click(_(this.close).bind(this));
  };

  /**
   * @const
   * @private
   */
  var MODAL_ENTER_KEYCODE = 13;
  var MODAL_ESC_KEYCODE = 27;

  /**
   * Common onKeyDown handler
   *
   * @private
   */
  var unfocusedEnter = function(callback) {
    if (typeof callback === 'function') {
      return function(ev) {
        if (ev.which === MODAL_ENTER_KEYCODE && !$(ev.target).is('textarea')) {
          if (callback.apply(this, [ev])) {
            ev.preventDefault();
          }
        }
      };
    }
    else {
      return function() { };
    }
  };

  modal.open = function(options) {
    var target = options.target || $.fn;
    delete options.target;

    var keydown = unfocusedEnter(options.onUnfocusedEnter);
    $(window).keydown(keydown);

    var anchored = $('.anchored-modal:visible');

    options.onClosed = _.wrap(options.onClosed, function(oldFun) {
      if (typeof oldFun === 'function') { oldFun(); }
      $(window).unbind('keydown', keydown);
      erly.events.fire(erly.events.MODAL_CLOSE);
      anchored.show();
    });

    var self = this;
    options.onComplete = _.wrap(options.onComplete, function(oldFun) {
      if (typeof oldFun === 'function') { oldFun(); }
      erly.enableWatermarks();
      self.bindHooks();
      erly.events.fire(erly.events.MODAL_OPEN);
      anchored.hide();
    });
    options.transition = 'none';

    // Try to stretch to fill the window
    if (options.stretch) {
      var template = $(options.href);
      if (options.stretch.width) {
        template.css('left', options.stretch.width.reduction / 2);
        template.css('right', options.stretch.width.reduction / 2);
        template.css('min-width', options.stretch.width.minWidth + 'px');
      }

      if (options.stretch.height) {
        template.css('bottom', options.stretch.height.reduction);
        template.css('min-height', options.stretch.height.minHeight + 'px');

        var heightReduction = options.stretch.height.reduction * 2 - $(document).scrollTop();
        template.css('height', $(window).height() - heightReduction);

        $(window).bind('resize', function() {
          var heightReduction = options.stretch.height.reduction * 2 - $(document).scrollTop();
          template.css('height', $(window).height() - heightReduction);
          modal.resize();
        });
      }
    }

    target.colorbox(options);
  };

  modal.close = function() {
    modal.window().colorbox.close();
    return false;
  };

  modal.resize = function(options) {
    modal.window().colorbox.resize(options);
  };

  modal.window = function() {
    return $('.modal');
  };

  modal.showConfirm = function(title, question, confirmText, confirmFunc,
      options) {
    options = options || {};

    var classes = options.type === 'warning' || options.type === 'remove' ?
      options.type : '';
    delete options.type;

    modal.showConfirmWithTemplate($('#tmplConfirmationModal').tmpl({
      title: title,
      question: question,
      confirmText: confirmText,
      cancelText: options.cancelText,
      hideCancel: options.hideCancel,
      extraClasses: classes
    }), confirmFunc || function() {}, options.onComplete, options);
  };

  modal.showConfirmWithTemplate = function(template, confirmFunc, onComplete,
      options) {
    options = options || {};
    var self = this;
    self.open({
      inline: true,
      href: $(template),
      open: true,
      scrolling: false,
      onUnfocusedEnter: function() {
        template.find('.button-bar .confirm-button').click();
        return true;
      },
      onComplete: function() {
        $('#cboxContent').addClass('shadow-wide');
        template.find('.button-bar .cancel').click(function() {
          $('#cboxContent').removeClass('shadow-wide');
          self.close();
        });
        template.find('.close-modal').click(function() {
          $('#cboxContent').removeClass('shadow-wide');
          self.close();
        });
        template.find('.button-bar .confirm-button').click(function () {
          $('#cboxContent').removeClass('shadow-wide');
          confirmFunc();
          self.close();
        });
        if (typeof onComplete === 'function') {
          onComplete(template);
        }
      },
      onClosed: options.onClosed
    });
  };

  modal.showAlertWithTemplate = function(template, onComplete) {
    var self = this;
    self.open({
      inline: true,
      href: $(template),
      open: true,
      scrolling: false,
      onUnfocusedEnter: function() {
        self.close();
        return true;
      },
      onComplete: function() {
        template.find('.button-bar .cancel').click(self.close);
        template.find('.close-modal').click(self.close);
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }
    });
  };

  modal.showAlert = function(title, alert) {
    modal.showAlertWithTemplate($('#tmplAlertModal').tmpl({
      title: title,
      alert: alert
    }));
  };

  modal.showEmailVerificationAlert = function() {
    erly.modal.showAlertWithTemplate(
      $('#tmplEmailVerificationError').tmpl(),
      function() {
        $('.confirm-modal .email-verification a').click(function() {
          erly.resendEmailVerification();
        });
      }
    );
  };

  var anchoredModal = {};

  anchoredModal.open = function(anchorElement, modalOptions) {
    var self = this;

    if (self.options) {
      var sameAnchor = (anchorElement.get(0) ===
        self.options.anchorElement.get(0));

      self.close(true);

      // If someone clicked the same anchor element, just close and don't
      // reopen
      if (sameAnchor) {
        return;
      }
    }

    if (typeof modalOptions === 'function') {
      self.options = modalOptions();
    } else {
      self.options = _.extend({}, modalOptions);
    }

    var keyDown = unfocusedEnter(self.options.onUnfocusedEnter);
    $(window).keydown(keyDown);
    self.options.onKeyDown = keyDown;

    // Remember the anchorElement for later use
    self.options.anchorElement = anchorElement;

    var template = $(self.options.html);

    template.css('z-index', '99999');
    template.css('position', 'absolute');
    template.css('opacity', '0.01');

    var html = '';
    html += '<div class="anchored-modal">';
    if (!self.options.skipOverlay) {
      html += '<div class="anchored-modal-overlay"></div>';
    }
    html += '</div>';
    html = $(html);
    template.appendTo(html);
    $('body').append(html);

    template.animate({
      opacity: 1
    }, self.options.immediate ? 0 : 250, function() {
      template.css('filter', '');
    });

    if (self.options.centerModal) {
      // If we are centering the modal and don't show the triangle
      self.options.triangleCssClass = null;
    }

    self.moveToAnchor();

    // Try to stretch to fill the window
    if (self.options.stretch) {
      if (self.options.stretch.width) {
        template.css('left', self.options.stretch.width.reduction / 2);
        template.css('right', self.options.stretch.width.reduction / 2);
        template.css('min-width', self.options.stretch.width.minWidth + 'px');
      }

      if (self.options.stretch.height) {
        template.css('bottom', self.options.stretch.height.reduction);
        template.css('min-height', self.options.stretch.height.minHeight + 'px');
      }
    }

    if (!self.options.omitTriangle) {
      if (self.options.triangleCssClass) {
        $('.modal').addClass(self.options.triangleCssClass);
      }
      else {
        var triangle = erly.widgets.createPositionedBorderedTriangle(
          $('.modal').parent(),
          anchorElement,
          2,
          {
            position: 'left',
            borderWidth: 8,
            color: 'white',
            borderColor: '#ccc'
          }
        );
      }
    }

    if (self.options.cssClass) {
      $('.modal').addClass(self.options.cssClass);
    }

    $('.anchored-modal-overlay').click(function() {
      self.close();
    });
    $('.anchored-modal .close-modal').click(function() {
      self.close();
    });

    if (self.options.onComplete) {
      $(window).keydown(function(e) {
        if (e.which === MODAL_ESC_KEYCODE) {
          self.close();
        }
      });
      self.options.onComplete();
    }
    $(window).bind('resize', self.moveToAnchor);
    erly.events.fire(erly.events.MODAL_OPEN);
  };

  anchoredModal.moveToAnchor = function() {
    var self = erly.anchoredModal;
    var anchorElement = self.options.anchorElement;
    var modal = $('.modal');
    var off = $(anchorElement).offset(),
        top  = off.top - $(window).scrollTop(),
        left = off.left + anchorElement.outerWidth();

    top += self.options.topOffset || 0;

    if (typeof self.options.right !== 'undefined') {
      modal.css('right', self.options.right);
    }
    else {
      if (self.options.left) {
        modal.css('left', self.options.left);
      }
      else if (self.options.centerLeft || self.options.centerModal) {
        modal.css('left', ($(window).width() - modal.width()) / 2 + 'px');
      }
      else {
        modal.css('left', left);
      }
    }

    if (self.options.top) {
      modal.css('top', self.options.top);
    }
    else if (self.options.centerTop || self.options.centerModal) {
      modal.css('top', ($(window).height() - modal.height()) / 2 + 'px');
    }
    else {
      modal.css('top', top);
    }

    if (self.options.stretch && self.options.stretch.height) {
      var reduction = self.options.stretch.height.reduction || 0;
      reduction += modal.offset().top - $(document).scrollTop();
      modal.height($(window).height() - reduction);
    }
  };

  anchoredModal.isOpen = function() {
    return $('.anchored-modal').length > 0;
  };

  anchoredModal.close = function(immediate) {
    var self = this;
    var modal = $('.anchored-modal');
    var doClose = function() {
      modal.remove();

      if (self.options) {
        if (self.options.onClosed) {
          self.options.onClosed();
        }
        if (self.options.onKeyDown) {
          $(window).unbind('keydown', self.options.onKeyDown);
        }
      }

      self.options = null;

      erly.events.fire(erly.events.MODAL_CLOSE);
    };

    $(window).unbind('resize', self.moveToAnchor);
    if (immediate) {
      doClose();
    }
    else {
      modal.fadeOut(doClose);
    }
  };

  $.fn.anchoredModal = function(modalOptions) {
    var self = this;
    self.click(function() {
      erly.anchoredModal.open(self, modalOptions);
    });
  };

  erly.modal = modal;
  erly.anchoredModal = anchoredModal;
}(erly));

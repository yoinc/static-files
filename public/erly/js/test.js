// Override alert so it doesn't interfere with tests
alert = function(s) {
  console.log("[ALERT] " + s);
};

var erlyTest = {};

erlyTest.pageReady = false;
erlyTest.scriptReady = false;
var _runningTests = false;
erlyTest.execTests = function() {
  if (_runningTests) return;
  _runningTests = true;
  erlyTest.runTests();
};

erlyTest.startTests = function() {
  if (!erlyTest.pageReady || !erlyTest.scriptReady) {
    console.log('Waiting for test script download and PAGE_READY event...');
  }
  else {
    erlyTest.execTests();
  }
};
// Turn off animations to speed up testing and reduce flakiness
jQuery.fx.off = true;

erlyTest.unmock = function(obj, fnName) {
  var original = obj.__mocked && obj.__mocked[fnName];
  if (original) {
    obj[fnName] = original;

    delete obj.__mocked[fnName];
  }
};

erlyTest.mock = function(obj, fnName, newFn) {
  obj.__mocked = obj.__mocked || {};
  // NOTE: Preserve the original
  if (!obj.__mocked[fnName]) {
    obj.__mocked[fnName] = obj[fnName];
  }
  obj[fnName] = newFn;
};

var _steppedTests = [];
var _currentStep = 0;

/**
 * Add a step to the currently running test.  `count` is the number of expected
 * tests within the step. `test` is a function that defines the tests within
 * that step.
 */
erlyTest.testCount = 0;
erlyTest.steppedTestCount = 0;
erlyTest.step = function(count, fn) {
  _steppedTests.push({count: count, fn: fn});
  erlyTest.testCount += count;
  erlyTest.steppedTestCount = _steppedTests.length;
};

erlyTest.testsRun = 0;
erlyTest.runCurrentStep = function() {
  var curTest = _steppedTests[_currentStep];
  console.log(' * Running step ' + _currentStep + ': ' + window.location.href);
  if (!curTest) throw new Error("Couldn't find step " + _currentStep);
  // sum tests up until this point
  erlyTest.testsRun = _(_steppedTests).reduce(function(sum, v, i) {
    return sum + (i < _currentStep ? v.count : 0);
  }, 0);
  curTest.fn();
};

erlyTest.getTestState = function(inc) {
  var testName = window.location.search ? window.location.search : '';
  if (!testName && document.referrer.indexOf('?') >= 0) {
    testName = '?' + document.referrer.split('?')[1];

  }
  if (inc) {
    testName = testName.replace(/(&__testStepCount=\d+|$)/,
      '&__testStepCount=' + (_currentStep + 1));
  }
  return testName;
};

/**
 * Vists given path preserving test state.  Assumes current host/port.
 */
erlyTest.visitUrl = function(path) {
  var state = erlyTest.getTestState(true);
  var url = [
    'http://',
    window.location.hostname, ':',
    window.location.port,
    path,
    state || ''
  ].join('');
  //console.log(' *- visitUrl: ' + url);
  window.location.assign(url);
};

$(function() {
  var testName = erlyTest.getTestState(
    // Only increment if this was a redirect from the server
    !window.location.search && !!document.referrer);

  if (testName) {
    var m = /__testStepCount=(\d+)/.exec(testName);
    if (m) {
      _currentStep = parseInt(m[1], 10);
    }
    else {
      _currentStep = 0;
    }
  }

  erly.events.subscribeOnce(erly.events.PAGE_READY, function() {
    erlyTest.pageReady = true;
    if (erlyTest.scriptReady) erlyTest.execTests();

    if (window.location.search.indexOf('automated') === -1) {
      erlyTest.startTests();
    }
  });

  // console.log(erly.BASE_URL + "/__test" + testName);
  $.ajax({
    url: 'http://' + erly.BASE_URL + "/__test" + testName,
    cache: false,
    error: function() {
      console.log(arguments);
    },
    success: function(data) {
      if (data.error) {
        alert("Couldn't load test data for " + testName);
        return;
      }

      // Add the test script to the page
      var testScript = "<script id='__test' type='text/javascript' charset='utf-8'>" + data.script + "</script>";
      $("body").append(testScript);

      erlyTest.scriptReady = true;
      if (erlyTest.pageReady) erlyTest.execTests();
    }
  });

  // Position and hover-effect the results - wooooo!
  var resultsDiv = $(".test-results");
  resultsDiv.css("left", Math.max(0, (($(window).width() - resultsDiv.width()) / 2)) + "px");
  resultsDiv.hover(function() {
    $(this).animate({
      opacity: 1.0
    });
  }, function() {
    $(this).animate({
      opacity: 0.6
    });
  }).css("opacity", 0.6);

  $(".showhide").click(function() {
    $(".qunit-results").toggle();
    return false;
  });
});

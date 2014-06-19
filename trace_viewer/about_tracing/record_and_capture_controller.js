// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

tvcm.require('tracing.record_selection_dialog');

tvcm.exportTo('about_tracing', function() {
  function beginMonitoring(tracingControllerClient) {
    var finalPromiseResolver;
    var finalPromise = new Promise(function(resolver) {
      finalPromiseResolver = resolver;
    });

    // TODO(haraken): Implement a configure dialog to set these options.
    var monitoringOptions = {
      categoryFilter: '*',
      useSystemTracing: false,
      useContinuousTracing: false,
      useSampling: true
    };


    var beginMonitoringPromise = tracingControllerClient.beginMonitoring(
        monitoringOptions);

    beginMonitoringPromise.then(
        function() {
          finalPromiseResolver.resolve();
        },
        function(err) {
          finalPromiseResolver.reject(err);
        });

    return finalPromise;
  }

  function endMonitoring(tracingControllerClient) {
    var finalPromiseResolver;
    var finalPromise = new Promise(function(resolver) {
      finalPromiseResolver = resolver;
    });

    var endMonitoringPromise = tracingControllerClient.endMonitoring();
    endMonitoringPromise.then(
        function() {
          finalPromiseResolver.resolve();
        },
        function(err) {
          finalPromiseResolver.reject(err);
        });

    return finalPromise;
  }

  function captureMonitoring(tracingControllerClient) {
    var finalPromiseResolver;
    var finalPromise = new Promise(function(resolver) {
      finalPromiseResolver = resolver;
    });

    var captureMonitoringPromise =
        tracingControllerClient.captureMonitoring();
    captureMonitoringPromise.then(
        captureMonitoringResolved,
        captureMonitoringRejected);

    function captureMonitoringResolved(tracedData) {
      finalPromiseResolver.resolve(tracedData);
    }

    function captureMonitoringRejected(err) {
      finalPromiseResolver.reject(err);
    }

    return finalPromise;
  }

  function getMonitoringStatus(tracingControllerClient) {
    var finalPromiseResolver;
    var finalPromise = new Promise(function(resolver) {
      finalPromiseResolver = resolver;
    });

    var getMonitoringStatusPromise =
        tracingControllerClient.getMonitoringStatus();
    getMonitoringStatusPromise.then(
        function(monitoringOptions) {
          finalPromiseResolver.resolve(monitoringOptions.isMonitoring,
                                       monitoringOptions.categoryFilter,
                                       monitoringOptions.useSystemTracing,
                                       monitoringOptions.useContinuousTracing,
                                       monitoringOptions.useSampling);
        },
        function(err) {
          finalPromiseResolver.reject(err);
        });

    return finalPromise;
  }

  function beginRecording(tracingControllerClient) {
    var finalPromiseResolver;
    var finalPromise = new Promise(function(resolver) {
      finalPromiseResolver = resolver;
    });
    finalPromise.selectionDlg = undefined;
    finalPromise.progressDlg = undefined;

    function beginRecordingError(err) {
      finalPromiseResolver.reject(err);
    }

    // Step 0: End recording. This is necessary when the user reloads the
    // about:tracing page when we are recording. Window.onbeforeunload is not
    // reliable to end recording on reload.
    endRecording(tracingControllerClient).then(
        getCategories,
        getCategories);  // Ignore error.

    // But just in case, bind onbeforeunload anyway.
    window.onbeforeunload = function(e) {
      endRecording(tracingControllerClient);
    }

    // Step 1: Get categories.
    function getCategories() {
      tracingControllerClient.getCategories().then(
          showTracingDialog,
          beginRecordingError);
    }

    // Step 2: Show tracing dialog.
    var selectionDlg;
    function showTracingDialog(categories) {
      selectionDlg = new tracing.RecordSelectionDialog();
      selectionDlg.categories = categories;
      selectionDlg.settings_key = 'about_tracing.record_selection_dialog';
      selectionDlg.addEventListener('recordclick', startTracing);
      selectionDlg.addEventListener('closeclick', cancelRecording);
      selectionDlg.visible = true;

      finalPromise.selectionDlg = selectionDlg;
    }

    function cancelRecording() {
      finalPromise.selectionDlg = undefined;
      finalPromiseResolver.reject(new UserCancelledError());
    }

    // Step 2: Do the actual tracing dialog.
    var progressDlg;
    var bufferPercentFullDiv;
    function startTracing() {
      progressDlg = new tvcm.ui.Overlay();
      progressDlg.textContent = 'Recording...';
      progressDlg.userCanClose = false;

      bufferPercentFullDiv = document.createElement('div');
      progressDlg.appendChild(bufferPercentFullDiv);

      var stopButton = document.createElement('button');
      stopButton.textContent = 'Stop';
      progressDlg.clickStopButton = function() {
        stopButton.click();
      };
      progressDlg.appendChild(stopButton);

      var recordingOptions = {
        categoryFilter: selectionDlg.categoryFilter(),
        useSystemTracing: selectionDlg.useSystemTracing,
        useContinuousTracing: selectionDlg.useContinuousTracing,
        useSampling: selectionDlg.useSampling
      };


      var requestPromise = tracingControllerClient.beginRecording(
          recordingOptions);
      requestPromise.then(
          function() {
            progressDlg.visible = true;
            stopButton.focus();
            updateBufferPercentFull('0');
          },
          recordFailed);

      stopButton.addEventListener('click', function() {
        // TODO(chrishenry): Currently, this only dismiss the progress
        // dialog when tracingComplete event is received. When performing
        // remote debugging, the tracingComplete event may be delayed
        // considerable. We should indicate to user that we are waiting
        // for tracingComplete event instead of being unresponsive. (For
        // now, I disable the "stop" button, since clicking on the button
        // again now cause exception.)
        var recordingPromise = endRecording(tracingControllerClient);
        recordingPromise.then(
            recordFinished,
            recordFailed);
        stopButton.disabled = true;
        bufferPercentFullDiv = undefined;
      });
      finalPromise.progressDlg = progressDlg;
    }

    function recordFinished(tracedData) {
      progressDlg.visible = false;
      finalPromise.progressDlg = undefined;
      finalPromiseResolver.resolve(tracedData);
    }

    function recordFailed(err) {
      progressDlg.visible = false;
      finalPromise.progressDlg = undefined;
      finalPromiseResolver.reject(err);
    }

    function getBufferPercentFull() {
      if (!bufferPercentFullDiv)
        return;

      tracingControllerClient.beginGetBufferPercentFull().then(
          updateBufferPercentFull);
    }

    function updateBufferPercentFull(percent_full) {
      if (!bufferPercentFullDiv)
        return;

      percent_full = parseFloat(percent_full);
      var newText = 'Buffer usage: ' + Math.round(100 * percent_full) + '%';
      if (bufferPercentFullDiv.textContent != newText)
        bufferPercentFullDiv.textContent = newText;

      window.setTimeout(getBufferPercentFull, 500);
    }

    // Thats it! We're done.
    return finalPromise;
  };

  function endRecording(tracingControllerClient) {
    return tracingControllerClient.endRecording();
  }

  function UserCancelledError() {
    Error.apply(this, arguments);
  }
  UserCancelledError.prototype = {
    __proto__: Error.prototype
  };

  return {
    beginRecording: beginRecording,
    beginMonitoring: beginMonitoring,
    endMonitoring: endMonitoring,
    captureMonitoring: captureMonitoring,
    getMonitoringStatus: getMonitoringStatus,
    UserCancelledError: UserCancelledError
  };
});

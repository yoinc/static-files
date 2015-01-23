(function(erly) {
  function downloadTemplates(paths, callback) {
    var tasks = [];
    $.each(paths, function(index, path){
      tasks.push(function(taskCallback) {
        $.ajax({
          url: path,
          dataType: 'text',
          success: function(tmpl) {
            $('#templates').append(tmpl);
            taskCallback(null, tmpl);
          }
        });
      });
    });

    async.parallel(tasks, function(err, results) {
      if (err) {
        throw new Error(err);
      }
      if (callback) {
        callback(results);
      }
    });
  }

  function downloadTemplate(path, callback) {
    downloadTemplates([path], callback);
  }

  erly.cms = {
    downloadTemplate: downloadTemplate,
    downloadTemplates: downloadTemplates
  };
}(erly));

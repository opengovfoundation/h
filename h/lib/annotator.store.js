/*
** Annotator 1.2.6-dev-fe8a355
** https://github.com/okfn/annotator/
**
** Copyright 2012 Aron Carroll, Rufus Pollock, and Nick Stenning.
** Dual licensed under the MIT and GPLv3 licenses.
** https://github.com/okfn/annotator/blob/master/LICENSE
**
** Built at: 2013-06-06 13:31:04Z
*/

(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; },
    __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  Annotator.Plugin.Store = (function(_super) {

    __extends(Store, _super);

    Store.prototype.events = {
      'annotationCreated': 'annotationCreated',
      'annotationDeleted': 'annotationDeleted',
      'annotationUpdated': 'annotationUpdated'
    };

    Store.prototype.options = {
      annotationData: {},
      emulateHTTP: false,
      loadFromSearch: false,
      prefix: '/store',
      urls: {
        create: '/annotations',
        read: '/annotations/:id',
        update: '/annotations/:id',
        destroy: '/annotations/:id',
        search: '/search'
      }
    };

    function Store(element, options) {
      this._onError = __bind(this._onError, this);
      this._onLoadAnnotationsFromSearch = __bind(this._onLoadAnnotationsFromSearch, this);
      this._onLoadAnnotations = __bind(this._onLoadAnnotations, this);
      this._getAnnotations = __bind(this._getAnnotations, this);
      var _this = this;
      Store.__super__.constructor.apply(this, arguments);
      this.annotations = [];
      this.initTaskInfo = {
        code: function(task) {
          if (!Annotator.supported()) task.failed("Annotator is not supported.");
          _this.tasks = _this.annotator.tasks;
          _this.log = _this.annotator.log;
          _this.loadGen = _this.tasks.createGenerator({
            name: "load annotations",
            code: function(task, data) {
              var extraURIs, href, searchOptions, _i, _len, _results;
              extraURIs = data.extraURIs;
              _this.pendingLoading = task;
              _this.pendingRequests = 1 + extraURIs.length;
              _this.log.info("Sending request for " + _this.options.annotationData.uri);
              if (_this.options.loadFromSearch) {
                _this.loadAnnotationsFromSearch(_this.options.loadFromSearch);
              } else {
                _this.loadAnnotations();
              }
              searchOptions = $.extend({}, _this.options.loadFromSearch);
              _results = [];
              for (_i = 0, _len = extraURIs.length; _i < _len; _i++) {
                href = extraURIs[_i];
                _this.log.info("Also loading annotations for " + href);
                searchOptions.uri = href;
                _results.push(_this.loadAnnotationsFromSearch(searchOptions));
              }
              return _results;
            }
          });
          if (!options.noLoading) {
            _this.annotator.init.addSubTask({
              task: _this.startLoading("plugin init")
            }, [], false);
            if (_this.annotator.init.started) _this.tasks.schedule();
          }
          return task.ready();
        }
      };
    }

    Store.prototype.pluginInit = function() {
      if (!Annotator.supported()) return;
      if (this.options.noLoading) return;
      if (this.annotator.plugins.Auth) {
        return this.annotator.plugins.Auth.withToken(this._getAnnotations);
      } else {
        return this._getAnnotations();
      }
    };

    Store.prototype.startLoading = function(reason, extraURIs, useDefaultProgress) {
      var info;
      if (extraURIs == null) extraURIs = [];
      if (useDefaultProgress == null) useDefaultProgress = true;
      info = {
        instanceName: reason,
        data: {
          extraURIs: extraURIs
        }
      };
      return this.loadGen.create(info, useDefaultProgress);
    };

    Store.prototype._getAnnotations = function() {
      if (this.options.loadFromSearch) {
        return this.loadAnnotationsFromSearch(this.options.loadFromSearch);
      } else {
        return this.loadAnnotations();
      }
    };

    Store.prototype.annotationCreated = function(annotation) {
      var _this = this;
      if (__indexOf.call(this.annotations, annotation) < 0) {
        this.registerAnnotation(annotation);
        return this._apiRequest('create', annotation, function(data) {
          if (!(data.id != null)) {
            _this.annotator.log.warn(Annotator._t("Warning: No ID returned from server for annotation "), annotation);
          }
          return _this.updateAnnotation(annotation, data);
        });
      } else {
        return this.updateAnnotation(annotation, {});
      }
    };

    Store.prototype.annotationUpdated = function(annotation) {
      var _this = this;
      if (__indexOf.call(this.annotations, annotation) >= 0) {
        return this._apiRequest('update', annotation, (function(data) {
          return _this.updateAnnotation(annotation, data);
        }));
      }
    };

    Store.prototype.annotationDeleted = function(annotation) {
      var _this = this;
      if (__indexOf.call(this.annotations, annotation) >= 0) {
        return this._apiRequest('destroy', annotation, (function() {
          return _this.unregisterAnnotation(annotation);
        }));
      }
    };

    Store.prototype.registerAnnotation = function(annotation) {
      return this.annotations.push(annotation);
    };

    Store.prototype.unregisterAnnotation = function(annotation) {
      return this.annotations.splice(this.annotations.indexOf(annotation), 1);
    };

    Store.prototype.updateAnnotation = function(annotation, data) {
      if (__indexOf.call(this.annotations, annotation) < 0) {
        this.annotator.log.error(Annotator._t("Trying to update unregistered annotation!"));
      } else {
        $.extend(annotation, data);
      }
      return $(annotation.highlights).data('annotation', annotation);
    };

    Store.prototype.loadAnnotations = function() {
      return this._apiRequest('read', null, this._onLoadAnnotations);
    };

    Store.prototype._onLoadAnnotations = function(data) {
      var task, _ref, _ref2;
      if (data == null) data = [];
      if (data.length) {
        this.annotations = this.annotations.concat(data);
        this.annotator.loadAnnotations(data.slice());
      }
      if (((_ref = this.pendingLoading) != null ? _ref.state() : void 0) === "pending") {
        this.pendingRequests -= 1;
        if (!this.pendingRequests) {
          _ref2 = [this.pendingLoading, null], task = _ref2[0], this.pendingLoading = _ref2[1];
          return task.ready();
        }
      }
    };

    Store.prototype.loadAnnotationsFromSearch = function(searchOptions) {
      return this._apiRequest('search', searchOptions, this._onLoadAnnotationsFromSearch);
    };

    Store.prototype._onLoadAnnotationsFromSearch = function(data) {
      if (data == null) data = {};
      return this._onLoadAnnotations(data.rows || []);
    };

    Store.prototype.dumpAnnotations = function() {
      var ann, _i, _len, _ref, _results;
      _ref = this.annotations;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ann = _ref[_i];
        _results.push(JSON.parse(this._dataFor(ann)));
      }
      return _results;
    };

    Store.prototype._apiRequest = function(action, obj, onSuccess) {
      var id, options, request, url;
      id = obj && obj.id;
      url = this._urlFor(action, id);
      options = this._apiRequestOptions(action, obj, onSuccess);
      request = $.ajax(url, options);
      request._id = id;
      request._action = action;
      return request;
    };

    Store.prototype._apiRequestOptions = function(action, obj, onSuccess) {
      var data, method, opts;
      method = this._methodFor(action);
      opts = {
        type: method,
        headers: this.element.data('annotator:headers'),
        dataType: "json",
        success: onSuccess || function() {},
        error: this._onError
      };
      if (this.options.emulateHTTP && (method === 'PUT' || method === 'DELETE')) {
        opts.headers = $.extend(opts.headers, {
          'X-HTTP-Method-Override': method
        });
        opts.type = 'POST';
      }
      if (action === "search") {
        opts = $.extend(opts, {
          data: obj
        });
        return opts;
      }
      data = obj && this._dataFor(obj);
      if (this.options.emulateJSON) {
        opts.data = {
          json: data
        };
        if (this.options.emulateHTTP) opts.data._method = method;
        return opts;
      }
      opts = $.extend(opts, {
        data: data,
        contentType: "application/json; charset=utf-8"
      });
      return opts;
    };

    Store.prototype._urlFor = function(action, id) {
      var url;
      url = this.options.prefix != null ? this.options.prefix : '';
      url += this.options.urls[action];
      url = url.replace(/\/:id/, id != null ? '/' + id : '');
      url = url.replace(/:id/, id != null ? id : '');
      return url;
    };

    Store.prototype._methodFor = function(action) {
      var table;
      table = {
        'create': 'POST',
        'read': 'GET',
        'update': 'PUT',
        'destroy': 'DELETE',
        'search': 'GET'
      };
      return table[action];
    };

    Store.prototype._dataFor = function(annotation) {
      var data, highlights;
      highlights = annotation.highlights;
      delete annotation.highlights;
      $.extend(annotation, this.options.annotationData);
      data = JSON.stringify(annotation);
      if (highlights) annotation.highlights = highlights;
      return data;
    };

    Store.prototype._onError = function(xhr) {
      var action, message, task, _ref, _ref2;
      action = xhr._action;
      message = Annotator._t("Sorry we could not ") + action + Annotator._t(" this annotation");
      if (xhr._action === 'search') {
        message = Annotator._t("Sorry we could not search the store for annotations");
      } else if (xhr._action === 'read' && !xhr._id) {
        message = Annotator._t("Sorry we could not ") + action + Annotator._t(" the annotations from the store");
      }
      switch (xhr.status) {
        case 401:
          message = Annotator._t("Sorry you are not allowed to ") + action + Annotator._t(" this annotation");
          break;
        case 404:
          message = Annotator._t("Sorry we could not connect to the annotations store");
          break;
        case 500:
          message = Annotator._t("Sorry something went wrong with the annotation store");
      }
      Annotator.showNotification(message, Annotator.Notification.ERROR);
      this.annotator.log.error(Annotator._t("API request failed:"), xhr);
      if (((_ref = this.pendingLoading) != null ? _ref.state() : void 0) === "pending") {
        _ref2 = [this.pendingLoading, null], task = _ref2[0], this.pendingLoading = _ref2[1];
        return task.failed("Coult not load annotations: API request failed.");
      }
    };

    return Store;

  })(Annotator.Plugin);

}).call(this);

class Annotator.Plugin.Discovery extends Annotator.Plugin
  constructor: ->
    @initTaskInfo =
      name: "discovery"
      code: (taskCtrl) => this.pluginInit taskCtrl

  pluginInit: (taskCtrl) ->
    svc = $('link')
    .filter ->
      this.rel is 'service' and this.type is 'application/annotatorsvc+json'
    .filter ->
      this.href

    unless svc.length
      if taskCtrl then taskCtrl.reject()
      return

    href = svc[0].href

    $.getJSON href, (data) =>
      unless data?.links?
        if taskCtrl then taskCtrl.reject()
        return

      options =
        prefix: href.replace /\/$/, ''
        urls: {}

      if data.links.search?.url?
        options.urls.search = data.links.search.url

      for action, info of (data.links.annotation or {}) when info.url?
        options.urls[action] = info.url

      for action, url of options.urls
        options.urls[action] = url.replace(options.prefix, '')

      @annotator.publish 'serviceDiscovery', options
      if taskCtrl then taskCtrl.resolve()

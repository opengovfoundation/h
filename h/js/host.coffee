$ = Annotator.$

class Annotator.Host extends Annotator
  # Events to be bound on Annotator#element.
  events:
    ".annotator-adder button click":     "onAdderClick"
    ".annotator-adder button mousedown": "onAdderMousedown"

  # Plugin configuration
  options: {}

  # Drag state variables
  drag:
    delta: 0
    enabled: false
    last: null
    tick: false

  constructor: (element, options) ->
    @log ?= getXLogger "Annotator.Host"
#    @log.setLevel XLOG_LEVEL.DEBUG
    @log.debug "Started constructor."

    options.noScan = true
    options.noInit = true
    super

    window.wtfhost = this

#    @tasklog.setLevel XLOG_LEVEL.DEBUG

    this.initAsync()

    delete @options.noInit 
    delete @options.noScan

    @app = @options.app
    delete @options.app

    # Load plugins
    for own name, opts of @options
      if not @plugins[name]
        @log.debug "Loading plugin '" + name + "' with options", opts
        this.addPlugin(name, opts)

    # We will use these task generators to set up the tasks for setting up
    # annotations as we receive them.
    @setupListTaskGen = @tasks.createGenerator
      name: "setting up annotation list"
      composite: true

    @setupBatchTaskGen = @tasks.createGenerator
      name: "setting up annotation batch"
      code: (task, data) =>
        for n in data.annotations
          this.setupAnnotationReal n
        task.ready()

    # We need to override the normal setupAnnotation call, so we save it
    @setupAnnotationReal = @setupAnnotation

    # We receive setupAnnotation calls from the bridge plugin.
    # However, we don't know whether or not we can act on these requests
    # right away, because it's possible the that scan phase has not yet
    # finished. Therefore, we create tasks out of them, to be executed
    # when the results of the scan are ready.
    @setupAnnotation = (annotation) =>
      # If we don't have a pending setup task, create one
      unless @pendingSetup
        @pendingSetup = @setupListTaskGen.create
          instanceName: ""
          deps: [
            "scan document #1: Initial scan", # We can't anchore without data
            "panel channel" # we need to tell the sidebar when it's ready
          ]
        @pendingSetupCount = 0

        # Do this when this newly created setup task is finished
        @pendingSetup.done =>
          @panel.notify method: 'publishAnnotationsAnchored'
          delete @pendingSetup

        info =
          instanceName: "1 - "
          data: annotations: []

        @pendingSetup.addSubTask
          deps: @pendingSetup.lastSubTask
          task: @setupBatchTaskGen.create info, false

      @pendingSetupCount += 1

      # Fetch the last batch
      batch = @pendingSetup.lastSubTask

      # Check whether we can put this incoming annotation into this batch
      if batch.started or batch._data.annotations.length is 10
        # The current batch is full, we need a new batch
        info =
          instanceName: @pendingSetupCount + "-"
          data: annotations: []
        batch = @setupBatchTaskGen.create info, false
        @pendingSetup.addSubTask
          deps: @pendingSetup.lastSubTask
          task: batch

      # Add the new annotation to the chosen batch
      batch._data.annotations.push annotation

      @tasks.schedule()

    @log.debug "Finished constructor."

  defineAsyncInitTasks: ->
    super

    @init.createSubTask
      name: "iframe"
      code: (task) =>
        if document.baseURI and window.PDFView?
          # XXX: Hack around PDF.js resource: origin. Bug in jschannel?
          hostOrigin = '*'
        else
          hostOrigin = window.location.origin
          # XXX: Hack for missing window.location.origin in FF
          hostOrigin ?= window.location.protocol + "//" + window.location.host

        @frame = $('<iframe></iframe>')
        .css(display: 'none')
        .attr('src', "#{@app}#/?xdm=#{encodeURIComponent(hostOrigin)}")
        .appendTo(@wrapper)
        .addClass('annotator-frame annotator-outer annotator-collapsed')
        .bind 'load', =>
          task.ready()      

    @init.createSubTask
      name: "set time in SideBar"
      deps: ["panel channel"] # We need the channel to talk to sidebar
      code: (task) =>    
        @panel.notify method: 'setLoggerStartTime', params: window.XLoggerStartTime
        task.ready()
        
    @init.createSubTask
      name: "load bridge plugin"
      deps: ["iframe"]  # We need this to configure the plugin
      code: (task) =>
        # Set up the bridge plugin, which bridges the main annotation methods
        # between the host page and the panel widget.
        whitelist = ['diffHTML', 'quote', 'ranges', 'target', 'id']
        this.addPlugin 'Bridge',
          origin: '*'
          window: @frame[0].contentWindow
          formatter: (annotation) =>
            formatted = {}
            for k, v of annotation when k in whitelist
              formatted[k] = v
            formatted
          parser: (annotation) =>
            parsed = {}
            for k, v of annotation when k in whitelist
              parsed[k] = v
            parsed
        task.ready()

    @init.createSubTask
      name: "api channel"
      deps: ["iframe"] # We need this to build the channel
      code: (task) =>
        # Build a channel for the publish API
        @api = Channel.build
          origin: '*'
          scope: 'annotator:api'
          window: @frame[0].contentWindow
          onReady: =>
            task.ready()

    @init.createSubTask
      name: "panel channel"
      deps: ["iframe"] # We need this to build the channel
      code: (task) =>
        # Build a channel for the panel UI
        @panel = Channel.build
          origin: '*'
          scope: 'annotator:panel'
          window: @frame[0].contentWindow
          onReady: =>
                
            @frame.css('display', '')

            @panel

            .bind('onEditorHide', this.onEditorHide)
            .bind('onEditorSubmit', this.onEditorSubmit)

            .bind('showFrame', =>
              @frame.css 'margin-left': "#{-1 * @frame.width()}px"
              @frame.removeClass 'annotator-no-transition'
              @frame.removeClass 'annotator-collapsed'
            )

            .bind('hideFrame', =>
              @frame.css 'margin-left': ''
              @frame.removeClass 'annotator-no-transition'
              @frame.addClass 'annotator-collapsed'
            )

            .bind('dragFrame', (ctx, screenX) =>
              if screenX > 0
                if @drag.last?
                  @drag.delta += screenX - @drag.last
                @drag.last = screenX
              unless @drag.tick
                @drag.tick = true
                window.requestAnimationFrame this._dragRefresh
            )

            .bind('getHighlights', =>
              highlights: $(@wrapper).find('.annotator-hl')
              .filter ->
                this.offsetWidth > 0 || this.offsetHeight > 0
              .map ->
                offset: $(this).offset()
                height: $(this).outerHeight(true)
                data: $(this).data('annotation').$$tag
              .get()
              offset: $(window).scrollTop()
            )

            .bind('setActiveHighlights', (ctx, tags=[]) =>
              @wrapper.find('.annotator-hl')
              .each ->
                if $(this).data('annotation').$$tag in tags
                  $(this).addClass('annotator-hl-active')
                else if not $(this).hasClass('annotator-hl-temporary')
                  $(this).removeClass('annotator-hl-active')
            )

            .bind('getHref', => this.getHref())

            .bind('getMaxBottom', =>
              sel = '*' + (":not(.annotator-#{x})" for x in [
                'adder', 'outer', 'notice', 'filter', 'frame'
              ]).join('')

              # use the maximum bottom position in the page
              all = for el in $(document.body).find(sel)
                p = $(el).css('position')
                t = $(el).offset().top
                z = $(el).css('z-index')
                if (y = /\d+/.exec($(el).css('top'))?[0])
                  t = Math.min(Number y, t)
                if (p == 'absolute' or p == 'fixed') and t == 0 and z != 'auto'
                  bottom = $(el).outerHeight(false)
                  # but don't go larger than 80, because this isn't bulletproof
                  if bottom > 80 then 0 else bottom
                else
                  0
              Math.max.apply(Math, all)
            )

            .bind('scrollTop', (ctx, y) =>
              $('html, body').stop().animate {scrollTop: y}, 600
            )

            .bind('setDrag', (ctx, drag) =>
              @drag.enabled = drag
              @drag.last = null
            )

            task.ready()

    # Create a task for scanning the doc
    info =
      instanceName: "Initial scan"
      # Scanning requires a configured wrapper
      deps: ["wrapper", "iframe"]
    scan = @_scanGen.create info, false
    @init.addSubTask weight: 50, task: scan

    # We are sending info about the status of the init task to the sidebar
    @init.progress (info) =>
      @panel?.notify method: 'initProgress', params: info

    @init.done =>
      @panel?.notify method: 'initDone'

  _setupWrapper: ->
    @wrapper = @element
    .on 'mouseup', =>
      if not @ignoreMouseup
        setTimeout =>
          unless @selectedRanges?.length then @panel?.notify method: 'back'
    @domMatcher.setRootNode @wrapper[0]
    this

  _setupDocumentEvents: ->
    tick = false
    timeout = null
    touch = false
    update = =>
      if touch
        # Defer updates on mobile until after touch events are over
        if timeout then cancelTimeout timeout
        timeout = setTimeout =>
          timeout = null
          do updateFrame
        , 400
      else
        do updateFrame
    updateFrame = =>
      unless tick
        tick = true
        requestAnimationFrame =>
          tick = false
          if touch
            # CSS "position: fixed" is hell of broken on most mobile devices
            @frame?.css
              display: ''
              height: $(window).height()
              position: 'absolute'
              top: $(window).scrollTop()
          @panel?.notify method: 'publish', params: 'hostUpdated'

    document.addEventListener 'touchmove', update
    document.addEventListener 'touchstart', =>
      touch = true
      @frame?.css
        display: 'none'
      do update

    document.addEventListener 'dragover', (event) =>
      unless @drag.enabled then return
      if @drag.last?
        @drag.delta += event.screenX - @drag.last
      @drag.last = event.screenX
      unless @drag.tick
        @drag.tick = true
        window.requestAnimationFrame this._dragRefresh

    $(window).on 'resize scroll', update
    $(document.body).on 'resize scroll', '*', update

    if window.PDFView?
      # XXX: PDF.js hack
      $(PDFView.container).on 'scroll', update

    super

  # These methods aren't used in the iframe-hosted configuration of Annotator.
  _setupViewer: -> this
  _setupEditor: -> this

  _dragRefresh: =>
    d = @drag.delta
    @drag.delta = 0
    @drag.tick = false

    m = parseInt (getComputedStyle @frame[0]).marginLeft
    w = -1 * m
    m += d
    w -= d

    @frame.addClass 'annotator-no-transition'
    @frame.css
      'margin-left': "#{m}px"
      width: "#{w}px"

  showViewer: (annotation) => @plugins.Bridge.showViewer annotation
  showEditor: (annotation) => @plugins.Bridge.showEditor annotation

  checkForStartSelection: (event) =>
    # Override to prevent Annotator choking when this ties to access the
    # viewer but preserve the manipulation of the attribute `mouseIsDown` which
    # is needed for preventing the panel from closing while annotating.
    unless event and this.isAnnotator(event.target)
      @mouseIsDown = true

  addToken: (token) =>
    @api.notify
      method: 'addToken'
      params: token
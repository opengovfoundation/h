# Rudementary logging stuff for the client side.

class DebugLogger
  constructor: (name) ->
    @name = name
#    @log "Created logger"

  currentTimestamp: -> new Date().getTime()

  elapsedTime: -> @currentTimestamp() - window.loggerStartTime

  time: -> "[" + @elapsedTime() + " ms]"

  log: (message) -> console.log @time() + " '" + @name + "': " + message

  info: (message) -> this.log message

window.loggerStartTime = new Date().getTime()

window.getLogger = (name) -> new DebugLogger(name)

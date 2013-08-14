var ACTION_STATES = {
  active: {
    icons: {
      19: "images/active_19.png",
      38: "images/active_38.png"
    },
    title: "Disable annotation"
  },
  sleeping: {
    icons: {
      19: "images/sleeping_19.png",
      38: "images/sleeping_38.png"
    },
    title: "Enable annotation"
  }
}

var TAB_STATE = 'state'


function inject(tab) {
  chrome.tabs.executeScript(null, {
    file: 'public/js/embed.js'
  })
}


function state(tabId, value) {
  var stateMap = localStorage.getItem(TAB_STATE)
  stateMap = stateMap ? JSON.parse(stateMap) : {}

  if (value === undefined) {
    return stateMap[tabId]
  }

  if (value) {
    stateMap[tabId] = value
  } else {
    delete stateMap[tabId]
  }

  localStorage.setItem(TAB_STATE, JSON.stringify(stateMap))

  return value
}


function setPageAction(tabId, value) {
  chrome.pageAction.setIcon({
    tabId: tabId,
    path: ACTION_STATES[value].icons
  })
  chrome.pageAction.setTitle({
    tabId: tabId,
    title: ACTION_STATES[value].title
  })
  chrome.pageAction.show(tabId)
}


function onInstalled() {
  /* Make sure to enable localStorage and cookie storage for the extension.
   * If the user has configured Chrome to block 3rd-party cookies and storage
   * then the extension cannot function without this exception.
   *
   * Note that it'd be better if 'chrome-extension' scheme could be specified
   * but the contentSettings API rejects these as invalid. Since the extension
   * ID is a long, unique string with no TLD it should be safe to use a
   * wildcard scheme. The only possible conflict would be if the user has used
   * this ID somehow in a hosts file hack.
   */
  debugger
  var details = {
    primaryPattern: '*://' + chrome.runtime.id + '/*',
    setting: 'allow'
  }

  chrome.contentSettings.cookies.set(details)
  chrome.contentSettings.images.set(details)
  chrome.contentSettings.javascript.set(details)

  /* Enable the page action on all tabs. */
  chrome.tabs.query({}, function (tabs) {
    for (var i in tabs) {
      var tabId = tabs[i].id
        , tabState = state(tabId) || 'sleeping'
      setPageAction(tabId, tabState)
    }
  })
}


function onPageAction(tab) {
  var newState

  if (state(tab.id) == 'active') {
    newState = state(tab.id, 'sleeping')
  } else {
    newState = state(tab.id, 'active')
    if (tab.status == 'complete') {
      inject(tab.id)
    }
  }

  setPageAction(tab.id, newState)
}


function onTabCreated(tab) {
  state(tab.id, 'sleeping')
}


function onTabRemoved(tab) {
  state(tab.id, null)
}


function onTabUpdated(tabId, info) {
  var currentState = state(tabId) || 'sleeping'

  setPageAction(tabId, currentState)

  if (currentState == 'active' && info.status == 'complete') {
    inject(tabId)
  }
}

chrome.runtime.onInstalled.addListener(onInstalled)
chrome.pageAction.onClicked.addListener(onPageAction)
chrome.tabs.onCreated.addListener(onTabCreated)
chrome.tabs.onRemoved.addListener(onTabRemoved)
chrome.tabs.onUpdated.addListener(onTabUpdated)

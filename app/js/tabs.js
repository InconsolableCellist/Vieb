/*
* Vieb - Vim Inspired Electron Browser
* Copyright (C) 2019 Jelmer van Arnhem
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
/* global MODES FOLLOW SETTINGS */
"use strict"

const init = () => {
    addTab()
    //TODO maybe add a keep tabs option here
    //Although this could be a setting, it also requires history management
}

const listTabs = () => {
    return [...document.querySelectorAll("#tabs > span")]
}

const listPages = () => {
    return [...document.querySelectorAll("#pages > webview")]
}

const currentTab = () => {
    return document.getElementById("current-tab")
}

const currentPage = () => {
    let currentPage = null
    listPages().forEach(page => {
        if (page.style.display === "flex") {
            currentPage = page
        }
    })
    return currentPage
}

const addTab = (url=null) => {
    const tabs = document.getElementById("tabs")
    const pages = document.getElementById("pages")
    const tab = document.createElement("span")
    const favicon = document.createElement("img")
    const title = document.createElement("span")
    favicon.src = "img/newtab.png"
    title.textContent = "New tab"
    tab.appendChild(favicon)
    tab.appendChild(title)
    tabs.appendChild(tab)
    const webview = document.createElement("webview")
    if (url !== null) {
        webview.src = url
    }
    webview.setAttribute("preload", "./js/preload.js")
    addWebviewListeners(webview)
    pages.appendChild(webview)
    switchToTab(listTabs().length - 1)
}

const closeTab = () => {
    const oldTabIndex = listTabs().indexOf(currentTab())
    document.getElementById("tabs").removeChild(currentTab())
    document.getElementById("pages").removeChild(currentPage())
    if (listTabs().length === 0) {
        addTab()
    }
    if (oldTabIndex === 0) {
        switchToTab(0)
    } else {
        switchToTab(oldTabIndex - 1)
    }
}

const switchToTab = index => {
    if (index < 0) {
        return
    }
    const tabs = listTabs()
    if (tabs.length <= index) {
        return
    }
    tabs.forEach(tab => {
        tab.id = ""
    })
    const pages = listPages()
    pages.forEach(page => {
        page.style.display = "none"
    })
    tabs[index].id = "current-tab"
    pages[index].style.display = "flex"
    updateUrl(currentPage())
}

const updateUrl = webview => {
    const skip = ["command", "search", "nav"]
    if (webview !== currentPage() || skip.indexOf(MODES.currentMode()) !== -1) {
        return
    }
    if (currentPage().src !== undefined) {
        document.getElementById("url").value = currentPage().src
    } else {
        document.getElementById("url").value = ""
    }
}

const addWebviewListeners = webview => {
    webview.addEventListener("did-start-loading", () => {
        const tab = listTabs()[listPages().indexOf(webview)]
        tab.querySelector("img").src = "img/spinner.gif"
        updateUrl(webview)
        webview.getWebContents().removeAllListeners("login")
        webview.getWebContents()
            .on("login", (e, request, auth, callback)  => {
                e.preventDefault()
                //TODO ask nicely for username and password here
                //console.log(e, request, auth, callback)
                callback("username", "password")
            })
    })
    webview.addEventListener("did-fail-load", e => {
        //It will go to the http version of a website when no https is detected
        const redirect = SETTINGS.get().redirectToHttp
        const sslErrors = [
            "ERR_CERT_COMMON_NAME_INVALID",
            "ERR_SSL_PROTOCOL_ERROR"
        ]
        if (sslErrors.indexOf(e.errorDescription) !== -1 && redirect) {
            webview.src = webview.src.replace("https://", "http://")
            return
        }
        const tab = listTabs()[listPages().indexOf(webview)]
        tab.querySelector("img").src = "img/error.png"
        tab.querySelector("span").textContent = e.errorDescription
        //TODO maybe also show a notification for it
    })
    webview.addEventListener("did-stop-loading", () => {
        const tab = listTabs()[listPages().indexOf(webview)]
        if (tab.querySelector("img").src.endsWith("img/spinner.gif")) {
            if (tab.querySelector("img").src.startsWith("file://")) {
                tab.querySelector("img").src = "img/nofavicon.png"
            }
        }
        if (tab.querySelector("span").textContent === "Loading...") {
            tab.querySelector("span").textContent = ""
        }
    })
    webview.addEventListener("page-title-updated", e => {
        const tab = listTabs()[listPages().indexOf(webview)]
        tab.querySelector("span").textContent = e.title
        updateUrl(webview)
    })
    webview.addEventListener("page-favicon-updated", e => {
        const tab = listTabs()[listPages().indexOf(webview)]
        if (e.favicons.length > 0) {
            tab.querySelector("img").src = e.favicons[0]
        } else {
            tab.querySelector("img").src = "img/nofavicon.png"
        }
        updateUrl(webview)
    })
    webview.addEventListener("new-window", e => {
        navigateTo(e.url)
    })
    webview.addEventListener("found-in-page", e => {
        if (e.result.matches === 0) {
            //TODO no matches found, inform using notifications
        }
    })
    webview.addEventListener("ipc-message", e => {
        if (e.channel === "follow-response") {
            FOLLOW.parseAndDisplayLinks(e.args[0])
        }
    })
    webview.onblur = () => {
        if (MODES.currentMode() === "insert") {
            webview.focus()
        }
    }
}

const navigateTo = location => {
    currentPage().src = location
    currentTab().querySelector("span").textContent = "Loading..."
}

module.exports = {
    init,
    listTabs,
    listPages,
    currentTab,
    currentPage,
    addTab,
    closeTab,
    switchToTab,
    updateUrl,
    navigateTo
}

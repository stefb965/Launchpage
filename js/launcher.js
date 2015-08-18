/*******************************************************************************
 * Initialize variables, classes, & prototypes
 ******************************************************************************/
var apps = []; // Array of all apps
var launcher = document.getElementById("launcher"); // The launcher element
var icons = document.createElement("div"); // Holds icons in the launcher
var isBackgroundPage = false;
var appName = (navigator.userAgent.indexOf("Chromium") == -1) ?
        "Chrome" : "Chromium"; // Detect whether we are on Chrome or Chromium
chrome.extension.getBackgroundPage().isBackgroundPage = true; // Figure out if this is the background page
icons.id = "icons";

/* From http:// goo.gl/ebxrk */
Array.prototype.move = function (old_index, new_index) {
    if (new_index >= this.length) {
        var k = new_index - this.length;
        while ((k--) + 1) {
            this.push(undefined);
        }
    }
    this.splice(new_index, 0, this.splice(old_index, 1)[0]);
};

var launchpageInfo; // Will eventually contain the info about the extension

// Enum of the Chrome addon types, plus a couple custom ones
var appTypes = {
    extension: "extension",
    hostedApp: "hosted_app",
    packagedApp: "packaged_app",
    legacyPackagedApp: "legacy_packaged_app",
    theme: "theme",
    webClip: "web_clip",
    stockApp: "stock_app"
};

/**
 * Constructs an Icon element.
 *
 * @param id
 *        The addon ID of the app
 * @param name
 *        The name of the app
 * @param url
 *        The URL that the icon opens
 *
 * @return
 *        A newly constructed HTML object that contains the app icon
 */
function Icon(id, name, url) {
    var col = $("<div class='icon-col col-xs-4 col-sm-3 col-md-2'></div>");
    var app = $("<a class='icon' role='link'></a>")
            .attr("href", url)
            .attr("aria-labelledby", id + "-label")
            .attr("aria-grabbed", "false")
            .attr("id", id);
    var img = $("<img>")
            .attr("src", getAppIcon(id, 128))
            .attr("draggable", "false");
    var label = $("<span></span>")
            .attr("id", id + "-label")
            .attr("draggable", "false")
            .text(name);

    $(app)
            .append(img)
            .append(label)
            .on("dragstart", function(){
                dragStartIcon(this);
            }).on("dragend", function(){
                dragEndIcon(this);
            }).on("dragover", function() {
                dragOverIcon(this);
            }).on("dragenter", function(){
                dragEnterIcon(this);
            }).on("dragleave", function(){
                dragLeaveIcon(this);
            }).on("drop", function(){
                dropIcon(this);
            });

    $(col).append(app);
    return app[0];
}

/**
 * Constructs an App object.
 *
 * @param id
 *        The addon ID of the app
 * @param name
 *        The name of the app
 * @param url
 *        The URL that the icon opens
 *
 * @return
 *        A newly constructed App object
 */
function App(id, name, url) {
    return {
        appLaunchUrl: url,
        description: "",
        enabled: true,
        homepageUrl: "https:// chrome.google.com/webstore/detail/" + id,
        hostPermissions: [],
        icons: [{
            size: 128,
            url: ""
        }],
        id: id,
        type: appTypes.webClip,
        mayDisable: true,
        name: name,
        offlineEnabled: false,
        optionsUrl: "",
        permissions: [],
        version: "1.0"
    };
}

/*******************************************************************************
 * Extension functions
 ******************************************************************************/

/**
 * Filters a list of all installed addons to only those that will be shown.
 *
 * @param addons
 *        The list of all installed addons
 *
 * @return
 *        A list of addons to be displayed: enabled apps, the stock icons,
 *        and web clips.
 */
function getApps(addons) {
    for (var i in addons) {
        if (addons[i].type == appTypes.hostedApp ||
                addons[i].type == appTypes.packagedApp ||
                addons[i].type == appTypes.legacyPackagedApp) {
            apps.push(addons[i]);
        } else if (addons[i].id == chrome.runtime.id) {
            launchpageInfo = addons[i];
        }
    }
        
    var chromePrefs = new App("chrome-prefs",
            chrome.i18n.getMessage("iconSettings"), "chrome://settings");
    chromePrefs.description =
            chrome.i18n.getMessage("iconSettingsDescription", appName);
    chromePrefs.homepageUrl = "";
    chromePrefs.icons[0].url = chrome.runtime.getURL("../icons/wrench.png");
    chromePrefs.type = appTypes.stockApp;
    chromePrefs.mayDisable = false;
    chromePrefs.offlineEnabled = true;
    chromePrefs.updateUrl = "";
    chromePrefs.version =
            navigator.appVersion.substring(navigator.appVersion.indexOf("Chrome/") +
                    7, navigator.appVersion.indexOf(" ",
                            navigator.appVersion.indexOf("Chrome/")));
    var webStore = new App("web-store",
            chrome.i18n.getMessage("iconWebStore"),
            "https:// chrome.google.com/webstore?utm_source=launchpage");
    webStore.description = chrome.i18n.getMessage("iconWebStoreDescription");
    chromePrefs.homepageUrl = "https:// chrome.google.com/webstore";
    webStore.icons[0].url = chrome.runtime.getURL("../icons/webstore.png");
    webStore.type = appTypes.stockApp;
    webStore.mayDisable = false;
    webStore.offlineEnabled = false;
    webStore.updateUrl = "";
    webStore.version = "";
    
    apps.push(chromePrefs, webStore);
    
    // Get the webclips
    if (localStorage["apps"]) {
        storedApps = JSON.parse(localStorage["apps"]);
        for (var i = 0; i < storedApps.length; i++) {
            if (storedApps[i].type == appTypes.webClip) {
                apps.push(storedApps[i]);
            }
        }
    }
}

/**
 * Looks for new apps and appends them to the array.
 */
function checkNewApps() {
    if (!localStorage["apps"]) {
        localStorage["apps"] = JSON.stringify(apps);
    } else {
        for (var i = 0; i < storedApps.length; i++) { // Look through saved apps
            if (!apps[i] || storedApps[i].id != apps[i].id) { // If an app is misplaced
                for (var j = 0; j < apps.length; j++) { // Find where it should be
                    if (apps[j] && storedApps[i].id == apps[j].id) {
                        break;
                    }
                }
                apps.move(j, i);
            }
        }
        for (var i = 0; i < apps.length; i++) {
            if (!apps[i]) {
                apps.splice(i, 1);
            }
        }
    }
    localStorage["apps"] = JSON.stringify(apps);
}

/**
 * Emtpies and repopulates the launcher.
 */
function drawIcons() {
    icons.innerHTML = ""; // Clear out the icons
    for (var i = 0; i < apps.length; i++) {
        if (apps[i].enabled) { // If the app is enabled
            appendIcon(apps[i]);
        }
    }
}

/**
 * Appends an icon representing the App to the launcher.
 *
 * @param appObject
 *        The object representing the App's configuration
 *
 * @return
 *        True if the icon was appended successfully
 */
function appendIcon(appObject) {
    // Prefer short name, but use long name if short name is not specified
    var name = appObject.shortName;
    if (!name) {
        name = appObject.name;
    }
    var app = new Icon(appObject.id, name, appObject.appLaunchUrl);

    if (!appObject.offlineEnabled) {
        $(app).addClass("not-offline-enabled");
    }
    /*
    app.addEventListener("click", function(){
            event.preventDefault();
            chrome.management.launchApp(appObject.id);
            window.close();
            /*
            chrome.tabs.create({
                    "url": appObject.appLaunchUrl,
                    // "pinned": appObject.pinned
                    }, appLoaded);*/
        // }, false);
    if (appObject.appLaunchUrl.substring(0, 17) == "chrome:// settings") {
        app.addEventListener("click", function() {
            chrome.tabs.update({url: "chrome:// settings"});
        }, false);
    } else if (appObject.type == appTypes.packagedApp ||
                appObject.type == appTypes.legacyPackagedApp) {
        app.addEventListener("click", function(){
                event.preventDefault();
                chrome.management.launchApp(appObject.id);
                chrome.tabs.getCurrent(function(tab) {
                    chrome.tabs.remove(tab.id);
                });
            }, false);
    } else {
        // Web clip or hosted app
        app.addEventListener("click", function() {
            event.preventDefault();
            chrome.tabs.update({
                    url: appObject.appLaunchUrl,
                });
        }, false);
    }
    icons.appendChild(app.parentNode);
    return true;
}

/**
 * Returns the App object that matches the supplied ID.
 *
 * @param id
 *        The ID to look up
 *
 * @return
 *        An App object matching the ID, or null if the ID is wrong or the
 *        app doesn't exist.
 */
function getAppById(id) {
    if (!id || typeof id != "string") return null;
    
    for (var node in apps) {
        if (apps[node].id == id) {
            return apps[node];
        }
    }
    return null;
}

/**
 * Returns the index of the App that matches the supplied ID.
 *
 * @param id
 *        The ID to look up
 *
 * @return
 *        The index of the App object matching the ID, or null if the ID is
 *        wrong or the app doesn't exist.
 */
function getAppIndexById(id) {
    if (!id || typeof id != "string") return null;
    
    for (var node = 0; node < apps.length; node++) {
        if (apps[node].id == id) {
            return node;
        }
    }
    return null;
}

/**
 * Returns the icon for a given app.
 *
 * @param id
 *        The ID of the app
 * @param size
 *        The dimension of the icon to find (e.g. 128)
 *
 * @return
 *        The URL of the icon, or null if the argument is wrong, or undefined
 *        if the app doesn't exist or no suitable icon is found.
 */
function getAppIcon(id, size) {
    if (!id || typeof id != "string") return null;
    if (!size) size = 128;
    else if (typeof size != "number") return null;
    
    var app = getAppById(id);
    for (var i in app.icons) {
        if (app.icons[i].size == size) {
            return app.icons[i].url;
        }
    }
    return undefined;
}

/**
 * Handles the dragStart event on an icon.
 */
function dragStartIcon(dragSource) {
    var dragIcon = $("<img>").attr("src", getAppIcon(dragSource.id))[0];
    var width = dragIcon.width/2, height = dragIcon.height/2;
    if (!width) width = 64;
    if (!height) height = 64;
    // dragIcon.width = 128;
    // dragIcon.height = 128;
    event.dataTransfer.setDragImage(dragIcon, width, height);
    event.dataTransfer.effectsAllowed = "move";
    event.dataTransfer.setData("text/uri-list", dragSource.href);
    event.dataTransfer.setData("text/plain", dragSource.id);

    $(dragSource).css("opacity", "0.25")
            .attr("aria-grabbed", "true");
    $(".icons").attr("aria-dropeffect", "move"); // Mark all icons targets
}

/**
 * Handles the dragEnd event on an icon.
 */
function dragEndIcon(dragSource) {
    $(dragSource).css("opacity", "1")
            .attr("aria-grabbed", "false");
}

/**
 * Handles the dragOver event on an icon.
 */
function dragOverIcon(dropTarget) {
    event.preventDefault();
}

/**
 * Handles the dragEnter event on an icon.
 */
function dragEnterIcon(dropTarget) {
    $(dropTarget).toggleClass("hover");
}

/**
 * Handles the dragLeave event on an icon.
 */
function dragLeaveIcon(dropTarget) {
    $(dropTarget).toggleClass("hover");
}

/**
 * Handles the drop event on an icon.
 */
function dropIcon(dropTarget) {
// Handle icon drop reordering
    event.preventDefault();
    var oldPosition = getAppIndexById(event.dataTransfer.getData("text/plain"));
    var newPosition = getAppIndexById(dropTarget.id);

    apps.move(oldPosition, newPosition);
    drawIcons();
    localStorage["apps"] = JSON.stringify(apps);
    $(".icons").attr("aria-dropeffect", "none"); // Mark no icons targets
}

/**
 * Draws a context menu based on a target type.
 *
 * @return
 *        True if the context menu was drawn, otherwise false.
 */
function drawContextMenu(event) {
    event.preventDefault();
    
    destroyContextMenu();
    
    /*************************************
     * Determine the target element's type
     *************************************/
    var node = event.target;
    if ($(".context-menu")) {
        // A context menu exists
        if ($(node).parents(".popover").length > 0) {
            // The target is the context menu itself
            return false;
        }
    }

    while (!node.className && node != document) {
        // Climb up the DOM tree until the node has a class or the node is the root
        node = node.parentNode;
    }

    if ($(node).is(".modal") || $(node).is(".btn")) {
        return false;
    }

    var contextMenu = $("<menu type='context' role='menu' class='dropdown-menu context-menu' id='context-menu'></menu>");
    var contextMenuContainer = $("<div></div>").append(contextMenu);
    
    /****************
     * Build the menu
     ****************/
    if ($(node).is(".icon")) {
        var iconLi = $("<li role='menuitem'></li>");
        var iconA = $("<a href='#'></a>").text(node.innerText);

        iconA.on("click", function() {
            console.log(node);
            node.click();
            $(node).popover("destroy");
        });

        iconLi.append(iconA);
        contextMenu.append(iconLi);

        var app = getAppById(node.id);

        if (app.type == appTypes.hostedApp ||
                app.type == appTypes.packagedApp ||
                app.type == appTypes.legacyPackagedApp) {
            contextMenu.append("<li role='presentation' class='divider'></li>");
            if (app.optionsUrl) {
                // The app has an options page
                var optionsLi = $("<li role='menuitem'></li>");
                var optionsA = $("<a></a>")
                    .attr("href", app.optionsUrl)
                    .text(chrome.i18n.getMessage("options"));

                optionsLi.append(optionsA);
                contextMenu.append(optionsLi);
            }

            if (app.mayDisable) {
                var removeLi = $("<li role='menuitem'></li>");
                var removeA = $("<a href='#'></a>")
                    .text(chrome.i18n.getMessage("remove", appName))
                    .on("click", function() {
                        prompt(
                                chrome.i18n.getMessage("uninstallPageTitle", app.name),
                                undefined,
                                function() {
                                    chrome.management.uninstall(
                                            app.id,
                                            {
                                                showConfirmDialog: false
                                            },
                                            window.location.reload());
                                },
                                chrome.i18n.getMessage("buttonUninstall"),
                                node.childNodes[0].src);
                        $(node).popover("destroy");
                    });

                removeLi.append(removeA);
                contextMenu.append(removeLi);
            }
        } else if (app.type == appTypes.webClip) {
            contextMenu.append("<li role='presentation' class='divider'></li>");

            if (app.mayDisable) {
                var removeLi = $("<li role='menuitem'></li>");
                var removeA = $("<a href='#'></a>")
                    .text(chrome.i18n.getMessage("removeWebClip", appName))
                    .on("click", function() {
                        prompt(
                                chrome.i18n.getMessage("removePageTitle", app.name),
                                undefined,
                                function() {
                                    var index = getAppIndexById(app.id);
                                    apps.splice(index, 1);
                                    localStorage["apps"] = JSON.stringify(apps);
                                    window.location.reload();
                                },
                                chrome.i18n.getMessage("buttonRemove"),
                                node.childNodes[0].src);
                        $(node).popover("destroy");
                    });

                removeLi.append(removeA);
                contextMenu.append(removeLi);
            }
        }

        $(node).popover({
            animation: false,
            placement: "bottom",
            trigger: "manual",
            html: true,
            content: function() {
                return contextMenu;
            }
        });

        $(node).popover("show");

        return true;
    } else {
        return false;
    }
}

/**
 * Destroys all visible context menus.
 */
function destroyContextMenu() {
    //  Only destroy the popover if it wasn't triggered by an event or if the
    //  event target was not a context menu
    if(!event ||
            $(event.target).parents(".popover-content").length == 0) {
        $(".icon").popover("destroy");
    }
}

/**
 * Displays a modal prompt.
 *
 * @param titleText
 *        The text to display in the title of the modal
 * @param text
 *        The text to display in the body of the modal
 * @param buttonAction
 *        The action to perform when the primary button is clicked
 * @param buttonLabel
 *        The text to display in the primary button
 * @param iconUrl
 *        The URL of an icon to display. If undefined, the icon is hidden.
 */
function prompt(titleText, text, buttonAction, buttonLabel, iconUrl) {
    destroyContextMenu();

    $("#modal-title").text(titleText);
    if (text != undefined) {
        $("#modal-text").text(text).show();
    } else {
        $("#modal-text").hide();
    }
    $("#modal-cancel").text(chrome.i18n.getMessage("buttonCancel"));
    $("#modal-button").text(buttonLabel)
            .off("click")
            .one("click", buttonAction);
    if (iconUrl) {
        $("#modal-icon").attr("src", iconUrl).show();
    } else {
        $("#modal-icon").hide();
    }
    $("#modal").modal("show");
}

/**
 * Makes offline apps stand out by making other apps transparent.
 */
function offLine() {
    //  var icons = $(".icon");
    //  for (var i = 0; i < apps.length; i++) {
    //    if (!apps[i].offlineEnabled && apps[i].enabled) {
    //      // The app is not offline-enabled
    //      $(icons[i]).css("opacity", "0.3");
    //    }
    //  }
    $("#launcher").addClass("offline");
}

/**
 * Resets icon opacity to normal after an offLine event.
 */
function onLine() {
    $("#launcher").removeClass("offline");
}

// Uses YIQ color space to get the lightness of an RGB color (0.0 to 1.0)
/**
 * Gets the perceived lightness of an RGB color.
 *
 * @param rgb
 *        An array of [r, g, b] values from 0-255
 *
 * @return
 *        A value from 0.0 to 1.0 describing the perceived lightness.
 *        White is defined to be 1.0, and black is defined to be 0.0.
 */
function getLightness(rgb){
    var r = rgb[0], g = rgb[1], b = rgb[2];
    return (r*299 + g*587 + b*114)/1000/255;
}

/**
 * Injects the content script into the specified tab.
 *
 * @param tabId
 *        The ID of the tab to inject
 * @param changeInfo
 *        An object representing the information about the tab's change event
 * @param tab
 *        An object representing information about the tab
 */
function injectContentScript(tabId, changeInfo, tab) {
    if (changeInfo.status == "complete" && tab.url.substring(0,4) == "http") {
        chrome.tabs.executeScript(tabId, {file: "chrome-webstore-item_finder.js"});
    }
}

/**
 * Adds a web clip to the launcher.
 *
 * @param details
 *        An object containing the ID, title, URL, and icon of the web clip.
 */
function addToHomeScreen(details) {
    // Builds an App object, then adds it to the list of apps. Used for web clips.
    if (isBackgroundPage) {
    // Only add it if it's the background page. Otherwise, if Launchpage is open
    // somewhere else, it would fire multiple times.
        var app = new App(details.id, details.title, details.url);
        app.homepageUrl = details.url;
        app.icons[0].url = details.icon;
        app.updateUrl = "";
        app.type = appTypes.webClip;
        // FIXME? The background page doesn't get updates when apps/webclips are
        // removed. It only loads the app list on startup. Therefore, we need to
        // refresh its copy of the apps variable from localStorage (which is updated).
        apps = JSON.parse(localStorage["apps"]);
        apps.push(app);
        localStorage["apps"] = JSON.stringify(apps);
        chrome.tabs.create({});
    }
}

/*******************************************************************************
 * Event listeners
 ******************************************************************************/

// Inject the content script to look for chrome-webstore-item
// Disabled because the infobar API is still experimental
// chrome.tabs.onUpdated.addListener(injectContentScript);

// Draw Launchpage context menu instead of the browser's
document.addEventListener("contextmenu", drawContextMenu, false);

// Destroy the context menu when the user clicks anywhere outside of the menu
document.addEventListener("mousedown", destroyContextMenu, false);

window.addEventListener("load", function(e) {
    // Append icons to the launcher
    launcher.appendChild(icons);

    window.setTimeout(function() {
            console.log("Page load time:", 
                    performance.timing.loadEventEnd - performance.timing.navigationStart,
                    "ms");
        }, 100);
}, false);

chrome.extension.onMessage.addListener(function (msg, sender) {
    if (msg.to == "launcher.js" && msg.from == "add.js") {
    // it's being sent to the background page from the page action
        addToHomeScreen(msg.message); // Add the icon to the home screen
    } else if (msg.to == "launcher.js" &&
            msg.from == "chrome-webstore-item_finder.js") {
    // Sent from the webstore content script to the background page
        // First, check if the infobar has already been disabled for this page
        console.log("infobar.hide." + msg.message.url);
        console.log(localStorage["infobar.hide." + msg.message.url]);
        if (localStorage["infobar.hide." + msg.message.url] != "true") {
            // Show the infobar
            chrome.experimental.infobars.show({
                path: "chrome-webstore-item.html#" + escape(msg.message.url) +
                        "&" + escape(msg.message.host),
                tabId: sender.tab.id
            });
        }
    }
});

// Make the icons fade when connectivity is lost
window.addEventListener("offline", offLine, false);
window.addEventListener("online", onLine, false);

/*******************************************************************************
 * Post scripts
 ******************************************************************************/

// Request addons list from chrome - includes apps, extensions, & themes (these
// will be filtered out in getApps()
chrome.management.getAll(function(addons) {
    getApps(addons);
    checkNewApps();
    drawIcons();
    if (!navigator.onLine) offLine();
});

// Set the background
if (localStorage["background"] == "bg-custom") {
    document.body.style.backgroundImage =
        "url(" + localStorage["background-image-url"] + ")";
} else if (localStorage["background"] == "bg-color") {
    document.body.style.backgroundColor = localStorage["background-color"];
} else {
    document.body.style.backgroundImage =
            "-webkit-radial-gradient(center, ellipse cover, #ccc, #666)";
}

// Adjust the color palette based on the dominant color of the background
if (localStorage["background"] == "bg-custom") {
    var dominantColor = JSON.parse(localStorage["background-colors"])[0];

    if (getLightness(dominantColor) > 0.5) {
        $("body").addClass("light-bg");
        document.styleSheets[0].addRule(".icon > label", "color: #000");
        document.styleSheets[0].addRule(".icon > label",
                "text-shadow: #fff 0 0 10px, #fff 0 0 10px," +
                "#fff 0 0 10px, #fff 0 0 10px, #fff 0 0 10px");
        if (localStorage["chameleon"] == "true") {
            document.styleSheets[0].addRule("#context-menu li > a", "color: #000");
            document.styleSheets[0].addRule("#context-menu li.disabled",
                    "color: rgba(0, 0, 0, 0.25)");
            document.styleSheets[0].addRule(".divider",
                    "background-color: rgba(0, 0, 0, 0.1) !important");
        }
    } else if (localStorage["chameleon"] == "true") {
            document.styleSheets[0].addRule("#context-menu li > a", "color: #fff");
            document.styleSheets[0].addRule("#context-menu li.disabled",
                    "color: rgba(255, 255, 255, 0.25)");
            document.styleSheets[0].addRule(".divider",
                    "background-color: rgba(255, 255, 255, 0.1) !important");
    }

    if (localStorage["chameleon"] == "true") {
        var palette = JSON.parse(localStorage["background-colors"]);

        // Find a secondary color with enough contrast
        var dominantColor = palette[0];
        var secondaryColor;
        for (var i = palette.length - 1; i >= 0; i--) { 
            var difference = [0, 0, 0];
            for (var j = 0; j < 3; j++) {
                difference[j] = Math.abs(dominantColor[j] - palette[i][j]);
            }
            if (difference[0] > 50 || difference[1] > 50 || difference[2] > 50) {
                secondaryColor = palette[i];
            }
        }

        document.styleSheets[0].addRule(".icon:hover, .icon:focus, .icon.hover",
                "background: rgba(" + dominantColor[0] + ", " + dominantColor[1] + ", " + dominantColor[2] + ", 0.5)");
        document.styleSheets[0].addRule(".popover, #context-menu",
                "background: rgba(" + dominantColor[0] + ", " + dominantColor[1] + ", " + dominantColor[2] + ", 1.0)");
        document.styleSheets[0].addRule(".arrow:after",
                "border-bottom-color: rgba(" + dominantColor[0] + ", " + dominantColor[1] + ", " + dominantColor[2] + ", 1.0) !important");
        document.styleSheets[0].addRule("#context-menu li:not(.disabled):hover > a," +
                "#context-menu li:not(.disabled) > a:focus",
                "background:rgba(" + secondaryColor[0] + "," + secondaryColor[1] + "," + secondaryColor[2] + ", .75)");
        if (getLightness(secondaryColor) > 0.5) {
            document.styleSheets[0].addRule(
                    "#context-menu li:not(.disabled):hover > a," +
                    "#context-menu li:not(.disabled) > a:focus",
                    "color: #000");
        } else {
            document.styleSheets[0].addRule(
                    "#context-menu li:not(.disabled):hover > a," +
                    "#context-menu li:not(.disabled) > a:focus",
                    "color: #fff");
        }
    }
}

// Initiate settings
if (!localStorage["background"]) localStorage["background"] = "bg-default";
if (!localStorage["chameleon"]) localStorage["chameleon"] = "true";
if (!localStorage["page-action"]) localStorage["page-action"] = "true";

// Create a rule for when the page action should be displayed
var pageActionRule = {
    conditions: [
        new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {
                schemes: ["http", "https"]
            }
        })
    ],
    actions: [ new chrome.declarativeContent.ShowPageAction() ]
};

// Register the page action rule if the extension was just installed
chrome.runtime.onInstalled.addListener(function(details) {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
        chrome.declarativeContent.onPageChanged.addRules([pageActionRule]);
    });
});
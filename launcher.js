/*******************************************************************************
 * Initialize variables, classes, & prototypes
 ******************************************************************************/
var apps = []; //Array of all apps
var launcher = document.getElementById("launcher"); //The launcher element
var icons = document.createElement("div"); //Holds icons in the launcher
var isBackgroundPage = false;
var appName = (navigator.userAgent.indexOf("Chromium") == -1) ?
    "Chrome" : "Chromium"; //Detect whether we are on Chrome or Chromium
chrome.extension.getBackgroundPage().isBackgroundPage = true; //Figure out if this is the background page
icons.id = "icons";

/* From http://goo.gl/ebxrk */
Array.prototype.move = function (old_index, new_index) {
  if (new_index >= this.length) {
    var k = new_index - this.length;
    while ((k--) + 1) {
      this.push(undefined);
    }
  }
  this.splice(new_index, 0, this.splice(old_index, 1)[0]);
};

var launchpageInfo; //Will eventually contain the info about the extension

//Enum of the Chrome addon types, plus a couple custom ones
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
  var app = $("<a href='url' class='icon' role='link'></a>")
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
  // return col[0];
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
    homepageUrl: "https://chrome.google.com/webstore/detail/" + id,
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
    } else if (addons[i].id == chrome.i18n.getMessage("@@extension_id")) {
      launchpageInfo = addons[i];
    }
  }
    
  var chromePrefs = new App("chrome-prefs",
      chrome.i18n.getMessage("iconSettings"), "chrome://settings");
  chromePrefs.description =
      chrome.i18n.getMessage("iconSettingsDescription", appName);
  chromePrefs.homepageUrl = "";
  chromePrefs.icons[0].url = "icons/wrench.png";
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
      "https://chrome.google.com/webstore?utm_source=launchpage");
  webStore.description = chrome.i18n.getMessage("iconWebStoreDescription");
  chromePrefs.homepageUrl = "https://chrome.google.com/webstore";
  webStore.icons[0].url = "icons/webstore.png";
  webStore.type = appTypes.stockApp;
  webStore.mayDisable = false;
  webStore.offlineEnabled = false;
  webStore.updateUrl = "";
  webStore.version = "";
  
  apps.push(chromePrefs, webStore);
  
  //Get the webclips
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
    for (var i = 0; i < storedApps.length; i++) { //Look through saved apps
      if (!apps[i] || storedApps[i].id != apps[i].id) { //If an app is misplaced
        for (var j = 0; j < apps.length; j++) { //Find where it should be
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
  icons.innerHTML = ""; //Clear out the icons
  for (var i = 0; i < apps.length; i++) {
    if (apps[i].enabled) { //If the app is enabled
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
  //Prefer short name, but use long name if short name is not specified
  var name = appObject.shortName;
  if (!name) {
    name = appObject.name;
  }
  var app = new Icon(appObject.id, name, appObject.appLaunchUrl);
  /*
  app.addEventListener("click", function(){
      event.preventDefault();
      chrome.management.launchApp(appObject.id);
      window.close();
      /*
      chrome.tabs.create({
          "url": appObject.appLaunchUrl,
          //"pinned": appObject.pinned
          }, appLoaded);*/
    //}, false);
  if (appObject.appLaunchUrl.substring(0, 17) == "chrome://settings") {
    app.addEventListener("click", function() {
      chrome.tabs.update({url: "chrome://settings"});
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
    //Web clip or hosted app
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
//Returns the index number of the app that matches the id supplied. Returns null
//if the app doesn't exist or if the argument is wrong.
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
  var dragIcon = $("<img>").attr("src", getAppIcon(dragSource.id));
  var width = dragIcon.width/2, height = dragIcon.height/2;
  if (!width) width = 64;
  if (!height) height = 64;
  //dragIcon.width = 128;
  //dragIcon.height = 128;
  event.dataTransfer.setDragImage(dragIcon, width, height);
  event.dataTransfer.effectsAllowed = "move";
  event.dataTransfer.setData("text/uri-list", dragSource.href);
  event.dataTransfer.setData("text/plain", dragSource.id);

  $(dragSource).css("opacity", "0.25")
      .attr("aria-grabbed", "true");
  $(".icons").attr("aria-dropeffect", "move"); //Mark all icons targets
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
//Handle icon drop reordering
  event.preventDefault();
  var oldPosition = getAppIndexById(event.dataTransfer.getData("text/plain"));
  var newPosition = getAppIndexById(dropTarget.id);

  apps.move(oldPosition, newPosition);
  drawIcons();
  localStorage["apps"] = JSON.stringify(apps);
  $(".icons").attr("aria-dropeffect", "none"); //Mark no icons targets
}

/**
 * Draws a context menu based on a target type.
 */
function drawContextMenu(event) {
  event.preventDefault();
  
  destroyContextMenu();
  
  /*************************************
   * Determine the target element's type
   *************************************/
  var node = event.target;
  var cancelDrawing = false; //Flag to cancel drawing the context menu
  if (document.getElementById("context-menu")) { //If a context menu exists
    if (node.id == "context-menu" || node.id == "arrow" ||
        node.id == "arrow-overlay") { //If the target is the context menu itself
      cancelDrawing = true;
    }

    while (!node.id && node != document) {
      //Climb up the DOM tree until the node has an ID or the node is the root
      node = node.parentNode;
    }

    if (node.id == "context-menu" || node.id == "arrow" ||
        node.id == "arrow-overlay") { //If the target is in the context menu
      cancelDrawing = true;
    }
  }

  while (!node.className && node != document) {
    //Climb up the DOM tree until the node has a class or the node is the root
    node = node.parentNode;
  }

  if (node.className.substring(0, 5) == "modal" ||
      node.className.substring(0, 3) == "btn") {
    cancelDrawing = true;
  }

  if (cancelDrawing) {
    return false;
  }

  var contextMenu = document.createElement("menu");
  contextMenu.id = "context-menu";
  contextMenu.type = "context";
  contextMenu.setAttribute("role", "menu");
  var arrow = document.createElement("div");
  arrow.id = "arrow";
  contextMenu.appendChild(arrow);
  
  /****************
   * Build the menu
   ****************/
  switch (node.className) {
    case "icon": //If the node is an icon
      var iconLi = document.createElement("li");
      iconLi.setAttribute("role", "menuitem");
      var iconA = document.createElement("a");
      iconA.appendChild(document.createTextNode(node.innerText));
      iconA.style.fontWeight = "bold";
      iconA.href = node.href;
      if (iconA.href.substring(0, 17) == "chrome://settings") {
        iconA.addEventListener("click", function() {
          chrome.tabs.update({url:"chrome://settings"});
        }, false);
      }
      var optionsLi = document.createElement("li");
      optionsLi.setAttribute("role", "menuitem");
      var optionsA = document.createElement("a");
      optionsA.appendChild(document.createTextNode(
          chrome.i18n.getMessage("options")));
      var app = getAppById(node.id);
      if (app.optionsUrl) {
        optionsA.href = app.optionsUrl;
      } else {
        optionsLi.className = "disabled";
      }
      var removeLi = document.createElement("li");
      removeLi.setAttribute("role", "menuitem");
      var removeA = document.createElement("a");
      if (app.type == appTypes.hostedApp ||
          app.type == appTypes.packagedApp ||
          app.type == appTypes.legacyPackagedApp) {
        removeA.appendChild(document.createTextNode(
            chrome.i18n.getMessage("remove", appName)));
      } else {
        removeA.appendChild(document.createTextNode(
            chrome.i18n.getMessage("removeWebClip")));
      }
      if (app.mayDisable == true) {
        removeA.href = "#";
        removeA.addEventListener("click", function(){
            document.body.removeChild(
                document.getElementById("context-menu"));
            if (app.type == appTypes.hostedApp ||
                app.type == appTypes.packagedApp ||
                app.type == appTypes.legacyPackagedApp) {
              prompt(
                  chrome.i18n.getMessage("uninstallPageTitle"),
                  chrome.i18n.getMessage("uninstallApp", app.name),
                  function() {
                    chrome.management.uninstall(
                        app.id,
                        window.location.reload());
                  },
                  chrome.i18n.getMessage("buttonUninstall"),
                  node.childNodes[0].src);
            } else {
              prompt(
                  chrome.i18n.getMessage("removePageTitle"),
                  chrome.i18n.getMessage("removeWebClipMessage", app.name),
                  function() {
                    var index = getAppIndexById(app.id);
                    apps.splice(index, 1);
                    localStorage["apps"] = JSON.stringify(apps);
                    window.location.reload();
                  },
                  chrome.i18n.getMessage("buttonRemove"),
                  node.childNodes[0].src);
            }
          }, false);
      } else {
        removeLi.className = "disabled";
      }
      
      iconLi.appendChild(iconA);
      optionsLi.appendChild(optionsA);
      removeLi.appendChild(removeA);
      contextMenu.appendChild(iconLi);
      if (removeLi.className != "disabled") {
        contextMenu.appendChild(document.createElement("hr"));
        contextMenu.childNodes[2].setAttribute("role", "separator");
      }
      if (optionsLi.className != "disabled") {
        contextMenu.appendChild(optionsLi);
      }
      if (removeLi.className != "disabled") {
        contextMenu.appendChild(removeLi);
      }

      break;
      
    default: //If the node isn't any of the above (e.g. the root element)
      var launchpageLi = document.createElement("li");
      var launchpageA = document.createElement("a");
      launchpageA.appendChild(document.createTextNode(
          chrome.i18n.getMessage("extName")));
      launchpageA.style.fontWeight = "bold";
      launchpageLi.setAttribute("role", "menuitem");
      if (launchpageInfo.homepageUrl) {
        launchpageA.href = launchpageInfo.homepageUrl;
      } else {
        launchpageLi.className = "disabled";
      }
      var prefsLi = document.createElement("li");
      prefsLi.setAttribute("role", "menuitem");
      var prefsA = document.createElement("a");
      prefsA.appendChild(document.createTextNode(
          chrome.i18n.getMessage("options")));
      prefsA.href = "prefs.html";
      
      var manageLi = document.createElement("li");
      manageLi.setAttribute("role", "menuitem");
      var manageA = document.createElement("a");
      manageA.appendChild(document.createTextNode(
          chrome.i18n.getMessage("manageExtensions")));
      manageA.href = "chrome://extensions";
      manageA.addEventListener("click", function() {
        chrome.tabs.update({url:"chrome://extensions"});
      }, false);
      
      launchpageLi.appendChild(launchpageA);
      prefsLi.appendChild(prefsA);
      manageLi.appendChild(manageA);
      contextMenu.appendChild(launchpageLi);
      contextMenu.appendChild(document.createElement("hr"));
      contextMenu.childNodes[2].setAttribute("role", "separator");
      contextMenu.appendChild(prefsLi);
      contextMenu.appendChild(manageLi);

      break;
  }
  
  //Enables the context menu to have its style calculated - necessary for
  //position calculations
  contextMenu.style.display = "block";
  document.body.appendChild(contextMenu);
  
  /*********************************************
   * Context menu & triangle metrics - calculate
   * position to display menu & arrow
   *********************************************/
  switch (node.className) {
    case "icon":
    //if the target is an icon, display the context menu below the icon

      node.focus(); //Set the focus to the icon as visual feedback
    
      //Make the arrow display on top of the context menu
      arrow.className = "top";
    
      //Center the context menu horizontally on the icon
      contextMenu.style.left = node.parentNode.offsetLeft - 11 +
          (parseInt(getComputedStyle(node)["width"]) +
           parseInt(getComputedStyle(node)["padding-left"]) +
           parseInt(getComputedStyle(node)["padding-right"]) -
           parseInt(getComputedStyle(contextMenu)["width"]))/2 + "px";
          
      //Position the context menu below the icon
      contextMenu.style.top = node.parentNode.offsetTop - 33 -
          parseInt(getComputedStyle(arrow)["top"]) +
          parseInt(getComputedStyle(node)["height"]) +
          parseInt(getComputedStyle(node)["padding-top"]) +
          parseInt(getComputedStyle(node)["padding-bottom"]) + "px";
      
      //Center the arrow horizontally on the menu
      arrow.style.left =
          (parseInt(getComputedStyle(contextMenu)["width"]) +
           parseInt(getComputedStyle(contextMenu)["padding-left"]) +
           parseInt(getComputedStyle(contextMenu)["padding-right"]))/2 +
          parseInt(getComputedStyle(arrow)["top"]) + "px";
      
      if (parseInt(contextMenu.style.top) +
          parseInt(getComputedStyle(contextMenu)["padding-top"]) +
          parseInt(getComputedStyle(contextMenu)["padding-bottom"]) +
          parseInt(getComputedStyle(contextMenu)["height"]) -
          document.body.scrollTop > window.innerHeight) {
          //if the context menu overflows the viewport vertically
          
            arrow.className = "bottom"; //Make the arrow show below the menu
        
            //Position the context menu above the icon
            contextMenu.style.top = node.offsetTop +
                parseInt(getComputedStyle(arrow)["bottom"]) -
                parseInt(getComputedStyle(contextMenu)["height"]) -
                parseInt(getComputedStyle(contextMenu)["padding-top"]) -
                parseInt(getComputedStyle(contextMenu)["padding-bottom"]) +
                "px";
        }

        break;
    
    default:
    //if the target is not an icon, display the context menu with the arrow
    //tip at the point clicked
    
      //Make the arrow display on the left side of the menu
      arrow.className = "left";
      //Center the arrow vertically on the first menu item
      arrow.style.top =
          (parseInt(getComputedStyle(
               contextMenu.getElementsByTagName("li")[0])["height"]) +
           2 * parseInt(getComputedStyle(arrow)["left"]) + 1)/2 +
          parseInt(getComputedStyle(contextMenu)["padding-top"]) + "px";
      
      contextMenu.style.left = event.pageX -
          parseInt(getComputedStyle(arrow)["left"]) - 1 + "px";
      contextMenu.style.top = event.pageY +
          parseInt(getComputedStyle(arrow)["left"]) -
          parseInt(getComputedStyle(arrow)["top"]) + "px";
    
      if (parseInt(getComputedStyle(contextMenu)["left"]) +
          parseInt(getComputedStyle(contextMenu)["width"]) >
          window.innerWidth) {
        //If the menu overflows the window horizontally, make the arrow
        //display on the right side of the menu
        arrow.className = "right";
        //Center the arrow vertically on the first menu item
        arrow.style.top =
            (parseInt(getComputedStyle(
                 contextMenu.getElementsByTagName("li")[0])["height"]) +
             2 * parseInt(getComputedStyle(arrow)["right"]) + 2)/2 +
            parseInt(getComputedStyle(contextMenu)["padding-top"]) + "px";
        
        contextMenu.style.left = event.pageX -
            parseInt(getComputedStyle(contextMenu)["width"]) +
            parseInt(getComputedStyle(arrow)["right"]) + "px";
        contextMenu.style.top = event.pageY +
            parseInt(getComputedStyle(arrow)["right"]) -
            parseInt(getComputedStyle(arrow)["top"]) + "px";
      }

      break;
  }
  return true;
}

/**
 * Destroys all visible context menus.
 */
function destroyContextMenu() {
  if (document.getElementById("context-menu")) {
    if (event.target == document.childNodes[1]) { //If it's the root element
      document.body.removeChild(document.getElementById("context-menu"));
      return true;
    } else if (event.target.id != "context-menu" &&
        event.target.parentNode.id != "context-menu" &&
        event.target.parentNode.parentNode.id != "context-menu") {
      document.body.removeChild(document.getElementById("context-menu"));
      return true;
    }
  }
  return false;
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
  $("#modal-title").text(titleText);
  $("#modal-text").text(text);
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
  var icons = $(".icon");
  for (var i = 0; i < apps.length; i++) {
    if (!apps[i].offlineEnabled && apps[i].enabled) {
    //If the app is not offline-enabled
      $(icons[i]).css("opacity", "0.25");
    }
  }
}

/**
 * Resets icon opacity to normal after an offLine event.
 */
function onLine() {
  $(".icon").css("opacity", "1.0");
}

//Uses YIQ color space to get the lightness of an RGB color (0.0 to 1.0)
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
 * Checks whether the page action should be shown for the given tab.
 *
 * @param tabId
 *        The ID of the tab to check
 * @param changeInfo
 *        An object representing the information about the tab's change event
 * @param tab
 *        An object representing information about the tab
 */
function checkUrl(tabId, changeInfo, tab) {
  if (localStorage["page-action"] == "true" &&
      tab.url.substring(0, 34) != "https://chrome.google.com/webstore" &&
      (tab.url.substring(0, 7) == "http://" ||
      tab.url.substring(0, 8) == "https://")) { //If URL is valid
    chrome.pageAction.show(tabId); //Show the page action
  } else {
    chrome.pageAction.hide(tabId);
  }
}

/**
 * Displays the page action on all currently open tabs that match.
 */
function setUpCurrentTabs() {
  chrome.tabs.query({}, function(tabs) { //Get all tabs
    for (var i = 0; i < tabs.length; i++) {
      checkUrl(tabs[i].id, {}, tabs[i]);
    }
  });
}

/**
 * Prints infomation about an error.
 */
function errorHandler(e) {
  var msg = "";
  switch (e.code) {
    case FileError.QUOTA_EXCEEDED_ERR:
      msg = "QUOTA_EXCEEDED_ERR";
      break;
    case FileError.NOT_FOUND_ERR:
      msg = "NOT_FOUND_ERR";
      break;
    case FileError.SECURITY_ERR:
      msg = "SECURITY_ERR";
      break;
    case FileError.INVALID_MODIFICATION_ERR:
      msg = "INVALID_MODIFICATION_ERR";
      break;
    case FileError.INVALID_STATE_ERR:
      msg = "INVALID_STATE_ERR";
      break;
    default:
      msg = "Unknown Error";
      break;
  };
  console.error(msg);
}

/**
 * Adds a web clip to the launcher.
 *
 * @param details
 *        An object containing the ID, title, URL, and icon of the web clip.
 */
function addToHomeScreen(details) {
  //Builds an App object, then adds it to the list of apps. Used for web clips.
  if (isBackgroundPage) {
  //Only add it if it's the background page. Otherwise, if Launchpage is open
  //somewhere else, it would fire multiple times.
    var app = new App(details.id, details.title, details.url);
    app.homepageUrl = details.url;
    app.icons[0].url = details.icon;
    app.updateUrl = "";
    app.type = appTypes.webClip;
    //FIXME? The background page doesn't get updates when apps/webclips are
    //removed. It only loads the app list on startup. Therefore, we need to
    //refresh its copy of the apps variable from localStorage (which is updated).
    apps = JSON.parse(localStorage["apps"]);
    apps.push(app);
    localStorage["apps"] = JSON.stringify(apps);
    chrome.tabs.create({});
  }
}

/*******************************************************************************
 * Event listeners
 ******************************************************************************/

//Inject the content script to look for chrome-webstore-item
//Disabled because the infobar API is still experimental
//chrome.tabs.onUpdated.addListener(injectContentScript);

//Listen for tab updates so we can check the URL for the page action
if (localStorage["page-action"] == "true") {
  chrome.tabs.onUpdated.addListener(checkUrl); //Listen for tab updates
}

//Draw Launchpage context menu instead of the browser's
document.addEventListener("contextmenu", drawContextMenu, false);

//Destroy the context menu when the user clicks anywhere outside of the menu
document.addEventListener("mousedown", destroyContextMenu, false);

window.addEventListener("load", function(e) {
  //Append icons to the launcher
  launcher.appendChild(icons);
  
  //Check if a new cache is available on page load
  window.applicationCache.addEventListener("updateready", function(e) {
    if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
      window.applicationCache.swapCache();
    }
  }, false);
  window.setTimeout(function() {
      console.log("Page load time:", 
          performance.timing.loadEventEnd - performance.timing.navigationStart,
          "ms");
    }, 100);
}, false);

chrome.extension.onMessage.addListener(function (msg, sender) {
  if (msg.to == "launcher.js" && msg.from == "add.js") {
  //it's being sent to the background page from the page action
    addToHomeScreen(msg.message); //Add the icon to the home screen
  } else if (msg.to == "launcher.js" &&
      msg.from == "chrome-webstore-item_finder.js") {
  //Sent from the webstore content script to the background page
    //First, check if the infobar has already been disabled for this page
    console.log("infobar.hide." + msg.message.url);
    console.log(localStorage["infobar.hide." + msg.message.url]);
    if (localStorage["infobar.hide." + msg.message.url] != "true") {
      //Show the infobar
      chrome.experimental.infobars.show({
        path: "chrome-webstore-item.html#" + escape(msg.message.url) +
            "&" + escape(msg.message.host),
        tabId: sender.tab.id
      });
    }
  }
});

//Make the icons fade when connectivity is lost
window.addEventListener("offline", offLine, false);
window.addEventListener("online", onLine, false);

/*******************************************************************************
 * Post scripts
 ******************************************************************************/

//Request addons list from chrome - includes apps, extensions, & themes (these
//will be filtered out in getApps()
chrome.management.getAll(function(addons) {
  getApps(addons);
  checkNewApps();
  drawIcons();
  if (!navigator.onLine) offLine();
});

//Set the background
if (localStorage["background"] == "bg-custom") {
  document.body.style.backgroundImage =
    "url(" + localStorage["background-image-url"] + ")";
} else if (localStorage["background"] == "bg-color") {
  document.body.style.backgroundColor = localStorage["background-color"];
} else {
  document.body.style.backgroundImage =
      "-webkit-radial-gradient(center, ellipse cover, #ccc, #666)";
}

//Adjust the color palette based on the dominant color of the background
if (localStorage["background"] == "bg-custom") {
  var dominantColor = JSON.parse(localStorage["background-dominant-color"]);

  if (getLightness(dominantColor)[2] > 0.5) {
    $("body").addClass("light-bg");
    // document.styleSheets[0].addRule(".icon > label", "color: #000");
    // document.styleSheets[0].addRule(".icon > label",
    //     "text-shadow: #fff 0 0 10px, #fff 0 0 10px," +
    //     "#fff 0 0 10px, #fff 0 0 10px, #fff 0 0 10px");
    // if (localStorage["chameleon"] == "true") {
    //   document.styleSheets[0].addRule("#context-menu", "color: #000");
    //   document.styleSheets[0].addRule("#context-menu li.disabled",
    //       "color: rgba(0, 0, 0, 0.25)");
    // }
  }

  if (localStorage["chameleon"] == "true") {
    var secondaryColor = JSON.parse(localStorage["background-secondary-color"]);
    var colors = JSON.parse(localStorage["background-colors"]);
    var rgb = colors[0];
    var rgbLight = colors[1];
    var rgbMed = colors[2];
    var rgbDark = colors[3];
    var rgb2 = colors[4];
    document.styleSheets[0].addRule(".icon:hover, .icon:focus, .icon.hover",
        "background: rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", 0.5)");
    document.styleSheets[0].addRule("#context-menu",
        "background: -webkit-linear-gradient(" +
        "rgba("+rgbLight[0]+", "+rgbLight[1]+", "+rgbLight[2]+", 0.9),"+
        "rgba("+rgbDark[0]+", "+rgbDark[1]+", "+rgbDark[2]+", 0.9))");
    document.styleSheets[0].addRule("#context-menu > #arrow.top",
        "border-bottom: 12px solid rgba(" + rgbLight[0] + ", "+
            rgbLight[1] + ", " + rgbLight[2] + ", 0.9)");
    document.styleSheets[0].addRule("#context-menu > #arrow.left",
        "border-right: 12px solid rgba(" + rgbMed[0] + ", "+
            rgbMed[1] + ", " + rgbMed[2] + ", 0.9)");
    document.styleSheets[0].addRule("#context-menu > #arrow.right",
        "border-left: 12px solid rgba(" + rgbMed[0] + ", "+
            rgbMed[1] + ", " + rgbMed[2] + ", 0.9)");
    document.styleSheets[0].addRule("#context-menu > #arrow.bottom",
        "border-top: 12px solid rgba(" + rgbDark[0] + ", "+
            rgbDark[1] + ", " + rgbDark[2] + ", 0.9)");
    document.styleSheets[0].addRule("#context-menu li:not(.disabled):hover > a," +
        "#context-menu li:not(.disabled) > a:focus",
        "background:rgba(" + rgb2[0] + "," + rgb2[1] + "," + rgb2[2] + ", .75)");
    if (getLightness(secondaryColor)[2] > 0.5) {
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

//Display page action on tabs
setUpCurrentTabs(false);

//Initiate settings
if (!localStorage["background"]) localStorage["background"] = "bg-default";
if (!localStorage["chameleon"]) localStorage["chameleon"] = "true";
if (!localStorage["page-action"]) localStorage["page-action"] = "true";

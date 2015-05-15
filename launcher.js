/*******************************************************************************
 * Initialize variables, classes, & prototypes
 ******************************************************************************/
var apps = []; //Array of all apps
var launcher = document.getElementById('launcher'); //The launcher element
var icons = document.createElement('div'); //Holds icons in the launcher
var isBackgroundPage = false;
var appName = (navigator.userAgent.indexOf('Chromium') == -1) ?
    'Chrome' : 'Chromium'; //Detect whether we are on Chrome or Chromium
chrome.extension.getBackgroundPage().isBackgroundPage = true;
icons.id = 'icons';
var appTypes = { //All the Chrome addon types, plus a couple custom ones
  extension: 'extension',
  hostedApp: 'hosted_app',
  packagedApp: 'packaged_app',
  legacyPackagedApp: 'legacy_packaged_app',
  theme: 'theme',
  webClip: 'web_clip',
  stock: 'stock'
};

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

var launchpage = { //Launchpage namespace prefix
  extensionInfo: {} //Will eventually contain the info about the extension
};

launchpage.Icon = function(id, name, url) {
//Set up the structure of the icon
  var app = document.createElement('a');  
  app.className = 'icon';
  app.href = url;
  app.setAttribute('role', 'link');
  app.setAttribute('aria-labelledby', id + '-label');
  app.setAttribute('aria-grabbed', 'false');
  app.appendChild(document.createElement('img'));
  app.appendChild(document.createElement('label'));
  app.childNodes[1].id = id + '-label';
  if (id) {
    app.id = id;
    app.childNodes[0].src = launchpage.getAppIcon(id, 128);
  }
  if (name) app.childNodes[1].appendChild(document.createTextNode(name));
  
  //Prevent the image and the label from being dragged separately from the icon.
  //Their drag events now bubble up to the icon.
  app.childNodes[0].draggable = 'false';
  app.childNodes[1].draggable = 'false';
  
  app.addEventListener('dragstart', function(){
        launchpage.dragStartIcon(this);
      }, false);
  app.addEventListener('dragend', function(){
        launchpage.dragEndIcon(this);
      }, false);
  app.addEventListener('dragover', function() {
        launchpage.dragOverIcon(this);
      }, false);
  app.addEventListener('dragenter', function(){
        launchpage.dragEnterIcon(this);
      }, false);
  app.addEventListener('dragleave', function(){
        launchpage.dragLeaveIcon(this);
      }, false);
  app.addEventListener('drop', function(){
        launchpage.dropIcon(this);
      }, false);
  return app;
};

launchpage.App = function(id, name, url) {
  return {
    appLaunchUrl: url,
    description: '',
    enabled: true,
    homepageUrl: 'https://chrome.google.com/webstore/detail/' + id,
    hostPermissions: [],
    icons: [{
      size: 128,
      url: ''
    }],
    id: id,
    isApp: false, //deprecated
    isWebClip: false, //deprecated
    type: appTypes.webClip,
    mayDisable: true,
    name: name,
    offlineEnabled: false,
    optionsUrl: '',
    permissions: [],
    updateUrl: 'http://clients2.google.com/service/update2/crx',
    version: '1.0'
  };
};

/*******************************************************************************
 * Extension functions
 ******************************************************************************/

launchpage.getApps = function(addons) {
//Filter out the apps from the other addons, and add prefs & store icons
  for (var i in addons) {
    if (addons[i].isApp ||
        addons[i].type == appTypes.hostedApp ||
        addons[i].type == appTypes.packagedApp ||
        addons[i].type == appTypes.legacyPackagedApp) {
      apps.push(addons[i]);
    } else if (addons[i].id == chrome.i18n.getMessage('@@extension_id')) {
      launchpage.extensionInfo = addons[i];
    }
  }
  
  if (apps.length == 0)
    launchpage.showInfoBar(chrome.i18n.getMessage('infobarNoApps'));
    
  var chromePrefs = new launchpage.App('chrome-prefs',
      chrome.i18n.getMessage('iconSettings'), 'chrome://settings');
  chromePrefs.description =
      chrome.i18n.getMessage('iconSettingsDescription', appName);
  chromePrefs.homepageUrl = '';
  chromePrefs.icons[0].url = 'skin/wrench.png';
  chromePrefs.isApp = false;
  chromePrefs.type = appTypes.stock;
  chromePrefs.mayDisable = false;
  chromePrefs.offlineEnabled = true;
  chromePrefs.updateUrl = '';
  chromePrefs.version =
      navigator.appVersion.substring(navigator.appVersion.indexOf('Chrome/') +
          7, navigator.appVersion.indexOf(' ',
              navigator.appVersion.indexOf('Chrome/')));
  var webStore = new launchpage.App('web-store',
      chrome.i18n.getMessage('iconWebStore'),
      'https://chrome.google.com/webstore?utm_source=launchpage');
  webStore.description = chrome.i18n.getMessage('iconWebStoreDescription');
  webStore.icons[0].url = 'skin/webstore.png';
  webStore.isApp = false;
  webStore.type = appTypes.stock;
  webStore.mayDisable = false;
  webStore.offlineEnabled = false;
  webStore.updateUrl = '';
  webStore.version = '';
  
  apps.push(chromePrefs, webStore);
  
  //Get the webclips
  if (localStorage['apps']) {
    storedApps = JSON.parse(localStorage['apps']);
    for (var i = 0; i < storedApps.length; i++) {
      if (storedApps[i].isWebClip || storedApps[i].type == appTypes.webClip) {
        apps.push(storedApps[i]);
      }
    }
  }
};

launchpage.checkNewApps = function() {
//Check for new apps installed & position them at the end of the list.
  if (!localStorage['apps']) {
    localStorage['apps'] = JSON.stringify(apps);
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
  localStorage['apps'] = JSON.stringify(apps);
};

launchpage.drawIcons = function() { //Draws icons to the page
  icons.innerHTML = ''; //Clear out the icons
  for (var i = 0; i < apps.length; i++) {
    if (apps[i].enabled) { //If the app is enabled
      launchpage.appendIcon(apps[i]);
    }
  }
};

launchpage.appendIcon = function(appObject) {
//Constructs the app object as an icon and appends it to the launcher.
//Returns true upon success.
  var app = new launchpage.Icon(appObject.id, appObject.name,
      appObject.appLaunchUrl);
  /*
  app.addEventListener('click', function(){
      event.preventDefault();
      chrome.management.launchApp(appObject.id);
      window.close();
      /*
      chrome.tabs.create({
          'url': appObject.appLaunchUrl,
          //'pinned': appObject.pinned
          }, launchpage.appLoaded);*/
    //}, false);
  if (appObject.appLaunchUrl.substring(0, 17) == 'chrome://settings') {
    app.addEventListener('click', function() {
      chrome.tabs.update({url: 'chrome://settings'});
    }, false);
  } else if (appObject.type == appTypes.packagedApp ||
        appObject.type == appTypes.legacyPackagedApp) {
    app.addEventListener('click', function(){
        event.preventDefault();
        chrome.management.launchApp(appObject.id);
        chrome.tabs.getCurrent(function(tab) {
          chrome.tabs.remove(tab.id);
        });
      }, false);
  } else {
    //Web clip or hosted app
    app.addEventListener('click', function() {
      event.preventDefault();
      chrome.tabs.update({
          url: appObject.appLaunchUrl,
        });
    }, false);
  }
  icons.appendChild(app);
  return true;
};

launchpage.getAppById = function(id) {
//Returns an appObject that matches the id supplied. Returns null if the app
//doesn't exist or if the argument is wrong.
  if (!id || typeof id != 'string') return null;
  
  for (var node in apps) {
    if (apps[node].id == id) {
      return apps[node];
    }
  }
  return null;
};

launchpage.getAppIndexById = function(id) {
//Returns the index number of the app that matches the id supplied. Returns null
//if the app doesn't exist or if the argument is wrong.
  if (!id || typeof id != 'string') return null;
  
  var app = launchpage.getAppById(id);
  for (var node = 0; node < apps.length; node++) {
    if (apps[node].id == id) {
      return node;
    }
  }
  return null;
};

launchpage.getAppsByName = function(name) {
//Returns an array of appObjects that match the name supplied. Returns null if
//the argument is wrong. Returns an empty array if no apps match.
  if (!name || typeof name != 'string') return null;
  
  var appsByName = []
  for (var node in apps) {
    if (apps[node].name == name) {
      appsByName.push(apps[node]);
    }
  }
  return appsByName;
};

launchpage.getAppIcon = function(id, size) {
//Returns the URL string of the icon size belonging to the app id supplied.
//Returns undefined if the app doesn't exist or if no suitable icon is
//supplied. Returns null if an argument is wrong.
  if (!id || typeof id != 'string') return null;
  if (!size) size = 128;
  else if (typeof size != 'number') return null;
  
  var app = launchpage.getAppById(id);
  for (var i in app.icons) {
    if (app.icons[i].size == size) {
      return app.icons[i].url;
    }
  }
  return undefined;
};

launchpage.dragStartIcon = function(dragSource) {
  var dragIcon = document.createElement('img');
  dragIcon.src = launchpage.getAppIcon(dragSource.id);
  var width = dragIcon.width/2, height = dragIcon.height/2;
  if (!width) width = 64;
  if (!height) height = 64;
  //dragIcon.width = 128;
  //dragIcon.height = 128;
  event.dataTransfer.setDragImage(dragIcon, width, height);
  event.dataTransfer.effectsAllowed = 'move';
  event.dataTransfer.setData('text/uri-list', dragSource.href);
  event.dataTransfer.setData('text/plain', dragSource.id);
  dragSource.style.opacity = '0.25';
  dragSource.setAttribute('aria-grabbed', 'true');
  var icons = launcher.childNodes[0].childNodes;
  for (var i = 0; i < icons.length; i++) {
    icons[i].setAttribute('aria-dropeffect', 'move'); //Mark all icons targets
  }
};

launchpage.dragEndIcon = function(dragSource) {
  dragSource.style.opacity = '1';
  dragSource.setAttribute('aria-grabbed', 'false');
};

launchpage.dragOverIcon = function(dropTarget) {
  event.preventDefault();
};

launchpage.dragEnterIcon = function(dropTarget) {
  dropTarget.classList.toggle('hover');
};

launchpage.dragLeaveIcon = function(dropTarget) {
  dropTarget.classList.toggle('hover');
};

launchpage.dropIcon = function(dropTarget) {
//Handle icon drop reordering
  event.preventDefault();
  var oldPosition = launchpage.getAppIndexById(
      event.dataTransfer.getData('text/plain'));
  var newPosition = launchpage.getAppIndexById(dropTarget.id);

  apps.move(oldPosition, newPosition);
  launchpage.drawIcons();
  localStorage['apps'] = JSON.stringify(apps);
  var icons = launcher.childNodes[0].childNodes;
  for (var i = 0; i < icons.length; i++) {
    icons[i].setAttribute('aria-dropeffect', 'none'); //Mark no icons targets
  }
};

launchpage.drawContextMenu = function(event) {
  //Draw the context menu based on the target type
  event.preventDefault();
  
  launchpage.destroyContextMenu();
  
  /*************************************
   * Determine the target element's type
   *************************************/
  var node = event.target;
  var cancelDrawing = false; //Flag to cancel drawing the context menu
  if (document.getElementById('context-menu')) { //If a context menu exists
    if (node.id == 'context-menu' || node.id == 'arrow' ||
        node.id == 'arrow-overlay') { //If the target IS the context menu
      cancelDrawing = true;
    }
    while (!node.id && node != document) {
    //Climb up the DOM tree until the node has an ID OR the node is the root
      node = node.parentNode;
    }
    if (node.id == 'context-menu' || node.id == 'arrow' ||
        node.id == 'arrow-overlay') { //If the target is in the context menu
      cancelDrawing = true;
    }
  }
  while (!node.className && node != document) {
  //Climb up the DOM tree until the node has a class OR the node is the root
    node = node.parentNode;
  }
  if (node.className == 'modal-bg' || node.className == 'modalDialog') {
  //If the node is a modal dialog
    cancelDrawing = true;
  }
  if (cancelDrawing == false) {
    var contextMenu = document.createElement('menu');
    contextMenu.id = 'context-menu';
    contextMenu.type = 'context';
    contextMenu.setAttribute('role', 'menu');
    var arrow = document.createElement('div');
    arrow.id = 'arrow';
    contextMenu.appendChild(arrow);
    
    /****************
     * Build the menu
     ****************/
    switch (node.className) {
      case 'icon': //If the node is an icon
        var iconLi = document.createElement('li');
        iconLi.setAttribute('role', 'menuitem');
        var iconA = document.createElement('a');
        iconA.appendChild(document.createTextNode(node.innerText));
        iconA.style.fontWeight = 'bold';
        iconA.href = node.href;
        if (iconA.href.substring(0, 17) == 'chrome://settings') {
          iconA.addEventListener('click', function() {
            chrome.tabs.update({url:'chrome://settings'});
          }, false);
        }
        var optionsLi = document.createElement('li');
        optionsLi.setAttribute('role', 'menuitem');
        var optionsA = document.createElement('a');
        optionsA.appendChild(document.createTextNode(
            chrome.i18n.getMessage('options')));
        var app = launchpage.getAppById(node.id);
        if (app.optionsUrl) {
          optionsA.href = app.optionsUrl;
        } else {
          optionsLi.className = 'disabled';
        }
        var removeLi = document.createElement('li');
        removeLi.setAttribute('role', 'menuitem');
        var removeA = document.createElement('a');
        if (app.isApp ||
            app.type == appTypes.hostedApp ||
            app.type == appTypes.packagedApp ||
            app.type == appTypes.legacyPackagedApp) {
          removeA.appendChild(document.createTextNode(
              chrome.i18n.getMessage('remove', appName)));
        } else {
          removeA.appendChild(document.createTextNode(
              chrome.i18n.getMessage('removeWebClip')));
        }
        if (app.mayDisable == true) {
          removeA.href = '#';
          removeA.addEventListener('click', function(){
              document.body.removeChild(
                  document.getElementById('context-menu'));
              if (app.isApp ||
                  app.type == appTypes.hostedApp ||
                  app.type == appTypes.packagedApp ||
                  app.type == appTypes.legacyPackagedApp) {
                launchpage.prompt(
                    chrome.i18n.getMessage('uninstallPageTitle'),
                    chrome.i18n.getMessage('uninstallApp', app.name),
                    function() {
                      chrome.management.uninstall(
                          app.id,
                          window.location.reload());
                    },
                    chrome.i18n.getMessage('buttonUninstall'),
                    node.childNodes[0].src);
              } else {
                launchpage.prompt(
                    chrome.i18n.getMessage('removePageTitle'),
                    chrome.i18n.getMessage('removeWebClipMessage', app.name),
                    function() {
                      var index = launchpage.getAppIndexById(app.id);
                      apps.splice(index, 1);
                      localStorage['apps'] = JSON.stringify(apps);
                      window.location.reload();
                    },
                    chrome.i18n.getMessage('buttonRemove'),
                    node.childNodes[0].src);
              }
            }, false);
        } else {
          removeLi.className = 'disabled';
        }
        
        iconLi.appendChild(iconA);
        optionsLi.appendChild(optionsA);
        removeLi.appendChild(removeA);
        contextMenu.appendChild(iconLi);
        if (removeLi.className != 'disabled') {
          contextMenu.appendChild(document.createElement('hr'));
          contextMenu.childNodes[2].setAttribute('role', 'separator');
        }
        if (optionsLi.className != 'disabled') {
          contextMenu.appendChild(optionsLi);
        }
        if (removeLi.className != 'disabled') {
          contextMenu.appendChild(removeLi);
        }
        
        break;
        
      default: //If the node isn't any of the above (e.g. the root element)
        var launchpageLi = document.createElement('li');
        var launchpageA = document.createElement('a');
        launchpageA.appendChild(document.createTextNode(
            chrome.i18n.getMessage('extName')));
        launchpageA.style.fontWeight = 'bold';
        launchpageLi.setAttribute('role', 'menuitem');
        if (launchpage.extensionInfo.homepageUrl) {
          launchpageA.href = launchpage.extensionInfo.homepageUrl;
        } else {
          launchpageLi.className = 'disabled';
        }
        var prefsLi = document.createElement('li');
        prefsLi.setAttribute('role', 'menuitem');
        var prefsA = document.createElement('a');
        prefsA.appendChild(document.createTextNode(
            chrome.i18n.getMessage('options')));
        prefsA.href = 'prefs.html';
        
        var manageLi = document.createElement('li');
        manageLi.setAttribute('role', 'menuitem');
        var manageA = document.createElement('a');
        manageA.appendChild(document.createTextNode(
            chrome.i18n.getMessage('manageExtensions')));
        manageA.href = 'chrome://extensions';
        manageA.addEventListener('click', function() {
          chrome.tabs.update({url:'chrome://extensions'});
        }, false);
        
        launchpageLi.appendChild(launchpageA);
        prefsLi.appendChild(prefsA);
        manageLi.appendChild(manageA);
        contextMenu.appendChild(launchpageLi);
        contextMenu.appendChild(document.createElement('hr'));
        contextMenu.childNodes[2].setAttribute('role', 'separator');
        contextMenu.appendChild(prefsLi);
        contextMenu.appendChild(manageLi);
        break;
    }
    
    //Enables the context menu to have its style calculated - necessary for
    //position calculations
    contextMenu.style.display = 'block';
    document.body.appendChild(contextMenu);
    
    /*********************************************
     * Context menu & triangle metrics - calculate
     * position to display menu & arrow
     *********************************************/
    switch (node.className) {
      case 'icon':
      //if the target is an icon, display the context menu below the icon

        node.focus(); //Set the focus to the icon as visual feedback
      
        //Make the arrow display on top of the context menu
        arrow.className = 'top';
      
        //Center the context menu horizontally on the icon
        contextMenu.style.left = node.offsetLeft +
            (parseInt(getComputedStyle(node)['width']) +
             parseInt(getComputedStyle(node)['padding-left']) +
             parseInt(getComputedStyle(node)['padding-right']) -
             parseInt(getComputedStyle(contextMenu)['width']))/2 + 'px';
            
        //Position the context menu below the icon
        contextMenu.style.top = node.offsetTop -
            parseInt(getComputedStyle(arrow)['top']) +
            parseInt(getComputedStyle(node)['height']) +
            parseInt(getComputedStyle(node)['padding-top']) +
            parseInt(getComputedStyle(node)['padding-bottom']) + 'px';
        
        //Center the arrow horizontally on the menu
        arrow.style.left =
            (parseInt(getComputedStyle(contextMenu)['width']) +
             parseInt(getComputedStyle(contextMenu)['padding-left']) +
             parseInt(getComputedStyle(contextMenu)['padding-right']))/2 +
            parseInt(getComputedStyle(arrow)['top']) + 'px';
        
        if (parseInt(contextMenu.style.top) +
            parseInt(getComputedStyle(contextMenu)['padding-top']) +
            parseInt(getComputedStyle(contextMenu)['padding-bottom']) +
            parseInt(getComputedStyle(contextMenu)['height']) -
            document.body.scrollTop > window.innerHeight) {
            //if the context menu overflows the viewport vertically
            
              arrow.className = 'bottom'; //Make the arrow show below the menu
          
              //Position the context menu above the icon
              contextMenu.style.top = node.offsetTop +
                  parseInt(getComputedStyle(arrow)['bottom']) -
                  parseInt(getComputedStyle(contextMenu)['height']) -
                  parseInt(getComputedStyle(contextMenu)['padding-top']) -
                  parseInt(getComputedStyle(contextMenu)['padding-bottom']) +
                  'px';
          }
        break;
      
      default:
      //if the target is not an icon, display the context menu with the arrow
      //tip at the point clicked
      
        //Make the arrow display on the left side of the menu
        arrow.className = 'left';
        //Center the arrow vertically on the first menu item
        arrow.style.top =
            (parseInt(getComputedStyle(
                 contextMenu.getElementsByTagName('li')[0])['height']) +
             2 * parseInt(getComputedStyle(arrow)['left']) + 1)/2 +
            parseInt(getComputedStyle(contextMenu)['padding-top']) + 'px';
        
        contextMenu.style.left = event.pageX -
            parseInt(getComputedStyle(arrow)['left']) - 1 + 'px';
        contextMenu.style.top = event.pageY +
            parseInt(getComputedStyle(arrow)['left']) -
            parseInt(getComputedStyle(arrow)['top']) + 'px';
      
        if (parseInt(getComputedStyle(contextMenu)['left']) +
            parseInt(getComputedStyle(contextMenu)['width']) >
            window.innerWidth) {
          //If the menu overflows the window horizontally, make the arrow
          //display on the right side of the menu
          arrow.className = 'right';
          //Center the arrow vertically on the first menu item
          arrow.style.top =
              (parseInt(getComputedStyle(
                   contextMenu.getElementsByTagName('li')[0])['height']) +
               2 * parseInt(getComputedStyle(arrow)['right']) + 2)/2 +
              parseInt(getComputedStyle(contextMenu)['padding-top']) + 'px';
          
          contextMenu.style.left = event.pageX -
              parseInt(getComputedStyle(contextMenu)['width']) +
              parseInt(getComputedStyle(arrow)['right']) + 'px';
          contextMenu.style.top = event.pageY +
              parseInt(getComputedStyle(arrow)['right']) -
              parseInt(getComputedStyle(arrow)['top']) + 'px';
        }
                  
      break;
    }
  }
  return true;
};

launchpage.destroyContextMenu = function() {
//Destroys the context menu when the user clicks outside of the menu
  if (document.getElementById('context-menu')) {
    if (event.target == document.childNodes[1]) { //If it's the root element
      document.body.removeChild(document.getElementById('context-menu'));
      return true;
    } else if (event.target.id != 'context-menu' &&
        event.target.parentNode.id != 'context-menu' &&
        event.target.parentNode.parentNode.id != 'context-menu') {
      document.body.removeChild(document.getElementById('context-menu'));
      return true;
    }
  }
  return false;
};
  
launchpage.prompt = function(titleText, text, buttonAction, buttonLabel, iconUrl) {
//Displays a modal prompt
  if (!buttonAction) {
    buttonAction = function(){
      overlay.style.opacity = '0';
      //Give the prompt time to fade out
      window.setTimeout(function(){document.body.removeChild(overlay)}, 500);
    };
  }
  buttonLabel = buttonLabel ? buttonLabel : 'OK';
  //Create the prompt
  var overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.style.opacity = '0';
  var page = document.createElement('div');
  page.className = 'page';
  page.setAttribute('role', 'dialog');
  var title = document.createElement('h1');
  title.appendChild(document.createTextNode(titleText));
  title.id = 'modal-title';
  page.setAttribute('aria-labelledby', 'modal-title');
  var contentArea = document.createElement('div');
  contentArea.className = 'content-area';
  contentArea.id = 'modal-content';
  page.setAttribute('aria-describedby', 'modal-content');
  if (iconUrl) {
    var icon = document.createElement('img');
    icon.src = iconUrl;
  }
  var label = document.createElement('label');
  label.appendChild(document.createTextNode(text));
  var actionArea = document.createElement('div');
  actionArea.className = 'action-area';
  var buttonStrip = document.createElement('div');
  buttonStrip.className = 'button-strip';
  var cancelButton = document.createElement('button');
  cancelButton.appendChild(document.createTextNode(
      chrome.i18n.getMessage('buttonCancel')));
  cancelButton.type = 'reset';
  cancelButton.addEventListener('click', function(){
      overlay.style.opacity = '0';
      //Give the prompt time to fade out
      window.setTimeout(function(){document.body.removeChild(overlay)}, 500);
    }, false);
  var mainButton = document.createElement('button');
  mainButton.appendChild(document.createTextNode(buttonLabel));
  mainButton.type = 'submit';
  mainButton.addEventListener('click', buttonAction, false);
  
  if (iconUrl) contentArea.appendChild(icon);
  contentArea.appendChild(label);
  buttonStrip.appendChild(cancelButton);
  buttonStrip.appendChild(mainButton);
  actionArea.appendChild(buttonStrip);
  page.appendChild(title);
  page.appendChild(contentArea);
  page.appendChild(actionArea);
  overlay.appendChild(page);
  document.body.appendChild(overlay);
  //Give the prompt time to fade in
  window.setTimeout(function(){overlay.style.opacity = '1'}, 10);

  return true;
};

launchpage.showInfoBar = function(message, bgColor, textColor) {
//Displays an info bar with a message. Optionally set a hex bg & text color.
  if (document.getElementById('infobar')) {
    document.body.removeChild(document.getElementById('infobar'));
  }
  var infobar = document.createElement('div');
  infobar.id = 'infobar';
  infobar.innerText = message;
  infobar.innerHTML += '&nbsp;&nbsp;<a href="#" id="infobarClose">' +
      chrome.i18n.getMessage('infobarClose') + '</a>';
  infobar.setAttribute('role', 'status');
  infobar.setAttribute('aria-describedby', 'infobar');
  if (bgColor) { //Calculate the gradient for the background
    var darkBgColor = '';
    bgColor = bgColor.replace('#', '');
    if ((bgColor.length == 6 || bgColor.length == 3) &&
        !isNaN(parseInt(bgColor, 16))) { //Make sure it's a valid hex code
      if (bgColor.length == 3) {
        codes = [bgColor.substring(0,1),
            bgColor.substring(1,2),
            bgColor.substring(2,3)];
        bgColor = codes[0] + codes[0] +
            codes[1] + codes[1] +
            codes[2] + codes[2];
      }
      var rgb = [parseInt(bgColor.substring(0, 2), 16),
          parseInt(bgColor.substring(2, 4), 16),
          parseInt(bgColor.substring(4, 6), 16)];
      for (var i = 0; i < rgb.length; i++) {
        if (rgb[i] < 34) {
          darkBgColor += '00';
        } else {
          darkBgColor += (rgb[i] - 34).toString(16);
        }
      }
      infobar.style.background = '-webkit-linear-gradient(#' + bgColor +
          ', #' + darkBgColor + ')';
    } else {
      console.error('Invalid color code passed to launchpage.showInfoBar');
    }
  } else {
    infobar.style.background = '-webkit-linear-gradient(#ddd, #bbb)';
  }
  if (textColor) {
    infobar.style.color = textColor;
  } else {
    infobar.style.color = '#000';
  }
  document.body.appendChild(infobar);
  document.getElementById('infobarClose').addEventListener('click',
    launchpage.hideInfoBar, false);
  return true;
};

launchpage.hideInfoBar = function() {
  if (document.getElementById('infobar')) {
    document.body.removeChild(document.getElementById('infobar'));
    return true;
  } else {
    return false;
  }
};

launchpage.offLine = function() {
//Make offline apps stand out by making other apps transparent
  if (localStorage['infobarOffline'] != 'true') {
    launchpage.showInfoBar(chrome.i18n.getMessage('infobarOffline'));
    localStorage['infobarOffline'] = 'true';
  }
  var icons = document.getElementById('icons').childNodes;
  for (var i = 0; i < apps.length; i++) {
    if (!apps[i].offlineEnabled && apps[i].enabled) {
    //If the app is not offline-enabled
      icons[i].style.opacity = '0.25';
    }
  }
};

launchpage.onLine = function() {
//Reset apps opacity to make them opaque again
  launchpage.hideInfoBar();
  var icons = document.getElementById('icons').childNodes;
  for (var i = 0; i < apps.length; i++) {
    icons[i].style.opacity = '1.0';
  }
};

launchpage.rgbToHsl = function(rgb){
  var r = rgb[0], g = rgb[1], b = rgb[2];
  r /= 255, g /= 255, b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;

  if (max == min) {
    h = s = 0; //achromatic
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h,s,l];
}

function injectContentScript(tabId, changeInfo, tab) {
  if (changeInfo.status == 'complete' && tab.url.substring(0,4) == 'http') {
    chrome.tabs.executeScript(tabId, {file: 'chrome-webstore-item_finder.js'});
  }
}

//Page action stuff
function checkUrl(tabId, changeInfo, tab) {
//Check whether the URL is valid
  if (localStorage['page-action'] == 'true' &&
      tab.url.substring(0, 34) != 'https://chrome.google.com/webstore' &&
      (tab.url.substring(0, 7) == 'http://' ||
      tab.url.substring(0, 8) == 'https://')) { //If URL is valid
    chrome.pageAction.show(tabId); //Show the page action
  } else {
    chrome.pageAction.hide(tabId);
  }
}

function setUpCurrentTabs() {
  chrome.tabs.query({}, function(tabs) { //Get all tabs
    for (var i = 0; i < tabs.length; i++) {
      checkUrl(tabs[i].id, {}, tabs[i]);
    }
  });
}

function errorHandler(e) {
  var msg = '';
  switch (e.code) {
    case FileError.QUOTA_EXCEEDED_ERR:
      msg = 'QUOTA_EXCEEDED_ERR';
      break;
    case FileError.NOT_FOUND_ERR:
      msg = 'NOT_FOUND_ERR';
      break;
    case FileError.SECURITY_ERR:
      msg = 'SECURITY_ERR';
      break;
    case FileError.INVALID_MODIFICATION_ERR:
      msg = 'INVALID_MODIFICATION_ERR';
      break;
    case FileError.INVALID_STATE_ERR:
      msg = 'INVALID_STATE_ERR';
      break;
    default:
      msg = 'Unknown Error';
      break;
  };
  console.error(msg);
}

launchpage.addToHomeScreen = function(details) {
  //Builds an App object, then adds it to the list of apps. Used for web clips.
  if (isBackgroundPage) {
  //Only add it if it's the background page. Otherwise, if Launchpage is open
  //somewhere else, it would fire multiple times.
    var app = new launchpage.App(details.id, details.title, details.url);
    app.homepageUrl = details.url;
    app.icons[0].url = details.icon;
    app.updateUrl = '';
    app.isApp = false;
    app.isWebClip = true;
    app.type = appTypes.webClip;
    //FIXME? The background page doesn't get updates when apps/webclips are
    //removed. It only loads the app list on startup. Therefore, we need to
    //refresh its copy of the apps variable from localStorage (which is updated).
    apps = JSON.parse(localStorage['apps']);
    apps.push(app);
    localStorage['apps'] = JSON.stringify(apps);
    chrome.tabs.create({});
  }
};

/*******************************************************************************
 * Event listeners
 ******************************************************************************/

//Inject the content script to look for chrome-webstore-item
//Disabled because the infobar API is still experimental
//chrome.tabs.onUpdated.addListener(injectContentScript);

//Listen for tab updates so we can check the URL for the page action
if (localStorage['page-action'] == 'true') {
  chrome.tabs.onUpdated.addListener(checkUrl); //Listen for tab updates
}

//Draw Launchpage context menu instead of the browser's
document.addEventListener('contextmenu', launchpage.drawContextMenu, false);

//Destroy the context menu when the user clicks anywhere outside of the menu
document.addEventListener('mousedown', launchpage.destroyContextMenu, false);

window.addEventListener('load', function(e) {
  //Append icons to the launcher
  launcher.appendChild(icons);
  
  //Check if a new cache is available on page load
  window.applicationCache.addEventListener('updateready', function(e) {
    if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
      window.applicationCache.swapCache();
    }
  }, false);
  window.setTimeout(function() {
      console.log('Page load time:', 
          performance.timing.loadEventEnd - performance.timing.navigationStart,
          'ms');
    }, 100);
}, false);

chrome.extension.onMessage.addListener(function (msg, sender) {
  if (msg.to == 'launcher.js' && msg.from == 'add.js') {
  //It's being sent to the background page from the page action
    launchpage.addToHomeScreen(msg.message); //Add the icon to the home screen
  } else if (msg.to == 'launcher.js' &&
      msg.from == 'chrome-webstore-item_finder.js') {
  //Sent from the webstore content script to the background page
    //First, check if the infobar has already been disabled for this page
    console.log('infobar.hide.' + msg.message.url);
    console.log(localStorage['infobar.hide.' + msg.message.url]);
    if (localStorage['infobar.hide.' + msg.message.url] != 'true') {
      //Show the infobar
      chrome.experimental.infobars.show({
        path: 'chrome-webstore-item.html#' + escape(msg.message.url) +
            '&' + escape(msg.message.host),
        tabId: sender.tab.id
      });
    }
  }
});

//Make the icons fade when connectivity is lost
window.addEventListener('offline', launchpage.offLine, false);
window.addEventListener('online', launchpage.onLine, false);

/*******************************************************************************
 * Post scripts
 ******************************************************************************/

//Request addons list from chrome - includes apps, extensions, & themes (these
//will be filtered out in getApps()
chrome.management.getAll(function(addons) {
  launchpage.getApps(addons);
  launchpage.checkNewApps();
  launchpage.drawIcons();
  if (!navigator.onLine) launchpage.offLine();
});

//Set the background
if (localStorage['background'] == 'bg-custom') {
  document.body.style.backgroundImage =
    'url(' + localStorage['background-image-url'] + ')';
} else if (localStorage['background'] == 'bg-color') {
  document.body.style.backgroundColor = localStorage['background-color'];
} else {
  document.body.style.backgroundImage =
      "-webkit-radial-gradient(center, ellipse cover, #ccc, #666)";
}

//Adjust the color palette based on the dominant color of the background
if (localStorage['background'] == 'bg-custom') {
  var dominantColor =
      JSON.parse(localStorage['background-dominant-color']);
  if (launchpage.rgbToHsl(dominantColor)[2] > 0.5) {
    document.styleSheets[0].addRule('.icon > label', 'color: #000');
    document.styleSheets[0].addRule('.icon > label',
        'text-shadow: #fff 0 0 10px, #fff 0 0 10px,' +
        '#fff 0 0 10px, #fff 0 0 10px, #fff 0 0 10px');
    if (localStorage['chameleon'] == 'true') {
      document.styleSheets[0].addRule('#context-menu', 'color: #000');
      document.styleSheets[0].addRule('#context-menu li.disabled',
          'color: rgba(0, 0, 0, 0.25)');
    }
  }
  if (localStorage['chameleon'] == 'true') {
    var secondaryColor =
        JSON.parse(localStorage['background-secondary-color']);
    var colors = JSON.parse(localStorage['background-colors']);
    var rgb = colors[0];
    var rgbLight = colors[1];
    var rgbMed = colors[2];
    var rgbDark = colors[3];
    var rgb2 = colors[4];
    document.styleSheets[0].addRule('.icon:hover, .icon:focus, .icon.hover',
        'background: rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', 0.5)');
    document.styleSheets[0].addRule('#context-menu',
        'background: -webkit-linear-gradient(' +
        'rgba('+rgbLight[0]+', '+rgbLight[1]+', '+rgbLight[2]+', 0.9),'+
        'rgba('+rgbDark[0]+', '+rgbDark[1]+', '+rgbDark[2]+', 0.9))');
    document.styleSheets[0].addRule('#context-menu > #arrow.top',
        'border-bottom: 12px solid rgba(' + rgbLight[0] + ', '+
            rgbLight[1] + ', ' + rgbLight[2] + ', 0.9)');
    document.styleSheets[0].addRule('#context-menu > #arrow.left',
        'border-right: 12px solid rgba(' + rgbMed[0] + ', '+
            rgbMed[1] + ', ' + rgbMed[2] + ', 0.9)');
    document.styleSheets[0].addRule('#context-menu > #arrow.right',
        'border-left: 12px solid rgba(' + rgbMed[0] + ', '+
            rgbMed[1] + ', ' + rgbMed[2] + ', 0.9)');
    document.styleSheets[0].addRule('#context-menu > #arrow.bottom',
        'border-top: 12px solid rgba(' + rgbDark[0] + ', '+
            rgbDark[1] + ', ' + rgbDark[2] + ', 0.9)');
    document.styleSheets[0].addRule('#context-menu li:not(.disabled):hover > a,' +
        '#context-menu li:not(.disabled) > a:focus',
        'background:rgba(' + rgb2[0] + ',' + rgb2[1] + ',' + rgb2[2] + ', .75)');
    if (launchpage.rgbToHsl(secondaryColor)[2] > 0.5) {
      document.styleSheets[0].addRule(
          '#context-menu li:not(.disabled):hover > a,' +
          '#context-menu li:not(.disabled) > a:focus',
          'color: #000');
    } else {
      document.styleSheets[0].addRule(
          '#context-menu li:not(.disabled):hover > a,' +
          '#context-menu li:not(.disabled) > a:focus',
          'color: #fff');
    }
  }
}

//Display page action on tabs
setUpCurrentTabs(false);

//Initiate settings
if (!localStorage['background']) localStorage['background'] = 'bg-default';
if (!localStorage['chameleon']) localStorage['chameleon'] = 'true';
if (!localStorage['page-action']) localStorage['page-action'] = 'true';

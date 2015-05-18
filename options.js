/*******************************************************************************
 * Declare variables
 ******************************************************************************/
var launchpage = chrome.extension.getBackgroundPage().launchpage;
var fs, bgThumb;

/*******************************************************************************
 * Option functions
 ******************************************************************************/
function loadPage(page) { //Switch to the specified page
  if (!page) {
    if (localStorage['optionsPage'])
      page = localStorage['optionsPage'];
    else
      page = 'general';
  }
  var navbarItems = document.getElementsByClassName('navbar-item');
  for (var i = 0; i < navbarItems.length; i++) {
    navbarItems[i].classList.remove('navbar-item-selected');
  }
  var pages = document.getElementsByClassName('page');
  for (var i = 0; i < pages.length; i++) {
    pages[i].style.display = 'none';
  }
  document.getElementById(page + 'Page').style.display = 'block';
  document.getElementById(page + 'PageNav').classList.add(
      'navbar-item-selected');
  localStorage['optionsPage'] = page;
}

function loadPrefs(bgDir) {
//Load the saved settings and display them
  document.getElementById('chameleon').checked =
    (localStorage['chameleon'] == 'true');
  document.getElementById('page-action').checked =
    (localStorage['page-action'] == 'true');
  if (localStorage['background-image-url']) {
    //Display the saved background thumbnails
    var dirReader = bgDir.createReader();
    dirReader.readEntries(function(entries) {
      for (var i = 0, entry; entry = entries[i]; ++i) {
        if (entry.isFile) {
          appendThumb(entry.toURL());
          if (localStorage['background'] == 'bg-custom' &&
              localStorage['background-image-url'] == entry.toURL()) {
            setSelected(document.getElementById(entry.toURL()));
          }
        }
      }
    }, errorHandler);
  }
  
  var bg = document.getElementsByName('background');
  for (var i in bg) {
    if (bg[i].id == localStorage['background']) {
      bg[i].checked = 'true';
    }
  }
}

function save(pref) { //Autosave the setting that was just changed
  switch (pref.name) {
    case 'background':
      if (pref.id == 'bg-default') {
        localStorage['background'] = 'bg-default';
        localStorage['background-dominant-color'] = '#000000';
      } else {
        localStorage['background'] = 'bg-custom';
        localStorage['background-image-url'] = pref.id;
        bgThumb = pref.id;
        window.setTimeout(function() {
            setColors(bgThumb + '-thumb');
          }, 1000);
      }
      break;
    case 'background-image':
      var file = event.target.files[0];
      if (!file.type.match('image.*')) {
        alert('The file you selected is not an image. Please retry and select' +
          ' an image file.');
        break;
      }
      writeFile(file);
      break;
    case 'chameleon':
      localStorage['chameleon'] = pref.checked;
      break;
    case 'page-action':
      localStorage['page-action'] = pref.checked;
      chrome.extension.getBackgroundPage().setUpCurrentTabs();
    break;
  }
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

function writeFile(f) { //Write the background image to the filesystem
  fs.root.getFile('backgrounds/' + f.name, {create: true, exclusive: false},
    function(fileEntry) {
      fileEntry.createWriter(function(fileWriter) {
        fileWriter.onwriteend = function(e) {
          localStorage['background'] = 'bg-custom';
          localStorage['background-image-url'] = fileEntry.toURL();
          appendThumb(fileEntry.toURL());
          setSelected(document.getElementById(fileEntry.toURL()));
        };
        fileWriter.onerror = function(e) {
          console.error('Write failed: ' + e.toString());
        };
        fileWriter.write(f);
    }, errorHandler);
  }, errorHandler);
}

function appendThumb(url) {
//Display the saved background thumbnail
  var mainDiv = document.createElement('div');
  var secondDiv = document.createElement('div');
  var bgImg = document.createElement('img');
  var deleteButton = document.createElement('button');
  
  mainDiv.id = url;
  mainDiv.name = 'background';
  mainDiv.className = 'deletable-item';
  mainDiv.setAttribute('role', 'option');
  mainDiv.lead = 'lead';
  mainDiv.setAttribute('aria-selected', 'false');
  mainDiv.addEventListener('click', function(){setSelected(this)}, false);
  mainDiv.addEventListener('mouseover', function() {
    this.childNodes[1].style.backgroundColor = '#fff';
  }, false);
  mainDiv.addEventListener('mouseout', function() {
    this.childNodes[1].style.backgroundColor = 'transparent';
  }, false);
  bgImg.src = url;
  bgImg.className = 'bg-thumb';
  bgImg.id = url + '-thumb';
  deleteButton.className = 'raw-button row-delete-button custom-appearance';
  deleteButton.addEventListener('click', function(){
    removeThumb(this);
    event.stopPropagation();
  }, false);
  
  secondDiv.appendChild(bgImg);
  mainDiv.appendChild(secondDiv);
  mainDiv.appendChild(deleteButton);
  document.getElementById('backgrounds-grid').appendChild(mainDiv);
}

function removeThumb(element) {
  var thumbDiv = element.parentNode;
  fs.root.getFile(decodeURI(thumbDiv.id.substring(74)), {create: false},
    function (bgFile) {
      bgFile.remove(function() {}, errorHandler);
    }, errorHandler);
  if (thumbDiv.getAttribute('selected') == 'selected') {
    setSelected(document.getElementById('bg-default'));
  }
  thumbDiv.parentNode.removeChild(thumbDiv);
}

function setColors(img) {
//Get palette & dominant color in background image
  var dominantColor = getDominantColor(document.getElementById(img));
  localStorage['background-dominant-color'] = '[' + dominantColor + ']';
  var palette = createPalette(document.getElementById(img), 5);
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
  localStorage['background-secondary-color'] = '[' + secondaryColor + ']';
  var colors = [adjustRGB(dominantColor, -30), adjustRGB(dominantColor, -20),
      adjustRGB(dominantColor, -28), adjustRGB(dominantColor, -70),
      adjustRGB(secondaryColor, 0)];
  var paletteString = '[';
  for (var i = 0; i < colors.length; i++) {
    if (i > 0) {
      paletteString += ',';
    }
    paletteString += '[' + colors[i] + ']';
  }
  paletteString += ']';
  localStorage['background-colors'] =
      paletteString;
}

function setSelected(element) {
  document.getElementById('bg-default').removeAttribute('selected');
  document.getElementById('bg-default').setAttribute('aria-selected', 'false');
  var items = document.getElementsByClassName('deletable-item');
  for (var i = 0; i < items.length; i++) {
    if (items[i].getAttribute('selected')) {
      items[i].removeAttribute('selected');
      items[i].setAttribute('aria-selected', 'false');
    }
  }
  element.setAttribute('selected', 'selected');
  element.setAttribute('aria-selected', 'true');
  save(element);
}

function adjustRGB(rgb, amount) {
  if (amount == 0) {
    return rgb;
  }
  var ret = [0, 0, 0];
  for (var i = 0; i < ret.length; i++) {
    ret[i] = rgb[i] + amount;
    if (ret[i] < 0) {
      ret[i] = 0;
    } else if (ret[i] > 255) {
      ret[i] = 255;
    }
  }
  return ret;
}

function differenceRGB(rgb1, rgb2) {
  var ret = [0, 0, 0];
  for (var i = 0; i < ret.length; i++) {
    ret[i] = Math.abs(rgb1[i] - rgb2[i]);
  }
  return ret;
}

/*******************************************************************************
 * Event listeners
 ******************************************************************************/
var navbarItems = document.getElementsByClassName('navbar-item');
for (var i = 0; i < navbarItems.length; i++) {
  if (navbarItems[i].id != 'searchPageNav') {
    navbarItems[i].addEventListener('click', function() {
        loadPage(this.getAttribute('pagename'));
      }, false);
  }
}
document.getElementById('background-image').addEventListener('change',
  function() { save(this) }, false);
document.getElementById('bg-default').addEventListener('click', function(){
  setSelected(this);
}, false);
document.getElementById('chameleon').addEventListener('change', function() {
  save(this);
}, false);
document.getElementById('page-action').addEventListener('change', function() {
  save(this);
}, false);
document.getElementById('getHelpButton').addEventListener('click', function() {
  window.open('help.html');
}, false);
document.getElementById('reportProblemButton').addEventListener('click',
  function() {
    window.location.href =
        'https://chrome.google.com/webstore/support/' +
        launchpage.extensionInfo.id + '#bug';
  }, false);

/*******************************************************************************
 * Post scripts
 ******************************************************************************/
//Webkit-specific requestFileSystem
window.requestFileSystem = window.requestFileSystem ||
    window.webkitRequestFileSystem;

//FIXME: Don't know why this resets, as it is declared in the HTML, but whatever
document.getElementById('bg-default').name = 'background';

//Display extension info in Help tab
document.getElementById('version').innerText = chrome.i18n.getMessage(
    'optionsVersion', launchpage.extensionInfo.version);
document.getElementById('aboutIcon').src = 
    launchpage.extensionInfo.icons[3].url;
document.getElementById('copyright').innerText = chrome.i18n.getMessage(
    'optionsCopyright', new Date().getFullYear().toString());

//Filesystem directory writer adapted from http://www.html5rocks.com
window.webkitStorageInfo.requestQuota(PERSISTENT, 1024*100, //100 MB
  function(grantedBytes) {
    window.requestFileSystem(PERSISTENT, grantedBytes, function(fsys) {
      (function() {
        fs = fsys;
        fs.root.getDirectory(
          'backgrounds',
          {}, //read directory (not write)
          function(dir) { //directory exists
            loadPrefs(dir);
          },
          function() { //directory doesn't exist
            fs.root.getDirectory(
              'backgrounds',
              {create: true}, //create the directory
              function(dir) {
                loadPrefs(dir);
              },
              errorHandler
            );
          }
        );
      })();
    }, errorHandler);
  }, errorHandler);
loadPage();

//Use Chrome's OS detector script to enable platform-specific CSS
//cr.enablePlatformSpecificCSSRules();

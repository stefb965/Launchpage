function findBestIcon(icons) {
//Find the highest resolution icon, then send it back to the launcher
  var icon;
  if (icons.length > 0) {
    for (var i = 0; i < icons.length; i++) {
      icons[i].sizes.sort(function(a,b){return b - a}); //Sort sizes big-small
    }
    icons.sort(largerIcon);
    icon = icons[0].url;
  } else {
    icon = 'screenshot';
  }
  chrome.extension.sendMessage({
    to: 'add.js',
    from: 'icon_finder.js',
    message: {
      description: desc,
      icon: icon,
      title: title,
      url: window.location.href
    }
  });
}

function largerIcon(a, b) {
//Sorts 2 icons by maximum size
  if (!a.sizes && !b.sizes) {
    return 0;
  }
  if (!a.sizes) {
    return 1;
  }
  if (!b.sizes) {
    return -1;
  }
  if (a.sizes[0] > b.sizes[0]) {
    return -1;
  } else if (a.sizes[0] < b.sizes[0]) {
    return 1;
  } else {
    return 0;
  }
}

var title = document.title;
var desc = '';
var metas = document.getElementsByTagName('meta');
for (var i = 0; i < metas.length; i++) { //Check for meta description
  if (metas[i].name == 'description') {
    desc = metas[i].content;
  } else if (metas[i].name == 'apple-mobile-web-app-title') {
    title = metas[i].content;
  }
}
if (title == '') {
  title = '(Untitled)';
}
chrome.extension.sendMessage({ //Send the title for display ASAP
  to: 'add.js',
  from: 'icon_finder.js',
  message: {title: title}
});
var numImgs = 0;
var links = document.getElementsByTagName('link');
var icons = [], obj = [];
var imgs = []; //Stores icons to be checked
var imgsChecked = 0;
for (var i = 0; i < links.length; i++) {
  if (links[i].rel.indexOf('icon') != -1 &&
      links[i].rel.indexOf('shortcut') == -1 &&
      links[i].href.indexOf('favicon.ico') == -1) {
      //Only find icons (Apple or Opera), but not favicons
    numImgs++;
    checkIcon(links[i].href, true);
  }
}
if (!imgs.length) searchFiles();

function checkIcon(url, links) {
  if (!links) links = false;
  obj.push({url: url}); //Start building an entry for the list of possible icons
  imgs.push(new Image()); //Queue this icon to be checked
  imgs[imgs.length-1].onload = function() {
    obj[parseInt(this.id)].sizes = [this.width];
    if (this.width >= 57 && this.height >= 57) { //If it's not super tiny
      icons.push(obj[parseInt(this.id)]); //Add to the list & keep going
    }
    //if (links) { //Whether it is being called by the links loop or searchFiles()
      imgsChecked++; //So we know how many have been checked so far
      if (imgsChecked >= numImgs) { //Are we all done?
        if (!icons.length) { //If we still don't have any good icons
          searchFiles(); //Look for icons in the domain's root
        } else {
          findBestIcon(icons); //Take what we have and find the best one
        }
      }
    //}
  }
  imgs[imgs.length-1].src = url;
  imgs[imgs.length-1].id = (imgs.length-1).toString(); //Keep track of each img
}
function searchFiles() {
  var baseURL = window.location.origin + '/';
  var fileNames = ['apple-touch-icon.png',
    'apple-touch-icon.png-precomposed',
    'apple-touch-icon-144x144-precomposed.png',
    'apple-touch-icon-144x144.png',
    'apple-touch-icon-114x114-precomposed.png',
    'apple-touch-icon-114x114.png',
    'apple-touch-icon-72x72-precomposed.png',
    'apple-touch-icon-72x72.png',
    'apple-touch-icon-57x57-precomposed.png',
    'apple-touch-icon-57x57.png']; //These are the filenames to look for
  var i = 0;
  //Check to see if any Apple touch icons exist in the root of the domain
  var xhr = new XMLHttpRequest();
  xhr.open('HEAD', baseURL + fileNames[i], true); //At this point, we just want
  xhr.onreadystatechange = function() {           //to know if it exists or not
    if (xhr.readyState == 4) {
      if (xhr.status == 200) {
        //Icon exists, add it to the list
        numImgs++;
        checkIcon(baseURL + fileNames[i]);
      }
      //Move on to the next icon
      i++;
      if (i < fileNames.length) { //Are there more to check?
        xhr.open('HEAD', baseURL + fileNames[i], true);
        xhr.send();
      } else {
        if (icons.length == 0 && imgsChecked >= numImgs) { //Still no icons
          findBestIcon(icons); //Send the extension what we do have
        }
      }
    }
  };
  xhr.send();
}

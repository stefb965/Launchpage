var hash = unescape(location.hash).split('&');
var url = hash[0].substring(1);
var host = hash[1];
var id = '';
var extensionInfo;

document.getElementById('host').innerText = host;

document.getElementById('view').addEventListener('click', function() {
  if (document.getElementById('view').innerText == 'View') {
    window.open(url);
  } else if (extensionInfo.isApp) {
    chrome.management.launchApp(id);
  }
}, false);

document.addEventListener('contextmenu', function(event) {
  event.preventDefault();
}, false);

window.onbeforeunload = function() {
  //FIXME: Doesn't prevent the infobar from displaying next time.
  //localStorage doesn't get set like it is supposed to
  localStorage['infobar.hide.' + url] = 'true';
  console.log('infobar.hide.' + url, localStorage['infobar.hide.' + url]);
}

chrome.management.onInstalled.addListener(function(extensionInfo) {
  alert(extensionInfo.id);
  if (extensionInfo.id == id) {
    //They installed the app, so switch to an Open button
    document.getElementById('view').innerText = 'Open';
    document.getElementById('description').innerText =
      extensionInfo.name + ' is installed.';
    if (!extensionInfo.isApp) {
      document.getElementById('view').disabled = 'disabled';
    }
  }
});
//Double check that it really is the Chrome Web Store
if (url.substring(0, 34) == 'https://chrome.google.com/webstore') {
  //Extract the extension ID from the URL
  id = url.substr(url.lastIndexOf('/') + 1, 32);
  //Check if app is installed
  chrome.management.get(id, function(extInfo) {
    if (extInfo) {
      //It's installed, switch to an Open button
      document.getElementById('view').innerText = 'Open';
      document.getElementById('description').innerText =
        extInfo.name + ' is installed.';
      extensionInfo = extInfo;
      if (!extInfo.isApp) {
        document.getElementById('view').disabled = 'disabled';
      }
    }
  });
}

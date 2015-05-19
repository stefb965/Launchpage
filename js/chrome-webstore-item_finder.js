//Looks for <link rel="chrome-webstore-item"> to suggest an app to the user

var links = document.getElementsByTagName('link');

for (var i = 0; i < links.length; i++) {
  if (links[i].rel == 'chrome-webstore-item') {
    chrome.extension.sendMessage({ //Tell the background script to show the infobar
      from: 'chrome-webstore-item_finder.js',
      to: 'launcher.js',
      message: {
        'url': links[i].href,
        'host': window.location.host
      }
    });
  }
}

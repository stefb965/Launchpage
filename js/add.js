/*******************************************************************************
 * Declare variables
 ******************************************************************************/
var details; //Stores the details sent from the content script

/*******************************************************************************
 * Functions
 ******************************************************************************/

function showInfo(url) {
//Displays web clip info in popup
  $("#icon").attr("src", url).show();
  $("#loading").hide();
  $("#add").removeAttr("disabled");
}

function randomId() {
//Generates a random hex id in Chrome's app id format
  var str = "";
  for (var i = 0; i < 32; i++) {
    str += String.fromCharCode(Math.floor(Math.random() * 16) + 97);
  }
  return str;
}

function dataURItoBlob(dataURI) {
//Convert base64 to raw binary data held in a string
  //(doesn't handle URLEncoded DataURIs)
  var byteString = atob(dataURI.split(",")[1]);
  //Separate out the mime component
  var mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0]
  //Write the bytes of the string to an array
  var array = [];
  for (var i = 0; i < byteString.length; i++) {
    array.push(byteString.charCodeAt(i));
  }
  //Write the array to a blob and return
  return new Blob([new Uint8Array(array)], {type: mimeString});
}

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

/*******************************************************************************
 * Event listeners
 ******************************************************************************/

//Listen for the content script trying to communicate
chrome.extension.onMessage.addListener(function(msg) {
  if (msg.to == "add.js" && msg.from == "icon_finder.js") { //It's for us
    details = msg.message; //Save the details for later, too
    if (details.url) { //If it's the complete info, not just the title
      details.id = randomId();
      if (details.icon == "screenshot") { //If no icons are found, take a screenshot
        console.log("Taking screenshot...");
        chrome.tabs.captureVisibleTab({"quality": 100}, function(dataUrl) {
          //Shrink the screenshot & convert it to a blob
          var canvas = document.createElement("canvas"); //Will use to apply effects
          canvas.style.display = "none"; //We don't want it to be visible, of course
          document.body.appendChild(canvas);
          var context = canvas.getContext("2d");
          var img = new Image();
          img.onload = function() {
            var width = 128, height = 128;
            if (this.width > this.height) { //If the screenshot is landscape
              height = 128*this.height/this.width;
            } else { //If the screenshot is portrait
              width = 128*this.width/this.height;
            }
            canvas.width = 128; //Make the canvas icon-sized
            canvas.height = 128;
            //Draw the image data centered in the canvas
            context.drawImage(this, (128-width)/2, (128-height)/2, width, height);
            details.icon = canvas.toDataURL();
            document.body.removeChild(canvas); //Dispose of the canvas - we're done
            showInfo(details.icon);
          };
          img.src = dataUrl; //Load the screenshot into the image for processing
        });
      } else {
        showInfo(details.icon);
      }
    } else { //Nope, just the title was sent
      document.getElementById("title").disabled = "";
      document.getElementById("title").value = details.title;
      document.getElementById("title").select();
    }
  }
});

document.getElementById("add").addEventListener("click", function() {
  details.title = document.getElementById("title").value;
  if (document.getElementById("icon").src.substring(0, 22) ==
      "data:image/png;base64,") { //The icon is a screenshot
    //Convert icon to blob
    var imgBlob = dataURItoBlob(document.getElementById("icon").src);
    //Webkit support for requestFileSystem
    window.requestFileSystem = window.requestFileSystem ||
        window.webkitRequestFileSystem;
    window.requestFileSystem(PERSISTENT, 1024*1024, function(fs) {
      fs.root.getDirectory("icons", {create: true}, function(dirEntry) {
        var name = details.id + ".png";
        dirEntry.getFile(name, {create: true}, function(fileEntry) {
          fileEntry.createWriter(function(fileWriter) {
            fileWriter.onwriteend = function(e) {
              details.icon = fileEntry.toURL();    //Get the screenshot URL
              chrome.extension.sendMessage({       //and send it to the
                to: "launcher.js",                 //background page
                from: "add.js",
                message: details
              }, window.close);
            };
            fileWriter.onerror = function(e) {
              console.log("Write failed: " + e.toString());
            };
            fileWriter.write(imgBlob); //Write the screenshot to a file
          }, errorHandler);
        }, errorHandler);
        }, errorHandler);
    }, errorHandler);
  } else { //The icon is a file
    chrome.extension.sendMessage({ //Tell the background script about the icon
      to: "launcher.js",
      from: "add.js",
      message: details
    }, window.close);
  }
  //window.close();
}, false);

document.getElementById("title").addEventListener("keypress", function(event) {
  if (event.keyCode == 13) { //They pressed Enter
    document.getElementById("add").click();
  }
}, false);

document.getElementById("title").addEventListener("input", function() {
  if (document.getElementById("title").value == "") {
    document.getElementById("add").disabled = "disabled";
  } else {
    document.getElementById("add").disabled = "";
  }
}, false);

document.getElementById("cancel").addEventListener("click", function() {
  window.close();
}, false);

/*******************************************************************************
 * Post scripts
 ******************************************************************************/

chrome.tabs.executeScript(null, {file: "js/icon_finder.js"}); //Inject the content script

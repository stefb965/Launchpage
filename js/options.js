/*******************************************************************************
 * Declare variables
 ******************************************************************************/
var launchpage = chrome.extension.getBackgroundPage().launchpage;
var fs;
var bgImg = new Image();

/*******************************************************************************
 * Option functions
 ******************************************************************************/

/**
 * Loads and displays the saved settings.
 */
function loadPrefs() {
  $("#background").attr("checked", (localStorage["background"] == "bg-custom"));

  //Enable/disable the other background settings
  if (localStorage["background"] == "bg-custom") {
    $("#background-image, #chameleon").removeAttr("disabled");
  } else {
    $("#background-image, #chameleon").attr("disabled", "true");
  }

  $("#chameleon").attr("checked", (localStorage["chameleon"] == "true"));
  $("#page-action").attr("checked", (localStorage["page-action"] == "true"));
}

/**
 * Autosaves a setting.
 */
function save() {
  switch (this.name) {
    case "background":
      if (this.checked) {
        localStorage["background"] = "bg-custom";
      } else {
        localStorage["background"] = "bg-default";
      }
      break;
    case "background-image":
      var file = event.target.files[0];
      if (!file.type.match("image.*")) {
        alert("The file you selected is not an image. Please retry and select" +
          " an image file.");
      } else {
        writeFile(file);
      }
      break;
    case "chameleon":
      localStorage["chameleon"] = this.checked;
      break;
    case "page-action":
      localStorage["page-action"] = this.checked;
      if (this.checked) {
        //Show the page action
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

        chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
          chrome.declarativeContent.onPageChanged.addRules([pageActionRule]);
        });
      } else {
        //Hide the page action
        chrome.declarativeContent.onPageChanged.removeRules();
      }
      break;
  }
}

/**
 * Prints infomation about an error.
 */
function errorHandler(e) {
  var msg;
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
 * Writes an image to the backgrounds folder.
 *
 * @param f
 *        The file to write
 */
function writeFile(f) {
  fs.root.getFile("backgrounds/bg-custom.jpg", {create: true, exclusive: false},
    function(fileEntry) {
      fileEntry.createWriter(function(fileWriter) {
        fileWriter.onwriteend = function(e) {
          localStorage["background"] = "bg-custom";
          localStorage["background-image-url"] = fileEntry.toURL();
          bgImg.src = fileEntry.toURL();
          setTimeout(function() {
            setColors(bgImg);
          }, 1000);
        };
        fileWriter.onerror = function(e) {
          console.error("Write failed: " + e.toString());
        };
        fileWriter.write(f);
    }, errorHandler);
  }, errorHandler);
}

/**
 * Detects and stores the primary color palette of the image.
 *
 * @param img
 *        The image object to process
 */
function setColors(img) {
  var colorThief = new ColorThief();
  var palette = colorThief.getPalette(img, 5);
  localStorage["background-colors"] = JSON.stringify(palette);
}

/*******************************************************************************
 * Event listeners
 ******************************************************************************/

$("#background, #background-image, #chameleon, #page-action").on("change", save);

$("#background").on("change", function(){
  //Enable/disable the other background settings
  if (this.checked) {
    $("#background-image, #chameleon").removeAttr("disabled");
  } else {
    $("#background-image, #chameleon").attr("disabled", "true");
  }
});

/*******************************************************************************
 * Post scripts
 ******************************************************************************/

navigator.webkitPersistentStorage.requestQuota(1024*1024*100, //100 MB
  function(grantedBytes) {
    window.webkitRequestFileSystem(PERSISTENT, grantedBytes, function(fsys) {
      (function() {
        fs = fsys;
        fs.root.getDirectory(
          "backgrounds",
          {}, //read directory (not write)
          function(dir) { //directory exists
            //Do nothing
          },
          function() { //directory doesn't exist
            fs.root.getDirectory(
              "backgrounds",
              {create: true}, //create the directory
              function(dir) {
                //Do nothing
              },
              errorHandler
            );
          }
        );
      })();
    }, errorHandler);
  }, errorHandler);

loadPrefs();

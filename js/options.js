/*******************************************************************************
 * Declare variables
 ******************************************************************************/
var launchpage = chrome.extension.getBackgroundPage().launchpage;
var fs, bgImg;

/*******************************************************************************
 * Option functions
 ******************************************************************************/

/**
 * Loads and displays the saved settings.
 *
 * @param bgDir
 *        The extension directory containing the user's backgrounds
 */
function loadPrefs(bgDir) {
  document.getElementById("chameleon").checked =
    (localStorage["chameleon"] == "true");
  document.getElementById("page-action").checked =
    (localStorage["page-action"] == "true");
  
  var bg = document.getElementsByName("background");
  for (var i in bg) {
    if (bg[i].id == localStorage["background"]) {
      bg[i].checked = "true";
    }
  }
}

/**
 * Autosaves a setting.
 *
 * @param pref
 *        The HTML element whose value just changed
 */
function save(pref) {
  switch (pref.name) {
    case "background":
      if (pref.id == "bg-default") {
        localStorage["background"] = "bg-default";
        localStorage["background-dominant-color"] = "#000000";
      } else {
        localStorage["background"] = "bg-custom";
        localStorage["background-image-url"] = pref.id;
        bgImg = new Image(pref.id);
        window.setTimeout(function() {
            setColors(bgImg);
          }, 1000);
      }
      break;
    case "background-image":
      var file = event.target.files[0];
      if (!file.type.match("image.*")) {
        alert("The file you selected is not an image. Please retry and select" +
          " an image file.");
        break;
      }
      writeFile(file);
      break;
    case "chameleon":
      localStorage["chameleon"] = pref.checked;
      break;
    case "page-action":
      localStorage["page-action"] = pref.checked;
      chrome.extension.getBackgroundPage().setUpCurrentTabs();
      break;
  }
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
 * Writes a file to the backgrounds folder.
 *
 * @param f
 *        The file to write
 */
function writeFile(f) {
  fs.root.getFile("backgrounds/" + f.name, {create: true, exclusive: false},
    function(fileEntry) {
      fileEntry.createWriter(function(fileWriter) {
        fileWriter.onwriteend = function(e) {
          localStorage["background"] = "bg-custom";
          localStorage["background-image-url"] = fileEntry.toURL();
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
  var dominantColor = getDominantColor(img);
  localStorage["background-dominant-color"] = "[" + dominantColor + "]";
  var palette = createPalette(img, 5);
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
  localStorage["background-secondary-color"] = "[" + secondaryColor + "]";
  var colors = [adjustRGB(dominantColor, -30), adjustRGB(dominantColor, -20),
      adjustRGB(dominantColor, -28), adjustRGB(dominantColor, -70),
      adjustRGB(secondaryColor, 0)];
  var paletteString = "[";
  for (var i = 0; i < colors.length; i++) {
    if (i > 0) {
      paletteString += ",";
    }
    paletteString += "[" + colors[i] + "]";
  }
  paletteString += "]";
  localStorage["background-colors"] =
      paletteString;
}

/**
 * Increments or decrements the RGB value by the given amount.
 *
 * @param rgb
 *        An array of [red, green, blue] values from 0 to 255
 * @param amount
 *        The signed integer to add to each RGB component
 *
 * @note Uses saturated arithmetic to keep values between 0 and 255.
 */
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

/**
 * Calculates the difference in each component between two RGB values.
 *
 * @param rgb1
 *        An array of [red, green, blue] values from 0 to 255
 * @param rgb2
 *        An array of [red, green, blue] values from 0 to 255
 */
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

$("#custom-bg").on("click", function(){
  if (this.checked) {
    $("#background-image, #chameleon").removeAttr("disabled");
  } else {
    $("#background-image, #chameleon").attr("disabled", "true");
  }
});

$("#background-image").on("change", function() {
  save(this);
});

$("#chameleon").on("change", function() {
  save(this);
});

$("#page-action").on("change", function() {
  save(this);
});

/*******************************************************************************
 * Post scripts
 ******************************************************************************/

navigator.webkitPersistentStorage.requestQuota (1024*100, //100 MB
  function(grantedBytes) {
    window.webkitRequestFileSystem(PERSISTENT, grantedBytes, function(fsys) {
      (function() {
        fs = fsys;
        fs.root.getDirectory(
          "backgrounds",
          {}, //read directory (not write)
          function(dir) { //directory exists
            loadPrefs(dir);
          },
          function() { //directory doesn't exist
            fs.root.getDirectory(
              "backgrounds",
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

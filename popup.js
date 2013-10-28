/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

var backgroundPage = chrome.extension.getBackgroundPage();
var imports = ["require", "isWhitelisted", "extractHostFromURL", "refreshIconAndContextMenu", "getBlockedData", "console", "whitelistUrl"];
for (var i = 0; i < imports.length; i++)
  window[imports[i]] = backgroundPage[imports[i]];

var Filter = require("filterClasses").Filter;
var FilterStorage = require("filterStorage").FilterStorage;

var tab = null;

function init()
{
  // Attach event listeners
  $("#enabled").click(toggleEnabled);
  
  // Ask content script whether clickhide is active. If so, show cancel button.
  // If that isn't the case, ask background.html whether it has cached filters. If so,
  // ask the user whether she wants those filters.
  // Otherwise, we are in default state.
  chrome.windows.getCurrent(function(w)
  {
    chrome.tabs.getSelected(w.id, function(t)
    {
      tab = t;
      document.getElementById("enabled").checked = !isWhitelisted(tab.url);
      document.getElementById("enabledCheckboxAndLabel").style.display = "block";
    });
  });
}
$(init);

function toggleEnabled()
{
  var checked = document.getElementById("enabled").checked;
  if (checked)
  {
    // Remove any exception rules applying to this URL
    var filter = isWhitelisted(tab.url);
    while (filter)
    {
      FilterStorage.removeFilter(filter);
      if (filter.subscriptions.length)
        filter.disabled = true;
      filter = isWhitelisted(tab.url);
    }
  }
  else
  {
    var host = extractHostFromURL(tab.url).replace(/^www\./, "");
    var filter = Filter.fromText("@@||" + host + "^$document");
    if (filter.subscriptions.length && filter.disabled)
      filter.disabled = false;
    else
    {
      filter.disabled = false;
      FilterStorage.addFilter(filter);
    }
  }

  refreshIconAndContextMenu(tab);
}

// ugly helpers: not to be used!
function _addOriginHTML(origin, origin_id, printable, blocked) {
  console.log("Popup: adding origin HTML for " + origin);
  var classText = 'class="clicker"'
  if (blocked)
    classText = 'class="clicker blocked"';
  return printable + '<div class="click-nav"><ul class="js"><li> \
    <a id="' + origin_id + '" href="#" ' + classText + '>' + origin + '</a></li></ul></div>';
}

function toggleBlockedStatus(elt) {
  var classList = elt.className.split(" ");
  if ($.inArray("blocked", classList) != -1) {
    $(elt).toggleClass("blocked");
  }
  else if ($.inArray("cookieblocked", classList) != -1) {
    $(elt).toggleClass("blocked");
    $(elt).toggleClass("cookieblocked");
  }
  else {
    $(elt).toggleClass("cookieblocked");
  }
}

function addBlocked(tab) {
  var blockedData = getBlockedData(tab.id);
  if (blockedData != null) {
    var printable = "Suspicious 3rd party domains in this page.  Red: we've blocked it; yellow: only cookies blocked; blue: no blocking yet";
    for (var origin in blockedData) {
      // todo: fix; this causes collisions e.g. a.foo.com and afoo.com
      var origin_id = origin.replace(/\W/g, '');
      console.log("menuing " + origin + " -> " + JSON.stringify(blockedData[origin]));
      var criteria = blockedData[origin];
      var originBlocked = criteria["frequencyHeuristic"] && !criteria[window.whitelistUrl];
      // todo: gross hack
      printable = _addOriginHTML(origin, origin_id, printable, originBlocked);
      console.log("Popup: done loading origin " + origin);
    }
    document.getElementById("blockedResources").innerHTML = printable;
    $('.clicker').click(function() {
      toggleBlockedStatus(this);
    });
  }
  else
    document.getElementById("blockedResources").innerHTML = "No blockworthy resources found :)";
}

document.addEventListener('DOMContentLoaded', function () {
  chrome.tabs.getSelected(null, addBlocked);
});
/**
 * FetLife Profile Sheets
 *
 * This file provides utility functions that enable easy manipulation of FetLife
 * Profile user data within Google Spreadsheets. Each user record is stored in a
 * single row in a spreadsheet. The spreadsheets themselves are organized in sets
 * of logical "volumes" whose capacity is equal to the <code>CONFIG.db_spreadsheet_rows</code>
 * variable. Collectively, this set of spreadsheets is known as the "user database."
 *
 * @author <a href="https://maybemaimed.com/tag/fetlife/">maymay</a>
 */
// TODO: Make an actual config option that all files can use...?
var CONFIG = {};
CONFIG.debug = true;
CONFIG.db_spreadsheet_name = 'FetLife ASL Search Results';
CONFIG.db_spreadsheet_rows = 50000; // The number of records per Sheet "Volume."
CONFIG.db_spreadsheet_cols = 30;
CONFIG.db_spreadsheet_property_prefix = 'SPREADSHEET_ID_OF_VOLUME_'; // TODO: Move this to its own spreadsheet?
CONFIG.db_sheet_name = 'FetLife DB';
CONFIG.fieldset_range = 'A1:AC1';
CONFIG.Fields = {
  // The order of the elements of these arrays matter.
  // TODO: Make the order not matter?
  'headings_nicename': [
    'Last Updated',
    'User ID',
    'Nickname',
    'Age',
    'Gender',
    'Role',
    'Friend Count',
    'Paid Account?',
    'Locality',
    'Region',
    'Country',
    'Avatar URL',
    'Sexual Orientation',
    'Interest Level ("Active")',
    'Looking For',
    'Vanilla Relationships',
    'D/s Relationships',
    'Bio ("About Me")',
    'Websites',
    'Last Activity',
    'Fetishes Into',
    'Fetishes Curious About',
    'Number of Pictures',
    'Number of Videos',
    'Latest Writings',
    'Groups Lead',
    'Groups Member Of',
    'Events Going To',
    'Events Maybe Going To'
  ],
  'headings': [
    'last_updated',
    'user_id',
    'nickname',
    'age',
    'gender',
    'role',
    'friend_count',
    'paid_account',
    'location_locality',
    'location_region',
    'location_country',
    'avatar_url',
    'sexual_orientation',
    'interest_level',
    'looking_for',
    'relationships',
    'ds_relationships',
    'bio',
    'websites',
    'last_activity',
    'fetishes_into',
    'fetishes_curious_about',
    'num_pics',
    'num_vids',
    'latest_posts',
    'groups_lead',
    'groups_member_of',
    'events_going_to',
    'events_maybe_going_to'
  ]
}

/**
 * Simple utility logger.
 */
function debugLog (data) {
  if (CONFIG.debug) { Logger.log(data); }
}

/**
 * Returns the Range of cells of the given sheet's headers.
 *
 * @param {Sheet} The Google Sheet from which to get the range.
 * @return {Range} The Google Sheet's Range of headers.
 */
function getHeaderRange (sheet) {
  return sheet.getRange(CONFIG.fieldset_range);
}

/**
 * Gets a column index by looking up its name. A column's "name" is the
 * formula (string) inside its top row.
 *
 * @param {Sheet} sheet The Google Sheet in which to look.
 * @param {string} name The name of the column.
 * @return {Integer|boolean} The column's numeric index
 *          (starting from 1, so it can be used to call ranges)
 *          or <code>FALSE</code> if the column name isn't found.
 */
function lookupColumnByName (sheet, name) {
  var v = getHeaderRange(sheet).getValues();
  for (var i = 0; i < v[0].length; i++) {
    if (name === v[0][i]) { return i + 1; }
  }
  return false;
}

/**
 * Gets the row index that a given User ID is saved in.
 *
 * @param {Sheet} sheet The Google Sheet in which to look.
 * @param {Integer} user_id The User ID value to search for.
 * @return {Integer|boolean} The row's numeric index
 *          (starting from 1, so it can be used to call ranges)
 *          or <code>FALSE</code> if the User ID isn't found.
 */
function lookupRowByUserId (sheet, user_id) {
  var col_index = lookupColumnByName(sheet, 'User ID');
  var last_row = sheet.getLastRow();
  var values = sheet.getRange(1, col_index, last_row).getValues();
  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      if (user_id == values[i][j]) { return i + 1; }
    }
  }
  return false;
}

/**
 * Gets the correct Volume number for the User ID.
 *
 * @param {Integer} user_id The User ID value to sort into a Volume.
 * @return {Integer} The Volume number for this user account belongs in.
 */
function lookupVolumeNumberByUserId (user_id) {
  var volume = parseInt(
    (user_id - 1) // User IDs begin at 1, not 0
    /
    CONFIG.db_spreadsheet_rows
  );
  return volume + 1; // Volume numbers begin at 1, not 0
}

/**
 * Gets all known volume numbers.
 *
 * @return {Object} An object whose keys are volume numbers and values are
 *                  those volumes' Spreadsheet IDs.
 */
function getVolumes () {
  var c = CacheService.getScriptCache();
  var x = JSON.parse(c.get('script_properties_cache'));
  if (null === x) {
    var x = PropertiesService.getScriptProperties().getProperties();
    c.put('script_properties_cache', JSON.stringify(x), 21600); // maximum cache lifetime of 6 hours
  }
  var vols = {};
  for (key in x) {
    if (0 === key.indexOf(CONFIG.db_spreadsheet_property_prefix)) {
      var parts = key.split('_');
      var volume_number = parts[parts.length - 1];
      // TODO: Why is there sometimes a "NaN" volume?
      if ('NaN' !== volume_number) {
        vols[volume_number] = x[key];
      }
    }
  }
  return vols;
}

/**
 * Gets the Google Spreadsheet ID corresponding to the given volume number.
 *
 * @param {Integer} volume_number The volume number.
 * @return {string|null} The Google Spreadsheet ID to which the volume number corresponds,
 *                       or null if not found.
 */
function getSpreadsheetIdByVolumeNumber (num) {
  var ss_id = null;
  var vols = getVolumes();
  if (vols[num]) {
    ss_id = vols[num];
  }
  return ss_id;
}

/**
 * Gets the URL of the spreadsheet associated with the given volume number.
 *
 * @param {Integer} volume_number The volume number.
 * @return {string|null} URL of the Google Spreadsheet to which the volume number corresponds,
 *                       or null if not found.
 */
function getSpreadsheetUrlByVolumeNumber (num) {
  var ss_id = getSpreadsheetIdByVolumeNumber(num);
  var url = null;
  if (ss_id) {
    url = getSpreadsheetUrlById(ss_id);
  }
  return url;
}

/**
 * Gets the URL of a spreadsheet based on the spreadsheet's ID value.
 *
 * @param {string} ss_id The spreadsheet's ID.
 * @return {string} The URL of the spreadsheet.
 */
function getSpreadsheetUrlById (ss_id) {
  return 'https://docs.google.com/spreadsheets/d/' + ss_id;
}

/**
 * A simple function to kinda-sorta stagger the cache expiration time.
 *
 * @return {Integer}
 */
function getCacheExpiration () {
  var max = 21600; // maximum CacheService expiration time in seconds
  var x = parseInt(Math.random() * 10) + 1;
  return max / x;
}

/**
 * Sends a Google Data Query Language query to a Google Spreadsheet.
 *
 * @param {string} ss_id The ID of the Google Spreadsheet.
 * @param {string} query The query.
 * @param {string} format Format of the results. Can be one of <code>html</code>, <code>csv</code>, or <code>jsonp</code> (the default).
 * @return {HTTPResponse}
 */
function querySpreadsheet (ss_id, query, format) {
  var url = getSpreadsheetUrlById(ss_id) + '/gviz/tq?tq=' + encodeURIComponent(query);
  if (format) {
    url += '&tqx=out:' + encodeURIComponent(format);
  }
  debugLog('Retrieving data from query endpoint ' + url);
  var cache = CacheService.getScriptCache();
  var cache_key = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, url));
  resp = cache.get(cache_key);
  if (resp === null) {
    debugLog('Cache miss, refetching data from spreadsheet at ' + url);
    try {
      resp = UrlFetchApp.fetch(url).getContentText();
    } catch (ex) {
      debugLog('Caught exception: ' + ex);
    }
    try {
      // TODO: Find a way to cache even when value too large?
      cache.put(cache_key, resp, getCacheExpiration());
    } catch (ex) {
      debugLog('Caught exception: ' + ex);
    }
  }
  return resp;
}

/**
 * Runs a Google Data Query against all known spreadsheet volumes and returns the result.
 *
 * @param {string} query The Google Data Query query.
 * @param {string} format Format of the results. Can be one of <code>html</code>, <code>csv</code>, or <code>jsonp</code> (the default).
 * @return {Object} JSON or multidimensional array data representing the values of the result set as queried in the format requested.
 */
function queryAllSpreadsheets (query, format) {
  var vols = getVolumes();
  var replies = [];
  for (n in vols) {
    replies.push(querySpreadsheet(vols[n], query, format));
  }

  for (x in replies) {
    switch (format) {
// TODO:
//      case 'html':
//        replies[x] = getHtmlResponse(replies[x]);
//        break;
      case 'csv':
        replies[x] = Utilities.parseCsv((replies[x]));
        break;
      case 'json':
      case 'jsonp':
      default:
        replies[x] = parseJsonpResponse(replies[x]);
        break;
    }
  }

  var result = replies[0];
  for (var i = 1; i < replies.length; i++) {
    switch (format) {
      case 'csv':
        result = result.concat(replies[i].splice(1));
        break;
      case 'json':
      case 'jsonp':
      default:
          result.table.rows = result.table.rows.concat(replies[i].table.rows);
        break;
    }
  }
  return result;
}

/**
 * Parses a JSONP response from a spreadsheet data query.
 *
 * @param {string} response_text The JSONP-formatted response text.
 * @return {Object}
 */
function parseJsonpResponse (response_text) {
  // Strip the callback, we just want the JSON data.
  var json_str = response_text.substr(0, response_text.length - 2)
    .replace('google.visualization.Query.setResponse(', '');
  var json = JSON.parse(json_str);
  if ('error' === json.status) {
    throw new Error(json.errors[0].detailed_message);
  }
  return json;
}

/**
 * Makes a new spreadsheet to house records that are sorted into the given volume.
 *
 * @param {Integer} volume_number The volume number of the new spreadsheet.
 * @return {Spreadsheet} The Google Spreadsheet object created.
 */
function createSpreadsheetForVolume (volume_number) {
  var ss = SpreadsheetApp.create(
    CONFIG.db_spreadsheet_name + ', Volume ' + volume_number,
    CONFIG.db_spreadsheet_rows,
    CONFIG.db_spreadsheet_cols
  );

  setupSheet(ss.getActiveSheet());

  var c = CacheService.getScriptCache();
  var p = PropertiesService.getScriptProperties();
  p.setProperty(CONFIG.db_spreadsheet_property_prefix + volume_number, ss.getId());
  var prop_cache = JSON.parse(c.get('script_properties_cache'));
  prop_cache[CONFIG.db_spreadsheet_property_prefix + volume_number] = ss.getId();
  c.put('script_properties_cache', JSON.stringify(prop_cache), 21600); // maximum cache lifetime of 6 hours

  var file = DriveApp.getFileById(ss.getId());
  file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
  return ss;
}

/**
 * Prepares a Sheet to house FetLife ASL Search scrape cache.
 *
 * @param {Sheet} The Google Sheet to prepare.
 * @return {void}
 */
function setupSheet (sheet) {
  sheet.setName(CONFIG.db_sheet_name);
  // TODO: Change this from "append" to ensure
  //       always the first row is getting written to.
  var index = sheet.appendRow(CONFIG.Fields.headings_nicename).getLastRow();
  sheet.setFrozenRows(index);
  var range = getHeaderRange(sheet);
  range.setFontWeight('bold');
  range.setHorizontalAlignment('center');
  range.setVerticalAlignment('middle');
  range.setWrap(true);
}
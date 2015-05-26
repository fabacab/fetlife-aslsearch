/**
 * FetLife ASL Search Server
 *
 * @author <a href="https://maybemaimed.com/tag/fetlife/">maymay</a>
 */

function doGet (e) {
  var output;
  switch (e.parameter.action) {
    case 'query':
      output = doQuery(e);
      break;
    default:
      output = HtmlService
        .createTemplateFromFile('index')
        .evaluate()
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
      break;
  }
  return output;
}

function doPost (e) {
  var profile_data = JSON.parse(e.parameter.post_data);
  var volume_number = lookupVolumeNumberByUserId(profile_data.user_id);
  var ss_id = getSpreadsheetIdByVolumeNumber(volume_number);
  var ss;
  try {
      ss = SpreadsheetApp.openById(ss_id);
  } catch (ex) {
    debugLog('No spreadsheet with ID ' + ss_id + ', creating a new one');
    ss = createSpreadsheetForVolume(volume_number);
  }
  sheet = ss.getSheetByName(CONFIG.db_sheet_name);
  var result = saveProfileData(sheet, profile_data);
  result.coords.vol = volume_number;
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Processes an HTTP GET with the action=query parameter set.
 *
 * @param {object} e Parameters from the HTTP GET or POST event.
 * @return {TextOutput} A TextOutput object with the appropriate MIME type.
 */
function doQuery (e) {
  e.parameter.tq = e.parameter.tq || '';
  e.parameter.prefix = e.parameter.prefix || 'google.visualization.Query.setResponse';
  var result = queryAllSpreadsheets(e.parameter.tq, e.parameter.format);

  var output;
  switch (e.parameter.format) {
    case 'csv':
      output = ContentService.createTextOutput();
      for (row in result) {
        for (cell in result[row]) {
          result[row][cell] = '"' + result[row][cell].replace(/"/g, '\\"') + '"';
        }
        output.append(result[row].join(',') + "\n");
      }
      output.setMimeType(ContentService.MimeType.CSV).downloadAsFile('data.csv');
    break;
    case 'json':
      output = ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      break;
    case 'jsonp':
    default:
      output = ContentService.createTextOutput(e.parameter.prefix + '(' + JSON.stringify(result) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    break;
  }
  return output;
}

/**
 * Adds data to a spreadsheet.
 *
 * @param {Sheet} sheet The Google Sheet to add data to.
 * @param {Object} data An object with named properties to add to the sheet.
 * @return {Object}
 */
function saveProfileData (sheet, data) {
  // Prepare cell values.
  for (var key in data) {
    if (data[key] instanceof Array) {
      if (0 === data[key].length) { data[key] = ''; }
      else {
        // prepend an apostrophe to prevent Google Sheets from auto-formatting
        data[key] = "'" + data[key].join(',');
      }
    }
  }

  // Lookup the destination coordinates of the data POST'ed to us.
  // TODO: Can this be optimized without losing per-cell precision?
  var row_index = lookupRowByUserId(sheet, data.user_id);
  if (!row_index) {
    row_index = sheet.getLastRow() + 1;
  }
  var range = sheet.getRange(row_index, 1);
  range.setValue(Date.now()); // update the last scrape time
  var cols = [];
  for (var key in data) {
    var col_name = CONFIG.Fields.headings_nicename[CONFIG.Fields.headings.indexOf(key)];
    var col_index = lookupColumnByName(sheet, col_name);
    cols.push(col_index);
    debugLog(
      'Writing cell value to spreadsheet '
      + sheet.getParent().getId() + ' at ' + row_index + ',' + col_index
      + ' ("' + key + '" : "' + data[key] + '")'
    );
    range = sheet.getRange(row_index, col_index);
    range.setValue(data[key]);
  }
  return {
    'status': "ok",
    'coords': {
      'row': row_index,
      'col': cols
    }
  };
}

/**
 * Handler for the main search form.
 */
function processSearchForm (form_object) {
  return queryAllSpreadsheets(buildQuery(form_object), 'csv');
}

/**
 * Constructs a Google Query Language query appropriate to a GViz search.
 *
 * @param {object} params Parameters passed from the client.
 * @return {string} A Google Query Language query matching the parameters.
 */
function buildQuery (params) {
  // always add "where C is not null" to the query to avoid getting inactive user IDs
  var query = 'select L, B, C, D, E, F, G, I, J, K, M, N, O where C is not null';
  for (var x in params) {
    if (params[x]) {
      switch (x) {
        case 'min_age':
          query += ' and D <= ' + params[x];
          break;
        case 'max_age':
          query += ' and D >= ' + params[x];
          break;
        case 'user[sex]':
          query += ' and (';
          for (var i in params[x]) {
            query += 'E="' + params[x][i] + '"';
            if (i < params[x].length - 1) { query += ' or '; }
          }
          query += ')';
          break;
        case 'user[role]':
          query += ' and (';
          for (var i in params[x]) {
            query += 'F="' + params[x][i] + '"';
            if (i < params[x].length - 1) { query += ' or '; }
          }
          query += ')';
          break;
        case 'location':
          var loc_cols = ['I', 'J', 'K'];
          query += ' and (';
          for (var i in loc_cols) {
            query += loc_cols[i] + '=lower("' + params[x] + '")';
            if (i < loc_cols.length - 1) { query += ' or '; }
          }
          query += ')';
          break;
      }
    }
  }
  query += ' limit 10'; // 10 per volume, so with 100 volumes, up to 10*100 results per query
  if (params.offset) {
    query += ' offset ' + params.offset;
  }
  Logger.log('Built query: ' + query);
  return query;
}
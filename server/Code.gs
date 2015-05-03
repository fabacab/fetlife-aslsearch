/**
 * FetLife ASL Search Server
 *
 * @author <a href="http://maybemaimed.com/">maymay</a>
 */
var CONFIG = {
  'spreadsheet_id': '1kVxcgdyJtwuG72bg4NX-0x5Hpiqui0tnikdKTrcGlH0',
  'db_sheet_name': 'FetLife DB',
  'fieldset_range': 'A1:AC1'
};
var SHEET = SpreadsheetApp.openById(CONFIG.spreadsheet_id).getSheetByName(CONFIG.db_sheet_name);

function doGet (e) {
  return ContentService.createTextOutput(JSON.stringify({'hello':'world'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost (e) {
//  Logger.log(e);
  var profile_data = JSON.parse(e.parameter.post_data);
  saveProfileData(SHEET, profile_data);
}

/**
 * Adds data to a spreadsheet.
 * 
 * @param {Sheet} sheet The Google Sheet to add data to.
 * @param {Object} data An object with named properties to add to the sheet.
 * @return {void}
 */
function saveProfileData (sheet, data) {
  // Collect the new data to data. (The order matters.)
  var cells = [Date.now()];
  cells.push(data.user_id);
  cells.push(data.nickname);
  cells.push(data.age);
  cells.push(data.gender);
  cells.push(data.role);
  cells.push(data.friend_count);
  cells.push(data.paid_account);
  cells.push(data.location.locality);
  cells.push(data.location.region);
  cells.push(data.location.country);
  cells.push('=IMAGE("' + data.avatar_url + '")');
  cells.push(data.sexual_orientation);
  cells.push(data.interest_level);
  cells.push(JSON.stringify(data.looking_for));
  cells.push(JSON.stringify(data.relationships));
  cells.push(JSON.stringify(data.ds_relationships));
  cells.push(data.bio);
  cells.push(JSON.stringify(data.websites));
  cells.push(data.last_activity);
  cells.push(JSON.stringify(data.fetishes_into));
  cells.push(JSON.stringify(data.fetishes_curious_about));
  cells.push(data.latest_pics);
  cells.push(data.latest_vids);
  cells.push(data.groups_lead);
  cells.push(data.groups_member_of);
  cells.push(data.events_going_to);
  cells.push(data.events_maybe_going_to);

  var row_index = lookupRowByUserId(data.user_id);
  Logger.log(row_index);
  if (row_index) {
    var r = sheet.getRange(row_index, 1, 1, cells.length);
    r.setValues([cells]);
  } else {
    sheet.appendRow(cells);
  }
}
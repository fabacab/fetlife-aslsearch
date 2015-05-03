function test () {
  Logger.log(lookupRowByUserId('10180'));
}

/**
 * Gets a column index by looking up its name. A column's "name" is the
 * formula (string) inside its top row.
 *
 * @param {string} name The name of the column.
 * @return {Integer|boolean} The column's numeric index
 *          (starting from 1, so it can be used to call ranges)
 *          or <code>FALSE</code> if the column name isn't found.
 */
function getColumnByName (name) {
  var v = SHEET.getRange(CONFIG.fieldset_range).getValues();
  for (var i = 0; i < v[0].length; i++) {
    if (name === v[0][i]) { return i + 1; }
  }
  return false;
}

/**
 * Gets the row index that a given User ID is saved in
 *
 * @param {Integer} user_id The User ID value to search for.
 * @return {Integer|boolean} The row's numeric index
 *          (starting from 1, so it can be used to call ranges)
 *          or <code>FALSE</code> if the User ID isn't found.
 */
function lookupRowByUserId (user_id) {
  var col_index = getColumnByName('User ID');
  var last_row = SHEET.getLastRow();
  var values = SHEET.getRange(1, col_index, last_row).getValues();
  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      if (user_id == values[i][j]) { return i + 1; }
    }
  }
  return false;
}
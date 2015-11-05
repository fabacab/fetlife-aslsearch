#!/usr/bin/env python
#
# Convert a set of similarly-structured .xlsx files into a SQLite DB.
#
# For example, say you have hundreds of Excel files in a directory
# called "big-analysis-project" and that each of these Excel files
# has a worksheet containing the same set of columns. Rather than
# having hundreds of separate Excel files, it would be handy to have
# all their data inside one relational database management system.
#
# Pass this script the path to the directory containing said files,
# and this script will create a SQLite database file in the current
# directory.
#
# From there, most operations are a breeze. For instance, looking at
# only the most recent timestamped entry for each user in the dataset:
#
#     SELECT MAX(Last_Updated) AS latest, * FROM records GROUP BY User_ID
#

import sys, glob, openpyxl, sqlite3

def main():
    # TODO: Replace this with getopt.
    if 2 == len(sys.argv) and '--help' == sys.argv[1]:
        print('USAGE:')
        print(sys.argv[0], '[directory]')

    # Choose a directory.
    try:
        where = sys.argv[1]
    except:
        where = '.'

    # Create a SQLite database for the results.
    db_filename = 'excel-data-database.db' # TODO: Set this from user input.
    conn = sqlite3.connect(db_filename)
    db_fields = []

    i = 0
    for filepath in glob.glob(where + '/*.xlsx'):
        print('Loading workbook from ' + filepath, file=sys.stderr)
        try:
            wb = openpyxl.load_workbook(filepath)
        except openpyxl.formula.tokenizer.TokenizerError as e:
            print(e, file=sys.stderr)
            continue
        ws = wb.active
        if 0 == i: # if the first file, create the SQL table
            headers = []
            for cell in ws.rows[0]:
                t = {
                    ord(' '): '_',
                    ord('"'): '',
                    ord('?'): '',
                    ord('/'): '',
                    ord('('): '',
                    ord(')'): ''
                }
                headers.append(cell.value.translate(t))

            db_fields = headers
            try:
                conn.execute('CREATE TABLE records (' + ','.join(headers) +  ')')
            except sqlite3.Error as e:
                print(e, file=sys.stderr)

        for row in ws.get_squared_range(ws.min_column, ws.min_row + 1, ws.max_column, ws.max_row):
            placeholders = []
            vals = []
            for cell in row:
                placeholders.append('?')
                vals.append(cell.value)
            sql = 'INSERT INTO records (' + ','.join(db_fields) + ') VALUES (' + ','.join(placeholders[:len(db_fields)]) + ')'
            try:
                conn.execute(sql, tuple(vals[:len(db_fields)])) # make sure only db_fields number of columns
            except sqlite3.InterfaceError as e:
                print(e, file=sys.stderr)
        conn.commit()
        i = i + 1

if __name__ == '__main__':
    main()

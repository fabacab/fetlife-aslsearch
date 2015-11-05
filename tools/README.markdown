# About this folder

This directory contains utilities that I've found helpful for whatever reason.

* `xl2sqlite.py`: Convert a set of similarly-structured .xlsx files into a SQLite DB.
    * Handy for transforming those Excel files from Google Spreadsheets into a format that can be easily queried, de-duped, etc.
    * Noteworthy queries:
        * Get the latest scraped data for each user profile: `SELECT MAX(Last_Updated) AS latest, * FROM records GROUP BY User_ID`

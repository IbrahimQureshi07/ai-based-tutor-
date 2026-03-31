# Subject tags (A1 vs A5, etc.) — fix wrong questions in practice

## What went wrong

The app shows practice questions by filtering Supabase `questions.subject` to match the card you picked (e.g. **A1 Real Property**).

The tax question (*“If the assessed valuation… $4.00 per $100”*) exists in **`Content Assembling Salesperson(A5 Real Estate Math).csv`** only — it is **not** an A1 topic. If it still appeared under A1, that row in Supabase had **`subject` set incorrectly** (often from an old import), not because the React app mixed topics.

## Fix (recommended): align `subject` to your CSV files

1. In Supabase: **backup** or export `questions` if you care about rollback.
2. Ensure folder **`Backend/sql`** exists.
3. From the project root:

   ```bash
   npm run generate-subject-sql
   ```

   This overwrites **`Backend/sql/fix_subjects_from_csv.sql`** with one `UPDATE` per question row, using the **filename** as the source of truth (e.g. `(A5 Real Estate Math)` → `subject = 'A5 Real Estate Math'`).

4. Open **Supabase → SQL Editor**, paste the contents of `fix_subjects_from_csv.sql`, and run it.

Later CSV filenames **override** earlier ones when the same `Question` text appears in two files (files are processed in alphabetical order).

## After that

Reload the app and try **Practice → A1** again. The A5 tax item should only appear under **A5**, not A1.

## If some rows still look wrong

Your **CSV files** may themselves mix units (e.g. math questions inside `A1 Real Property.csv`). The script tags every row with that file’s subject. To fix content, move rows to the correct CSV or edit Supabase manually.

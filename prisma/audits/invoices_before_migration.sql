-- READ-ONLY. Run these in the Supabase SQL editor BEFORE the invoice migration to see what it will find.
-- Nothing here changes data. (The migration itself records the same findings in invoice_migration_audit.)

-- 1. Duplicate invoice numbers (case/whitespace-insensitive). The migration keeps the oldest as-is and FLAGS the rest; it renumbers nothing.
SELECT lower(btrim(invoice_number)) AS number, count(*) AS invoices, array_agg(id ORDER BY created_at) AS ids
FROM invoices GROUP BY 1 HAVING count(*) > 1;

-- 2. Amounts that are not valid under the new rules (qty > 0, rate >= 0, tax 0..0.5) or have more decimals than are stored.
SELECT i.invoice_number, li.description, li.qty, li.rate, i.tax_rate
FROM invoice_line_items li JOIN invoices i ON i.id = li.invoice_id
WHERE li.qty <= 0 OR li.rate < 0 OR i.tax_rate < 0 OR i.tax_rate > 0.5
   OR li.qty::numeric <> round(li.qty::numeric, 4) OR li.rate::numeric <> round(li.rate::numeric, 4) OR i.tax_rate::numeric <> round(i.tax_rate::numeric, 6);

-- 3. Invoices whose total would change by a cent because lines are now rounded one by one (old: sum then round).
SELECT i.invoice_number,
       round((SELECT coalesce(sum(qty * rate), 0) FROM invoice_line_items WHERE invoice_id = i.id)::numeric * (1 + i.tax_rate::numeric), 2) AS old_total,
       (SELECT coalesce(sum(round(round(qty::numeric, 4) * round(rate::numeric, 4), 2)), 0) FROM invoice_line_items WHERE invoice_id = i.id) AS new_subtotal
FROM invoices i;

-- 4. Dates that are not YYYY-MM-DD, due before issue, or statuses outside Unsent / Not Paid / Paid.
SELECT invoice_number, issue_date, due_date, status FROM invoices
WHERE issue_date !~ '^\d{4}-\d{2}-\d{2}$' OR due_date !~ '^\d{4}-\d{2}-\d{2}$' OR due_date < issue_date OR status NOT IN ('Unsent', 'Not Paid', 'Paid');

-- 5. Which clients could each legacy invoice be linked to? (Free text only: the migration auto-links ONLY when the email matches exactly one client AND the name, company or project also matches.)
SELECT i.invoice_number, i.client_name, i.client_email,
       (SELECT count(*) FROM users u WHERE lower(btrim(u.email)) = lower(btrim(i.client_email)) AND u.admin = false) AS clients_with_that_email
FROM invoices i ORDER BY clients_with_that_email, i.invoice_number;

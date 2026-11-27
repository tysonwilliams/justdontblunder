-- The review pile used a two-save counter. interval_days was 0 or 1 and mirrored that counter.
-- Spaced repetition stores 0 while a card is due now, and 100 * consecutive saves + the
-- interval (1, 3, 7, 16, or 35) after a save. Rows the scheduler already wrote are left
-- alone: a lapse is interval_days 0 with due_on on or before today, and a saved card is
-- interval_days >= 100.
-- Old rows become due on the UTC date before this runs, which is still due in every timezone.
-- Apply this file with the other migrations. Do not push the database config from the app.

update public.review_entries
set
  due_on = least(
    coalesce(due_on, (pg_catalog.timezone('utc', pg_catalog.now()))::date),
    (pg_catalog.timezone('utc', pg_catalog.now()))::date
  ) - 1,
  interval_days = 0,
  saves = 0,
  updated_at = pg_catalog.now()
where (interval_days > 0 and interval_days < 100)
   or due_on is null
   or (interval_days = 0 and due_on > (pg_catalog.timezone('utc', pg_catalog.now()))::date);

comment on table public.review_entries is
  'Spaced repetition. interval_days is 0 when the card is due now. After a save it is 100 * consecutive saves + the interval (1, 3, 7, 16, or 35). due_on is the next review date. saves stays 0.';

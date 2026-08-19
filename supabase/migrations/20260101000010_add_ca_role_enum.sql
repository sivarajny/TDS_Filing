-- Split into its own migration/transaction: a newly added enum value can't
-- reliably be used as a literal in the same transaction that adds it.
alter type user_role add value if not exists 'ca';

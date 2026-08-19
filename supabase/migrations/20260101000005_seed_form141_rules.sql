-- ============================================================================
-- Section 194-IA transitions from Form 26QB to the unified Form 141 (under
-- the Income-tax Act, 2025) for any transaction event on/after 1 Apr 2026.
-- Cap the 26QB version's validity there and seed the successor version, so
-- rules_version_id on a milestone genuinely reflects which form era it
-- belongs to instead of always pointing at one row.
--
-- The rate/threshold/surcharge/cess structure is carried over unchanged
-- because the publicly known Form 141 transition is a filing-mechanism and
-- schema change, not (as of this writing) a change to the 194-IA rate
-- itself — reconcile this row against the final Form 141 rules when the
-- CBDT notifies them, without editing rows already used in a calculation.
-- ============================================================================

update tds_rules_versions
set effective_to = '2026-03-31'
where version_label = '194IA-26QB-2024.10';

insert into tds_rules_versions (version_label, form_type, effective_from, effective_to, rules, notes)
values (
  '194IA-141-2026.04',
  '141',
  '2026-04-01',
  null,
  '{
    "residentRate": 1.0,
    "residentThreshold": 5000000,
    "residentNoPanRate": 20.0,
    "nriDefaultBaseRate": 20.0,
    "nriNoPanRate": 20.0,
    "surchargeSlabs": [
      { "minAmount": 0,        "maxAmount": 5000000,    "rate": 0 },
      { "minAmount": 5000000,  "maxAmount": 10000000,   "rate": 10 },
      { "minAmount": 10000000, "maxAmount": 20000000,   "rate": 15 },
      { "minAmount": 20000000, "maxAmount": null,        "rate": 25 }
    ],
    "cessRate": 4.0
  }'::jsonb,
  'Same simplified rate structure as 194IA-26QB-2024.10, carried forward for the Form 141 era (transaction events on/after 1 Apr 2026 under the Income-tax Act, 2025). Confirm against the finalized Form 141 field/rate notification before relying on this for real filings. Not tax advice.'
);

-- ============================================================================
-- Seed the initial Section 194-IA / Form 26QB rules version. This is
-- reference data the app needs to function (not demo data), so it ships as
-- a migration. A future version row (form_type = '141') should be added
-- when Form 141 rules are finalized for transactions on/after 1 Apr 2026 —
-- never edit this row after it has been used in a real calculation.
-- ============================================================================

insert into tds_rules_versions (version_label, form_type, effective_from, effective_to, rules, notes)
values (
  '194IA-26QB-2024.10',
  '26QB',
  '2024-10-01',
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
  'Simplified defaults for MVP demo purposes only, not tax advice. '
  || 'Resident sellers: flat 1% under Sec 194-IA once total consideration >= threshold; 20% if seller has no PAN (Sec 206AA); no surcharge/cess on 194-IA. '
  || 'NRI sellers: this app uses a configurable default base rate + income-slab surcharge + 4% health & education cess as a simplified stand-in for the fact-specific Sec 195 computation (which actually depends on LTCG/STCG classification, holding period, and indexation); an approved Form 13 Lower/Nil Deduction Certificate overrides the computed rate entirely. Always verify the final rate with a qualified CA before filing.'
);

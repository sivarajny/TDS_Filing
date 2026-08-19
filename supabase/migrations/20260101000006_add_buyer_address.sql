-- The portal filing form (26QB/141) asks for the transferee's (buyer's)
-- address separately from the property being purchased — add it so the
-- pre-fill package can include every required field.
alter table transactions add column buyer_address text;

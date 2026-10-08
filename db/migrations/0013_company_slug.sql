-- A URL name for each company (/companies/<slug>), for pages Google can index.
-- From the board token, which is usually the company's own short name
-- ("linear", "checkout.com" -> "checkout-com"). The same token on two ATSs
-- gives one slug: its page lists both boards' roles.
ALTER TABLE companies ADD COLUMN slug text GENERATED ALWAYS AS
  (btrim(regexp_replace(lower(board_token), '[^a-z0-9]+', '-', 'g'), '-')) STORED;

CREATE INDEX companies_slug_idx ON companies (slug);

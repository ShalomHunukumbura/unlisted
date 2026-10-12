-- Accounts: signing in with any email address, from the header. A link for an
-- address that has no profile yet isn't for a profile until it's opened: the
-- profile is made (or this device's is used) then, once the address is proven.
ALTER TABLE profile_logins ALTER COLUMN profile_id DROP NOT NULL;

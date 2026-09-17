-- Evergreen recycling: remember when a post was last run again, so the
-- cooldown in lib/marketing/content/social.ts (pickEvergreen) has a source.
alter table social_posts
  add column if not exists last_recycled_at timestamptz;

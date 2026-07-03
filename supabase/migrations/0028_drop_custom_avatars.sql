-- ============================================================================
-- Custom avatar / profile-photo UPLOAD was removed from the app. Users now
-- choose only from the 10 ready-made preset avatars (/avatars/preset-N.svg) or
-- their coloured initials. The app already ignores any non-preset avatar_url
-- (see components/Avatar.tsx), so this migration is OPTIONAL tidy-up: it clears
-- legacy uploaded-photo URLs so the column only ever holds preset paths.
-- Safe + idempotent. Run in the Supabase SQL Editor if you want the cleanup.
-- ============================================================================

update public.profiles
  set avatar_url = null
  where avatar_url is not null
    and avatar_url not like '/avatars/preset-%';

-- (Optional, not run here) The 'avatars' storage bucket is now write-unused by
-- the app. You can leave it, or later remove its write policies / delete
-- uploaded files if you want to reclaim storage. Left intact to avoid deleting
-- anything unexpectedly.

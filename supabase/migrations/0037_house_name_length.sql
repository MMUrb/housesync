-- Cap house names at 30 characters. They're rendered in the app header, the
-- house switcher, chat notices and exports, so an unbounded name (the column
-- was plain `text`) could break those layouts — and any housemate can rename
-- a house, so the client-side maxLength alone isn't a real guarantee.
--
-- Existing over-long names are trimmed first so the constraint can be added
-- without failing validation.
update public.houses
set name = left(btrim(name), 30)
where char_length(btrim(name)) > 30;

alter table public.houses
  drop constraint if exists houses_name_length;

alter table public.houses
  add constraint houses_name_length
  check (char_length(btrim(name)) between 1 and 30);

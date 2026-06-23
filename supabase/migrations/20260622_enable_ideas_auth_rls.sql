alter table public.ideas
alter column user_id type uuid using user_id::uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ideas_user_id_fkey'
      and conrelid = 'public.ideas'::regclass
  ) then
    alter table public.ideas
    add constraint ideas_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade;
  end if;
end
$$;

create index if not exists ideas_user_id_created_at_idx
on public.ideas (user_id, created_at desc);

alter table public.ideas enable row level security;

drop policy if exists "Users can read own ideas" on public.ideas;
create policy "Users can read own ideas"
on public.ideas
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own ideas" on public.ideas;
create policy "Users can insert own ideas"
on public.ideas
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own ideas" on public.ideas;
create policy "Users can update own ideas"
on public.ideas
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own ideas" on public.ideas;
create policy "Users can delete own ideas"
on public.ideas
for delete
to authenticated
using (auth.uid() = user_id);

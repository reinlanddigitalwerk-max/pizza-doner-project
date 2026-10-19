-- Online-Bestellungen von der Website (kasse.html) und Bestell-Monitor im Laden (bestellungen.html).
--
-- Gäste (anon) können NUR über die Funktion bestellung_aufgeben() eine Bestellung anlegen –
-- lesen dürfen sie nichts. Lesen und Status ändern darf nur angemeldetes Personal,
-- dessen E-Mail in der Tabelle personal steht.

create table public.bestellungen (
  id            uuid primary key default gen_random_uuid(),
  nr            integer generated always as identity,
  erstellt      timestamptz not null default now(),
  status        text not null default 'neu' check (status in ('neu', 'angenommen', 'fertig', 'storniert')),
  art           text not null check (art in ('lieferung', 'abholung')),
  name          text not null,
  telefon       text not null,
  email         text,
  firma         text,
  strasse       text,
  hausnr        text,
  plz           text,
  ort           text,
  etage         text,
  zeit          text not null,
  zahlung       text not null check (zahlung in ('bar', 'karte')),
  bemerkung     text,
  positionen    jsonb not null,
  zwischensumme numeric(8, 2) not null,
  rabatt        numeric(8, 2) not null default 0,
  liefergebuehr numeric(8, 2) not null default 0,
  gesamt        numeric(8, 2) not null
);
create index bestellungen_erstellt_idx on public.bestellungen (erstellt desc);
create index bestellungen_telefon_idx on public.bestellungen (telefon, erstellt desc);

-- Wer im Laden Bestellungen sehen darf (E-Mail des Supabase-Logins)
create table public.personal (
  email text primary key
);

alter table public.bestellungen enable row level security;
alter table public.personal enable row level security;

create or replace function public.ist_personal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.personal p where p.email = (auth.jwt() ->> 'email'));
$$;

create policy "Personal liest Bestellungen" on public.bestellungen
  for select to authenticated using ((select public.ist_personal()));
create policy "Personal ändert Status" on public.bestellungen
  for update to authenticated using ((select public.ist_personal())) with check ((select public.ist_personal()));
create policy "Personal sieht Personal-Liste" on public.personal
  for select to authenticated using ((select public.ist_personal()));

-- Nur der Status darf vom Personal geändert werden
revoke update on public.bestellungen from authenticated;
grant update (status) on public.bestellungen to authenticated;
grant select on public.bestellungen to authenticated;
grant select on public.personal to authenticated;

-- Bestellung aufgeben (wird von der Kasse aufgerufen)
create or replace function public.bestellung_aufgeben(daten jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  jetzt      timestamp := now() at time zone 'Europe/Berlin';
  tag        integer := extract(isodow from jetzt);
  uhr        time := jetzt::time;
  schluss    time;
  pos        jsonb;
  anzahl     integer;
  neue_nr    integer;
  art_       text := daten ->> 'art';
  telefon_   text := btrim(coalesce(daten ->> 'telefon', ''));
begin
  -- Öffnungszeiten: Mo Ruhetag, Di–Sa bis 22:00, So bis 22:00; Lieferung bis 21:30
  if tag = 1 then
    raise exception 'Heute ist Ruhetag.';
  end if;
  schluss := case when art_ = 'lieferung' then time '21:30' else time '21:45' end;
  if uhr >= schluss then
    raise exception 'Heute nehmen wir keine Bestellungen mehr an.';
  end if;

  if art_ not in ('lieferung', 'abholung') then raise exception 'Lieferart fehlt.'; end if;
  if char_length(btrim(coalesce(daten ->> 'name', ''))) not between 2 and 80 then raise exception 'Name fehlt.'; end if;
  if telefon_ !~ '^[0-9 +()/-]{6,25}$' then raise exception 'Telefonnummer ungültig.'; end if;
  if char_length(coalesce(daten ->> 'bemerkung', '')) > 500 then raise exception 'Bemerkung zu lang.'; end if;
  if (daten ->> 'zahlung') not in ('bar', 'karte') then raise exception 'Zahlart fehlt.'; end if;
  if art_ = 'lieferung' and (
       char_length(btrim(coalesce(daten ->> 'strasse', ''))) < 3
    or char_length(btrim(coalesce(daten ->> 'hausnr', ''))) < 1
    or coalesce(daten ->> 'plz', '') !~ '^[0-9]{5}$') then
    raise exception 'Lieferadresse unvollständig.';
  end if;

  if jsonb_typeof(daten -> 'positionen') <> 'array' then raise exception 'Warenkorb fehlt.'; end if;
  anzahl := jsonb_array_length(daten -> 'positionen');
  if anzahl not between 1 and 60 then raise exception 'Warenkorb leer oder zu groß.'; end if;
  for pos in select * from jsonb_array_elements(daten -> 'positionen') loop
    if (pos ->> 'menge')::int not between 1 and 50 or (pos ->> 'preis')::numeric not between 0 and 100
       or char_length(coalesce(pos ->> 'name', '')) not between 1 and 120 then
      raise exception 'Ungültige Position im Warenkorb.';
    end if;
  end loop;
  if (daten ->> 'gesamt')::numeric not between 0 and 1500 then raise exception 'Summe ungültig.'; end if;

  -- Schutz vor Doppel- und Spam-Bestellungen: höchstens 3 pro Telefonnummer in 10 Minuten
  if (select count(*) from public.bestellungen b
      where b.telefon = telefon_ and b.erstellt > now() - interval '10 minutes') >= 3 then
    raise exception 'Zu viele Bestellungen in kurzer Zeit. Bitte ruf uns an.';
  end if;

  insert into public.bestellungen (art, name, telefon, email, firma, strasse, hausnr, plz, ort, etage, zeit, zahlung,
                                   bemerkung, positionen, zwischensumme, rabatt, liefergebuehr, gesamt)
  values (art_,
          left(btrim(daten ->> 'name'), 80), telefon_,
          left(nullif(btrim(daten ->> 'email'), ''), 120),
          left(nullif(btrim(daten ->> 'firma'), ''), 80),
          left(nullif(btrim(daten ->> 'strasse'), ''), 80),
          left(nullif(btrim(daten ->> 'hausnr'), ''), 10),
          nullif(daten ->> 'plz', ''),
          left(nullif(daten ->> 'ort', ''), 40),
          left(nullif(daten ->> 'etage', ''), 20),
          left(coalesce(daten ->> 'zeit', 'schnellstmöglich'), 30),
          daten ->> 'zahlung',
          nullif(btrim(daten ->> 'bemerkung'), ''),
          daten -> 'positionen',
          (daten ->> 'zwischensumme')::numeric,
          coalesce((daten ->> 'rabatt')::numeric, 0),
          coalesce((daten ->> 'liefergebuehr')::numeric, 0),
          (daten ->> 'gesamt')::numeric)
  returning nr into neue_nr;
  return neue_nr;
end;
$$;

revoke all on function public.bestellung_aufgeben(jsonb) from public;
grant execute on function public.bestellung_aufgeben(jsonb) to anon, authenticated;
revoke all on function public.ist_personal() from public;
grant execute on function public.ist_personal() to authenticated;

-- Neue Bestellungen live an den Monitor schicken
alter publication supabase_realtime add table public.bestellungen;

-- Personal eintragen (E-Mail anpassen):
-- insert into public.personal (email) values ('laden@example.de');

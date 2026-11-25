-- Выполнить один раз: Supabase → SQL Editor → вставить → Run. Повторный запуск безопасен.
create table if not exists classes (
  code text primary key,
  name text not null,
  teacher_key_hash text,              -- sha256; null = доступ учителя через сервер закрыт (DEMO)
  created_at timestamptz not null default now()
);
create table if not exists students (
  class_code text not null references classes(code) on delete cascade,
  number int not null check (number between 1 and 99),
  tg_chat_id bigint,
  parent_chat_id bigint,
  primary key (class_code, number)
);
create index if not exists students_tg on students (tg_chat_id);
create index if not exists students_parent on students (parent_chat_id);
create table if not exists tasks (
  id text primary key,
  format text not null,
  skill text not null,
  difficulty int not null,
  lang text not null,
  payload jsonb not null,
  source text not null,
  class_code text references classes(code) on delete cascade
);
create index if not exists tasks_class on tasks (class_code);
create table if not exists attempts (
  id bigint generated always as identity primary key,
  class_code text not null,
  number int not null,
  task_id text not null,
  score numeric not null check (score in (0, 0.5, 1)),
  hints_used int not null check (hints_used between 0 and 3),
  confidence int check (confidence between 1 and 3),
  answer text,
  ts bigint not null,
  via text not null check (via in ('online', 'qr', 'bot')),
  foreign key (class_code, number) references students (class_code, number) on delete cascade,
  unique (class_code, number, task_id, ts)  -- повторная отправка не создаёт дублей
);
create table if not exists skill_state (
  class_code text not null,
  number int not null,
  skill text not null,
  rating double precision not null,
  attempts int not null,
  primary key (class_code, number, skill),
  foreign key (class_code, number) references students (class_code, number) on delete cascade
);

-- Доступ только у сервера (service role): политик нет, публичный ключ не видит ничего.
alter table classes enable row level security;
alter table students enable row level security;
alter table tasks enable row level security;
alter table attempts enable row level security;
alter table skill_state enable row level security;
grant all on classes, students, tasks, attempts, skill_state to service_role;

insert into classes (code, name) values ('DEMO', 'Демо-класс') on conflict do nothing;

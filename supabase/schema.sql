-- =============================================================
-- 无畏契约阵容协作工具 —— Supabase 数据库结构
-- =============================================================
-- 在 Supabase 项目的 SQL Editor 中整段运行即可建表。
-- 设计目标：
--   1. 团队房间(rooms)：一个房间 = 一个协作空间(社群共用一个即可)
--   2. 成员英雄池(members)：每位玩家的擅长位置 + 擅长英雄
--   3. 阵容方案(compositions)：每张地图当前的阵容分配(实时协作对象)
--   4. 编辑日志(edit_logs)：完整记录“谁、在何时、改了什么”，永不删除
--   5. 历史版本(comp_versions)：每次保存阵容都存一份快照，可查看/回滚
--
-- 说明：为便于社群快速上手，这里使用宽松的 RLS 策略(anon 可读写)。
-- 若需更严格权限，可在 Supabase 后台自行收紧策略。
-- =============================================================

-- ---------- 1. 团队房间 ----------
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- 2. 成员英雄池 ----------
create table if not exists public.members (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  nickname     text not null,               -- 玩家昵称
  roles        jsonb not null default '[]', -- 擅长位置数组，如 ["duelist","initiator"]
  agents       jsonb not null default '[]', -- 擅长英雄id数组，如 ["jett","sova"]
  is_starter   boolean not null default true, -- 是否首发(true=首发, false=替补)
  sort_order   int not null default 0,       -- 组内排序
  updated_at   timestamptz not null default now()
);
create index if not exists idx_members_room on public.members(room_id);

-- 已有旧表时的增量迁移（重复执行安全）
alter table public.members add column if not exists is_starter boolean not null default true;
alter table public.members add column if not exists sort_order int not null default 0;

-- ---------- 3. 阵容方案(当前状态，实时协作) ----------
-- 每个房间 + 每张地图 唯一一条“当前方案”
create table if not exists public.compositions (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  map_id       text not null,               -- 地图内部key，如 "ascent"
  assignments  jsonb not null default '[]', -- 分配数组：[{memberId, memberName, agentId, role}]
  updated_by   text,                        -- 最后修改人昵称
  updated_at   timestamptz not null default now(),
  unique (room_id, map_id)
);
create index if not exists idx_comps_room on public.compositions(room_id);

-- ---------- 4. 编辑日志(完整审计，只增不删) ----------
create table if not exists public.edit_logs (
  id           bigserial primary key,
  room_id      uuid not null references public.rooms(id) on delete cascade,
  map_id       text,                        -- 关联地图(可空)
  actor        text not null,               -- 操作人昵称/ID
  action       text not null,               -- 动作说明，如 "更新阵容"/"新增成员"
  change_type  text not null default 'edit',-- 修改类型：add(新增) / edit(编辑) / delete(删除)
  target       text,                        -- 修改对象，如 "阵容:亚海悬城" / "成员:队员A"
  detail       text,                        -- 人类可读的变更说明
  diff         jsonb,                        -- 结构化对比：{ before:[...], after:[...], changes:[...] }
  payload      jsonb,                        -- 预留：其它结构化数据
  created_at   timestamptz not null default now()
);
create index if not exists idx_logs_room on public.edit_logs(room_id, created_at desc);
create index if not exists idx_logs_type on public.edit_logs(room_id, change_type);

-- 已有旧表时的增量迁移（重复执行安全）
alter table public.edit_logs add column if not exists change_type text not null default 'edit';
alter table public.edit_logs add column if not exists target text;
alter table public.edit_logs add column if not exists diff jsonb;

-- ---------- 5. 历史版本快照 ----------
create table if not exists public.comp_versions (
  id           bigserial primary key,
  room_id      uuid not null references public.rooms(id) on delete cascade,
  map_id       text not null,
  assignments  jsonb not null,              -- 该次保存的完整阵容快照
  saved_by     text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_versions_room_map on public.comp_versions(room_id, map_id, created_at desc);

-- =============================================================
-- 行级安全策略(RLS)：开放 anon 读写，便于社群直接使用
-- =============================================================
alter table public.rooms         enable row level security;
alter table public.members       enable row level security;
alter table public.compositions  enable row level security;
alter table public.edit_logs     enable row level security;
alter table public.comp_versions enable row level security;

-- 为每张表创建“允许匿名读写”的策略
do $$
declare t text;
begin
  foreach t in array array['rooms','members','compositions','edit_logs','comp_versions'] loop
    execute format('drop policy if exists "anon_all_%1$s" on public.%1$s;', t);
    execute format('create policy "anon_all_%1$s" on public.%1$s for all using (true) with check (true);', t);
  end loop;
end $$;

-- =============================================================
-- 开启 Realtime：让 compositions / members / edit_logs 变更实时推送
-- =============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.compositions;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.members;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.edit_logs;
  exception when duplicate_object then null; end;
end $$;

-- =============================================================
-- 并发一致性：服务端自动维护 updated_at 时间戳
-- =============================================================
-- 让 members / compositions 每次 UPDATE 时由数据库(而非客户端)盖上权威时间戳，
-- 保证“最后写入者时间”以服务端为准，避免多端时钟不一致；并作为乐观并发的依据。
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  drop trigger if exists trg_members_touch on public.members;
  create trigger trg_members_touch before update on public.members
    for each row execute function public.touch_updated_at();

  drop trigger if exists trg_comps_touch on public.compositions;
  create trigger trg_comps_touch before update on public.compositions
    for each row execute function public.touch_updated_at();
end $$;

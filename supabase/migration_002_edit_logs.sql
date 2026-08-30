-- =============================================================
-- 迁移脚本 002 —— 编辑日志「修改对比 / 修改类型」增强 + 并发触发器
-- =============================================================
-- 适用：你之前已经跑过 schema.sql（表都建好、members 已有 is_starter），
-- 现在只需补齐 edit_logs 的新字段与并发一致性触发器。
--
-- 用法：Supabase Dashboard → 左侧 SQL Editor → New query → 整段粘贴 → Run。
-- 该脚本可**重复执行**，不会报错、不会破坏已有数据。
-- =============================================================

-- 1) edit_logs 增加：修改类型 / 修改对象 / 结构化对比
alter table public.edit_logs add column if not exists change_type text not null default 'edit'; -- add / edit / delete
alter table public.edit_logs add column if not exists target text;   -- 修改对象，如 "阵容:亚海悬城"
alter table public.edit_logs add column if not exists diff jsonb;    -- { before:[...], after:[...], changes:[...] }

create index if not exists idx_logs_type on public.edit_logs(room_id, change_type);

-- 2) 并发一致性：服务端自动维护 updated_at（多端时钟以服务器为准）
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

-- 3) 确保 Realtime 已开启（重复执行安全）
do $$
begin
  begin alter publication supabase_realtime add table public.compositions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.members;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.edit_logs;    exception when duplicate_object then null; end;
end $$;

-- 完成。可运行以下查询确认新列已存在：
-- select column_name from information_schema.columns
--   where table_name='edit_logs' and column_name in ('change_type','target','diff');

-- ==================================================
-- 岩瀬自治会 防災アプリ
-- プッシュ通知・警報情報 スキーマ
--
-- Supabase の SQL Editor に貼り付けて実行する。
-- 何度実行しても壊れないように書いてある。
--
-- 方針：
--
--   ・GitHub Pages はソースが全部見えるので、
--     権限はすべてDB側（RLS + SECURITY DEFINER）で守る
--   ・利用者側からテーブルを直接いじらせない
--   ・警報だけは誰でも読めてよいので select を許可する
-- ==================================================


-- ==================================================
-- 1. プッシュ通知の購読先
--
-- endpoint はブラウザが発行するURL。
-- 端末を特定する実質的なキーなので unique にする。
-- ==================================================

create table if not exists public.push_subscriptions (

    id              uuid primary key default gen_random_uuid(),

    endpoint        text        not null unique,

    p256dh          text        not null,
    auth            text        not null,

    -- 参加者と結び付ける（未登録でも通知は使えるので null 可）
    participant_id  text,

    -- 受け取る種類 emergency / warning / announcement
    topics          text[]      not null
                    default array['emergency','warning','announcement'],

    user_agent      text,

    is_active       boolean     not null default true,

    -- 連続で送信に失敗した回数。一定数を超えたら止める。
    fail_count      integer     not null default 0,

    last_success_at timestamptz,

    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()

);


create index if not exists idx_push_subscriptions_active
    on public.push_subscriptions (is_active)
    where is_active;

create index if not exists idx_push_subscriptions_participant
    on public.push_subscriptions (participant_id);


alter table public.push_subscriptions enable row level security;

-- ポリシーを作らない＝anon からは一切読み書きできない。
-- 出入口は下の RPC だけにする。

revoke all on public.push_subscriptions from anon, authenticated;


-- ==================================================
-- 2. 警報・注意報などの発表状況
--
-- event_key は「同じ事象かどうか」の判定に使う。
-- 例：jma_warning なら「市町村コード:警報コード」。
--
-- 継続発表のたびに行を増やすとキリがないので、
-- 1事象1行にして is_active を切り替える。
-- ==================================================

create table if not exists public.alerts (

    id           uuid        primary key default gen_random_uuid(),

    -- jma_warning / jma_flood / manual
    source       text        not null,

    event_key    text        not null,

    -- weather / flood / earthquake / evacuation / other
    category     text        not null default 'other',

    -- 0 お知らせ / 1 注意報 / 2 警報 / 3 特別警報・危険
    level        integer     not null default 0,

    title        text        not null,
    body         text,

    area_name    text,

    issued_at    timestamptz not null default now(),

    -- 解除された日時
    resolved_at  timestamptz,

    is_active    boolean     not null default true,

    -- プッシュ送信済みかどうか（二重送信の防止）
    notified_at  timestamptz,

    raw          jsonb,

    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),

    constraint alerts_source_event_key_uniq unique (source, event_key)

);


create index if not exists idx_alerts_active
    on public.alerts (is_active, level desc, issued_at desc);


alter table public.alerts enable row level security;


-- 発表中のものは誰でも読めてよい
drop policy if exists alerts_public_read on public.alerts;

create policy alerts_public_read
    on public.alerts
    for select
    to anon, authenticated
    using (is_active = true);


grant select on public.alerts to anon, authenticated;


-- ==================================================
-- 3. 送信ログ
--
-- 「いつ・何を・何台へ送ったか」を残す。
-- 障害調査だけでなく、
-- 研究側の記録としても使う。
-- ==================================================

create table if not exists public.push_logs (

    id            uuid        primary key default gen_random_uuid(),

    alert_id      uuid        references public.alerts (id) on delete set null,

    topic         text        not null,
    level         integer     not null default 0,

    title         text        not null,
    body          text,

    target_count  integer     not null default 0,
    success_count integer     not null default 0,
    failure_count integer     not null default 0,

    -- 手動送信の場合は送信した管理者
    sent_by       uuid,

    created_at    timestamptz not null default now()

);


create index if not exists idx_push_logs_created
    on public.push_logs (created_at desc);


alter table public.push_logs enable row level security;

revoke all on public.push_logs from anon;


-- 管理画面（ログイン済み）からは読めるようにする
drop policy if exists push_logs_admin_read on public.push_logs;

create policy push_logs_admin_read
    on public.push_logs
    for select
    to authenticated
    using (true);

grant select on public.push_logs to authenticated;


-- ==================================================
-- 4. 購読の登録・更新
--
-- 同じ endpoint が来たら上書きする。
-- 端末を機種変更しても古い行が残らないよう、
-- participant_id が一致する古い購読は落とす。
-- ==================================================

create or replace function public.save_push_subscription(
    p_endpoint       text,
    p_p256dh         text,
    p_auth           text,
    p_participant_id text    default null,
    p_topics         text[]  default array['emergency','warning','announcement'],
    p_user_agent     text    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

    if p_endpoint is null or length(p_endpoint) < 20 then
        raise exception '購読情報が不正です。';
    end if;

    if p_p256dh is null or p_auth is null then
        raise exception '購読情報が不足しています。';
    end if;


    insert into public.push_subscriptions (
        endpoint,
        p256dh,
        auth,
        participant_id,
        topics,
        user_agent,
        is_active,
        fail_count,
        updated_at
    )
    values (
        p_endpoint,
        p_p256dh,
        p_auth,
        nullif(trim(coalesce(p_participant_id, '')), ''),
        coalesce(p_topics, array['emergency','warning','announcement']),
        left(coalesce(p_user_agent, ''), 300),
        true,
        0,
        now()
    )
    on conflict (endpoint) do update
    set
        p256dh         = excluded.p256dh,
        auth           = excluded.auth,
        participant_id = coalesce(
                             excluded.participant_id,
                             public.push_subscriptions.participant_id
                         ),
        topics         = excluded.topics,
        user_agent     = excluded.user_agent,
        is_active      = true,
        fail_count     = 0,
        updated_at     = now();

end;
$$;


grant execute on function public.save_push_subscription(
    text, text, text, text, text[], text
) to anon, authenticated;


-- ==================================================
-- 5. 購読の停止
--
-- 行は消さない。
-- 「いつ止めたか」を残しておきたいのと、
-- 誤操作からの復旧を容易にするため。
-- ==================================================

create or replace function public.disable_push_subscription(
    p_endpoint text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

    update public.push_subscriptions
    set
        is_active  = false,
        updated_at = now()
    where endpoint = p_endpoint;

end;
$$;


grant execute on function public.disable_push_subscription(text)
    to anon, authenticated;


-- ==================================================
-- 6. 管理画面用：購読状況の集計
--
-- 何台が通知を受け取れる状態かを見る。
-- ==================================================

create or replace view public.v_push_subscription_summary as
select
    count(*) filter (where is_active)                     as active_count,
    count(*) filter (where not is_active)                 as inactive_count,
    count(*) filter (where is_active and participant_id is not null)
                                                          as linked_count,
    count(*) filter (where is_active and last_success_at > now() - interval '30 days')
                                                          as recently_delivered_count
from public.push_subscriptions;


grant select on public.v_push_subscription_summary to authenticated;


-- ==================================================
-- 確認
-- ==================================================

-- select * from public.v_push_subscription_summary;
-- select * from public.alerts order by issued_at desc limit 20;
-- select * from public.push_logs order by created_at desc limit 20;

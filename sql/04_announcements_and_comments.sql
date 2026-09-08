/* ==================================================
   岩瀬自治会 防災アプリ
   追加の修正

   1. お知らせの公開・非公開を管理者が変更できるようにする
   2. 掲示板にコメント（返信）を追加する

   Supabase の SQL Editor に貼り付けて実行する。
   何度実行しても壊れないように書いてある。

   前提：sql/03_community.sql を実行済みであること。
================================================== */


/* ==================================================
   1. お知らせ

   「非公開にする」を押しても公開のままになる場合、
   announcements テーブルに UPDATE を許可する
   ポリシーが無いことが原因になっている。

   PostgREST は、権限で1行も更新できなかったとき
   エラーではなく「0件更新」を返す。
   そのため画面上はエラーが出ないまま、
   実際には何も変わらない状態になる。

   ここで、管理者（ログイン済み）には
   すべての操作を許可し直す。
================================================== */

alter table public.announcements enable row level security;


/* ---------- 住民向けの読み取り ---------- */

drop policy if exists announcements_select_public
    on public.announcements;

create policy announcements_select_public
    on public.announcements
    for select
    to anon, authenticated
    using (
        is_published = true
        or auth.role() = 'authenticated'
    );


/* ---------- 管理者はすべて可能 ---------- */

drop policy if exists announcements_admin_all
    on public.announcements;

create policy announcements_admin_all
    on public.announcements
    for all
    to authenticated
    using (true)
    with check (true);


/* ==================================================
   参考

   同じ理由で更新できなくなりやすいテーブルにも
   管理者用のポリシーを入れておく。

   既にある場合は作り直すだけなので影響はない。
================================================== */

alter table public.site_contents enable row level security;

drop policy if exists site_contents_select_public
    on public.site_contents;

create policy site_contents_select_public
    on public.site_contents
    for select
    to anon, authenticated
    using (true);

drop policy if exists site_contents_admin_all
    on public.site_contents;

create policy site_contents_admin_all
    on public.site_contents
    for all
    to authenticated
    using (true)
    with check (true);


alter table public.activities enable row level security;

drop policy if exists activities_select_public
    on public.activities;

create policy activities_select_public
    on public.activities
    for select
    to anon, authenticated
    using (
        is_published = true
        or auth.role() = 'authenticated'
    );

drop policy if exists activities_admin_all
    on public.activities;

create policy activities_admin_all
    on public.activities
    for all
    to authenticated
    using (true)
    with check (true);


/* ==================================================
   2. 掲示板のコメント（返信）

   投稿と同じく、投稿名は自由に決められる。
   書き込みは RPC 経由に限定する。
================================================== */

create table if not exists public.board_comments (

    id             uuid primary key default gen_random_uuid(),

    post_id        uuid not null
                   references public.board_posts(id)
                   on delete cascade,

    display_name   text not null default '名無し',

    participant_id text,

    body           text not null,

    is_hidden      boolean not null default false,

    created_at     timestamptz not null default now()

);


create index if not exists board_comments_post_id_idx
    on public.board_comments (post_id, created_at);


alter table public.board_comments enable row level security;


drop policy if exists board_comments_select_public
    on public.board_comments;

create policy board_comments_select_public
    on public.board_comments
    for select
    to anon, authenticated
    using (
        is_hidden = false
        or auth.role() = 'authenticated'
    );


drop policy if exists board_comments_admin_all
    on public.board_comments;

create policy board_comments_admin_all
    on public.board_comments
    for all
    to authenticated
    using (true)
    with check (true);


/* ==================================================
   RPC：コメントの投稿

   非表示にされた投稿へは返信できないようにする。
   見えない投稿に返信が付くと、
   管理する側も投稿者も混乱するため。
================================================== */

create or replace function public.create_board_comment(
    p_post_id        uuid,
    p_display_name   text,
    p_body           text,
    p_participant_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_name   text;
    v_body   text;
    v_hidden boolean;
    v_id     uuid;
begin

    select is_hidden
      into v_hidden
      from public.board_posts
     where id = p_post_id;

    if not found then
        raise exception '投稿が見つかりません。';
    end if;

    if v_hidden then
        raise exception 'この投稿には返信できません。';
    end if;


    v_body := trim(coalesce(p_body, ''));

    if v_body = '' then
        raise exception '本文を入力してください。';
    end if;

    if char_length(v_body) > 1000 then
        raise exception '本文が長すぎます。';
    end if;


    v_name := nullif(trim(coalesce(p_display_name, '')), '');

    if v_name is null then
        v_name := '名無し';
    end if;

    if char_length(v_name) > 40 then
        v_name := left(v_name, 40);
    end if;


    insert into public.board_comments (
        post_id,
        display_name,
        body,
        participant_id
    )
    values (
        p_post_id,
        v_name,
        v_body,
        p_participant_id
    )
    returning id into v_id;


    return v_id;

end;
$$;


grant execute on function public.create_board_comment(
    uuid, text, text, text
) to anon, authenticated;

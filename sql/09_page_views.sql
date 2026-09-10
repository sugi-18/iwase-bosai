/* ==================================================
   岩瀬自治会 防災アプリ
   利用状況の記録（ページ閲覧）

   Supabase の SQL Editor に貼り付けて実行する。
   何度実行しても壊れないように書いてある。

   前提：sql/03〜08 を実行済みであること。


   ■ 記録するもの

     どの画面を、いつ、誰が開いたか。

   ■ 記録しないもの

     画面の中で入力した内容は一切記録しない。
     アンケートの回答も、掲示板の文章も含まない。

   ■ 参加者IDを持つ理由

     「延べ何回開かれたか」だけでは、
     1人が繰り返し開いたのか、
     何人が開いたのかが分からない。

     並び順を決めたり、成果を説明したりするには
     人数が要るため、参加者IDを一緒に記録している。

   ■ 保存期間

     溜め続けても意味が薄いので、
     古い記録を消す関数を用意している。
     必要に応じて実行すること。
================================================== */


create table if not exists public.page_views (

    id             bigserial primary key,

    /* 画面の名前（日本語） */
    page           text not null,

    /* 実際のURLの経路。分類を見直すときに使う */
    path           text,

    participant_id text,

    member_type    text default 'member',

    /* 端末ごとの識別子。未ログインの人数を数えるため */
    client_key     text,

    created_at     timestamptz not null default now()

);


create index if not exists page_views_created_at_idx
    on public.page_views (created_at desc);


create index if not exists page_views_page_idx
    on public.page_views (page);


alter table public.page_views enable row level security;


/* 閲覧記録を読めるのは管理者だけ */

drop policy if exists page_views_admin_all
    on public.page_views;

create policy page_views_admin_all
    on public.page_views
    for all
    to authenticated
    using (true)
    with check (true);


/* ==================================================
   記録用のRPC

   利用者は Supabase Auth を使わないため、
   テーブルへ直接書き込ませず関数を通す。
================================================== */

create or replace function public.log_page_view(
    p_page           text,
    p_path           text default null,
    p_participant_id text default null,
    p_member_type    text default 'member',
    p_client_key     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_page text;
begin

    v_page := nullif(trim(coalesce(p_page, '')), '');

    if v_page is null then
        return;
    end if;

    if char_length(v_page) > 60 then
        v_page := left(v_page, 60);
    end if;


    insert into public.page_views (
        page,
        path,
        participant_id,
        member_type,
        client_key
    )
    values (
        v_page,
        left(coalesce(p_path, ''), 200),
        nullif(trim(coalesce(p_participant_id, '')), ''),
        case
            when p_member_type in ('member', 'guest')
            then p_member_type
            else 'member'
        end,
        nullif(trim(coalesce(p_client_key, '')), '')
    );

end;
$$;


grant execute on function public.log_page_view(
    text, text, text, text, text
) to anon, authenticated;


/* ==================================================
   古い記録の削除

   例：1年より前の記録を消す

     select public.purge_page_views(365);
================================================== */

create or replace function public.purge_page_views(
    p_keep_days integer default 365
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count integer;
begin

    if auth.role() is distinct from 'authenticated' then
        raise exception '管理者としてログインしてください。';
    end if;


    delete from public.page_views
     where created_at < now() - (p_keep_days || ' days')::interval;


    get diagnostics v_count = row_count;


    return v_count;

end;
$$;


revoke all on function public.purge_page_views(integer)
    from public, anon;

grant execute on function public.purge_page_views(integer)
    to authenticated;

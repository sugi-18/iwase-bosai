/* ==================================================
   岩瀬自治会 防災アプリ

   1. 自治会員と自治会員以外で自治会コードを分ける
   2. 防災力診断（防災チェックリスト）の結果を保存する

   Supabase の SQL Editor に貼り付けて実行する。
   何度実行しても壊れないように書いてある。

   前提：sql/03、sql/04 を実行済みであること。


   自治会コード

     iwase2026 … 自治会員
     iwase     … 自治会員以外

   自治会員以外は、次の機能を使えない。

     ・岩瀬地区防災計画
     ・岩瀬自治会ツール（アンケート・掲示板）
     ・活動実績の写真（文字だけ表示する）

   なお、この制限は画面の出し分けである。
   写真そのものは公開URLに置かれているため、
   URLを直接知っている人は見られる。
   本当に見せたくない写真は、
   そもそも登録しない運用にしてほしい。
================================================== */


/* ==================================================
   1. 参加者に会員区分を持たせる
================================================== */

alter table public.participants
    add column if not exists member_type text
    not null default 'member';


/*
 * 既存の利用者は全員が会員用コードで登録している。
 * そのため default 'member' のままでよい。
 */


/* ==================================================
   2. 自治会コードから会員区分を求める

   コードを変えたくなったら、
   この関数だけを書き換える。
================================================== */

create or replace function public.resolve_access_code(
    p_code text
)
returns text
language plpgsql
immutable
security definer
set search_path = public
as $$
declare
    v_code text;
begin

    v_code := lower(trim(coalesce(p_code, '')));

    if v_code = 'iwase2026' then
        return 'member';
    end if;

    if v_code = 'iwase' then
        return 'guest';
    end if;

    return null;

end;
$$;


grant execute on function public.resolve_access_code(text)
    to anon, authenticated;


/* ==================================================
   3. 登録・再ログイン（会員区分つき）

   既存の register_or_login_participant は
   そのまま使う。書き換えない。

   ここでは、
     ・入力された自治会コードから会員区分を判定し
     ・従来の関数を会員用コードで呼び出し
     ・参加者の会員区分を更新して
     ・結果に member_type を足して返す
   という包み方をしている。

   こうすると、既存の登録処理（重複防止や
   氏名＋暗証番号での再開）に手を入れずに済む。
================================================== */

create or replace function public.register_or_login_participant_v2(
    p_code      text,
    p_name      text,
    p_pin       text,
    p_force_new boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_member_type text;
    v_result      jsonb;
    v_id          text;
begin

    v_member_type := public.resolve_access_code(p_code);


    if v_member_type is null then

        return jsonb_build_object(
            'success', false,
            'error',   'invalid_code'
        );

    end if;


    /*
     * 従来の関数は会員用コードで呼ぶ。
     * 会員以外のコードは、この関数の中だけで
     * 会員区分に読み替える。
     */

    select public.register_or_login_participant(
               p_code      := 'iwase2026',
               p_name      := p_name,
               p_pin       := p_pin,
               p_force_new := p_force_new
           )::jsonb
      into v_result;


    if v_result is null then

        return jsonb_build_object(
            'success', false,
            'error',   'unknown'
        );

    end if;


    if coalesce((v_result ->> 'success')::boolean, false) then

        v_id := v_result ->> 'participant_id';

        if v_id is not null then

            update public.participants
               set member_type = v_member_type
             where id::text = v_id;

        end if;

    end if;


    return v_result || jsonb_build_object(
        'member_type', v_member_type
    );

end;
$$;


grant execute on function public.register_or_login_participant_v2(
    text, text, text, boolean
) to anon, authenticated;


/* ==================================================
   4. 防災力診断の結果

   同じ人が何度実施しても、すべて記録する。
   集計側で最新の1件だけを使う。

   経過を残しておくと、訓練の前後で
   どれだけ変わったかを見られる。
================================================== */

create table if not exists public.checklist_results (

    id             uuid primary key default gen_random_uuid(),

    /* ログインしている場合のみ入る */
    participant_id text,

    participant_name text,

    member_type    text default 'member',

    /*
     * 端末ごとの識別子。
     * ログインしていない場合に
     * 同じ人の再診断をまとめるために使う。
     */
    client_key     text,

    total_score    integer not null default 0,

    score_home      integer not null default 0,
    score_stock     integer not null default 0,
    score_evac      integer not null default 0,
    score_community integer not null default 0,

    /*
     * 設問ごとの回答。
     * [{ "key": "home_1", "category": "home",
     *    "text": "家具を固定している", "checked": true }, ...]
     */
    answers        jsonb not null default '[]'::jsonb,

    created_at     timestamptz not null default now()

);


create index if not exists checklist_results_created_at_idx
    on public.checklist_results (created_at desc);


create index if not exists checklist_results_participant_idx
    on public.checklist_results (participant_id, created_at desc);


alter table public.checklist_results enable row level security;


/* 回答内容は管理者だけが見られる */

drop policy if exists checklist_results_admin_all
    on public.checklist_results;

create policy checklist_results_admin_all
    on public.checklist_results
    for all
    to authenticated
    using (true)
    with check (true);


/* ==================================================
   5. RPC：診断結果の保存
================================================== */

create or replace function public.submit_checklist_result(
    p_participant_id text default null,
    p_name           text default null,
    p_member_type    text default 'member',
    p_client_key     text default null,
    p_total_score    integer default 0,
    p_scores         jsonb default '{}'::jsonb,
    p_answers        jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin

    insert into public.checklist_results (
        participant_id,
        participant_name,
        member_type,
        client_key,
        total_score,
        score_home,
        score_stock,
        score_evac,
        score_community,
        answers
    )
    values (
        nullif(trim(coalesce(p_participant_id, '')), ''),
        nullif(trim(coalesce(p_name, '')), ''),
        case
            when p_member_type in ('member', 'guest')
            then p_member_type
            else 'member'
        end,
        nullif(trim(coalesce(p_client_key, '')), ''),
        greatest(0, least(100, coalesce(p_total_score, 0))),
        coalesce((p_scores ->> 'home')::integer, 0),
        coalesce((p_scores ->> 'stock')::integer, 0),
        coalesce((p_scores ->> 'evac')::integer, 0),
        coalesce((p_scores ->> 'community')::integer, 0),
        coalesce(p_answers, '[]'::jsonb)
    )
    returning id into v_id;


    return v_id;

end;
$$;


grant execute on function public.submit_checklist_result(
    text, text, text, text, integer, jsonb, jsonb
) to anon, authenticated;

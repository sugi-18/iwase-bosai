/* ==================================================
   岩瀬自治会 防災アプリ
   自治会ツール（アンケート・掲示板）
   オリジナルコンテンツ／地区防災計画

   Supabase の SQL Editor に貼り付けて実行する。
   何度実行しても壊れないように書いてある。

   作成されるもの

     surveys            … アンケート本体
     survey_questions   … アンケートの設問
     survey_responses   … 回答者ごとの回答（1人1レコード）
     survey_answers     … 設問ごとの回答内容
     board_posts        … 自治会掲示板の投稿
     board_likes        … いいねの重複防止
     custom_contents    … オリジナルコンテンツ／地区防災計画の資料

   RPC（アプリ側から呼ぶ関数）

     submit_survey_response … アンケート回答の登録
     create_board_post      … 掲示板への投稿
     toggle_board_like      … いいねの付け外し

   考え方

     一般利用者は Supabase Auth を使わない。
     そのため書き込みは RPC（SECURITY DEFINER）に限定し、
     テーブルへの直接書き込みは許可しない。
     読み取りだけを匿名キーに開放する。
================================================== */


/* ==================================================
   1. アンケート
================================================== */

create table if not exists public.surveys (

    id              uuid primary key default gen_random_uuid(),

    title           text not null,

    description     text,

    /* 公開すると、アプリのアンケート一覧に出る */
    is_published    boolean not null default false,

    /* 匿名回答を許可するか */
    allow_anonymous boolean not null default true,

    /* 記名回答を許可するか */
    allow_named     boolean not null default true,

    start_date      date,

    end_date        date,

    display_order   integer not null default 0,

    created_at      timestamptz not null default now(),

    updated_at      timestamptz not null default now()

);


create table if not exists public.survey_questions (

    id            uuid primary key default gen_random_uuid(),

    survey_id     uuid not null
                  references public.surveys(id)
                  on delete cascade,

    question_text text not null,

    /*
     * single   … 選択肢から1つ
     * multiple … 選択肢から複数
     * text     … 自由記述
     * scale5   … 5段階評価
     */
    question_type text not null default 'single',

    /* 選択肢。["はい","いいえ"] のような配列 */
    options       jsonb not null default '[]'::jsonb,

    is_required   boolean not null default false,

    display_order integer not null default 0,

    created_at    timestamptz not null default now()

);


create index if not exists survey_questions_survey_id_idx
    on public.survey_questions (survey_id, display_order);


create table if not exists public.survey_responses (

    id              uuid primary key default gen_random_uuid(),

    survey_id       uuid not null
                    references public.surveys(id)
                    on delete cascade,

    /* 記名回答のときだけ入る */
    participant_id  text,

    respondent_name text,

    is_anonymous    boolean not null default true,

    /*
     * 端末ごとの識別子。
     * 同じ端末からの二重回答を防ぐためだけに使う。
     * 個人を特定する目的では使わない。
     */
    client_key      text,

    created_at      timestamptz not null default now()

);


create index if not exists survey_responses_survey_id_idx
    on public.survey_responses (survey_id);


create unique index if not exists survey_responses_client_unique
    on public.survey_responses (survey_id, client_key)
    where client_key is not null;


create table if not exists public.survey_answers (

    id            uuid primary key default gen_random_uuid(),

    response_id   uuid not null
                  references public.survey_responses(id)
                  on delete cascade,

    question_id   uuid not null
                  references public.survey_questions(id)
                  on delete cascade,

    /* 自由記述 */
    answer_text   text,

    /* 選択肢の回答。["はい"] のような配列 */
    answer_values jsonb not null default '[]'::jsonb,

    created_at    timestamptz not null default now()

);


create index if not exists survey_answers_response_id_idx
    on public.survey_answers (response_id);


create index if not exists survey_answers_question_id_idx
    on public.survey_answers (question_id);


/* ==================================================
   2. 自治会掲示板
================================================== */

create table if not exists public.board_posts (

    id             uuid primary key default gen_random_uuid(),

    /* 投稿名は自由に決められる */
    display_name   text not null default '名無し',

    /* 参考情報。表示には使わない */
    participant_id text,

    /*
     * normal … ふだんの交流
     * damage … 災害時の被害報告
     * info   … おしらせ・共有
     */
    category       text not null default 'normal',

    body           text not null,

    like_count     integer not null default 0,

    /* 管理者が非表示にした投稿 */
    is_hidden      boolean not null default false,

    created_at     timestamptz not null default now()

);


create index if not exists board_posts_created_at_idx
    on public.board_posts (created_at desc);


create table if not exists public.board_likes (

    id         uuid primary key default gen_random_uuid(),

    post_id    uuid not null
               references public.board_posts(id)
               on delete cascade,

    client_key text not null,

    created_at timestamptz not null default now(),

    unique (post_id, client_key)

);


/* ==================================================
   3. オリジナルコンテンツ／地区防災計画の資料

   category

     original      … リンク集の「オリジナルコンテンツ」
     district_plan … 岩瀬地区防災計画のページ
================================================== */

create table if not exists public.custom_contents (

    id            uuid primary key default gen_random_uuid(),

    category      text not null default 'original',

    title         text not null,

    description   text,

    url           text,

    icon          text default '📄',

    display_order integer not null default 0,

    is_published  boolean not null default true,

    created_at    timestamptz not null default now(),

    updated_at    timestamptz not null default now()

);


create index if not exists custom_contents_category_idx
    on public.custom_contents (category, display_order);


/* ==================================================
   4. RLS

   読み取りだけ匿名キーに開放する。
   書き込みは RPC 経由に限定する。
================================================== */

alter table public.surveys           enable row level security;
alter table public.survey_questions  enable row level security;
alter table public.survey_responses  enable row level security;
alter table public.survey_answers    enable row level security;
alter table public.board_posts       enable row level security;
alter table public.board_likes       enable row level security;
alter table public.custom_contents   enable row level security;


/* ---------- アンケート本体 ---------- */

drop policy if exists surveys_select_public on public.surveys;

create policy surveys_select_public
    on public.surveys
    for select
    to anon, authenticated
    using (
        is_published = true
        or auth.role() = 'authenticated'
    );


drop policy if exists surveys_admin_all on public.surveys;

create policy surveys_admin_all
    on public.surveys
    for all
    to authenticated
    using (true)
    with check (true);


/* ---------- 設問 ---------- */

drop policy if exists survey_questions_select_public
    on public.survey_questions;

create policy survey_questions_select_public
    on public.survey_questions
    for select
    to anon, authenticated
    using (true);


drop policy if exists survey_questions_admin_all
    on public.survey_questions;

create policy survey_questions_admin_all
    on public.survey_questions
    for all
    to authenticated
    using (true)
    with check (true);


/* ---------- 回答（管理者のみ閲覧） ---------- */

drop policy if exists survey_responses_admin_all
    on public.survey_responses;

create policy survey_responses_admin_all
    on public.survey_responses
    for all
    to authenticated
    using (true)
    with check (true);


drop policy if exists survey_answers_admin_all
    on public.survey_answers;

create policy survey_answers_admin_all
    on public.survey_answers
    for all
    to authenticated
    using (true)
    with check (true);


/* ---------- 掲示板 ---------- */

drop policy if exists board_posts_select_public on public.board_posts;

create policy board_posts_select_public
    on public.board_posts
    for select
    to anon, authenticated
    using (
        is_hidden = false
        or auth.role() = 'authenticated'
    );


drop policy if exists board_posts_admin_all on public.board_posts;

create policy board_posts_admin_all
    on public.board_posts
    for all
    to authenticated
    using (true)
    with check (true);


drop policy if exists board_likes_admin_all on public.board_likes;

create policy board_likes_admin_all
    on public.board_likes
    for all
    to authenticated
    using (true)
    with check (true);


/* ---------- オリジナルコンテンツ ---------- */

drop policy if exists custom_contents_select_public
    on public.custom_contents;

create policy custom_contents_select_public
    on public.custom_contents
    for select
    to anon, authenticated
    using (
        is_published = true
        or auth.role() = 'authenticated'
    );


drop policy if exists custom_contents_admin_all
    on public.custom_contents;

create policy custom_contents_admin_all
    on public.custom_contents
    for all
    to authenticated
    using (true)
    with check (true);


/* ==================================================
   5. RPC：アンケート回答の登録

   p_answers の形

   [
     {
       "question_id": "....",
       "answer_text": "自由記述",
       "answer_values": ["はい"]
     }
   ]
================================================== */

create or replace function public.submit_survey_response(
    p_survey_id      uuid,
    p_participant_id text default null,
    p_name           text default null,
    p_is_anonymous   boolean default true,
    p_client_key     text default null,
    p_answers        jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_survey       public.surveys%rowtype;
    v_response_id  uuid;
    v_answer       jsonb;
begin

    select *
      into v_survey
      from public.surveys
     where id = p_survey_id;

    if not found then
        raise exception 'アンケートが見つかりません。';
    end if;

    if v_survey.is_published is not true then
        raise exception 'このアンケートは公開されていません。';
    end if;

    if v_survey.start_date is not null
       and current_date < v_survey.start_date then
        raise exception 'このアンケートはまだ開始していません。';
    end if;

    if v_survey.end_date is not null
       and current_date > v_survey.end_date then
        raise exception 'このアンケートは終了しました。';
    end if;


    /*
     * 同じ端末からの二重回答を防ぐ。
     * 端末を変えれば回答できるが、
     * 自治会のアンケートではこの程度で足りる。
     */
    if p_client_key is not null then

        if exists (
            select 1
              from public.survey_responses
             where survey_id  = p_survey_id
               and client_key = p_client_key
        ) then
            raise exception 'このアンケートには既に回答済みです。';
        end if;

    end if;


    insert into public.survey_responses (
        survey_id,
        participant_id,
        respondent_name,
        is_anonymous,
        client_key
    )
    values (
        p_survey_id,
        case when p_is_anonymous then null else p_participant_id end,
        case when p_is_anonymous then null else nullif(trim(coalesce(p_name, '')), '') end,
        coalesce(p_is_anonymous, true),
        p_client_key
    )
    returning id into v_response_id;


    for v_answer in
        select * from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb))
    loop

        insert into public.survey_answers (
            response_id,
            question_id,
            answer_text,
            answer_values
        )
        values (
            v_response_id,
            (v_answer ->> 'question_id')::uuid,
            nullif(trim(coalesce(v_answer ->> 'answer_text', '')), ''),
            coalesce(v_answer -> 'answer_values', '[]'::jsonb)
        );

    end loop;


    return v_response_id;

end;
$$;


grant execute on function public.submit_survey_response(
    uuid, text, text, boolean, text, jsonb
) to anon, authenticated;


/* ==================================================
   6. RPC：掲示板への投稿
================================================== */

create or replace function public.create_board_post(
    p_display_name   text,
    p_body           text,
    p_category       text default 'normal',
    p_participant_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_name text;
    v_body text;
    v_id   uuid;
begin

    v_body := trim(coalesce(p_body, ''));

    if v_body = '' then
        raise exception '本文を入力してください。';
    end if;

    if char_length(v_body) > 2000 then
        raise exception '本文が長すぎます。';
    end if;


    v_name := nullif(trim(coalesce(p_display_name, '')), '');

    if v_name is null then
        v_name := '名無し';
    end if;

    if char_length(v_name) > 40 then
        v_name := left(v_name, 40);
    end if;


    insert into public.board_posts (
        display_name,
        body,
        category,
        participant_id
    )
    values (
        v_name,
        v_body,
        case
            when p_category in ('normal', 'damage', 'info')
            then p_category
            else 'normal'
        end,
        p_participant_id
    )
    returning id into v_id;


    return v_id;

end;
$$;


grant execute on function public.create_board_post(
    text, text, text, text
) to anon, authenticated;


/* ==================================================
   7. RPC：いいね

   同じ端末が2回押したら取り消しになる。
================================================== */

create or replace function public.toggle_board_like(
    p_post_id    uuid,
    p_client_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_liked bool;
    v_count integer;
begin

    if p_client_key is null or trim(p_client_key) = '' then
        raise exception '端末識別子がありません。';
    end if;


    if exists (
        select 1
          from public.board_likes
         where post_id    = p_post_id
           and client_key = p_client_key
    ) then

        delete from public.board_likes
         where post_id    = p_post_id
           and client_key = p_client_key;

        v_liked := false;

    else

        insert into public.board_likes (post_id, client_key)
        values (p_post_id, p_client_key)
        on conflict do nothing;

        v_liked := true;

    end if;


    select count(*)
      into v_count
      from public.board_likes
     where post_id = p_post_id;


    update public.board_posts
       set like_count = v_count
     where id = p_post_id;


    return jsonb_build_object(
        'liked', v_liked,
        'like_count', v_count
    );

end;
$$;


grant execute on function public.toggle_board_like(uuid, text)
    to anon, authenticated;


/* ==================================================
   8. RPC：自分が押したいいねの一覧

   画面を開き直したときに
   「いいね済み」を再現するために使う。
================================================== */

create or replace function public.get_board_likes(
    p_client_key text
)
returns setof uuid
language sql
security definer
set search_path = public
as $$
    select post_id
      from public.board_likes
     where client_key = p_client_key;
$$;


grant execute on function public.get_board_likes(text)
    to anon, authenticated;


/* ==================================================
   9. site_contents に地区防災計画を使えるようにする

   既存テーブルをそのまま使う。
   content_type = 'district_plan' の1行を追加するだけ。
================================================== */

insert into public.site_contents (content_type)
select 'district_plan'
where not exists (
    select 1
      from public.site_contents
     where content_type = 'district_plan'
);

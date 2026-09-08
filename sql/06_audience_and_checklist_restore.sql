/* ==================================================
   岩瀬自治会 防災アプリ

   1. お知らせの表示先（自治会員／会員以外）
   2. 防災力診断の前回の回答を読み出す

   Supabase の SQL Editor に貼り付けて実行する。
   何度実行しても壊れないように書いてある。

   前提：sql/03、sql/04、sql/05 を実行済みであること。
================================================== */


/* ==================================================
   1. お知らせの表示先

     all    … 全員に表示する
     member … 自治会員のみ
     guest  … 自治会員以外のみ

   既存のお知らせは既定値の all になるため、
   これまでどおり全員に表示される。
================================================== */

alter table public.announcements
    add column if not exists audience text
    not null default 'all';


/*
 * 想定外の値が入らないようにしておく。
 * 既に制約がある場合は作り直す。
 */

alter table public.announcements
    drop constraint if exists announcements_audience_check;

alter table public.announcements
    add constraint announcements_audience_check
    check (audience in ('all', 'member', 'guest'));


/* ==================================================
   2. 防災力診断の前回の回答

   2回目以降に診断画面を開いたとき、
   前回の選択状態を復元するために使う。

   checklist_results は管理者だけが読めるようにしているため、
   本人の分だけを返す関数を用意する。

   参加者IDが分かればそれを優先し、
   分からない場合は端末識別子で探す。
================================================== */

create or replace function public.get_my_checklist_result(
    p_participant_id text default null,
    p_client_key     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.checklist_results%rowtype;
begin

    if p_participant_id is not null
       and trim(p_participant_id) <> '' then

        select *
          into v_row
          from public.checklist_results
         where participant_id = p_participant_id
         order by created_at desc
         limit 1;

    end if;


    if v_row.id is null
       and p_client_key is not null
       and trim(p_client_key) <> '' then

        select *
          into v_row
          from public.checklist_results
         where client_key = p_client_key
         order by created_at desc
         limit 1;

    end if;


    if v_row.id is null then

        return null;

    end if;


    return jsonb_build_object(
        'created_at',  v_row.created_at,
        'total_score', v_row.total_score,
        'answers',     v_row.answers
    );

end;
$$;


grant execute on function public.get_my_checklist_result(text, text)
    to anon, authenticated;

/* ==================================================
   岩瀬自治会 防災アプリ
   暗証番号（4桁）の再設定

   Supabase の SQL Editor に貼り付けて実行する。
   何度実行しても壊れないように書いてある。

   前提：sql/03〜06 を実行済みであること。


   ■ この機能でできること

     暗証番号を忘れた方に対して、管理者が
     新しい4桁を設定し直す。

     参加者ID（participant_id）は変わらないため、
     スタンプ・訓練参加記録・防災マイスターの認定は
     そのまま引き継がれる。


   ■ 暗証番号の保存方法を知らなくても動く理由

     pin_key の作り方は
     register_or_login_participant の中にある。
     この関数はダッシュボードで作られており、
     中身が分からなくても再設定できるようにしたい。

     そこで、次の手順を踏んでいる。

       1. 対象者と同じ氏名・新しい暗証番号で、
          register_or_login_participant を使って
          一時的な登録を1件つくる
       2. その一時レコードの pin_key を読む
          （＝正しい作り方で作られた値）
       3. 一時レコードを削除する
       4. 対象者の pin_key をその値に差し替える

     こうすると、平文でもハッシュでも、
     氏名を混ぜていても、同じ結果になる。

     手順3と4の順序は入れ替えられない。
     (name_key, pin_key) に一意制約があるため、
     一時レコードを消す前に対象者を書き換えると
     重複でエラーになる。


   ■ 元の暗証番号を「調べる」ことはできるか

     この関数ではできない。再設定のみである。

     そもそも4桁の暗証番号は、
     組み合わせが1万通りしかない。
     データベースを見られる人にとっては
     秘密として機能しない。

     「他人が偶然なりすますことを防ぐ鍵」であって、
     パスワードほどの強度は無い、という前提で
     運用していただきたい。
================================================== */


/* ==================================================
   1. 再設定の記録

   いつ・誰の暗証番号を変えたかを残す。

   あとから「勝手に変えられた」と言われたときに
   説明できるようにするため。
================================================== */

create table if not exists public.pin_reset_logs (

    id               uuid primary key default gen_random_uuid(),

    participant_id   text not null,

    participant_name text,

    /* 操作した管理者 */
    reset_by         uuid,

    /* 対応の経緯などを残す欄 */
    note             text,

    created_at       timestamptz not null default now()

);


create index if not exists pin_reset_logs_created_at_idx
    on public.pin_reset_logs (created_at desc);


alter table public.pin_reset_logs enable row level security;


drop policy if exists pin_reset_logs_admin_all
    on public.pin_reset_logs;

create policy pin_reset_logs_admin_all
    on public.pin_reset_logs
    for all
    to authenticated
    using (true)
    with check (true);


/* ==================================================
   2. 再設定の本体

   管理者（ログイン済み）だけが実行できる。
================================================== */

create or replace function public.admin_reset_participant_pin(
    p_participant_id text,
    p_new_pin        text,
    p_note           text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_target   public.participants%rowtype;
    v_temp     public.participants%rowtype;
    v_result   jsonb;
    v_temp_id  text;
    v_pin_key  text;
begin

    /* ---------- 権限 ---------- */

    if auth.role() is distinct from 'authenticated' then

        raise exception '管理者としてログインしてください。';

    end if;


    /* ---------- 入力の確認 ---------- */

    if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then

        raise exception '暗証番号は数字4桁で入力してください。';

    end if;


    select *
      into v_target
      from public.participants
     where participant_id = p_participant_id
        or id::text = p_participant_id
     limit 1;


    if not found then

        raise exception '対象の利用者が見つかりません。';

    end if;


    /* ----------------------------------------------
       同じ氏名・新しい暗証番号で一時的に登録する

       氏名を同じにしているのは、
       pin_key の計算に氏名が混ざっている場合にも
       正しい値を得るため。
    ---------------------------------------------- */

    select public.register_or_login_participant(
               p_code      := 'iwase2026',
               p_name      := v_target.name,
               p_pin       := p_new_pin,
               p_force_new := true
           )::jsonb
      into v_result;


    if v_result is null then

        raise exception '暗証番号を作成できませんでした。';

    end if;


    if coalesce((v_result ->> 'success')::boolean, false) = false then

        /*
         * 同じ氏名の別の方が、その暗証番号を
         * 既に使っている場合はここに来る。
         */

        return jsonb_build_object(
            'success', false,
            'error',   coalesce(v_result ->> 'error', 'unknown')
        );

    end if;


    v_temp_id := v_result ->> 'participant_id';


    /* ----------------------------------------------
       すでに同じ暗証番号だった場合

       一時登録が対象者本人に一致したということなので、
       何もせずに終わる。
    ---------------------------------------------- */

    if v_temp_id = v_target.participant_id then

        return jsonb_build_object(
            'success',   true,
            'unchanged', true,
            'message',   'すでにこの暗証番号が設定されています。'
        );

    end if;


    select *
      into v_temp
      from public.participants
     where participant_id = v_temp_id;


    if not found then

        raise exception '暗証番号の作成結果を確認できませんでした。';

    end if;


    /* ----------------------------------------------
       安全確認

       いま作られたレコードでなければ、
       既存の利用者に一致してしまっている。
       その場合は何も変更せずに終わる。
    ---------------------------------------------- */

    if v_temp.created_at < now() - interval '5 minutes' then

        return jsonb_build_object(
            'success', false,
            'error',   'pin_duplicate'
        );

    end if;


    v_pin_key := v_temp.pin_key;


    /* ----------------------------------------------
       一時レコードを先に削除する

       (name_key, pin_key) が重複するため、
       先に対象者を書き換えることはできない。
    ---------------------------------------------- */

    delete from public.participants
     where id = v_temp.id;


    update public.participants
       set pin_key    = v_pin_key,
           updated_at = now()
     where id = v_target.id;


    insert into public.pin_reset_logs (
        participant_id,
        participant_name,
        reset_by,
        note
    )
    values (
        v_target.participant_id,
        v_target.name,
        auth.uid(),
        nullif(trim(coalesce(p_note, '')), '')
    );


    return jsonb_build_object(
        'success',        true,
        'unchanged',      false,
        'participant_id', v_target.participant_id,
        'name',           v_target.name
    );

end;
$$;


/* 管理者だけが実行できる。匿名キーには渡さない。 */

revoke all on function public.admin_reset_participant_pin(text, text, text)
    from public, anon;

grant execute on function public.admin_reset_participant_pin(text, text, text)
    to authenticated;


/* ==================================================
   3. sql/05 の修正

   会員区分を書き込む条件が
   participants.id を見ていたが、
   アプリが使っているのは participant_id だった。

   そのままだと member_type が更新されないため、
   両方を見るようにする。

   アプリ側は登録時の戻り値で会員区分を持つので、
   この修正前でも画面の出し分けは動いている。
   ここで直しているのは、
   管理者がデータベース上で会員区分を確認できるようにするため。
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
             where participant_id = v_id
                or id::text = v_id;

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

/* ==================================================
   岩瀬自治会 防災アプリ
   訓練の受付番号（4桁）

   Supabase の SQL Editor に貼り付けて実行する。
   何度実行しても壊れないように書いてある。

   前提：sql/03〜09 を実行済みであること。


   ■ 何のための仕組みか

     QRコードが読めなかった方のための、
     もう一つの受付方法。

     カメラを使わず、訓練ごとの4桁の番号を
     アプリに入力するだけで参加登録できる。

     カメラの使用許可を求められるのが苦手な方、
     QRの読み取りがうまくいかない方には、
     こちらのほうが速いことが多い。


   ■ 番号の性質

     訓練ごとに1つ、重複しない4桁を割り当てる。

     当日その場にいる人だけが知っている番号、
     という程度のものである。
     厳密な本人確認をするものではない。

     念のため、実施日から前後14日の訓練だけを
     受け付けるようにしている。
     古い番号で登録されるのを防ぐため。
================================================== */

alter table public.trainings
    add column if not exists access_code text;


create unique index if not exists trainings_access_code_unique
    on public.trainings (access_code)
    where access_code is not null;


/* ==================================================
   受付番号の発行

   すでにある場合はそれを返す。
   無い場合だけ新しく作る。

   同じ訓練で番号が変わると、
   配った紙と合わなくなるため。
================================================== */

create or replace function public.ensure_training_access_code(
    p_training_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code     text;
    v_existing text;
    v_tries    integer := 0;
begin

    if auth.role() is distinct from 'authenticated' then

        raise exception '管理者としてログインしてください。';

    end if;


    select access_code
      into v_existing
      from public.trainings
     where training_id = p_training_id;


    if not found then

        raise exception '訓練が見つかりません。';

    end if;


    if v_existing is not null then

        return v_existing;

    end if;


    loop

        v_tries := v_tries + 1;


        /* 0000 や 1111 のような分かりにくい番号は避ける */

        v_code := lpad(
            (1000 + floor(random() * 9000))::int::text,
            4,
            '0'
        );


        exit when not exists (
            select 1
              from public.trainings
             where access_code = v_code
        );


        if v_tries > 50 then

            raise exception '受付番号を作成できませんでした。';

        end if;

    end loop;


    update public.trainings
       set access_code = v_code
     where training_id = p_training_id;


    return v_code;

end;
$$;


revoke all on function public.ensure_training_access_code(text)
    from public, anon;

grant execute on function public.ensure_training_access_code(text)
    to authenticated;


/* ==================================================
   受付番号から訓練を探す

   アプリ側から呼ぶ。

   実施日から前後14日のものだけを返す。
   trainings テーブル全体を匿名キーに
   見せないよう、必要な項目だけを返している。
================================================== */

create or replace function public.find_training_by_code(
    p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.trainings%rowtype;
begin

    if p_code is null or p_code !~ '^[0-9]{4}$' then

        return jsonb_build_object(
            'success', false,
            'error',   'invalid_code'
        );

    end if;


    select *
      into v_row
      from public.trainings
     where access_code = p_code
       and (
           training_date is null
           or training_date
               between current_date - 14 and current_date + 14
       )
     order by training_date desc
     limit 1;


    if not found then

        return jsonb_build_object(
            'success', false,
            'error',   'not_found'
        );

    end if;


    return jsonb_build_object(
        'success',     true,
        'training_id', v_row.training_id
    );

end;
$$;


grant execute on function public.find_training_by_code(text)
    to anon, authenticated;

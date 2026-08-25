-- ==================================================
-- 岩瀬自治会 防災アプリ
-- 定期実行と補助関数
--
-- 01_push_and_alerts.sql を先に実行しておくこと。
-- ==================================================


-- ==================================================
-- 1. 送信失敗回数を増やす
--
-- send-push から呼ばれる。
-- 5回連続で失敗した購読は送信対象から外れる。
-- ==================================================

create or replace function public.increment_push_fail_count(
    p_ids uuid[]
)
returns void
language sql
security definer
set search_path = public
as $$
    update public.push_subscriptions
    set
        fail_count = fail_count + 1,
        updated_at = now()
    where id = any(p_ids);
$$;


-- ==================================================
-- 2. 古い警報の掃除
--
-- 解除から30日たった行を消す。
-- 履歴を残したい場合はこの関数を使わず、
-- 別テーブルへ退避させること。
-- ==================================================

create or replace function public.cleanup_old_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    deleted integer;
begin

    delete from public.alerts
    where is_active = false
      and resolved_at < now() - interval '30 days';

    get diagnostics deleted = row_count;

    return deleted;

end;
$$;


-- ==================================================
-- 3. 定期実行の設定
--
-- Supabase の Dashboard で
-- Database → Extensions から
-- pg_cron と pg_net を有効にしてから実行する。
--
-- 下の2つを実際の値に置き換えること。
--
--   YOUR_PROJECT_REF   … Supabase のプロジェクトID
--   YOUR_SERVICE_ROLE_KEY … サービスロールキー
--
-- サービスロールキーをSQLに直接書きたくない場合は、
-- Vault（Dashboard → Settings → Vault）に入れて
-- vault.decrypted_secrets から読む方法もある。
-- ==================================================

create extension if not exists pg_cron;

create extension if not exists pg_net;


-- 既存の登録があれば消してから入れ直す
select cron.unschedule('fetch-jma-alerts')
where exists (
    select 1 from cron.job where jobname = 'fetch-jma-alerts'
);


-- 5分ごとに気象庁を確認する
select cron.schedule(
    'fetch-jma-alerts',
    '*/5 * * * *',
    $cron$
    select net.http_post(
        url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/fetch-jma-alerts',
        headers := jsonb_build_object(
                       'Content-Type',  'application/json',
                       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
                   ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 25000
    );
    $cron$
);


-- 毎日3時に古い警報を掃除する
select cron.unschedule('cleanup-old-alerts')
where exists (
    select 1 from cron.job where jobname = 'cleanup-old-alerts'
);


select cron.schedule(
    'cleanup-old-alerts',
    '0 18 * * *',   -- UTC 18:00 = JST 翌3:00
    $cron$ select public.cleanup_old_alerts(); $cron$
);


-- ==================================================
-- 確認
-- ==================================================

-- 登録されているジョブ
-- select jobid, jobname, schedule, active from cron.job;

-- 直近の実行結果（失敗していないか）
-- select jobid, status, return_message, start_time
-- from cron.job_run_details
-- order by start_time desc
-- limit 20;

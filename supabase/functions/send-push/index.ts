// ==================================================
// 岩瀬自治会 防災アプリ
// Edge Function: send-push
//
// プッシュ通知を実際に送る係。
//
// 呼び出し元は2つ。
//
//   1. fetch-jma-alerts（サービスロールキーで呼ぶ）
//   2. 管理画面（ログイン済み管理者のJWTで呼ぶ）
//
// 送信鍵（VAPID秘密鍵）は必ずここに置く。
// GitHub Pages 側には絶対に置かないこと。
//
// --------------------------------------------------
// 必要な環境変数（supabase secrets set で設定）
//
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT        例: mailto:bosai@example.jp
//
// SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY は
// Supabase が自動で入れてくれる。
// ==================================================

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;

const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

const VAPID_SUBJECT =
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:bosai@example.jp";


webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
);


const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});


// 管理画面はブラウザから呼ぶので CORS が要る
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};


function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
        },
    });
}


interface SendRequest {
    // emergency / warning / announcement
    topic?: string;
    // 0 お知らせ / 1 注意報 / 2 警報 / 3 特別警報
    level?: number;
    title: string;
    body?: string;
    // 通知タップ時の遷移先（アプリルートからの相対パス）
    url?: string;
    tag?: string;
    alert_id?: string | null;
}


// ==================================================
// 呼び出し元の確認
//
//   サービスロールキー … 内部からの呼び出し
//   それ以外のJWT      … 管理画面からの呼び出し
//                        （ログイン済みかどうかを見る）
// ==================================================

async function authorize(req: Request): Promise<
    { ok: true; sentBy: string | null } | { ok: false; reason: string }
> {
    const header = req.headers.get("Authorization") ?? "";

    const token = header.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
        return { ok: false, reason: "認証情報がありません。" };
    }

    if (token === SERVICE_ROLE_KEY) {
        return { ok: true, sentBy: null };
    }

    const { data, error } = await admin.auth.getUser(token);

    if (error || !data?.user) {
        return { ok: false, reason: "管理者としてログインしてください。" };
    }

    return { ok: true, sentBy: data.user.id };
}


// ==================================================
// 本体
// ==================================================

Deno.serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
        return json({ error: "POSTのみ受け付けます。" }, 405);
    }


    const auth = await authorize(req);

    if (!auth.ok) {
        return json({ error: auth.reason }, 401);
    }


    let payload: SendRequest;

    try {
        payload = await req.json();
    } catch {
        return json({ error: "リクエストが不正です。" }, 400);
    }


    const title = (payload.title ?? "").trim();

    if (!title) {
        return json({ error: "タイトルは必須です。" }, 400);
    }

    const topic = payload.topic ?? "announcement";

    const level = Number(payload.level ?? 0);


    // ==================================================
    // 送信先の取り出し
    //
    // topics 配列に対象の種類が入っているものだけ。
    // 失敗が続いている購読は除外する。
    // ==================================================

    const { data: subscriptions, error: selectError } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("is_active", true)
        .contains("topics", [topic])
        .lt("fail_count", 5);

    if (selectError) {
        console.error("購読の取得に失敗:", selectError);
        return json({ error: "購読の取得に失敗しました。" }, 500);
    }

    if (!subscriptions || subscriptions.length === 0) {
        return json({
            sent: 0,
            failed: 0,
            message: "送信先がありません。",
        });
    }


    const notification = JSON.stringify({
        title,
        body: payload.body ?? "",
        url: payload.url ?? "./",
        tag: payload.tag ?? `iwase-${topic}`,
        level,
    });


    // ==================================================
    // 送信
    //
    // 一度に大量へ投げるとタイムアウトするので
    // 50件ずつに区切る。
    // ==================================================

    const CHUNK = 50;

    const goneIds: string[] = [];
    const failedIds: string[] = [];
    const okIds: string[] = [];


    for (let i = 0; i < subscriptions.length; i += CHUNK) {

        const chunk = subscriptions.slice(i, i + CHUNK);

        const results = await Promise.allSettled(
            chunk.map((row) =>
                webpush.sendNotification(
                    {
                        endpoint: row.endpoint,
                        keys: { p256dh: row.p256dh, auth: row.auth },
                    },
                    notification,
                    {
                        TTL: level >= 2 ? 1800 : 86400,
                        urgency: level >= 2 ? "high" : "normal",
                    },
                )
            ),
        );

        results.forEach((result, index) => {

            const row = chunk[index];

            if (result.status === "fulfilled") {
                okIds.push(row.id);
                return;
            }

            const statusCode =
                (result.reason as { statusCode?: number })?.statusCode;

            // 404 / 410 は購読が消えている＝もう届かない
            if (statusCode === 404 || statusCode === 410) {
                goneIds.push(row.id);
            } else {
                console.warn("送信失敗:", statusCode, result.reason);
                failedIds.push(row.id);
            }

        });

    }


    // ==================================================
    // 後始末
    // ==================================================

    if (okIds.length > 0) {
        await admin
            .from("push_subscriptions")
            .update({
                last_success_at: new Date().toISOString(),
                fail_count: 0,
                updated_at: new Date().toISOString(),
            })
            .in("id", okIds);
    }

    if (goneIds.length > 0) {
        await admin
            .from("push_subscriptions")
            .update({
                is_active: false,
                updated_at: new Date().toISOString(),
            })
            .in("id", goneIds);
    }

    if (failedIds.length > 0) {
        // 連続失敗の回数を1つずつ増やす
        await admin.rpc("increment_push_fail_count", {
            p_ids: failedIds,
        }).then(
            () => {},
            () => {
                // RPCが未作成でも送信自体は成功させる
                console.warn("fail_count の更新に失敗しました。");
            },
        );
    }


    await admin.from("push_logs").insert({
        alert_id: payload.alert_id ?? null,
        topic,
        level,
        title,
        body: payload.body ?? null,
        target_count: subscriptions.length,
        success_count: okIds.length,
        failure_count: goneIds.length + failedIds.length,
        sent_by: auth.sentBy,
    });


    return json({
        sent: okIds.length,
        failed: failedIds.length,
        gone: goneIds.length,
        target: subscriptions.length,
    });

});

/* ==================================================
   岩瀬自治会 防災アプリ
   Service Worker

   役割は2つ。

   1. オフラインでもアプリを開けるようにする
      （災害時に通信が細くなる／切れることを前提にする）

   2. プッシュ通知を受け取って表示する

   ※ 管理画面（/admin/）はこのSWの対象外にしている。
      管理画面は常に最新である必要があり、
      キャッシュで古い画面が出ると事故になるため。
================================================== */

"use strict";


/* ==================================================
   バージョン

   ファイルを更新したら必ずこの値を変える。
   ここが変わるとキャッシュが作り直され、
   古いキャッシュは activate で削除される。
================================================== */

const SW_VERSION = "2026-08-25-02";

const PRECACHE_NAME = "iwase-precache-" + SW_VERSION;

const RUNTIME_NAME = "iwase-runtime-" + SW_VERSION;


/* ==================================================
   プッシュ再購読用の設定

   pushsubscriptionchange（ブラウザ側の都合で購読が
   作り直されるイベント）で使う。
   いずれも公開されて問題のない値のみ。
================================================== */

const VAPID_PUBLIC_KEY =
    "BMtWi-5cowrjbiuO2IXNKX673Ubz0hCpRa3G9T-yWQOVKK9xTh5-hJ2QXVpl8i8yXD1leAiRZl9O5YXG1aXKP-c";

const SUPABASE_URL =
    "https://zumbqukrojdpgfpfekjr.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_8YXsMHOxLr7MOTEYShUM3w_LsZvR3Qn";


/* ==================================================
   事前キャッシュ対象

   「通信が無くても開けてほしいページ」だけを入れる。
   ここに入れ忘れても、一度オンラインで開けば
   実行時キャッシュに入る。
================================================== */

const PRECACHE_PATHS = [

    "./",
    "./index.html",
    "./offline.html",
    "./style.css",
    "./manifest.json",
    "./links.html",

    "./announcements.js",

    "./common/iwase-identity.js",
    "./common/pwa.js",
    "./common/push.js",
    "./common/alerts.js",

    "./images/bosai-iwapon.png",
    "./images/iwase-logo.png",
    "./images/icon-192.png",
    "./images/icon-512.png",
    "./images/apple-touch-icon.png",

    "./water-timeline/",
    "./earthquake-timeline/",

    "./checklist/",
    "./checklist/style.css",
    "./checklist/script.js",

    "./next-training/next-training.html",
    "./annual_schedule/annual_schedule.html",
    "./record/record.html",

    "./stamp/supabase.js",
    "./stamp/stamp.html",
    "./stamp/stamp.css",
    "./stamp/certificate.html",
    "./stamp/certificate.css",
    "./stamp/training.html",
　  "./stamp/stamp.js?v=20260818",
    "./stamp/certificate.js?v=20260818",
    "./stamp/training.js?v=20260814",
    "./stamp/qr.html",
    "./stamp/qr.js",
   
    "./login/login.html",
    "./login/login.css",
    "./login/login.js"

];


/* ==================================================
   Supabase のうちキャッシュしてよいテーブル

   お知らせ・警報は「通信が切れても直前の内容を
   見せたい」ので許可する。

   参加者情報や参加履歴は入れない。
================================================== */

const CACHEABLE_SUPABASE_TABLES = [

    "announcements",
    "site_contents",
    "activities",
    "trainings",
    "alerts"

];


/* ==================================================
   外部CDN

   supabase-js / html2canvas / jsPDF など。
   これが取れないとアプリが起動しないので、
   キャッシュを持っておく。
================================================== */

const CDN_HOSTS = [

    "cdn.jsdelivr.net",
    "cdnjs.cloudflare.com",
    "unpkg.com"

];


/* ==================================================
   ユーティリティ
================================================== */

function toAbsolute(path) {

    return new URL(path, self.registration.scope).toString();

}


function isAdminRequest(url) {

    return url.pathname.indexOf("/admin/") !== -1;

}


function isCacheableSupabase(url) {

    if (url.pathname.indexOf("/rest/v1/") !== 0) {
        return false;
    }

    const table = url.pathname.replace("/rest/v1/", "").split("?")[0];

    return CACHEABLE_SUPABASE_TABLES.indexOf(table) !== -1;

}


/* ==================================================
   install

   addAll は1つでも失敗すると全部失敗するので、
   1件ずつ入れて失敗は握りつぶす。
   （ファイル名を1つ間違えただけで
     アプリ全体がオフライン非対応になるのを防ぐ）
================================================== */

self.addEventListener("install", (event) => {

    event.waitUntil((async () => {

        const cache = await caches.open(PRECACHE_NAME);

        await Promise.all(

            PRECACHE_PATHS.map(async (path) => {

                try {

                    const url = toAbsolute(path);

                    const response = await fetch(url, {
                        cache: "reload"
                    });

                    if (response && response.ok) {

                        await cache.put(url, response);

                    }
                    else {

                        console.warn("[SW] 事前キャッシュ失敗:", path);

                    }

                }
                catch (error) {

                    console.warn("[SW] 事前キャッシュ例外:", path, error);

                }

            })

        );

    })());

});


/* ==================================================
   activate

   古いバージョンのキャッシュを削除する。
================================================== */

self.addEventListener("activate", (event) => {

    event.waitUntil((async () => {

        const keys = await caches.keys();

        await Promise.all(

            keys.map((key) => {

                const isCurrent =
                    key === PRECACHE_NAME ||
                    key === RUNTIME_NAME;

                if (!isCurrent && key.indexOf("iwase-") === 0) {

                    return caches.delete(key);

                }

                return Promise.resolve();

            })

        );

        if (self.registration.navigationPreload) {

            try {
                await self.registration.navigationPreload.enable();
            }
            catch (error) {
                // 未対応ブラウザは無視
            }

        }

        await self.clients.claim();

    })());

});


/* ==================================================
   ページからの指示

   更新バナーの「更新する」を押すと送られてくる。
================================================== */

self.addEventListener("message", (event) => {

    if (event.data && event.data.type === "SKIP_WAITING") {

        self.skipWaiting();

    }

});


/* ==================================================
   取得方法：ネットワーク優先（タイムアウトあり）

   災害時は「つながらない」より
   「つながるが極端に遅い」ほうが多い。
   一定時間で見切ってキャッシュを返す。
================================================== */

function networkFirst(request, cacheName, timeoutMs) {

    return new Promise((resolve) => {

        let settled = false;

        const done = (response) => {

            if (settled) {
                return;
            }

            settled = true;

            resolve(response);

        };


        const timer = setTimeout(async () => {

            const cached = await caches.match(request);

            if (cached) {

                console.log("[SW] 応答が遅いためキャッシュを使用:", request.url);

                done(cached);

            }

        }, timeoutMs || 3500);


        fetch(request)
            .then(async (response) => {

                clearTimeout(timer);

                if (response && response.ok) {

                    try {

                        const cache = await caches.open(cacheName);

                        await cache.put(request, response.clone());

                    }
                    catch (error) {
                        // 容量不足などは無視
                    }

                }

                done(response);

            })
            .catch(async () => {

                clearTimeout(timer);

                const cached = await caches.match(request);

                if (cached) {

                    done(cached);

                    return;

                }

                done(null);

            });

    });

}


/* ==================================================
   取得方法：キャッシュ優先＋裏で更新

   CSS・JS・画像向け。
   表示は速く、次回アクセスでは新しくなる。
================================================== */

async function staleWhileRevalidate(request, cacheName) {

    const cached = await caches.match(request);

    const fetching = fetch(request)
        .then(async (response) => {

            if (response && response.ok && response.type !== "opaque") {

                try {

                    const cache = await caches.open(cacheName);

                    await cache.put(request, response.clone());

                }
                catch (error) {
                    // 無視
                }

            }

            return response;

        })
        .catch(() => null);


    if (cached) {

        /*
         * fetch はすでに走り出しているので、
         * ここでは待たずにキャッシュを返す。
         * 新しい内容は次回のアクセスで反映される。
         */

        return cached;

    }

    const response = await fetching;

    return response || Response.error();

}


/* ==================================================
   ページ遷移

   常に最新を見せたいのでネットワーク優先。
   取れなければキャッシュ、それも無ければ
   オフライン用ページ。
================================================== */

async function handleNavigation(event) {

    const request = event.request;

    try {

        const preload = await event.preloadResponse;

        if (preload) {

            const cache = await caches.open(RUNTIME_NAME);

            cache.put(request, preload.clone()).catch(() => {});

            return preload;

        }

    }
    catch (error) {
        // 無視してfetchへ
    }


    const response = await networkFirst(request, RUNTIME_NAME, 3500);

    if (response) {

        return response;

    }


    const cached = await caches.match(request);

    if (cached) {

        return cached;

    }


    const offline = await caches.match(toAbsolute("./offline.html"));

    if (offline) {

        return offline;

    }


    return new Response(
        "オフラインです。通信が回復してから再度お試しください。",
        {
            status: 503,
            headers: {
                "Content-Type": "text/plain; charset=utf-8"
            }
        }
    );

}


/* ==================================================
   fetch
================================================== */

self.addEventListener("fetch", (event) => {

    const request = event.request;

    // 参照・更新系以外は触らない
    if (request.method !== "GET") {
        return;
    }

    let url;

    try {
        url = new URL(request.url);
    }
    catch (error) {
        return;
    }

    // 管理画面は素通し
    if (isAdminRequest(url)) {
        return;
    }


    /* ---------- Supabase ---------- */

    if (url.hostname.endsWith(".supabase.co")) {

        if (isCacheableSupabase(url)) {

            event.respondWith((async () => {

                const response =
                    await networkFirst(request, RUNTIME_NAME, 5000);

                if (response) {
                    return response;
                }

                return new Response(
                    "[]",
                    {
                        status: 200,
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                );

            })());

        }

        return;

    }


    /* ---------- 外部CDN ---------- */

    if (CDN_HOSTS.indexOf(url.hostname) !== -1) {

        event.respondWith(
            staleWhileRevalidate(request, RUNTIME_NAME)
        );

        return;

    }


    /* ---------- 他サイト ---------- */

    if (url.origin !== self.location.origin) {
        return;
    }


    /* ---------- ページ遷移 ---------- */

    if (request.mode === "navigate") {

        event.respondWith(handleNavigation(event));

        return;

    }


    /* ---------- 同一サイトの静的ファイル ---------- */

    event.respondWith(
        staleWhileRevalidate(request, RUNTIME_NAME)
    );

});


/* ==================================================
   プッシュ通知の受信

   payload（JSON）の形：

   {
     "title":  "大雨警報",
     "body":   "松戸市に大雨警報が発表されました",
     "url":    "./water-timeline/",
     "tag":    "jma-03",
     "level":  2
   }

   level
     0 … お知らせ
     1 … 注意報
     2 … 警報
     3 … 特別警報・危険情報
================================================== */

self.addEventListener("push", (event) => {

    let payload = {};

    try {

        if (event.data) {

            payload = event.data.json();

        }

    }
    catch (error) {

        payload = {
            title: "岩瀬防災アプリ",
            body: event.data ? event.data.text() : ""
        };

    }


    const level = Number(payload.level || 0);

    const title = payload.title || "岩瀬防災アプリ";

    const options = {

        body: payload.body || "",

        icon: toAbsolute("./images/icon-192.png"),

        badge: toAbsolute("./images/icon-192.png"),

        tag: payload.tag || "iwase-general",

        // 同じtagの通知が来たら黙って差し替えず、必ず知らせる
        renotify: true,

        // 警報以上は自動で消さない
        requireInteraction: level >= 2,

        vibrate: level >= 2
            ? [200, 100, 200, 100, 200]
            : [100],

        data: {
            url: payload.url || "./",
            level: level
        },

        actions: [
            {
                action: "open",
                title: "アプリを開く"
            }
        ]

    };


    event.waitUntil(
        self.registration.showNotification(title, options)
    );

});


/* ==================================================
   通知タップ

   すでにアプリが開いていればそれを前面に出し、
   無ければ新しく開く。
================================================== */

self.addEventListener("notificationclick", (event) => {

    event.notification.close();

    const target = toAbsolute(
        (event.notification.data && event.notification.data.url) || "./"
    );


    event.waitUntil((async () => {

        const clientList = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
        });


        for (const client of clientList) {

            if (client.url.indexOf(self.registration.scope) === 0) {

                await client.focus();

                if ("navigate" in client) {

                    try {
                        await client.navigate(target);
                    }
                    catch (error) {
                        // 無視
                    }

                }

                return;

            }

        }


        await self.clients.openWindow(target);

    })());

});


/* ==================================================
   購読が作り直されたとき

   ブラウザ側の都合でendpointが変わることがある。
   放置すると通知が届かなくなるので、
   その場で再購読してサーバへ登録し直す。
================================================== */

self.addEventListener("pushsubscriptionchange", (event) => {

    event.waitUntil((async () => {

        try {

            if (VAPID_PUBLIC_KEY.indexOf("ここに") === 0) {
                return;
            }

            const subscription =
                await self.registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey:
                        urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });


            const json = subscription.toJSON();


            await fetch(
                SUPABASE_URL + "/rest/v1/rpc/save_push_subscription",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "apikey": SUPABASE_PUBLISHABLE_KEY,
                        "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY
                    },
                    body: JSON.stringify({
                        p_endpoint: json.endpoint,
                        p_p256dh: json.keys.p256dh,
                        p_auth: json.keys.auth,
                        p_participant_id: null,
                        p_topics: ["emergency", "warning", "announcement"],
                        p_user_agent: "sw-resubscribe"
                    })
                }
            );

        }
        catch (error) {

            console.warn("[SW] 再購読に失敗:", error);

        }

    })());

});


function urlBase64ToUint8Array(base64String) {

    const padding = "=".repeat((4 - base64String.length % 4) % 4);

    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const raw = self.atob(base64);

    const output = new Uint8Array(raw.length);

    for (let i = 0; i < raw.length; i++) {
        output[i] = raw.charCodeAt(i);
    }

    return output;

}

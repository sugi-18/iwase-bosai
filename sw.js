/* ==================================================
   岩瀬自治会 防災アプリ
   旧アドレス用 「自己解体」Service Worker

   これは案内ページ専用のファイル。
   アプリの機能は入っていない。

   役割はひとつだけ。

     旧アドレスに残っている古いアプリの
     キャッシュとService Workerを、
     利用者の操作なしに完全に消す。

   これが無いと、ホーム画面に旧アイコンを
   残している人は、古いアプリが表示され続け、
   引っ越しに気づけない。
================================================== */

"use strict";


self.addEventListener("install", function () {

    self.skipWaiting();

});


self.addEventListener("activate", function (event) {

    event.waitUntil((async function () {

        /* ---------- キャッシュを全部消す ---------- */

        try {

            var keys = await caches.keys();

            await Promise.all(
                keys.map(function (key) {
                    return caches.delete(key);
                })
            );

        }
        catch (error) {
            // 消せなくても次へ進む
        }


        /* ---------- 自分自身を登録解除する ---------- */

        try {
            await self.registration.unregister();
        }
        catch (error) {
            // 無視
        }


        /* ---------- 開いている画面を読み直す ---------- */

        try {

            var clients = await self.clients.matchAll({
                type: "window"
            });

            clients.forEach(function (client) {

                if ("navigate" in client) {
                    client.navigate(client.url);
                }

            });

        }
        catch (error) {
            // 無視
        }

    })());

});


/* ==================================================
   取得の横取りはしない

   何も書かないことで、常にネットワークから
   最新（＝この案内ページ）を取りに行かせる。
================================================== */

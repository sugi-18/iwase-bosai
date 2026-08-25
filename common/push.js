/* ==================================================
   岩瀬自治会 防災アプリ
   プッシュ通知の購読

   前提：

   ・common/pwa.js を先に読み込んでいること
     （Service Worker の登録がここで必要）

   ・stamp/supabase.js を読み込んでいること
     （supabaseClient を使う）

   置き場所：<root>/common/push.js

   表示先：

     ページ内に <div id="pushSettings"></div> があれば
     そこへ描画する。無ければ main の末尾へ追加する。

   ------------------------------------------------
   iPhone / iPad の重要な制約

   iOSでプッシュ通知を受け取るには、

     1. iOS 16.4 以降であること
     2. Safariで開き「ホーム画面に追加」していること
     3. ホーム画面のアイコンから起動していること

   の3つがすべて必要。Safariのタブのままでは
   どうやっても通知は届かない。

   LINEのアプリ内ブラウザも同様に不可。
   ------------------------------------------------
================================================== */

(function () {

    "use strict";


    /* ==================================================
       設定
    ================================================== */

    var VAPID_PUBLIC_KEY =
        "BMtWi-5cowrjbiuO2IXNKX673Ubz0hCpRa3G9T-yWQOVKK9xTh5-hJ2QXVpl8i8yXD1leAiRZl9O5YXG1aXKP-c";


    var TOPICS = [

        {
            key: "emergency",
            label: "緊急情報（特別警報・避難情報）",
            defaultOn: true
        },

        {
            key: "warning",
            label: "気象警報（大雨・洪水など）",
            defaultOn: true
        },

        {
            key: "announcement",
            label: "自治会からのお知らせ・訓練案内",
            defaultOn: true
        }

    ];


    var TOPIC_STORAGE_KEY = "iwasePushTopics";


    /* ==================================================
       小道具
    ================================================== */

    function urlBase64ToUint8Array(base64String) {

        var padding = "=".repeat((4 - base64String.length % 4) % 4);

        var base64 = (base64String + padding)
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        var raw = window.atob(base64);

        var output = new Uint8Array(raw.length);

        for (var i = 0; i < raw.length; i++) {
            output[i] = raw.charCodeAt(i);
        }

        return output;

    }


    function readTopics() {

        try {

            var raw = localStorage.getItem(TOPIC_STORAGE_KEY);

            if (raw) {

                var parsed = JSON.parse(raw);

                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }

            }

        }
        catch (error) {
            // 無視
        }


        return TOPICS
            .filter(function (topic) {
                return topic.defaultOn;
            })
            .map(function (topic) {
                return topic.key;
            });

    }


    function writeTopics(list) {

        try {
            localStorage.setItem(TOPIC_STORAGE_KEY, JSON.stringify(list));
        }
        catch (error) {
            // 無視
        }

    }


    function isSupported() {

        return (
            "serviceWorker" in navigator &&
            "PushManager" in window &&
            "Notification" in window
        );

    }


    /* ==================================================
       描画先の確保
    ================================================== */

    function getContainer() {

        var container = document.getElementById("pushSettings");

        if (container) {
            return container;
        }


        var main = document.querySelector("main") || document.body;

        container = document.createElement("div");

        container.id = "pushSettings";

        main.appendChild(container);

        return container;

    }


    function render(html) {

        var container = getContainer();

        container.innerHTML =
            '<section class="card" style="text-align:left;">' +
            '<h2 style="text-align:center;">🔔 通知設定</h2>' +
            html +
            '</section>';

    }


    /* ==================================================
       状態ごとの表示
    ================================================== */

    function renderUnsupported() {

        render(
            '<p style="font-size:14px;line-height:1.7;">' +
            'このブラウザは通知に対応していません。' +
            '<br>最新のChrome、またはSafari（iOS 16.4以降）でお試しください。' +
            '</p>'
        );

    }


    function renderNeedsInstall() {

        var isIos =
            window.IwasePWA && window.IwasePWA.isIos();

        var isInApp =
            window.IwasePWA && window.IwasePWA.isInAppBrowser();


        var guide;

        if (isInApp) {

            guide =
                'いまLINEなどのアプリ内で開いています。' +
                '<br>右上のメニューから<b>「ブラウザで開く」</b>を選び、' +
                'そのあとホーム画面に追加してください。';

        }
        else if (isIos) {

            guide =
                '画面下の<b>共有ボタン</b>から' +
                '<b>「ホーム画面に追加」</b>を選び、' +
                '<br>追加されたアイコンから開き直してください。';

        }
        else {

            guide =
                'ブラウザのメニューから' +
                '<b>「アプリをインストール」</b>を選んでください。';

        }


        render(
            '<p style="font-size:14px;line-height:1.7;">' +
            '通知を受け取るには、このアプリを' +
            '<b>ホーム画面に追加</b>する必要があります。' +
            '<br><br>' + guide +
            '</p>'
        );

    }


    function renderDenied() {

        render(
            '<p style="font-size:14px;line-height:1.7;">' +
            '通知がブロックされています。' +
            '<br>端末の設定 → 通知 から、このアプリの通知を' +
            '許可してください。' +
            '</p>'
        );

    }


    function renderOff() {

        var checkboxes = TOPICS.map(function (topic) {

            var checked = topic.defaultOn ? " checked" : "";

            return (
                '<label style="display:block;margin:6px 0;font-size:14px;">' +
                '<input type="checkbox" class="iwase-push-topic" ' +
                'value="' + topic.key + '"' + checked + '> ' +
                topic.label +
                '</label>'
            );

        }).join("");


        render(
            '<p style="font-size:14px;line-height:1.7;">' +
            '大雨警報などが発表されたとき、' +
            'この端末へお知らせします。' +
            '</p>' +
            '<div style="margin:12px 0;">' + checkboxes + '</div>' +
            '<p style="text-align:center;">' +
            '<button type="button" id="iwasePushEnable" ' +
            'style="background:#1f4e79;color:#fff;border:0;' +
            'border-radius:8px;padding:12px 28px;font-size:16px;' +
            'cursor:pointer;">通知を受け取る</button>' +
            '</p>' +
            '<p id="iwasePushMessage" ' +
            'style="font-size:13px;color:#777;text-align:center;"></p>' +
            disclaimerHtml()
        );


        var button = document.getElementById("iwasePushEnable");

        if (button) {

            button.addEventListener("click", enable);

        }

    }


    function renderOn() {

        var selected = readTopics();

        var checkboxes = TOPICS.map(function (topic) {

            var checked =
                selected.indexOf(topic.key) !== -1 ? " checked" : "";

            return (
                '<label style="display:block;margin:6px 0;font-size:14px;">' +
                '<input type="checkbox" class="iwase-push-topic" ' +
                'value="' + topic.key + '"' + checked + '> ' +
                topic.label +
                '</label>'
            );

        }).join("");


        render(
            '<p style="font-size:14px;color:#2e7d32;font-weight:bold;">' +
            '✅ この端末は通知を受け取れる状態です' +
            '</p>' +
            '<div style="margin:12px 0;">' + checkboxes + '</div>' +
            '<p style="text-align:center;">' +
            '<button type="button" id="iwasePushSave" ' +
            'style="background:#1f4e79;color:#fff;border:0;' +
            'border-radius:8px;padding:10px 20px;font-size:15px;' +
            'cursor:pointer;">受け取る内容を保存</button>' +
            ' ' +
            '<button type="button" id="iwasePushDisable" ' +
            'style="background:#fff;color:#777;border:1px solid #ddd;' +
            'border-radius:8px;padding:10px 20px;font-size:15px;' +
            'cursor:pointer;">通知を止める</button>' +
            '</p>' +
            '<p id="iwasePushMessage" ' +
            'style="font-size:13px;color:#777;text-align:center;"></p>' +
            disclaimerHtml()
        );


        var save = document.getElementById("iwasePushSave");

        if (save) {

            save.addEventListener("click", function () {

                enable(true);

            });

        }


        var disable = document.getElementById("iwasePushDisable");

        if (disable) {

            disable.addEventListener("click", stop);

        }

    }


    function disclaimerHtml() {

        return (
            '<p style="font-size:12px;color:#999;line-height:1.7;' +
            'margin-top:14px;border-top:1px solid #eee;padding-top:10px;">' +
            '通知は端末や通信の状態によって遅れたり、' +
            '届かないことがあります。' +
            'この通知だけに頼らず、テレビ・ラジオ・防災行政無線・' +
            '松戸市の発表など、必ず複数の手段で確認してください。' +
            '</p>'
        );

    }


    function setMessage(text, color) {

        var node = document.getElementById("iwasePushMessage");

        if (node) {

            node.textContent = text;

            node.style.color = color || "#777";

        }

    }


    function selectedTopics() {

        var nodes =
            document.querySelectorAll(".iwase-push-topic:checked");

        var list = [];

        for (var i = 0; i < nodes.length; i++) {
            list.push(nodes[i].value);
        }

        return list;

    }


    /* ==================================================
       購読する
    ================================================== */

    async function enable(isUpdate) {

        var topics = selectedTopics();

        if (topics.length === 0) {

            setMessage("受け取る内容を1つ以上選んでください。", "#d62828");

            return;

        }


        setMessage("設定中です…");


        try {

            /* ---------- 通知の許可 ---------- */

            var permission = Notification.permission;

            if (permission === "default") {

                permission = await Notification.requestPermission();

            }

            if (permission !== "granted") {

                renderDenied();

                return;

            }


            /* ---------- Service Worker ---------- */

            var registration =
                await navigator.serviceWorker.ready;


            /* ---------- 購読 ---------- */

            var subscription =
                await registration.pushManager.getSubscription();

            if (!subscription) {

                subscription =
                    await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey:
                            urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                    });

            }


            var json = subscription.toJSON();


            /* ---------- 利用者IDを添える ---------- */

            var participantId = null;

            try {

                if (window.IwaseIdentity) {

                    var user = await window.IwaseIdentity.load();

                    if (user && user.id) {
                        participantId = user.id;
                    }

                }

            }
            catch (error) {
                // 未登録でも通知自体は使えるようにする
            }


            /* ---------- サーバへ登録 ---------- */

            if (!window.supabaseClient) {

                throw new Error("supabaseClient が読み込まれていません。");

            }


            var result = await window.supabaseClient.rpc(
                "save_push_subscription",
                {
                    p_endpoint: json.endpoint,
                    p_p256dh: json.keys.p256dh,
                    p_auth: json.keys.auth,
                    p_participant_id: participantId,
                    p_topics: topics,
                    p_user_agent: navigator.userAgent.slice(0, 300)
                }
            );


            if (result.error) {

                throw result.error;

            }


            writeTopics(topics);

            renderOn();

            setMessage(
                isUpdate === true
                    ? "保存しました。"
                    : "通知を受け取れるようになりました。",
                "#2e7d32"
            );


        }
        catch (error) {

            console.error("[Push] 購読失敗:", error);

            setMessage(
                "設定できませんでした。時間をおいてお試しください。",
                "#d62828"
            );

        }

    }


    /* ==================================================
       購読をやめる
    ================================================== */

    async function stop() {

        setMessage("解除中です…");


        try {

            var registration =
                await navigator.serviceWorker.ready;

            var subscription =
                await registration.pushManager.getSubscription();


            if (subscription) {

                var endpoint = subscription.endpoint;

                await subscription.unsubscribe();


                if (window.supabaseClient) {

                    await window.supabaseClient.rpc(
                        "disable_push_subscription",
                        {
                            p_endpoint: endpoint
                        }
                    );

                }

            }


            renderOff();

            setMessage("通知を停止しました。");


        }
        catch (error) {

            console.error("[Push] 解除失敗:", error);

            setMessage("解除できませんでした。", "#d62828");

        }

    }


    /* ==================================================
       起動時の状態判定
    ================================================== */

    async function init() {

        if (!isSupported()) {

            renderUnsupported();

            return;

        }


        if (VAPID_PUBLIC_KEY.indexOf("ここに") === 0) {

            console.warn("[Push] VAPID公開鍵が未設定です。");

            return;

        }


        /*
         * iOSはホーム画面から起動していないと
         * 購読自体ができない。
         * Android等は通常のブラウザでも購読できる。
         */

        var needsInstall =
            window.IwasePWA &&
            !window.IwasePWA.isStandalone() &&
            (window.IwasePWA.isIos() || window.IwasePWA.isInAppBrowser());


        if (needsInstall) {

            renderNeedsInstall();

            return;

        }


        if (Notification.permission === "denied") {

            renderDenied();

            return;

        }


        try {

            var registration =
                await navigator.serviceWorker.ready;

            var subscription =
                await registration.pushManager.getSubscription();


            if (subscription && Notification.permission === "granted") {

                renderOn();

            }
            else {

                renderOff();

            }

        }
        catch (error) {

            console.warn("[Push] 状態確認に失敗:", error);

            renderOff();

        }

    }


    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", init);

    }
    else {

        init();

    }

})();

/* ==================================================
   岩瀬自治会 防災アプリ
   PWA共通処理

   ・Service Worker の登録
   ・更新があったときの案内
   ・ホーム画面への追加の案内（Android / iOS）

   このファイルは <root>/common/pwa.js に置く前提。
   自分自身のURLからアプリのルートを求めるので、
   サブフォルダのページから読み込んでも動く。

   使い方（各ページの </body> の直前）：

     <script src="../common/pwa.js"></script>
================================================== */

(function () {

    "use strict";


    /* ==================================================
       アプリのルートを求める

       このスクリプトは common/pwa.js にあるので、
       そこから2階層戻ったところがルート。
    ================================================== */

    var selfScript =
        document.currentScript ||
        (function () {

            var list = document.getElementsByTagName("script");

            for (var i = list.length - 1; i >= 0; i--) {

                if (list[i].src &&
                    list[i].src.indexOf("common/pwa.js") !== -1) {

                    return list[i];

                }

            }

            return null;

        })();


    if (!selfScript) {

        console.warn("[PWA] 自身のURLを特定できません。");

        return;

    }


    var ROOT =
        new URL("../", selfScript.src).toString();


    /* ==================================================
       head に必要なタグを補う

       全ページのHTMLを書き換えなくても済むように、
       manifest・アイコン・テーマ色をここで入れる。

       ※ index.html には直接書いておくこと。
         インストール判定はページ読み込み直後に
         行われるため、JSでの後入れだと
         「ホーム画面に追加」が出ないことがある。
    ================================================== */

    function ensureHeadTags() {

        var head = document.head;

        if (!head) {
            return;
        }


        if (!head.querySelector('link[rel="manifest"]')) {

            var manifest = document.createElement("link");

            manifest.rel = "manifest";

            manifest.href = ROOT + "manifest.json";

            head.appendChild(manifest);

        }


        if (!head.querySelector('meta[name="theme-color"]')) {

            var theme = document.createElement("meta");

            theme.name = "theme-color";

            theme.content = "#1f4e79";

            head.appendChild(theme);

        }


        if (!head.querySelector('link[rel="apple-touch-icon"]')) {

            var appleIcon = document.createElement("link");

            appleIcon.rel = "apple-touch-icon";

            appleIcon.href = ROOT + "images/apple-touch-icon.png";

            head.appendChild(appleIcon);

        }


        if (!head.querySelector('meta[name="apple-mobile-web-app-capable"]')) {

            var capable = document.createElement("meta");

            capable.name = "apple-mobile-web-app-capable";

            capable.content = "yes";

            head.appendChild(capable);

        }

               if (!head.querySelector('meta[name="mobile-web-app-capable"]')) {

            var mobileCapable = document.createElement("meta");

            mobileCapable.name = "mobile-web-app-capable";

            mobileCapable.content = "yes";

            head.appendChild(mobileCapable);

        }


        if (!head.querySelector('meta[name="apple-mobile-web-app-title"]')) {

            var appleTitle = document.createElement("meta");

            appleTitle.name = "apple-mobile-web-app-title";

            appleTitle.content = "岩瀬防災アプリ";

            head.appendChild(appleTitle);

        }

    }


    ensureHeadTags();


    /* ==================================================
       環境の判定
    ================================================== */

    function isStandalone() {

        return (
            (window.matchMedia &&
             window.matchMedia("(display-mode: standalone)").matches) ||
            window.navigator.standalone === true
        );

    }


    function isIos() {

        var ua = window.navigator.userAgent;

        var iOSDevice = /iPad|iPhone|iPod/.test(ua);

        // iPadOS はデスクトップ表示だと Macintosh を名乗る
        var iPadOnMac =
            ua.indexOf("Macintosh") !== -1 &&
            "ontouchend" in document;

        return iOSDevice || iPadOnMac;

    }


    function isInAppBrowser() {

        var ua = window.navigator.userAgent;

        return /Line|FBAN|FBAV|Instagram|Twitter/i.test(ua);

    }


    window.IwasePWA = {

        root: ROOT,

        isStandalone: isStandalone,

        isIos: isIos,

        isInAppBrowser: isInAppBrowser

    };


    /* ==================================================
       画面下部に出す共通のバー
    ================================================== */

    function showBar(options) {

        var existing = document.getElementById("iwasePwaBar");

        if (existing) {
            existing.remove();
        }


        var bar = document.createElement("div");

        bar.id = "iwasePwaBar";

        bar.setAttribute("role", "status");

        bar.style.cssText = [
            "position:fixed",
            "left:12px",
            "right:12px",
            "bottom:12px",
            "z-index:9999",
            "background:#1f4e79",
            "color:#fff",
            "border-radius:12px",
            "padding:14px 16px",
            "box-shadow:0 4px 16px rgba(0,0,0,.25)",
            "font-size:14px",
            "line-height:1.6",
            "text-align:left",
            "display:flex",
            "gap:10px",
            "align-items:center",
            "flex-wrap:wrap",
            "max-width:560px",
            "margin:0 auto"
        ].join(";");


        var message = document.createElement("div");

        message.style.cssText = "flex:1 1 200px;";

        message.innerHTML = options.html;

        bar.appendChild(message);


        if (options.actionLabel) {

            var action = document.createElement("button");

            action.type = "button";

            action.textContent = options.actionLabel;

            action.style.cssText = [
                "background:#fff",
                "color:#1f4e79",
                "border:0",
                "border-radius:8px",
                "padding:8px 16px",
                "font-size:14px",
                "font-weight:bold",
                "cursor:pointer",
                "flex:0 0 auto"
            ].join(";");

            action.addEventListener("click", function () {

                bar.remove();

                if (options.onAction) {
                    options.onAction();
                }

            });

            bar.appendChild(action);

        }


        var close = document.createElement("button");

        close.type = "button";

        close.setAttribute("aria-label", "閉じる");

        close.textContent = "✕";

        close.style.cssText = [
            "background:transparent",
            "color:#fff",
            "border:0",
            "font-size:18px",
            "cursor:pointer",
            "flex:0 0 auto",
            "padding:4px 6px"
        ].join(";");

        close.addEventListener("click", function () {

            bar.remove();

            if (options.onClose) {
                options.onClose();
            }

        });

        bar.appendChild(close);


        document.body.appendChild(bar);

    }


    /* ==================================================
       Service Worker の登録
    ================================================== */

    function registerServiceWorker() {

        if (!("serviceWorker" in navigator)) {

            console.log("[PWA] このブラウザはService Worker未対応です。");

            return;

        }


        // 管理画面ではSWを使わない
        if (location.pathname.indexOf("/admin/") !== -1) {
            return;
        }


        navigator.serviceWorker.register(
            ROOT + "sw.js",
            {
                scope: ROOT
            }
        )
        .then(function (registration) {

            console.log("[PWA] Service Worker登録:", registration.scope);


            // すでに新しいものが待機している
            if (registration.waiting && navigator.serviceWorker.controller) {

                promptUpdate(registration.waiting);

            }


            registration.addEventListener("updatefound", function () {

                var installing = registration.installing;

                if (!installing) {
                    return;
                }


                installing.addEventListener("statechange", function () {

                    if (installing.state !== "installed") {
                        return;
                    }

                    // controller が無い＝初回インストール。案内不要。
                    if (!navigator.serviceWorker.controller) {
                        return;
                    }

                    promptUpdate(installing);

                });

            });


            // 定期的に更新を確認する（1時間ごと）
            setInterval(function () {

                registration.update().catch(function () {});

            }, 60 * 60 * 1000);

        })
        .catch(function (error) {

            console.warn("[PWA] Service Worker登録失敗:", error);

        });


        /*
         * 更新を適用したら1回だけ読み直す。
         *
         * 初回インストール時は claim() でも
         * controllerchange が起きるが、
         * このときは読み直す必要がない。
         */

        var hadController = !!navigator.serviceWorker.controller;

        var refreshing = false;

        navigator.serviceWorker.addEventListener(
            "controllerchange",
            function () {

                if (!hadController || refreshing) {
                    return;
                }

                refreshing = true;

                location.reload();

            }
        );

    }


    function promptUpdate(worker) {

        showBar({

            html: "新しいバージョンがあります。",

            actionLabel: "更新する",

            onAction: function () {

                worker.postMessage({
                    type: "SKIP_WAITING"
                });

            }

        });

    }


    /* ==================================================
       ホーム画面への追加の案内

       Android / PC は beforeinstallprompt が使える。
       iOS はイベントが無いので手順を文章で案内する。
    ================================================== */

    var DISMISS_KEY = "iwasePwaInstallDismissedAt";

    var DISMISS_DAYS = 30;


    function recentlyDismissed() {

        try {

            var value = localStorage.getItem(DISMISS_KEY);

            if (!value) {
                return false;
            }

            var elapsed = Date.now() - Number(value);

            return elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000;

        }
        catch (error) {

            return false;

        }

    }


    function markDismissed() {

        try {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
        }
        catch (error) {
            // 無視
        }

    }


    function setupInstallPrompt() {

        // すでにインストール済み
        if (isStandalone()) {
            return;
        }

        // トップページ以外では出さない
        var rootPath = new URL(ROOT).pathname;

        var path = location.pathname;

        var isTop =
            path === rootPath ||
            path === rootPath + "index.html";

        if (!isTop) {
            return;
        }

        if (recentlyDismissed()) {
            return;
        }


        /* ---------- LINE等のアプリ内ブラウザ ---------- */

        if (isInAppBrowser()) {

            setTimeout(function () {

                showBar({

                    html:
                        "このアプリはホーム画面に追加すると、" +
                        "通信が切れても使えて通知も受け取れます。<br>" +
                        "右上のメニューから" +
                        "<b>「ブラウザで開く」</b>を選んでください。",

                    onClose: markDismissed

                });

            }, 2500);

            return;

        }


        /* ---------- iPhone / iPad ---------- */

        if (isIos()) {

            setTimeout(function () {

                showBar({

                    html:
                        "ホーム画面に追加すると、通信が切れても使えます。<br>" +
                        "下の<b>共有ボタン</b>から" +
                        "<b>「ホーム画面に追加」</b>を選んでください。",

                    onClose: markDismissed

                });

            }, 2500);

            return;

        }


        /* ---------- Android / PC ---------- */

        window.addEventListener("beforeinstallprompt", function (event) {

            event.preventDefault();

            var deferred = event;


            showBar({

                html: "ホーム画面に追加すると、通信が切れても使えます。",

                actionLabel: "追加する",

                onAction: function () {

                    deferred.prompt();

                    deferred.userChoice.then(function (choice) {

                        console.log("[PWA] インストール選択:", choice.outcome);

                        if (choice.outcome !== "accepted") {
                            markDismissed();
                        }

                    });

                },

                onClose: markDismissed

            });

        });

    }


    /* ==================================================
       起動
    ================================================== */

    function start() {

        registerServiceWorker();

        setupInstallPrompt();

    }


    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", start);

    }
    else {

        start();

    }

})();

/* ==================================================
   岩瀬自治会 防災アプリ
   自治会ツール 共通処理

   アンケートと掲示板で共通して使う小さな部品を
   1か所にまとめている。

   ・端末識別子（二重回答・二重いいねの抑止用）
   ・文字列のエスケープ
   ・日付の表示

   端末識別子について

     個人を特定するためのものではない。
     「同じ端末から2回押されていないか」を
     判定するためだけに使う。
     利用者情報があればその ID を、
     無ければ端末ごとの乱数を使う。
================================================== */

(function (global) {

    "use strict";


    var CLIENT_KEY_STORAGE = "iwaseClientKey";


    /* ==================================================
       端末識別子
    ================================================== */

    function createRandomKey() {

        try {

            if (
                global.crypto &&
                typeof global.crypto.randomUUID === "function"
            ) {

                return global.crypto.randomUUID();

            }

        }
        catch (error) {

            console.warn("randomUUID を利用できません:", error);

        }


        return (
            "k-" +
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).slice(2, 10)
        );

    }


    function clientKey() {

        /*
         * 利用者情報があればそれを使う。
         * 端末を変えても同じ人だと分かるため、
         * 二重回答の抑止が効きやすい。
         */

        try {

            if (
                global.IwaseIdentity &&
                typeof global.IwaseIdentity.read === "function"
            ) {

                var user = global.IwaseIdentity.read();

                if (user && user.id) {
                    return String(user.id);
                }

            }

        }
        catch (error) {

            console.warn("利用者情報の読み取りに失敗:", error);

        }


        try {

            var stored = localStorage.getItem(CLIENT_KEY_STORAGE);

            if (stored) {
                return stored;
            }

            var created = createRandomKey();

            localStorage.setItem(CLIENT_KEY_STORAGE, created);

            return created;

        }
        catch (error) {

            console.warn("端末識別子を保存できません:", error);

            return createRandomKey();

        }

    }


    /* ==================================================
       利用者情報

       ログインしていない場合でも
       画面は動くようにしておく。
    ================================================== */

    function currentUser() {

        try {

            if (
                global.IwaseIdentity &&
                typeof global.IwaseIdentity.read === "function"
            ) {

                return global.IwaseIdentity.read();

            }

        }
        catch (error) {

            console.warn("利用者情報の読み取りに失敗:", error);

        }

        return null;

    }


    /* ==================================================
       エスケープ
    ================================================== */

    function escapeHtml(value) {

        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

    }


    /* ==================================================
       日付

       2026-05-01 → 2026年5月1日(金)
    ================================================== */

    var WEEK_DAYS = ["日", "月", "火", "水", "木", "金", "土"];


    function formatDate(value) {

        if (!value) {
            return "";
        }

        var parts = String(value).split("T")[0].split("-");

        if (parts.length !== 3) {
            return String(value);
        }

        var year  = Number(parts[0]);
        var month = Number(parts[1]);
        var day   = Number(parts[2]);

        var date = new Date(year, month - 1, day);

        var week = "";

        if (!isNaN(date.getTime())) {
            week = "(" + WEEK_DAYS[date.getDay()] + ")";
        }

        return year + "年" + month + "月" + day + "日" + week;

    }


    /* ==================================================
       日時

       サーバーの時刻を日本時間で表示する。
    ================================================== */

    function formatDateTime(value) {

        if (!value) {
            return "";
        }

        var date = new Date(value);

        if (isNaN(date.getTime())) {
            return String(value);
        }

        try {

            return date.toLocaleString(
                "ja-JP",
                {
                    timeZone: "Asia/Tokyo",
                    year:   "numeric",
                    month:  "2-digit",
                    day:    "2-digit",
                    hour:   "2-digit",
                    minute: "2-digit"
                }
            );

        }
        catch (error) {

            return date.toLocaleString();

        }

    }


    /* ==================================================
       Supabase クライアント
    ================================================== */

    function client() {

        if (global.supabaseClient) {
            return global.supabaseClient;
        }

        console.error("Supabaseクライアントが初期化されていません。");

        return null;

    }


    /* ==================================================
       会員区分

       自治会コードによって、使える機能が変わる。

         member … 岩瀬自治会の会員
                  すべての機能を使える

         guest  … 会員以外
                  地区防災計画・自治会ツールは使えない
                  活動実績は文字だけ表示する

       この判定は画面の出し分けのためのもので、
       通信の内容そのものを守るものではない。
       公開しているファイル（写真など）は、
       URLを直接開けば誰でも見られる。
    ================================================== */

    function memberType() {

        var user = currentUser();

        if (user && user.memberType === "guest") {

            return "guest";

        }

        return "member";

    }


    function isMember() {

        return memberType() === "member";

    }


    /* ==================================================
       会員限定ページの入口

       会員でなければ案内を出して中身を消す。
       戻り先を必ず用意して、
       行き止まりにならないようにする。
    ================================================== */

    function requireMember(options) {

        if (isMember()) {

            return true;

        }


        var settings = options || {};

        var container =
            document.querySelector(settings.selector || "main");

        if (!container) {

            return false;

        }


        container.innerHTML =
            '<div class="tool-card">' +

            '<h2>会員向けの機能です</h2>' +

            '<p>' +
            'この機能は、岩瀬自治会の会員の方がご利用いただけます。<br>' +
            '会員の方は、自治会からお知らせしている' +
            '会員用の自治会コードでログインしてください。' +
            '</p>' +

            '<p>' +
            '自治会コードは、設定画面からログアウトしたあと、' +
            'ログイン画面で入力し直せます。' +
            '</p>' +

            '<a class="tool-button" ' +
            'style="display:block;text-align:center;' +
            'text-decoration:none;box-sizing:border-box;" ' +
            'href="' + (settings.settingsHref || "../settings/settings.html") + '">' +
            '⚙ 設定を開く' +
            '</a>' +

            '<a class="back-button" ' +
            'href="' + (settings.homeHref || "../index.html") + '">' +
            '🏠 トップページへ戻る' +
            '</a>' +

            '</div>';


        return false;

    }


    global.IwaseCommunity = {

        memberType:     memberType,

        isMember:       isMember,

        requireMember:  requireMember,


        clientKey:      clientKey,

        currentUser:    currentUser,

        escapeHtml:     escapeHtml,

        formatDate:     formatDate,

        formatDateTime: formatDateTime,

        client:         client

    };

})(window);

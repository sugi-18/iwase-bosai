/* ==================================================
   岩瀬自治会 防災アプリ
   気象警報などの表示

   Supabase の alerts テーブルを読んで、
   画面の一番上に発表中の情報を出す。

   気象庁へは各端末から直接取りに行かない。
   Edge Function が定期的に取得して alerts に
   書き込んだものを読む。

   理由：

     ・全端末が気象庁へ直接アクセスすると
       負荷をかけてしまう
     ・CORSの保証がない
     ・「いつ何が発表されたか」の履歴が残らない

   表示先：

     <div id="alertBanner"></div> があればそこ。
     無ければ body の先頭に差し込む。

   置き場所：<root>/common/alerts.js
================================================== */

(function () {

    "use strict";


    /* ==================================================
       表示設定
    ================================================== */

    var REFRESH_MS = 5 * 60 * 1000;   // 5分ごとに読み直す

    var LEVEL_STYLE = {

        3: {
            label: "特別警報",
            bg: "#7b1fa2",
            fg: "#fff"
        },

        2: {
            label: "警報",
            bg: "#d62828",
            fg: "#fff"
        },

        1: {
            label: "注意報",
            bg: "#f39c12",
            fg: "#333"
        },

        0: {
            label: "お知らせ",
            bg: "#1f77b4",
            fg: "#fff"
        }

    };


    /* ==================================================
       小道具
    ================================================== */

    function escapeHtml(value) {

        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

    }


    function formatJst(value) {

        try {

            var date = new Date(value);

            if (isNaN(date.getTime())) {
                return "";
            }

            return new Intl.DateTimeFormat("ja-JP", {
                timeZone: "Asia/Tokyo",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }).format(date);

        }
        catch (error) {

            return "";

        }

    }


    function getContainer() {

        var container = document.getElementById("alertBanner");

        if (container) {
            return container;
        }

        container = document.createElement("div");

        container.id = "alertBanner";

        document.body.insertBefore(
            container,
            document.body.firstChild
        );

        return container;

    }


    /* ==================================================
       描画
    ================================================== */

    function renderNone() {

        getContainer().innerHTML = "";

    }


    function render(rows) {

        if (!rows || rows.length === 0) {

            renderNone();

            return;

        }


        var items = rows.map(function (row) {

            var level = Number(row.level || 0);

            var style = LEVEL_STYLE[level] || LEVEL_STYLE[0];


            var timeText = formatJst(row.issued_at);

            var area = row.area_name
                ? escapeHtml(row.area_name)
                : "";


            return (
                '<div style="background:' + style.bg + ';' +
                'color:' + style.fg + ';' +
                'border-radius:10px;padding:12px 14px;' +
                'margin:0 0 8px;text-align:left;">' +

                '<div style="font-size:16px;font-weight:bold;' +
                'line-height:1.4;">' +
                escapeHtml(row.title) +
                '</div>' +

                (row.body
                    ? '<div style="font-size:13px;margin-top:6px;' +
                      'line-height:1.6;opacity:.95;">' +
                      escapeHtml(row.body) +
                      '</div>'
                    : "") +

                '<div style="font-size:12px;margin-top:6px;opacity:.85;">' +
                (area ? area + "　" : "") +
                (timeText ? timeText + " 発表" : "") +
                '</div>' +

                '</div>'
            );

        }).join("");


        getContainer().innerHTML =

            '<section style="max-width:640px;margin:0 auto 20px;">' +

            items +

            '<p style="font-size:12px;color:#777;text-align:left;' +
            'line-height:1.7;margin:6px 2px 0;">' +
            '出典：気象庁ホームページ　' +
            '<a href="https://www.jma.go.jp/bosai/warning/" ' +
            'target="_blank" rel="noopener noreferrer">最新の発表を見る</a>' +
            '<br>この表示は更新が遅れることがあります。' +
            '危険を感じたら情報を待たずに安全を確保してください。' +
            '</p>' +

            '</section>';

    }


    /* ==================================================
       取得
    ================================================== */

    async function load() {

        if (!window.supabaseClient) {

            console.warn("[Alerts] supabaseClient が読み込まれていません。");

            return;

        }


        try {

            var result = await window.supabaseClient
                .from("alerts")
                .select("title, body, level, area_name, issued_at, source")
                .eq("is_active", true)
                .order("level", { ascending: false })
                .order("issued_at", { ascending: false })
                .limit(10);


            if (result.error) {

                throw result.error;

            }


            render(result.data);


        }
        catch (error) {

            console.warn("[Alerts] 取得失敗:", error);

            // 取得できないときは何も出さない。
            // 「警報なし」と誤解させないため。

        }

    }


    function start() {

        load();

        setInterval(load, REFRESH_MS);


        // アプリに戻ってきたときにも読み直す
        document.addEventListener("visibilitychange", function () {

            if (document.visibilityState === "visible") {
                load();
            }

        });

    }


    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", start);

    }
    else {

        start();

    }

})();

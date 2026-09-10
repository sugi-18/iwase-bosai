/* ==================================================
   岩瀬自治会 防災アプリ
   利用状況の記録

   どの画面が実際に開かれているかを記録する。

   何のために記録するか

     ・並び順を、思い込みではなく実際の使われ方で決める
     ・使われていない機能を見つける
     ・研究の成果として「どの機能が使われたか」を示す

   何を記録しないか

     ・画面の中で何を入力したか
     ・アンケートの回答内容
     ・掲示板に何を書いたか

     記録するのは「どの画面をいつ開いたか」だけである。

   個人との結びつき

     ログインしている場合は参加者IDを記録する。
     誰が使っているかではなく、
     「何人が使っているか」を数えるために必要なため。

     気になる場合は、下の SEND_PARTICIPANT_ID を
     false にすれば、端末の識別子だけになる。

   使い方

     supabaseClient を読み込んだあとに

       <script src="./common/tracking.js"></script>

     を置く。
================================================== */

(function () {

    "use strict";


    /* 参加者IDも一緒に送るか */

    var SEND_PARTICIPANT_ID = true;


    /*
     * 同じ画面を短時間に何度も開いたときは
     * 1回として数える。
     *
     * 戻る・進むを繰り返しただけで
     * 数字が膨らむのを防ぐため。
     */

    var COOLDOWN_MS = 5 * 60 * 1000;

    var STORAGE_KEY = "iwasePageViewSent";


    /* ==================================================
       画面の名前

       ファイルの場所から、人が読める名前に直す。
       集計するときに分かりやすくするため。
    ================================================== */

    var PAGE_NAMES = [

        ["/prepare/",             "そなえる"],
        ["/timeline/",            "マイタイムライン入口"],
        ["/water-timeline/",      "水害マイタイムライン"],
        ["/earthquake-timeline/", "地震マイタイムライン"],
        ["/checklist/",           "防災力診断"],
        ["/plan/",                "地区防災計画"],
        ["/tools/survey",         "アンケート"],
        ["/tools/board",          "掲示板"],
        ["/tools/",               "自治会ツール"],
        ["/training/",            "訓練・スタンプ"],
        ["/next-training/",       "次回訓練"],
        ["/annual_schedule/",     "年間予定"],
        ["/record/",              "活動実績"],
        ["/stamp/certificate",    "認定証"],
        ["/stamp/training",       "訓練の記録"],
        ["/stamp/qr",             "QR読み取り"],
        ["/stamp/",               "スタンプカード"],
        ["/settings/",            "設定"],
        ["/login/",               "ログイン"],
        ["/links",                "リンク集"]

    ];


    function pageKey() {

        var path = location.pathname;


        for (var i = 0; i < PAGE_NAMES.length; i++) {

            if (path.indexOf(PAGE_NAMES[i][0]) !== -1) {

                return PAGE_NAMES[i][1];

            }

        }


        return "ホーム";

    }


    /* ==================================================
       短時間の重複を防ぐ
    ================================================== */

    function shouldSend(key) {

        try {

            var raw = localStorage.getItem(STORAGE_KEY);

            var map = raw ? JSON.parse(raw) : {};

            var now = Date.now();


            if (
                map[key] &&
                (now - map[key]) < COOLDOWN_MS
            ) {

                return false;

            }


            map[key] = now;


            /* 古い記録は捨てる */

            Object.keys(map).forEach(function (name) {

                if ((now - map[name]) > 7 * 24 * 60 * 60 * 1000) {

                    delete map[name];

                }

            });


            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(map)
            );


            return true;

        }
        catch (error) {

            /* 保存できない環境では、毎回送る */

            return true;

        }

    }


    /* ==================================================
       送信

       記録が失敗しても、画面の動きには影響させない。
       利用者にとっては何の関係もない処理なので、
       エラーも表に出さない。
    ================================================== */

    /*
     * Supabaseクライアントの取り出し
     *
     * ページによって、window に入れている場合と
     * const で宣言している場合がある。
     * const は window に載らないので、両方を見る。
     */

    function getClient() {

        if (window.supabaseClient) {

            return window.supabaseClient;

        }

        try {

            if (typeof supabaseClient !== "undefined") {

                return supabaseClient;

            }

        }
        catch (error) {

            /* 宣言されていない場合はここへ来る */

        }

        return null;

    }


    async function send() {

        try {

            var client = getClient();


            if (!client) {

                return;

            }


            var key = pageKey();


            if (!shouldSend(key)) {

                return;

            }


            var participantId = null;

            var memberType = "member";


            if (
                SEND_PARTICIPANT_ID &&
                window.IwaseIdentity &&
                typeof window.IwaseIdentity.read === "function"
            ) {

                var user = window.IwaseIdentity.read();

                if (user) {

                    participantId = user.id || null;

                    memberType =
                        user.memberType === "guest"
                            ? "guest"
                            : "member";

                }

            }


            var clientKey = null;

            if (
                window.IwaseCommunity &&
                typeof window.IwaseCommunity.clientKey === "function"
            ) {

                clientKey = window.IwaseCommunity.clientKey();

            }


            var result =
                await client.rpc(
                    "log_page_view",
                    {
                        p_page:           key,
                        p_path:           location.pathname,
                        p_participant_id: participantId,
                        p_member_type:    memberType,
                        p_client_key:     clientKey
                    }
                );


            if (result.error) {

                console.warn(
                    "[Tracking] 記録できませんでした:",
                    result.error.message
                );

            }

        }
        catch (error) {

            console.warn("[Tracking] 記録できませんでした:", error);

        }

    }


    /*
     * 画面が出そろってから送る。
     * 表示より先に通信を始めても良いことはない。
     */

    function start() {

        setTimeout(send, 1200);

    }


    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", start);

    }
    else {

        start();

    }

})();

/* ==================================================
   岩瀬自治会 防災アプリ
   下部タブバー

   これまで、前の画面へ戻るには
   一番下までスクロールして
   「トップページへ戻る」を押す必要があった。

   画面下に固定のタブを置き、
   どこにいても1回で移動できるようにする。

   各ページはそれぞれ独立したHTMLなので、
   HTMLを書き足さずに済むよう、
   この1ファイルで組み立てて差し込む。

   使い方

     <script src="./common/nav.js"></script>

   ページの深さは自動で判定する。
================================================== */

(function () {

    "use strict";


    /* ==================================================
       ページの深さ

       ルート直下か、1つ下の階層かで
       リンクの書き方が変わる。
    ================================================== */

    function basePath() {

        var path = location.pathname;


        /* 末尾のファイル名を落とす */

        var dir = path.replace(/[^/]*$/, "");


        /*
         * GitHub Pages では
         *   /iwase-bosai/            … ルート
         *   /iwase-bosai/tools/      … 1つ下
         * のようになる。
         *
         * ルートからの深さを数えるのではなく、
         * 「index.html があるところ」を基準にしたい。
         *
         * ここでは、既に読み込まれている
         * script タグの src から逆算する。
         */

        var scripts = document.getElementsByTagName("script");

        for (var i = 0; i < scripts.length; i++) {

            var src = scripts[i].getAttribute("src") || "";

            var index = src.indexOf("common/nav.js");

            if (index !== -1) {

                return src.slice(0, index);

            }

        }


        return dir;

    }


    var BASE = basePath();


    /* ==================================================
       タブの内容

       4つまでにしている。
       これ以上増やすと、1つあたりが小さくなり
       押し間違えが増える。
    ================================================== */

    var TABS = [

        {
            key:   "home",
            icon:  "🏠",
            label: "ホーム",
            href:  "index.html",
            match: ["index.html", ""]
        },

        {
            key:   "prepare",
            icon:  "🧰",
            label: "そなえる",
            href:  "prepare/prepare.html",
            match: [
                "prepare/",
                "timeline/",
                "water-timeline/",
                "earthquake-timeline/",
                "checklist/"
            ]
        },

        {
            key:   "community",
            icon:  "🧑‍🤝‍🧑",
            label: "自治会",
            href:  "tools/tools.html",
            match: [
                "tools/",
                "plan/",
                "training/",
                "record/",
                "next-training/",
                "annual_schedule/",
                "stamp/"
            ]
        },

        {
            key:   "settings",
            icon:  "⚙",
            label: "設定",
            href:  "settings/settings.html",
            match: ["settings/"]
        }

    ];


    /* ==================================================
       いまどのタブにいるか
    ================================================== */

    function currentKey() {

        var path = location.pathname;


        for (var i = 1; i < TABS.length; i++) {

            var patterns = TABS[i].match;

            for (var j = 0; j < patterns.length; j++) {

                if (
                    patterns[j] &&
                    path.indexOf("/" + patterns[j]) !== -1
                ) {

                    return TABS[i].key;

                }

            }

        }


        return "home";

    }


    /* ==================================================
       組み立て
    ================================================== */

    function build() {

        if (document.getElementById("iwaseTabBar")) {

            return;

        }


        var active = currentKey();


        var nav = document.createElement("nav");

        nav.id = "iwaseTabBar";

        nav.className = "iwase-tab-bar";

        nav.setAttribute("aria-label", "メインメニュー");


        TABS.forEach(function (tab) {

            var link = document.createElement("a");

            link.className =
                "iwase-tab" +
                (tab.key === active ? " active" : "");

            link.href = BASE + tab.href;


            link.innerHTML =
                '<span class="iwase-tab-icon">' +
                tab.icon +
                '</span>' +
                '<span class="iwase-tab-label">' +
                tab.label +
                '</span>';


            nav.appendChild(link);

        });


        document.body.appendChild(nav);


        /*
         * タブの高さの分だけ、本文の下に余白を作る。
         * これが無いと、一番下の内容がタブに隠れる。
         */

        document.body.classList.add("has-tab-bar");

    }


    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", build);

    }
    else {

        build();

    }

})();

/* ==================================================
   岩瀬自治会 防災アプリ
   文字の大きさ

   設定画面で選んだ文字サイズを、
   すべてのページで同じように適用する。

   仕組み

     ・localStorage に倍率を保存する
     ・body に zoom をかけて画面全体を拡大する

   文字サイズだけを変えると、
   ボタンや枠が元の大きさのままになり
   文字がはみ出す。
   画面ごと拡大したほうが崩れにくい。

   使い方

     <script src="./common/appearance.js"></script>

   を各ページに読み込むだけでよい。
================================================== */

(function (global) {

    "use strict";


    var STORAGE_KEY = "iwaseFontScale";


    /* ==================================================
       選べる大きさ
    ================================================== */

    var LEVELS = [

        {
            key: "normal",
            label: "標準",
            scale: 1
        },

        {
            key: "large",
            label: "大きい",
            scale: 1.15
        },

        {
            key: "xlarge",
            label: "特大",
            scale: 1.3
        }

    ];


    /* ==================================================
       保存されている設定を読む
    ================================================== */

    function read() {

        try {

            var value = localStorage.getItem(STORAGE_KEY);

            if (!value) {
                return "normal";
            }

            for (var i = 0; i < LEVELS.length; i++) {

                if (LEVELS[i].key === value) {
                    return value;
                }

            }

            return "normal";

        }
        catch (error) {

            console.warn("文字サイズ設定の読み込みに失敗:", error);

            return "normal";

        }

    }


    function findLevel(key) {

        for (var i = 0; i < LEVELS.length; i++) {

            if (LEVELS[i].key === key) {
                return LEVELS[i];
            }

        }

        return LEVELS[0];

    }


    /* ==================================================
       画面へ反映する
    ================================================== */

    function apply(key) {

        var level = findLevel(key || read());

        var root = document.documentElement;


        /* 判定に使えるようにクラスも付けておく */

        root.classList.remove(
            "iwase-font-normal",
            "iwase-font-large",
            "iwase-font-xlarge"
        );

        root.classList.add("iwase-font-" + level.key);


        root.style.setProperty(
            "--iwase-font-scale",
            String(level.scale)
        );


        if (document.body) {

            if (level.scale === 1) {

                document.body.style.zoom = "";

            }
            else {

                document.body.style.zoom = String(level.scale);

            }

        }

    }


    /* ==================================================
       設定を保存して反映する
    ================================================== */

    function set(key) {

        var level = findLevel(key);

        try {

            localStorage.setItem(STORAGE_KEY, level.key);

        }
        catch (error) {

            console.warn("文字サイズ設定の保存に失敗:", error);

        }

        apply(level.key);

        return level.key;

    }


    /* ==================================================
       起動時の適用

       body がまだ無いときは
       DOMContentLoaded を待つ。
    ================================================== */

    function init() {

        apply(read());

        if (!document.body) {

            document.addEventListener(
                "DOMContentLoaded",
                function () {
                    apply(read());
                }
            );

        }

    }


    init();


    global.IwaseAppearance = {

        LEVELS: LEVELS,

        get: read,

        set: set,

        apply: apply,

        STORAGE_KEY: STORAGE_KEY

    };

})(window);

// ==================================================
// 岩瀬自治会 防災アプリ
// QRからの受付（旧方式）
//
// いまの訓練QRは training.html?training_id=... へ
// 直接つながっている。
//
// このページは、日付と訓練名をURLで渡していた
// 古いQRコードのために残してある。
//
// 以前は stamp/index.html へ移動していたが、
// そのファイルは存在しないため開けなかった。
// stamp.html へ移動するように直している。
// ==================================================

"use strict";


function goStamp() {

    try {

        const params =
            new URLSearchParams(
                window.location.search
            );


        const trainingData = {

            date:
                params.get("date"),

            name:
                params.get("name"),

            detail:
                params.get("detail")

        };


        localStorage.setItem(
            "qrTraining",
            JSON.stringify(trainingData)
        );

    }
    catch (error) {

        console.warn(
            "訓練情報を保存できませんでした:",
            error
        );

    }


    /*
     * スタンプカードはURL直打ちを防ぐため
     * sessionStorage を見ている。
     * ここで印を付けてから移動する。
     */

    try {

        sessionStorage.setItem(
            "iwaseStampAccess",
            "1"
        );

    }
    catch (error) {

        console.warn(
            "sessionStorageに書き込めません:",
            error
        );

    }


    window.location.href = "stamp.html";

}

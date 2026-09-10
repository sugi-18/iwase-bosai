// ==================================================
// 岩瀬自治会 防災アプリ
// アプリ内でのQR読み取り
//
// なぜこの画面が必要か
//
//   スマートフォンの標準のカメラでQRを読むと、
//   ホーム画面に追加したアプリではなく
//   ブラウザ（iPhoneならSafari）で開く。
//
//   iOSではこの2つは別々の保存領域を使うため、
//   アプリ側に保存した利用者情報が見えず、
//   参加登録に失敗することがあった。
//
//   この画面で読み取れば、アプリの中にいるまま
//   次の画面へ進むので、利用者情報がそのまま使える。
//
// 読み取れないときのために、
// 4桁の受付番号での入口も同じ画面に置いている。
// ==================================================

(function () {

"use strict";


var video = null;

var canvas = null;

var context = null;

var stream = null;

var scanning = false;


/* ==================================================
   小さな道具
================================================== */

function el(id) {

    return document.getElementById(id);

}


function showMessage(containerId, text, isError) {

    var container = el(containerId);

    if (!container) {
        return;
    }

    if (!text) {

        container.innerHTML = "";

        return;

    }

    container.innerHTML =
        '<div class="tool-message ' +
        (isError ? "tool-message-ng" : "tool-message-ok") +
        '">' +
        window.IwaseCommunity.escapeHtml(text) +
        '</div>';

}


/* ==================================================
   読み取った文字から training_id を取り出す

   QRの中身は、ふつうは
     https://.../stamp/training.html?training_id=xxxx
   の形をしている。

   古いQRや、書き方が違うものにも
   できるだけ対応しておく。
================================================== */

function extractTrainingId(text) {

    if (!text) {
        return null;
    }


    var value = String(text).trim();


    /* URLとして読めるか */

    try {

        var url = new URL(value);

        var id = url.searchParams.get("training_id");

        if (id) {
            return id;
        }

    }
    catch (error) {

        /* URLでない場合はここへ来る */

    }


    /* クエリだけが入っている場合 */

    var match = value.match(/training_id=([^&\s]+)/);

    if (match) {

        return decodeURIComponent(match[1]);

    }


    /*
     * 訓練IDそのものが入っている場合。
     * URLでも数字4桁でもないものを、それとみなす。
     */

    if (
        value.indexOf("http") !== 0 &&
        value.length >= 4 &&
        value.length <= 64
    ) {

        return value;

    }


    return null;

}


/* ==================================================
   次の画面へ

   参加登録の画面はこれまでどおり training.html。
   読み取った結果を渡すだけにしている。
================================================== */

function goToTraining(trainingId) {

    stopCamera();

    window.location.href =
        "training.html?training_id=" +
        encodeURIComponent(trainingId);

}


/* ==================================================
   カメラの開始
================================================== */

async function startCamera() {

    var startButton = el("scanStartButton");

    var stopButton  = el("scanStopButton");

    var frame       = el("scanFrame");


    showMessage("scanMessage", "", false);


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        showMessage(
            "scanMessage",
            "この端末ではカメラを使えません。" +
            "下の受付番号での登録をお使いください。",
            true
        );

        return;

    }


    if (typeof jsQR === "undefined") {

        showMessage(
            "scanMessage",
            "読み取りの準備ができませんでした。" +
            "通信できる場所で開き直すか、" +
            "受付番号での登録をお使いください。",
            true
        );

        return;

    }


    startButton.disabled = true;

    startButton.textContent = "カメラを起動しています...";


    try {

        stream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" }
                },
                audio: false
            });


        video = el("scanVideo");

        video.srcObject = stream;

        video.setAttribute("playsinline", true);

        await video.play();


        canvas = document.createElement("canvas");

        context = canvas.getContext("2d", {
            willReadFrequently: true
        });


        frame.classList.remove("scan-hidden");

        stopButton.classList.remove("scan-hidden");

        startButton.classList.add("scan-hidden");


        scanning = true;

        requestAnimationFrame(tick);


        showMessage(
            "scanMessage",
            "QRコードを枠の中に写してください。",
            false
        );


    }
    catch (error) {

        console.error("カメラを開始できません:", error);


        var message =
            "カメラを使えませんでした。";


        if (
            error &&
            (
                error.name === "NotAllowedError" ||
                error.name === "SecurityError"
            )
        ) {

            message =
                "カメラの使用が許可されていません。" +
                "端末の設定で許可するか、" +
                "下の受付番号での登録をお使いください。";

        }


        showMessage("scanMessage", message, true);


        startButton.disabled = false;

        startButton.textContent = "カメラを起動する";

    }

}


/* ==================================================
   カメラの停止

   画面を離れるときは必ず止める。
   止め忘れると、カメラが動いたままになる。
================================================== */

function stopCamera() {

    scanning = false;


    if (stream) {

        stream.getTracks().forEach(function (track) {

            track.stop();

        });

        stream = null;

    }


    var frame = el("scanFrame");

    var startButton = el("scanStartButton");

    var stopButton = el("scanStopButton");


    if (frame) {
        frame.classList.add("scan-hidden");
    }

    if (stopButton) {
        stopButton.classList.add("scan-hidden");
    }

    if (startButton) {

        startButton.classList.remove("scan-hidden");

        startButton.disabled = false;

        startButton.textContent = "カメラを起動する";

    }

}


/* ==================================================
   1コマごとの読み取り
================================================== */

function tick() {

    if (!scanning) {
        return;
    }


    try {

        if (
            video &&
            video.readyState === video.HAVE_ENOUGH_DATA
        ) {

            canvas.width = video.videoWidth;

            canvas.height = video.videoHeight;


            context.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
            );


            var image =
                context.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );


            var result =
                jsQR(
                    image.data,
                    image.width,
                    image.height,
                    { inversionAttempts: "dontInvert" }
                );


            if (result && result.data) {

                var trainingId =
                    extractTrainingId(result.data);


                if (trainingId) {

                    showMessage(
                        "scanMessage",
                        "読み取りました。登録画面へ進みます。",
                        false
                    );

                    goToTraining(trainingId);

                    return;

                }


                showMessage(
                    "scanMessage",
                    "このQRコードは訓練用ではないようです。",
                    true
                );

            }

        }

    }
    catch (error) {

        console.warn("読み取り中のエラー:", error);

    }


    requestAnimationFrame(tick);

}


/* ==================================================
   受付番号での登録
================================================== */

async function submitCode() {

    var input = el("codeInput");

    var button = el("codeButton");

    var code = (input.value || "").trim();


    if (!/^[0-9]{4}$/.test(code)) {

        showMessage(
            "codeMessage",
            "受付番号は数字4桁で入力してください。",
            true
        );

        return;

    }


    button.disabled = true;

    button.textContent = "確認中...";

    showMessage("codeMessage", "", false);


    try {

        var result =
            await window.supabaseClient.rpc(
                "find_training_by_code",
                { p_code: code }
            );


        if (result.error) {
            throw result.error;
        }


        var data = result.data || {};


        if (data.success !== true) {

            showMessage(
                "codeMessage",
                data.error === "not_found"
                    ? "この受付番号の訓練が見つかりません。" +
                      "番号をご確認ください。"
                    : "受付番号を確認できませんでした。",
                true
            );

            button.disabled = false;

            button.textContent = "この番号で進む";

            return;

        }


        goToTraining(data.training_id);


    }
    catch (error) {

        console.error("受付番号の確認エラー:", error);

        showMessage(
            "codeMessage",
            "確認できませんでした。通信状態をご確認ください。",
            true
        );

        button.disabled = false;

        button.textContent = "この番号で進む";

    }

}


/* ==================================================
   起動
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        el("scanStartButton")
            .addEventListener("click", startCamera);

        el("scanStopButton")
            .addEventListener("click", stopCamera);

        el("codeButton")
            .addEventListener("click", submitCode);


        el("codeInput")
            .addEventListener(
                "keydown",
                function (event) {

                    if (event.key === "Enter") {

                        submitCode();

                    }

                }
            );


        /* 画面を離れたらカメラを止める */

        window.addEventListener("pagehide", stopCamera);

        document.addEventListener(
            "visibilitychange",
            function () {

                if (document.visibilityState === "hidden") {

                    stopCamera();

                }

            }
        );

    }
);

})();

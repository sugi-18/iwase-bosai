/* ==================================================
   岩瀬自治会 防災アプリ
   管理者画面 PDF出力
   完成版
================================================== */

"use strict";


/* ==================================================
   共通：HTMLエスケープ
================================================== */

function escapePdfText(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* ==================================================
   共通：日付
================================================== */

function formatPdfDate(value) {

    const date =
        value instanceof Date
            ? value
            : new Date(value);

    if (Number.isNaN(date.getTime())) {

        return "";

    }

    return (
        date.getFullYear() +
        "/" +
        String(
            date.getMonth() + 1
        ).padStart(2, "0") +
        "/" +
        String(
            date.getDate()
        ).padStart(2, "0") +
        " " +
        String(
            date.getHours()
        ).padStart(2, "0") +
        ":" +
        String(
            date.getMinutes()
        ).padStart(2, "0")
    );

}


/* ==================================================
   PDF用クローンを作成
================================================== */

function preparePdfClone(source) {

    const clone =
        source.cloneNode(true);


    /* ----------------------------------------------
       重要
       hiddenをPDF側では解除
    ---------------------------------------------- */

    clone
        .classList
        .remove("hidden");


    /*
     * 子要素にもhiddenが付いている場合に備える
     */

    clone
        .querySelectorAll(".hidden")
        .forEach(
            element => {

                element.classList.remove(
                    "hidden"
                );

            }
        );


    /*
     * 操作用ボタンを削除
     */

    clone
        .querySelectorAll(
            "button"
        )
        .forEach(
            button => {

                button.remove();

            }
        );


    /*
     * モーダル・操作用要素を削除
     */

    clone
        .querySelectorAll(
            ".modal-buttons"
        )
        .forEach(
            element => {

                element.remove();

            }
        );


    /*
     * 明らかにPDFに不要な操作要素
     */

    clone
        .querySelectorAll(
            ".participant-card-delete"
        )
        .forEach(
            element => {

                element.remove();

            }
        );


    return clone;

}


/* ==================================================
   Canvas → Image
================================================== */

function replaceCanvasWithImage(
    originalSource,
    clonedSource
) {

    const originalCanvases =
        originalSource.querySelectorAll(
            "canvas"
        );


    const clonedCanvases =
        clonedSource.querySelectorAll(
            "canvas"
        );


    originalCanvases.forEach(
        (
            originalCanvas,
            index
        ) => {

            const clonedCanvas =
                clonedCanvases[index];


            if (!clonedCanvas) {

                return;

            }


            try {

                const image =
                    document.createElement(
                        "img"
                    );


                image.src =
                    originalCanvas.toDataURL(
                        "image/png"
                    );


                image.style.display =
                    "block";

                image.style.width =
                    "100%";

                image.style.maxWidth =
                    "100%";

                image.style.height =
                    "auto";


                /*
                 * 高さは指定しない。
                 *
                 * 画面上のCanvasの高さ（330px前後）を
                 * そのまま指定すると、PDF側の
                 * グラフ枠の高さを超えてはみ出し、
                 * 次の「参加回数ランキング」に
                 * 重なる原因になる。
                 *
                 * 幅100％・高さ自動にすれば、
                 * 縦横比を保ったまま枠に収まる。
                 */

                const rect =
                    originalCanvas.getBoundingClientRect();


                if (
                    rect.width > 0 &&
                    rect.height > 0
                ) {

                    image.style.aspectRatio =
                        rect.width + " / " + rect.height;

                }


                clonedCanvas.replaceWith(
                    image
                );


            } catch (error) {

                console.error(
                    "Canvas → Image conversion error:",
                    error
                );

            }

        }
    );

}


/* ==================================================
   印刷ウィンドウ
================================================== */

function openPrintWindow(
    title,
    contentHtml
) {

    const printWindow =
        window.open(
            "",
            "_blank",
            "width=1000,height=800"
        );


    if (!printWindow) {

        alert(
            "PDF出力用の画面を開けませんでした。\n\n" +
            "ブラウザのポップアップブロックを確認してください。"
        );

        return;

    }


    /*
     * admin.cssの絶対URL
     */

    const cssUrl =
        new URL(
            "admin.css",
            window.location.href
        ).href;


    /*
     * PDF専用HTML
     */

    const html = `<!DOCTYPE html>

<html lang="ja">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>
    ${escapePdfText(title)}
</title>


<link
    rel="stylesheet"
    href="${cssUrl}"
>


<style>

/* ==================================================
   PDF基本
================================================== */

@page {

    size: A4;

    margin: 12mm;

}


* {

    box-sizing: border-box;

}


html,
body {

    margin: 0;

    padding: 0;

    background: #ffffff;

    color: #222222;

}


body {

    font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Hiragino Kaku Gothic ProN",
        "Hiragino Sans",
        "Yu Gothic",
        "Meiryo",
        sans-serif;

    font-size: 12px;

    line-height: 1.6;

}


/* ==================================================
   ★重要
   admin.cssのhiddenをPDFでは無効化
================================================== */

.hidden {

    display: block !important;

}


/*
 * 本来のhidden要素でもPDFでは
 * 内容を表示するための指定
 */

.content-section.hidden,
.admin-section.hidden {

    display: block !important;

}


/* ==================================================
   PDF本体
================================================== */

.pdf-document {

    width: 100%;

    max-width: 190mm;

    margin: 0 auto;

}


/* ==================================================
   ヘッダー
================================================== */

.pdf-header {

    border-bottom:
        2px solid #333;

    padding-bottom: 8px;

    margin-bottom: 14px;

}


.pdf-header h1 {

    margin: 0 0 4px;

    font-size: 22px;

}


.pdf-header p {

    margin: 0;

    font-size: 11px;

    color: #666;

}


/* ==================================================
   フッター
================================================== */

.pdf-footer {

    margin-top: 20px;

    padding-top: 6px;

    border-top:
        1px solid #ccc;

    font-size: 9px;

    color: #777;

    text-align: right;

}


/* ==================================================
   操作系を非表示
================================================== */

button,
.action-button,
.modal-buttons,
.participant-card-delete,
#refreshParticipantAnalysisButton,
#exportParticipantAnalysisPdfButton {

    display: none !important;

}


/* ==================================================
   グラフ
================================================== */

canvas {

    display: block;

    max-width: 100% !important;

}


img {

    max-width: 100%;

}


/*
 * グラフ枠は高さを固定しない。
 *
 * 画面用のadmin.cssでは330px固定だが、
 * PDFでは画像の高さに合わせて伸縮させる。
 * 固定するとはみ出して次の見出しに重なる。
 */

.chart-container {

    position: relative !important;

    width: 100% !important;

    height: auto !important;

    max-height: none !important;

    overflow: hidden !important;

}


.chart-container img {

    display: block !important;

    width: 100% !important;

    max-width: 100% !important;

    height: auto !important;

    max-height: 80mm !important;

    object-fit: contain !important;

}


/* ==================================================
   2カラムの解除

   「月別参加状況」と「参加回数ランキング」は
   画面では横並びだが、A4では幅が足りず
   重なって見える。PDFでは縦に並べる。
================================================== */

.dashboard-two-column {

    display: block !important;

}


.dashboard-two-column > .dashboard-card {

    width: 100% !important;

    margin-bottom: 8mm !important;

}


.dashboard-card {

    display: block !important;

    width: 100% !important;

    overflow: visible !important;

    margin-bottom: 8mm !important;

    box-shadow: none !important;

}


/*
 * 画面用の高さ制限を解除する
 */

.ranking-list,
.analysis-inactive-list,
.analysis-ranking-list {

    max-height: none !important;

    overflow: visible !important;

}


/* ==================================================
   改ページ制御
================================================== */

.dashboard-card,
.stat-card,
.participant-card,
.participant-card-profile,
.participant-card-stat,
.participant-card-info,
.participant-card-progress,
.participant-card-history,
.history-item,
.ranking-item,
.analysis-ranking-item,
.analysis-inactive-item,
.analysis-training-item {

    break-inside: avoid;

    page-break-inside: avoid;

}


table {

    width: 100%;

    border-collapse: collapse;

}


th,
td {

    border:
        1px solid #ccc;

    padding: 5px 7px;

    text-align: left;

    vertical-align: top;

}


th {

    background: #f2f2f2;

    font-weight: bold;

}


h1,
h2,
h3 {

    break-after: avoid;

    page-break-after: avoid;

}


/* ==================================================
   PDF専用
================================================== */

.admin-container {

    padding: 0 !important;

    margin: 0 !important;

}


.admin-section {

    margin: 0 0 16px 0 !important;

    padding: 0 !important;

}


.content-section {

    display: block !important;

}


/* ==================================================
   印刷
================================================== */

@media print {

    body {

        background: #ffffff;

    }


    .pdf-document {

        max-width: none;

    }


    .hidden {

        display: block !important;

    }


}

</style>

</head>


<body>


<div class="pdf-document">


    <div class="pdf-header">

        <h1>
            ${escapePdfText(title)}
        </h1>

        <p>
            岩瀬自治会 防災アプリ
        </p>

    </div>


    <div id="pdfContent">

        ${contentHtml}

    </div>


    <div class="pdf-footer">

        岩瀬自治会 防災アプリ　
        作成日：
        ${formatPdfDate(new Date())}

    </div>


</div>


</body>

</html>`;


    /*
     * document.writeではなく
     * DOMへ直接書き込む
     */

    printWindow.document.open();

    printWindow.document.write(
        html
    );

    printWindow.document.close();


    /*
     * 印刷前にCSS・画像等の読み込みを待つ
     */

    const printWhenReady =
        async () => {

            try {

                if (
                    printWindow.document
                        .fonts
                ) {

                    await printWindow.document
                        .fonts
                        .ready;

                }

            } catch (error) {

                console.warn(
                    "Font loading wait error:",
                    error
                );

            }


            /*
             * 画像読み込み待ち
             */

            const images =
                Array.from(
                    printWindow.document
                        .images
                );


            if (
                images.length > 0
            ) {

                await Promise.all(
                    images.map(
                        image =>
                            new Promise(
                                resolve => {

                                    if (
                                        image.complete
                                    ) {

                                        resolve();

                                        return;

                                    }


                                    image.onload =
                                        resolve;

                                    image.onerror =
                                        resolve;

                                }
                            )
                    )
                );

            }


            /*
             * 少し待つ
             *
             * Chart画像・CSS等の反映
             */

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        300
                    )
            );


            printWindow.focus();


            printWindow.print();

        };


    printWhenReady();

}


/* ==================================================
   参加者カルテPDF
================================================== */

function exportParticipantCardPdf() {

    const content =
        document.getElementById(
            "participantCardContent"
        );


    if (!content) {

        alert(
            "参加者カルテの内容を取得できませんでした。"
        );

        return;

    }


    const title =
        document.getElementById(
            "participantCardTitle"
        )?.textContent
        ?.trim()
        ||
        "参加者カルテ";


    /*
     * PDF用クローン
     */

    const clone =
        preparePdfClone(
            content
        );


    /*
     * Canvas対応
     */

    replaceCanvasWithImage(
        content,
        clone
    );


    openPrintWindow(
        title,
        clone.innerHTML
    );

}


/* ==================================================
   参加者分析PDF
================================================== */

function exportParticipantAnalysisPdf() {

    const section =
        document.getElementById(
            "participantAnalysisSection"
        );


    if (!section) {

        alert(
            "参加者分析画面を取得できませんでした。"
        );

        return;

    }


    /*
     * PDF用クローン
     *
     * ★ここでhiddenを解除する
     */

    const clone =
        preparePdfClone(
            section
        );


    /*
     * Chart.jsのCanvasを
     * PDFで表示可能な画像へ変換
     */

    replaceCanvasWithImage(
        section,
        clone
    );


    /*
     * PDF出力
     */

    openPrintWindow(
        "防災訓練 参加者分析",
        clone.innerHTML
    );

}


/* ==================================================
   グローバル公開
================================================== */

window.exportParticipantCardPdf =
    exportParticipantCardPdf;


window.exportParticipantAnalysisPdf =
    exportParticipantAnalysisPdf;

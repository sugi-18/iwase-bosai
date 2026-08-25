// =====================================================
// いわぽん防災マイスター
// 認定証 JavaScript
//
// ・氏名は Supabase から取得した最新のものを表示する
//   （本体で氏名を変更した場合、端末に保存された氏名は
//     古いままのため、そのまま表示すると変更前の氏名が
//     出てしまう）
// ・10回以上の参加で
//   「いわぽんトップ防災マイスター」として認定する
//
// certificate.html に次の読み込みが必要:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="../common/iwase-identity.js"></script>
// =====================================================

"use strict";


// =====================================================
// 設定
// =====================================================

// いわぽん防災マイスター 認定に必要な参加回数
const CERTIFICATE_COUNT = 5;

// いわぽんトップ防災マイスター 認定に必要な参加回数
const TOP_MEISTER_COUNT = 10;


// 称号
const RANK_NAME_NORMAL = "いわぽん防災マイスター";

const RANK_NAME_TOP = "いわぽんトップ防災マイスター";


// =====================================================
// Supabase
// =====================================================

const CERT_SUPABASE_URL =
    "https://zumbqukrojdpgfpfekjr.supabase.co";

const CERT_SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_8YXsMHOxLr7MOTEYShUM3w_LsZvR3Qn";

let certSupabaseClient = null;


// =====================================================
// ページ読み込み
// =====================================================

window.addEventListener(
    "DOMContentLoaded",
    async function () {

        await loadCertificateData();

        setupPDFButton();

    }
);


// =====================================================
// Supabase初期化
// =====================================================

function initializeCertificateSupabase() {

    try {

        if (
            typeof window.supabase ===
            "undefined"
        ) {

            console.warn(
                "Supabase JSライブラリを読み込めませんでした。"
            );

            certSupabaseClient = null;

            return false;

        }


        certSupabaseClient =
            window.supabase.createClient(
                CERT_SUPABASE_URL,
                CERT_SUPABASE_PUBLISHABLE_KEY,
                {
                    auth: {

                        persistSession:
                            false,

                        autoRefreshToken:
                            false,

                        detectSessionInUrl:
                            false

                    }
                }
            );


        return true;


    }
    catch (error) {

        console.error(
            "Supabase初期化エラー:",
            error
        );

        certSupabaseClient = null;

        return false;

    }

}


// =====================================================
// 最新の氏名を取得
//
// 取得できたときだけ端末の利用者情報も更新する。
// 取得できなかった場合は端末の氏名をそのまま使う。
// =====================================================

async function fetchLatestName(
    participantId
) {

    if (
        !certSupabaseClient ||
        !participantId
    ) {

        return null;

    }


    try {

        const {
            data,
            error
        } =
            await certSupabaseClient.rpc(
                "get_participant_name",
                {
                    p_participant_id:
                        participantId
                }
            );


        if (error) {

            console.error(
                "参加者名取得RPCエラー:",
                error
            );

            return null;

        }


        if (
            data &&
            data.success === true &&
            typeof data.name === "string" &&
            data.name.trim() !== ""
        ) {

            return data.name.trim();

        }


        return null;


    }
    catch (error) {

        console.error(
            "参加者名同期エラー:",
            error
        );

        return null;

    }

}


// =====================================================
// 認定日の表示
//
// "2026-08-18" → "2026年8月18日"
// =====================================================

function formatCertificateDate(
    value
) {

    if (!value) {

        return "";

    }


    const parts =
        String(value).split("-");


    if (
        parts.length !==
        3
    ) {

        return String(value);

    }


    return (
        Number(parts[0])
        + "年"
        + Number(parts[1])
        + "月"
        + Number(parts[2])
        + "日"
    );

}


// =====================================================
// 認定証データ表示
// =====================================================

async function loadCertificateData() {


    // -------------------------------------------------
    // 利用者情報モジュール確認
    // -------------------------------------------------

    if (
        typeof window.IwaseIdentity ===
        "undefined"
    ) {

        console.error(
            "iwase-identity.js が読み込まれていません。"
        );

        alert(
            "認定証を表示できませんでした。"
        );

        history.back();

        return;

    }


    // -------------------------------------------------
    // 利用者情報を復元
    //
    // localStorage / Cookie / IndexedDB のうち
    // 残っているものから復元する。
    // -------------------------------------------------

    let data = null;


    try {

        data =
            await IwaseIdentity.load();

    }
    catch (error) {

        console.error(
            "利用者情報の復元エラー:",
            error
        );

    }


    if (!data) {

        alert(
            "データがありません。"
        );

        history.back();

        return;

    }


    // -------------------------------------------------
    // 参加回数の確認
    // -------------------------------------------------

    const stamps =
        Array.isArray(data.stamps)
            ? data.stamps
            : [];


    if (
        stamps.length <
        CERTIFICATE_COUNT
    ) {

        alert(
            "スタンプ" +
            CERTIFICATE_COUNT +
            "個以上で認定証を発行できます。"
        );

        history.back();

        return;

    }


    // -------------------------------------------------
    // 称号
    //
    // 10回以上でトップマイスター
    // -------------------------------------------------

    const rankName =
        stamps.length >=
        TOP_MEISTER_COUNT
            ? RANK_NAME_TOP
            : RANK_NAME_NORMAL;


    const rankElement =
        document.getElementById(
            "rank-title"
        );


    if (rankElement) {

        rankElement.textContent =
            rankName;

    }


    // -------------------------------------------------
    // 認定日
    //
    // 初回に認定証を発行した日を保存し、
    // 2回目以降は保存された日付を表示する。
    // （開くたびに認定日が変わらないようにするため）
    // -------------------------------------------------

    const today =
        new Date();


    let certificateDate =
        localStorage.getItem(
            "iwaseCertificateDate"
        );


    if (
        !certificateDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(
            certificateDate
        )
    ) {

        certificateDate =
            today.getFullYear()
            + "-"
            + String(
                today.getMonth() + 1
            ).padStart(2, "0")
            + "-"
            + String(
                today.getDate()
            ).padStart(2, "0");


        localStorage.setItem(
            "iwaseCertificateDate",
            certificateDate
        );

    }


    const dateElement =
        document.getElementById(
            "date"
        );


    if (dateElement) {

        dateElement.textContent =
            formatCertificateDate(
                certificateDate
            );

    }


    // -------------------------------------------------
    // 認定番号
    //
    // 認定日と同じ日付を使うため、
    // 認定日より後に組み立てる。
    // -------------------------------------------------

    let certificateNumber =
        localStorage.getItem(
            "iwaseCertificateNumber"
        );


    if (!certificateNumber) {

        certificateNumber =
            "IW-"
            + certificateDate.replace(
                /-/g,
                ""
            )
            + "-"
            + Math.floor(
                Math.random() * 9000
                + 1000
            );


        localStorage.setItem(
            "iwaseCertificateNumber",
            certificateNumber
        );

    }


    const numberElement =
        document.getElementById(
            "number"
        );


    if (numberElement) {

        numberElement.textContent =
            certificateNumber;

    }


    // -------------------------------------------------
    // 氏名
    //
    // 端末の氏名は本体で変更した直後は古いままなので、
    // Supabaseから最新の氏名を取得してから表示する。
    // -------------------------------------------------

    initializeCertificateSupabase();


    const latestName =
        await fetchLatestName(
            String(
                data.id ||
                ""
            ).trim()
        );


    let displayName =
        String(
            data.name ||
            ""
        ).trim();


    if (latestName) {

        displayName =
            latestName;


        if (
            latestName !==
            String(data.name || "").trim()
        ) {

            console.log(
                "参加者名をSupabaseから同期:",
                latestName
            );


            // 端末側の利用者情報も更新しておく
            data.name =
                latestName;


            try {

                await IwaseIdentity.save(
                    data
                );

            }
            catch (error) {

                console.error(
                    "利用者情報の保存エラー:",
                    error
                );

            }

        }

    }


    const nameElement =
        document.getElementById(
            "name"
        );


    if (nameElement) {

        nameElement.textContent =
            displayName;

    }

}


// =====================================================
// PDFボタン設定
// =====================================================

function setupPDFButton() {


    const button =
        document.getElementById(
            "pdf-button"
        );


    if (!button) {

        return;

    }


    button.addEventListener(
        "click",
        createCertificatePDF
    );

}


// =====================================================
// PDF生成
// =====================================================

async function createCertificatePDF() {


    const original =
        document.getElementById(
            "certificate"
        );


    const button =
        document.getElementById(
            "pdf-button"
        );


    if (!original) {

        alert(
            "認定証が見つかりません。"
        );

        return;

    }


    // -------------------------------------------------
    // ライブラリ確認
    // -------------------------------------------------

    if (
        typeof html2canvas ===
        "undefined"
    ) {

        alert(
            "PDF生成ライブラリを読み込めませんでした。"
        );

        return;

    }


    if (
        !window.jspdf ||
        !window.jspdf.jsPDF
    ) {

        alert(
            "PDFライブラリを読み込めませんでした。"
        );

        return;

    }


    // -------------------------------------------------
    // ボタン無効化
    // -------------------------------------------------

    if (button) {

        button.disabled = true;

        button.textContent =
            "PDFを作成しています…";

    }


    let clone = null;


    try {


        // =================================================
        // フォント読み込み
        // =================================================

        if (
            document.fonts &&
            document.fonts.ready
        ) {

            await document.fonts.ready;

        }


        // =================================================
        // 認定証を複製
        //
        // idは変えるが、certificate クラスは残す。
        // スタイルはクラス側で当てているため、
        // 複製にも画面と同じ配置が適用される。
        // =================================================

        clone =
            original.cloneNode(
                true
            );


        clone.id =
            "certificate-pdf";


        clone.classList.add(
            "certificate"
        );


        // =================================================
        // PDF専用クラス
        // =================================================

        clone.classList.add(
            "pdf-certificate"
        );


        // =================================================
        // 画面外に配置
        // =================================================

        clone.style.position =
            "fixed";

        clone.style.left =
            "-12000px";

        clone.style.top =
            "0";

        clone.style.display =
            "block";

        clone.style.visibility =
            "visible";

        clone.style.zIndex =
            "-1";


        // =================================================
        // PDF用サイズ
        //
        // A4横と同じ比率
        //
        // 1000 × 707
        // =================================================

        clone.style.width =
            "1000px";

        clone.style.height =
            "707px";

        clone.style.maxWidth =
            "none";

        clone.style.minWidth =
            "1000px";

        clone.style.minHeight =
            "707px";

        clone.style.boxSizing =
            "border-box";

        clone.style.margin =
            "0";

        clone.style.background =
            "#ffffff";

        clone.style.overflow =
            "hidden";


        // =================================================
        // bodyへ追加
        // =================================================

        document.body.appendChild(
            clone
        );


        // =================================================
        // レイアウト確定
        // =================================================

        await new Promise(
            function (resolve) {

                requestAnimationFrame(
                    function () {

                        requestAnimationFrame(
                            function () {

                                resolve();

                            }
                        );

                    }
                );

            }
        );


        // =================================================
        // 少し待つ
        // =================================================

        await new Promise(
            function (resolve) {

                setTimeout(
                    resolve,
                    300
                );

            }
        );


        // =================================================
        // Canvas生成
        // =================================================

        const canvas =
            await html2canvas(
                clone,
                {

                    scale: 2,

                    width: 1000,

                    height: 707,

                    windowWidth: 1000,

                    windowHeight: 707,

                    useCORS: true,

                    backgroundColor:
                        "#ffffff",

                    scrollX: 0,

                    scrollY: 0,

                    logging: false

                }
            );


        // =================================================
        // Canvas確認
        // =================================================

        if (
            !canvas ||
            canvas.width <= 0 ||
            canvas.height <= 0
        ) {

            throw new Error(
                "Canvasの生成に失敗しました。"
            );

        }


        // =================================================
        // PNG化
        // =================================================

        const imageData =
            canvas.toDataURL(
                "image/png"
            );


        if (
            !imageData ||
            imageData ===
            "data:,"
        ) {

            throw new Error(
                "画像データの生成に失敗しました。"
            );

        }


        // =================================================
        // jsPDF
        // =================================================

        const jsPDF =
            window.jspdf.jsPDF;


        const pdf =
            new jsPDF(
                {

                    orientation:
                        "landscape",

                    unit:
                        "mm",

                    format:
                        "a4",

                    compress:
                        true

                }
            );


        // =================================================
        // A4横
        // =================================================

        const pageWidth =
            297;

        const pageHeight =
            210;


        // =================================================
        // 画像比率を維持
        // =================================================

        const imageRatio =
            canvas.width /
            canvas.height;


        let width =
            pageWidth;


        let height =
            width /
            imageRatio;


        if (
            height >
            pageHeight
        ) {

            height =
                pageHeight;

            width =
                height *
                imageRatio;

        }


        // =================================================
        // 中央配置
        // =================================================

        const x =
            (
                pageWidth -
                width
            ) / 2;


        const y =
            (
                pageHeight -
                height
            ) / 2;


        // =================================================
        // PDFへ画像追加
        // =================================================

        pdf.addImage(

            imageData,

            "PNG",

            x,

            y,

            width,

            height,

            undefined,

            "FAST"

        );


        // =================================================
        // Blobとして取得
        // =================================================

        const pdfBlob =
            pdf.output(
                "blob"
            );


        if (
            !pdfBlob ||
            pdfBlob.size <= 0
        ) {

            throw new Error(
                "PDFデータの生成に失敗しました。"
            );

        }


        // =================================================
        // Blob URL作成
        // =================================================

        const pdfURL =
            URL.createObjectURL(
                pdfBlob
            );


        // =================================================
        // PDF表示
        // =================================================

        const newWindow =
            window.open(
                pdfURL,
                "_blank"
            );


        // =================================================
        // ポップアップブロック対策
        // =================================================

        if (!newWindow) {

            window.location.href =
                pdfURL;

        }


        // =================================================
        // 少し時間を置いてURLを解放
        // =================================================

        setTimeout(
            function () {

                URL.revokeObjectURL(
                    pdfURL
                );

            },
            60000
        );


    }
    catch (error) {


        console.error(
            "認定証PDFエラー:",
            error
        );


        alert(
            "認定証PDFの作成に失敗しました。\n\n"
            + "もう一度お試しください。"
        );


    }
    finally {


        // =================================================
        // 複製した認定証を削除
        // =================================================

        if (clone) {

            clone.remove();

        }


        // =================================================
        // ボタン復元
        // =================================================

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "認定証PDFを見る";

        }

    }

}

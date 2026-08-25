// ==================================================
// 岩瀬自治会 防災アプリ
// いわぽん防災マイスター スタンプカード
//
// 完成版
//
// ・iPhone / Android / PC / iPad 対応
// ・Supabase Authを一般利用者には使用しない
// ・スタンプカード専用Supabaseクライアント
// ・一般利用者の新規登録は本体loginでのみ実施
// ・本体からの正規アクセスのみスタンプカードを表示
// ・直接stamp.htmlを開いた場合はブロック
// ・訓練情報同期（参加した訓練は全件表示）
// ・QRコード表示
// ・スタンプ枠は10個
// ・5回参加で いわぽん防災マイスター 認定
// ・10回参加で いわぽんトップ防災マイスター 認定
// ・完全退会処理
//
// --------------------------------------------------
// 利用者情報の扱い
//
// 利用者情報は localStorage 単独ではなく、
// common/iwase-identity.js（IwaseIdentity）を通して
// localStorage / Cookie / IndexedDB の3か所で保持する。
//
// このファイルでは、退会が成功したとき以外は
// 利用者情報を削除しない。
// 削除すると過去の訓練履歴への手がかりを失うため。
//
// stamp.html に次の読み込みが必要:
//   <script src="../common/iwase-identity.js"></script>
// --------------------------------------------------
//
// 氏名の表示について
//
// 端末に保存された氏名は、本体で氏名を変更した直後は
// 古いままになっている。
// そのまま描画すると変更前の氏名が一瞬表示されるため、
// Supabaseからの氏名同期が終わるまで氏名欄は描画しない。
// 同期に失敗した場合のみ、端末の氏名を表示する。
// ==================================================

"use strict";


// ==================================================
// 設定
// ==================================================

const STORAGE_KEY = "iwaseStamp";

// スタンプ枠の数（表示上のマス目）
const MAX_STAMP = 10;

// いわぽん防災マイスター 認定に必要な参加回数
const CERTIFICATE_COUNT = 5;

// いわぽんトップ防災マイスター 認定に必要な参加回数
const TOP_MEISTER_COUNT = 10;


// ==================================================
// Supabase
// ==================================================

const STAMP_SUPABASE_URL =
    "https://zumbqukrojdpgfpfekjr.supabase.co";

const STAMP_SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_8YXsMHOxLr7MOTEYShUM3w_LsZvR3Qn";

let stampSupabaseClient = null;


// ==================================================
// 氏名同期の完了フラグ
//
// false の間は氏名欄を描画しない。
// ==================================================

let participantNameSynced = false;


// ==================================================
// 初期化
// ==================================================

window.addEventListener(
    "DOMContentLoaded",
    async function () {

        // ------------------------------------------
        // 利用者情報モジュール確認
        // ------------------------------------------

        if (
            typeof window.IwaseIdentity ===
            "undefined"
        ) {

            console.error(
                "iwase-identity.js が読み込まれていません。"
            );


            showStampAccessBlocked(
                "スタンプカードを表示できません。\n\n" +
                "しばらくしてから、防災アプリ本体を\n" +
                "開き直してください。"
            );

            return;

        }


        // ------------------------------------------
        // Supabase初期化
        // ------------------------------------------

        const initialized =
            initializeSupabase();


        if (!initialized) {

            showStampAccessBlocked(
                "サーバーに接続できません。\n\n" +
                "通信状態を確認してください。"
            );

            return;

        }


        // ------------------------------------------
        // 本体からの正規アクセス確認
        //
        // index.htmlからスタンプカードへ移動する際に
        //
        // sessionStorage:
        // iwaseStampAccess = "1"
        //
        // が設定される。
        //
        // stamp.htmlを直接URLで開いた場合は
        // この値が存在しないため即ブロックする。
        //
        // sessionStorageはリロードしても維持されるため、
        // スタンプカード表示後のページ更新でも
        // 利用者を追い出さない。
        // ------------------------------------------

        const stampAccess =
            sessionStorage.getItem(
                "iwaseStampAccess"
            );


        if (stampAccess !== "1") {

            showStampAccessBlocked(
                "このスタンプカードは、\n" +
                "防災アプリ本体からアクセスしてください。"
            );

            return;

        }


        // ------------------------------------------
        // 利用者情報を復元
        //
        // localStorage / Cookie / IndexedDB のうち
        // 残っているものから復元し、3か所へ書き戻す。
        // ------------------------------------------

        let userData = null;


        try {

            userData =
                await IwaseIdentity.load();

        }
        catch (error) {

            console.error(
                "利用者情報の復元エラー:",
                error
            );

        }


        // ------------------------------------------
        // カード表示
        // ------------------------------------------

        loadCard(
            userData
        );


        // ------------------------------------------
        // 登録ボタン・登録エリアを非表示
        //
        // 一般利用者の新規登録は
        // 本体login画面でのみ行う。
        // ------------------------------------------

        const registerButton =
            document.getElementById(
                "register-button"
            );


        if (registerButton) {

            registerButton.style.display =
                "none";

        }


        const registerArea =
            document.getElementById(
                "register-area"
            );


        if (registerArea) {

            registerArea.style.display =
                "none";

        }

    }
);


// ==================================================
// Supabase初期化
// ==================================================

function initializeSupabase() {

    try {

        if (
            typeof window.supabase ===
            "undefined"
        ) {

            console.error(
                "Supabase JSライブラリが読み込まれていません。"
            );

            stampSupabaseClient = null;

            return false;

        }


        stampSupabaseClient =
            window.supabase.createClient(
                STAMP_SUPABASE_URL,
                STAMP_SUPABASE_PUBLISHABLE_KEY,
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


        console.log(
            "Stamp Supabase client initialized."
        );


        return true;


    }
    catch (error) {

        console.error(
            "Supabase初期化エラー:",
            error
        );

        stampSupabaseClient = null;

        return false;

    }

}


// ==================================================
// 利用者登録
//
// 一般利用者の登録は本体のlogin画面で行う。
// スタンプカードからの新規登録は禁止。
//
// 利用者IDはSupabaseが発行するため、
// 端末側でIDを生成する処理は持たない。
// ==================================================

async function registerUser() {

    alert(
        "この画面から利用者登録はできません。\n\n" +
        "先に防災アプリ本体で利用者登録を行ってください。"
    );

    return;

}


// ==================================================
// カード表示準備
//
// 引数の利用者情報を使って表示する。
// 利用者情報が無い場合でも端末データは削除しない。
// ==================================================

function loadCard(
    userData
) {

    // ------------------------------------------
    // 利用者情報が存在しない
    //
    // 本体から正常に来た場合は
    // 原則としてここには到達しない。
    //
    // 端末データは消さず、本体での再開を案内する。
    // ------------------------------------------

    if (
        !userData ||
        !userData.id ||
        !userData.name
    ) {

        console.warn(
            "利用者情報を確認できませんでした。"
        );


        showStampAccessBlocked(
            "利用者情報を確認できませんでした。\n\n" +
            "防災アプリ本体に戻り、氏名と暗証番号を\n" +
            "入力してご利用を再開してください。"
        );

        return;

    }


    try {

        // ------------------------------------------
        // 参加した訓練は件数を制限せず全件保持する
        // ------------------------------------------

        const data = {

            id:
                String(userData.id).trim(),

            name:
                String(userData.name).trim(),

            stamps:
                Array.isArray(userData.stamps)
                    ? userData.stamps.slice()
                    : []

        };


        // ------------------------------------------
        // 3か所へ保存
        // ------------------------------------------

        IwaseIdentity.save(
            data
        );


        // ------------------------------------------
        // カード表示
        //
        // この時点では氏名同期が終わっていないため、
        // 氏名欄は空のまま描画される。
        // ------------------------------------------

        displayCard(
            data
        );


        // ------------------------------------------
        // Supabase同期
        //
        // 表示後にバックグラウンドで実行
        // ------------------------------------------

        syncWithSupabase();


    }
    catch (error) {

        console.error(
            "カードデータ読み込みエラー:",
            error
        );


        // ------------------------------------------
        // 端末データは削除しない
        // ------------------------------------------

        showStampAccessBlocked(
            "利用者情報を読み込めませんでした。\n\n" +
            "通信状態を確認して、防災アプリ本体から\n" +
            "開き直してください。"
        );

    }

}


// ==================================================
// Supabase同期
// ==================================================

async function syncWithSupabase() {

    if (!stampSupabaseClient) {

        // ------------------------------------------
        // 同期できないので端末の氏名を表示する
        // ------------------------------------------

        finishNameSync();

        return;

    }


    const userData =
        IwaseIdentity.read();


    if (
        !userData ||
        !userData.id
    ) {

        finishNameSync();

        return;

    }


    const participantId =
        String(
            userData.id
        ).trim();


    try {

        console.log(
            "Supabaseスタンプ同期開始:",
            participantId
        );


        const {
            data,
            error
        } =
            await stampSupabaseClient.rpc(
                "get_participant_stamps",
                {
                    p_participant_id:
                        participantId
                }
            );


        if (error) {

            console.error(
                "スタンプ取得RPCエラー:",
                error
            );

            throw error;

        }


        console.log(
            "スタンプ取得RPC結果:",
            data
        );


        if (!data) {

            throw new Error(
                "Supabaseからスタンプ情報を取得できませんでした。"
            );

        }


        if (
            data.success !== true
        ) {

            throw new Error(
                data.error ||
                "unknown_error"
            );

        }


        let stamps =
            Array.isArray(
                data.stamps
            )
                ? data.stamps
                : [];


        // ------------------------------------------
        // スタンプデータ整理
        // ------------------------------------------

        stamps =
            stamps
                .map(
                    stamp => {

                        if (!stamp) {

                            return null;

                        }


                        const trainingId =
                            String(
                                stamp.training_id ||
                                ""
                            ).trim();


                        if (!trainingId) {

                            return null;

                        }


                        return {

                            training_id:
                                trainingId,

                            date:
                                stamp.date ||
                                "",

                            event:
                                stamp.event ||
                                "防災訓練"

                        };

                    }
                )
                .filter(
                    stamp => !!stamp
                );


        // ------------------------------------------
        // training_id重複除去
        // ------------------------------------------

        const uniqueStamps =
            [];


        const usedTrainingIds =
            new Set();


        stamps.forEach(
            stamp => {

                if (
                    usedTrainingIds.has(
                        stamp.training_id
                    )
                ) {

                    return;

                }


                usedTrainingIds.add(
                    stamp.training_id
                );


                uniqueStamps.push(
                    stamp
                );

            }
        );


        // ------------------------------------------
        // 日付順（新しい順）
        // ------------------------------------------

        uniqueStamps.sort(
            (a, b) => {

                const dateA =
                    String(
                        a.date ||
                        ""
                    );


                const dateB =
                    String(
                        b.date ||
                        ""
                    );


                return dateB.localeCompare(
                    dateA
                );

            }
        );


        // ------------------------------------------
        // 参加した訓練は全件保持する
        //
        // 10回を超えて参加した分も残す。
        // スタンプ枠の表示だけが10個で止まる。
        // ------------------------------------------

        userData.stamps =
            uniqueStamps;


        // ==================================================
        // 最新の参加者名をSupabaseから取得
        //
        // 本体で氏名を変更した場合、端末に保存された氏名は
        // 古いままなので、ここで必ず上書きする。
        // ==================================================

        try {

            const {
                data: nameData,
                error: nameError
            } =
                await stampSupabaseClient.rpc(
                    "get_participant_name",
                    {
                        p_participant_id:
                            participantId
                    }
                );


            if (nameError) {

                console.error(
                    "参加者名取得RPCエラー:",
                    nameError
                );

            }
            else if (
                nameData &&
                nameData.success === true &&
                typeof nameData.name === "string" &&
                nameData.name.trim() !== ""
            ) {

                userData.name =
                    nameData.name.trim();


                console.log(
                    "参加者名をSupabaseから同期:",
                    userData.name
                );

            }

        }
        catch (nameSyncError) {

            console.error(
                "参加者名同期エラー:",
                nameSyncError
            );

        }


        // ------------------------------------------
        // 3か所へ保存
        // ------------------------------------------

        await IwaseIdentity.save(
            userData
        );


        // ------------------------------------------
        // 氏名同期完了
        // ------------------------------------------

        participantNameSynced =
            true;


        // ------------------------------------------
        // 再表示
        // ------------------------------------------

        displayCard(
            userData
        );


        console.log(
            "Supabase同期完了:",
            {
                participant_id:
                    participantId,

                stamp_count:
                    userData.stamps.length,

                stamps:
                    userData.stamps

            }
        );


    }
    catch (error) {

        console.error(
            "Supabase同期エラー:",
            error
        );


        // ------------------------------------------
        // 同期失敗時は端末の利用者情報を維持し、
        // 端末に残っている氏名を表示する。
        // ------------------------------------------

        finishNameSync();

    }

}


// ==================================================
// 氏名同期の打ち切り
//
// 通信できなかった場合など、Supabaseから最新の氏名を
// 取得できないときに、端末の氏名で表示を確定させる。
// ==================================================

function finishNameSync() {

    if (participantNameSynced) {

        return;

    }


    participantNameSynced =
        true;


    let userData = null;


    try {

        userData =
            IwaseIdentity.read();

    }
    catch (error) {

        console.error(
            "利用者情報の読み込みエラー:",
            error
        );

    }


    if (userData) {

        displayCard(
            userData
        );

    }

}


// ==================================================
// 参加した訓練一覧
//
// 参加した訓練はすべて表示する。
// ==================================================

function loadTrainingList() {

    const container =
        document.getElementById(
            "training-list"
        );


    if (!container) {

        return;

    }


    const userData =
        IwaseIdentity.read();


    const stamps =
        userData &&
        Array.isArray(userData.stamps)
            ? userData.stamps
            : [];


    if (
        stamps.length ===
        0
    ) {

        container.innerHTML =
            "<p>参加した訓練はありません。</p>";

        return;

    }


    container.innerHTML =
        "";


    stamps.forEach(
        (stamp, index) => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "training-item";


            const title =
                document.createElement(
                    "strong"
                );


            title.textContent =
                stamp.event ||
                "防災訓練";


            const date =
                document.createElement(
                    "div"
                );


            date.textContent =
                formatTrainingDate(
                    stamp.date
                );


            item.appendChild(
                title
            );


            item.appendChild(
                date
            );


            container.appendChild(
                item
            );

        }
    );


    // ------------------------------------------
    // 参加回数の合計
    // ------------------------------------------

    const total =
        document.createElement(
            "p"
        );


    total.className =
        "training-total";


    total.textContent =
        "参加回数 : 全 " +
        stamps.length +
        " 回";


    container.appendChild(
        total
    );

}


// ==================================================
// 日付表示
// ==================================================

function formatTrainingDate(
    date
) {

    if (!date) {

        return "";

    }


    const value =
        String(date);


    const parts =
        value.split("-");


    if (
        parts.length ===
        3
    ) {

        return (
            parts[0] +
            "年" +
            Number(parts[1]) +
            "月" +
            Number(parts[2]) +
            "日"
        );

    }


    return value;

}


// ==================================================
// スタンプカード表示
// ==================================================

function displayCard(
    data
) {

    if (!data) {

        return;

    }


    if (
        !Array.isArray(
            data.stamps
        )
    ) {

        data.stamps = [];

    }


    // ------------------------------------------
    // 参加回数
    //
    // stampCount : 実際の参加回数（上限なし）
    // filled     : スタンプ枠の点灯数（最大10）
    // ------------------------------------------

    const stampTotalCount =
        data.stamps.length;


    const filledCount =
        Math.min(
            stampTotalCount,
            MAX_STAMP
        );


    // ------------------------------------------
    // 登録エリア
    // ------------------------------------------

    const registerArea =
        document.getElementById(
            "register-area"
        );


    const cardArea =
        document.getElementById(
            "card-area"
        );


    if (registerArea) {

        registerArea.style.display =
            "none";

    }


    if (cardArea) {

        cardArea.style.display =
            "block";

    }


    // ------------------------------------------
    // 氏名
    //
    // Supabaseからの氏名同期が終わるまで表示しない。
    // 変更前の氏名が一瞬表示されるのを防ぐため。
    // ------------------------------------------

    const userName =
        document.getElementById(
            "user-name"
        );


    if (userName) {

        if (
            participantNameSynced &&
            data.name
        ) {

            userName.textContent =
                data.name +
                " さん";

        }
        else {

            // 表示位置がずれないよう高さだけ確保
            userName.textContent =
                "\u00A0";

        }

    }


    // ------------------------------------------
    // QRコード
    //
    // 中身は利用者ID。
    // 機種変更時の復元にも使えるため、
    // 画面の控えとして案内している。
    // ------------------------------------------

    const qrArea =
        document.getElementById(
            "qrcode"
        );


    if (qrArea) {

        qrArea.innerHTML =
            "";


        if (
            typeof QRCode !==
            "undefined"
        ) {

            try {

                new QRCode(
                    qrArea,
                    {
                        text:
                            data.id,

                        width:
                            180,

                        height:
                            180
                    }
                );

            }
            catch (error) {

                console.error(
                    "QRコード生成エラー:",
                    error
                );


                qrArea.textContent =
                    "QRコードを表示できませんでした。";

            }

        }
        else {

            qrArea.textContent =
                "QRコードを読み込めませんでした。";

        }

    }


    // ------------------------------------------
    // ID
    // ------------------------------------------

    const userId =
        document.getElementById(
            "user-id"
        );


    if (userId) {

        userId.textContent =
            "ID : " +
            data.id;

    }


    // ------------------------------------------
    // スタンプ
    // ------------------------------------------

    const icons =
        document.getElementById(
            "stamp-icons"
        );


    if (icons) {

        icons.innerHTML =
            "";


        for (
            let i = 0;
            i < MAX_STAMP;
            i++
        ) {

            const span =
                document.createElement(
                    "span"
                );


            span.textContent =
                i <
                filledCount
                    ? "⭐"
                    : "☆";


            icons.appendChild(
                span
            );

        }

    }


    // ------------------------------------------
    // スタンプ数
    // ------------------------------------------

    const stampCount =
        document.getElementById(
            "stamp-count"
        );


    if (stampCount) {

        stampCount.textContent =
            stampTotalCount;

    }


    const stampTotal =
        document.getElementById(
            "stamp-total"
        );


    if (stampTotal) {

        stampTotal.textContent =
            stampTotalCount >=
            MAX_STAMP
                ? "個（10個達成）"
                : "/10個";

    }


    // ------------------------------------------
    // 認定判定
    //
    //  5回以上 : いわぽん防災マイスター
    // 10回以上 : いわぽんトップ防災マイスター
    // ------------------------------------------

    const message =
        document.getElementById(
            "message"
        );


    const certificateArea =
        document.getElementById(
            "certificate-area"
        );


    if (
        stampTotalCount >=
        TOP_MEISTER_COUNT
    ) {

        if (message) {

            message.textContent =
                "🏆 いわぽんトップ防災マイスター認定！";

        }


        if (certificateArea) {

            certificateArea.style.display =
                "block";

        }

    }
    else if (
        stampTotalCount >=
        CERTIFICATE_COUNT
    ) {

        const toTop =
            TOP_MEISTER_COUNT -
            stampTotalCount;


        if (message) {

            message.textContent =
                "🎉 いわぽん防災マイスター認定！\n" +
                "トップマイスターまであと " +
                toTop +
                " 個です";

        }


        if (certificateArea) {

            certificateArea.style.display =
                "block";

        }

    }
    else {

        const remaining =
            CERTIFICATE_COUNT -
            stampTotalCount;


        if (message) {

            message.textContent =
                "認定まであと " +
                remaining +
                " 個です";

        }


        if (certificateArea) {

            certificateArea.style.display =
                "none";

        }

    }


    // ------------------------------------------
    // 訓練一覧
    // ------------------------------------------

    loadTrainingList();

}


// ==================================================
// 完全退会
//
// Supabase RPC
//   ↓
// participations削除
//   ↓
// participants削除
//   ↓
// 端末データ削除
//   （localStorage / Cookie / IndexedDB の3か所）
//
// 端末データを消すのはこの処理だけ。
// ==================================================

async function clearData() {

    const result =
        confirm(
            "スタンプカードを完全に削除しますか？\n\n" +
            "この操作を行うと、この端末の情報だけでなく、\n" +
            "データベースに保存されている参加者情報と\n" +
            "参加履歴も削除します。\n\n" +
            "削除後は元に戻せません。"
        );


    if (!result) {

        return;

    }


    if (!stampSupabaseClient) {

        alert(
            "サーバーに接続できないため、退会処理を実行できません。\n\n" +
            "通信状態を確認して、もう一度お試しください。"
        );

        return;

    }


    const userData =
        IwaseIdentity.read();


    // ------------------------------------------
    // 端末に利用者情報が無い
    //
    // 消すものが無いのでログイン画面へ戻す。
    // ------------------------------------------

    if (!userData) {

        await IwaseIdentity.clear();


        localStorage.removeItem(
            "iwaseLogin"
        );


        localStorage.removeItem(
            "role"
        );


        // ------------------------------------------
        // 認定証情報
        // ------------------------------------------

        localStorage.removeItem(
            "iwaseCertificateNumber"
        );


        localStorage.removeItem(
            "iwaseCertificateDate"
        );


        sessionStorage.removeItem(
            "iwaseStampAccess"
        );


        location.href =
            "../login/login.html";


        return;

    }


    const participantId =
        String(
            userData.id ||
            ""
        ).trim();


    const participantName =
        String(
            userData.name ||
            ""
        ).trim();


    if (!participantId) {

        alert(
            "利用者IDを確認できませんでした。\n\n" +
            "安全のため、退会処理を中止しました。"
        );


        return;

    }


    if (!participantName) {

        alert(
            "利用者名を確認できませんでした。\n\n" +
            "安全のため、退会処理を中止しました。"
        );


        return;

    }


    try {

        // ------------------------------------------
        // Supabase完全退会RPC
        // ------------------------------------------

        const {
            data,
            error
        } =
            await stampSupabaseClient.rpc(
                "delete_my_participant",
                {
                    p_participant_id:
                        participantId,

                    p_name:
                        participantName
                }
            );


        if (error) {

            console.error(
                "完全退会RPCエラー:",
                error
            );


            throw new Error(
                error.message ||
                "Supabaseの退会処理に失敗しました。"
            );

        }


        console.log(
            "完全退会RPC結果:",
            data
        );


        // ------------------------------------------
        // RPC成功確認
        // ------------------------------------------

        if (
            !data ||
            data.success !== true
        ) {

            const rpcError =
                data?.error ||
                "unknown_error";


            if (
                rpcError ===
                "participant_not_found"
            ) {

                throw new Error(
                    "Supabase上に一致する利用者情報がありません。\n\n" +
                    "すでに退会済みの可能性があります。"
                );

            }


            throw new Error(
                "Supabaseの退会処理が完了しませんでした。\n\n" +
                rpcError
            );

        }


        // ------------------------------------------
        // Supabase削除成功
        //
        // ここで初めて端末データを削除する。
        // localStorage / Cookie / IndexedDB の3か所。
        // ------------------------------------------

        await IwaseIdentity.clear();


        localStorage.removeItem(
            "iwaseLogin"
        );


        localStorage.removeItem(
            "role"
        );


        // ------------------------------------------
        // 認定証情報
        // ------------------------------------------

        localStorage.removeItem(
            "iwaseCertificateNumber"
        );


        localStorage.removeItem(
            "iwaseCertificateDate"
        );


        // ------------------------------------------
        // 本体→スタンプカード入口フラグも削除
        // ------------------------------------------

        sessionStorage.removeItem(
            "iwaseStampAccess"
        );


        // ------------------------------------------
        // 完了
        // ------------------------------------------

        alert(
            "退会処理が完了しました。\n\n" +
            "参加者情報・参加履歴・端末内データを削除しました。"
        );


        location.href =
            "../login/login.html";

    }
    catch (error) {

        console.error(
            "完全退会エラー:",
            error
        );


        // ------------------------------------------
        // Supabase削除失敗時
        //
        // 端末データは削除しない
        // ------------------------------------------

        alert(
            "退会処理を完了できませんでした。\n\n" +
            (
                error?.message ||
                "Supabaseの削除処理に失敗しました。"
            ) +
            "\n\n" +
            "端末内のデータは削除していません。"
        );

    }

}


// ==================================================
// スタンプカード利用不可表示
// ==================================================

function showStampAccessBlocked(
    message
) {

    const registerArea =
        document.getElementById(
            "register-area"
        );


    const cardArea =
        document.getElementById(
            "card-area"
        );


    const deleteArea =
        document.getElementById(
            "delete-area"
        );


    if (registerArea) {

        registerArea.style.display =
            "none";

    }


    if (cardArea) {

        cardArea.style.display =
            "none";

    }


    if (deleteArea) {

        deleteArea.style.display =
            "none";

    }


    // ------------------------------------------
    // 既存ブロックメッセージ
    // ------------------------------------------

    let blocked =
        document.getElementById(
            "stamp-access-blocked"
        );


    if (!blocked) {

        blocked =
            document.createElement(
                "section"
            );


        blocked.id =
            "stamp-access-blocked";


        blocked.style.marginTop =
            "30px";


        blocked.style.padding =
            "20px";


        blocked.style.border =
            "1px solid #ccc";


        blocked.style.borderRadius =
            "10px";


        blocked.style.background =
            "#f8f8f8";


        blocked.style.whiteSpace =
            "pre-line";


        const container =
            document.querySelector(
                ".stamp-container"
            );


        if (container) {

            container.appendChild(
                blocked
            );

        }

    }


    blocked.textContent =
        message;

}


// ==================================================
// グローバル公開
//
// HTMLのonclickから呼び出している場合に対応
// ==================================================

window.clearData =
    clearData;


window.registerUser =
    registerUser;


window.loadCard =
    loadCard;


window.loadTrainingList =
    loadTrainingList;


window.syncWithSupabase =
    syncWithSupabase;

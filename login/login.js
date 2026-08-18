// ==================================================
// 岩瀬自治会 防災アプリ
// 利用者登録 ／ 再ログイン
//
// 変更点
//
//   ・利用者IDを端末で生成しない
//     → Supabase の register_or_login_participant が発行する
//
//   ・氏名＋暗証番号が一致すれば既存IDを返すため、
//     ブラウザを変えても端末データが消えても
//     同じ利用者として復帰できる
//
//   ・participants への直接INSERTを廃止
//
//   ・照合できない場合でも端末の利用者情報は消さない
// ==================================================

"use strict";


// ==================================================
// 画面読み込み
// ==================================================

window.addEventListener(
    "load",
    checkLogin
);


// ==================================================
// 既存利用者の確認
//
// 端末に利用者情報が残っていれば、そのままアプリへ。
// 残っていない、または照合できない場合はこの画面に留まる。
// ==================================================

async function checkLogin() {

    try {

        const userData =
            await IwaseIdentity.load();


        /*
         * 端末に利用者情報がない
         * → 登録／再ログイン画面のまま
         */

        if (!userData) {
            return;
        }


        /*
         * Supabaseに存在するか確認
         *
         * 通信エラーでは利用者情報を消さない。
         */

        const {
            data,
            error
        } =
        await supabaseClient.rpc(
            "check_participant_exists",
            {
                p_participant_id:
                    userData.id
            }
        );


        if (error) {

            console.warn(
                "利用者確認RPCエラー。既存情報のままアプリを起動します。",
                error
            );

            location.href =
                "../index.html";

            return;

        }


        if (data === true) {

            console.log(
                "登録済み利用者を確認しました:",
                userData.id
            );

            location.href =
                "../index.html";

            return;

        }


        /*
         * Supabaseに存在しない
         *
         * 旧実装ではここで端末データを削除していたが、
         * 削除すると復旧手段が無くなるため残す。
         * 氏名＋暗証番号で再ログインしてもらう。
         */

        console.warn(
            "Supabase上に利用者が見つかりません:",
            userData.id
        );

        showNotice(
            "この端末の利用者情報が、データベースと一致しませんでした。\n\n" +
            "お手数ですが、氏名と暗証番号を入力してご利用を再開してください。"
        );

        const nameInput =
            document.getElementById("username");

        if (nameInput && !nameInput.value) {
            nameInput.value = userData.name;
        }

    }
    catch (error) {

        console.error(
            "利用者確認エラー:",
            error
        );

        /*
         * 予期しないエラーでも利用者情報は消さない
         */

        const fallback =
            IwaseIdentity.read();

        if (fallback) {

            location.href =
                "../index.html";

        }

    }

}


// ==================================================
// 登録 ／ 再ログイン
// ==================================================

async function login(forceNew) {

    const codeInput =
        document.getElementById("access-code");

    const nameInput =
        document.getElementById("username");

    const pinInput =
        document.getElementById("pin-code");

    const button =
        document.getElementById("login-button");

    const forceNewArea =
        document.getElementById("force-new-area");


    const code =
        codeInput.value.trim();

    const name =
        nameInput.value.trim();

    const pin =
        pinInput.value.trim();


    clearMessage();

    if (forceNewArea) {
        forceNewArea.style.display = "none";
    }


    // ----------------------------------------------
    // 入力チェック
    // ----------------------------------------------

    if (!code) {

        showNotice("自治会コードを入力してください。");

        codeInput.focus();

        return;

    }


    if (!name) {

        showNotice("氏名を入力してください。");

        nameInput.focus();

        return;

    }


    if (name.length > 100) {

        showNotice("氏名が長すぎます。");

        nameInput.focus();

        return;

    }


    if (!/^[0-9]{4}$/.test(pin)) {

        showNotice("暗証番号は数字4桁で入力してください。");

        pinInput.focus();

        return;

    }


    try {

        button.disabled = true;

        button.textContent = "確認中...";


        // ----------------------------------------------
        // 登録／再ログイン RPC
        //
        // 既存の利用者であれば既存IDが返るため、
        // 重複したアカウントは作られない。
        // ----------------------------------------------

        const {
            data,
            error
        } =
        await supabaseClient.rpc(
            "register_or_login_participant",
            {
                p_code:      code,
                p_name:      name,
                p_pin:       pin,
                p_force_new: forceNew === true
            }
        );


        if (error) {

            console.error("登録RPCエラー:", error);

            throw new Error(
                "サーバーとの通信に失敗しました。"
            );

        }


        if (!data) {

            throw new Error(
                "サーバーから応答がありませんでした。"
            );

        }


        // ----------------------------------------------
        // 失敗
        // ----------------------------------------------

        if (data.success !== true) {

            handleLoginError(data);

            button.disabled = false;

            button.textContent = "登録して開始";

            return;

        }


        // ----------------------------------------------
        // 成功
        // ----------------------------------------------

        button.textContent = "準備中...";


        const existing =
            IwaseIdentity.read();


        /*
         * 同じ利用者であればスタンプ履歴を引き継ぐ。
         * 別の利用者なら空で始める。
         */

        const stamps =
            existing && existing.id === data.participant_id
                ? existing.stamps
                : [];


        const saved =
            await IwaseIdentity.save({
                id:     data.participant_id,
                name:   data.name,
                stamps: stamps
            });


        if (!saved) {

            throw new Error(
                "端末への利用者情報の保存を確認できませんでした。"
            );

        }


        if (data.mode === "login") {

            console.log(
                "既存利用者として再開:",
                data.participant_id
            );

        }
        else if (data.mode === "claim") {

            console.log(
                "既存の登録に暗証番号を設定:",
                data.participant_id
            );

        }
        else {

            console.log(
                "新規登録:",
                data.participant_id
            );

        }


        location.href =
            "../index.html";


    }
    catch (error) {

        console.error("利用登録エラー:", error);

        showNotice(
            (error && error.message
                ? error.message
                : "利用登録に失敗しました。") +
            "\n\n通信状態を確認して、もう一度お試しください。"
        );

        button.disabled = false;

        button.textContent = "登録して開始";

    }

}


// ==================================================
// RPCが返したエラーの表示
// ==================================================

function handleLoginError(data) {

    const forceNewArea =
        document.getElementById("force-new-area");


    switch (data.error) {

        case "invalid_code":

            showNotice(
                "自治会コードが正しくありません。"
            );

            break;


        case "invalid_name":

            showNotice(
                "氏名を正しく入力してください。"
            );

            break;


        case "invalid_pin":

            showNotice(
                "暗証番号は数字4桁で入力してください。"
            );

            break;


        case "pin_mismatch":

            showNotice(
                "氏名は登録されていますが、暗証番号が一致しません。"
            );

            if (forceNewArea) {
                forceNewArea.style.display = "block";
            }

            break;


        case "pin_duplicate":

            showNotice(
                "同じ氏名・同じ暗証番号がすでに使われています。\n\n" +
                "別の暗証番号を設定してください。"
            );

            break;


        case "locked":

            showNotice(
                "暗証番号の入力を続けて誤ったため、しばらく登録できません。\n\n" +
                "15分ほど時間をおいてからお試しください。"
            );

            break;


        default:

            showNotice(
                "登録処理を完了できませんでした。\n\n" +
                "しばらくしてからもう一度お試しください。"
            );

    }

}


// ==================================================
// 同姓同名の別人として登録
// ==================================================

async function registerAsNewPerson() {

    const result =
        confirm(
            "同姓同名の別の方として、新しく登録します。\n\n" +
            "ご自身の過去の訓練記録は引き継がれません。\n" +
            "よろしいですか？"
        );

    if (!result) {
        return;
    }

    await login(true);

}


// ==================================================
// 利用者IDでの復元
// ==================================================

async function restoreById() {

    const input =
        document.getElementById("restore-id");

    const button =
        document.getElementById("restore-button");

    const message =
        document.getElementById("restore-message");


    const participantId =
        input.value.trim();


    message.textContent = "";


    if (!participantId) {

        message.textContent =
            "利用者IDを入力してください。";

        input.focus();

        return;

    }


    try {

        button.disabled = true;

        button.textContent = "確認中...";


        const {
            data,
            error
        } =
        await supabaseClient.rpc(
            "restore_participant",
            {
                p_participant_id: participantId
            }
        );


        if (error) {

            console.error("復元RPCエラー:", error);

            throw new Error(
                "サーバーとの通信に失敗しました。"
            );

        }


        if (!data || data.success !== true) {

            message.textContent =
                "この利用者IDは登録されていません。\n" +
                "IDを確認してください。";

            button.disabled = false;

            button.textContent = "利用者IDで再開する";

            return;

        }


        await IwaseIdentity.save({
            id:     data.participant_id,
            name:   data.name,
            stamps: []
        });


        location.href =
            "../index.html";


    }
    catch (error) {

        console.error("復元エラー:", error);

        message.textContent =
            (error && error.message
                ? error.message
                : "復元に失敗しました。") +
            "\n通信状態を確認して、もう一度お試しください。";

        button.disabled = false;

        button.textContent = "利用者IDで再開する";

    }

}


// ==================================================
// メッセージ表示
// ==================================================

function showNotice(text) {

    const element =
        document.getElementById("error-message");

    if (element) {
        element.textContent = text;
    }

}


function clearMessage() {

    showNotice("");

}


// ==================================================
// グローバル公開
// ==================================================

window.login = login;

window.registerAsNewPerson = registerAsNewPerson;

window.restoreById = restoreById;

/*
================================

岩瀬自治会 防災アプリ
ログイン処理

================================
*/


// 正しい地域コード
const COMMUNITY_CODE = "IWASE2026";




// ログイン処理

function login(){


    // 入力されたコード取得

    const inputCode = 
    document.getElementById("communityCode").value.trim();



    // 選択された利用区分取得

    const role =
    document.querySelector(
        'input[name="role"]:checked'
    ).value;



    const message =
    document.getElementById("message");



    // コード確認

    if(inputCode !== COMMUNITY_CODE){


        message.textContent =
        "地域コードが違います。";


        return;


    }



    // ログイン情報保存

    localStorage.setItem(
        "community",
        COMMUNITY_CODE
    );



    localStorage.setItem(
        "role",
        role
    );



    // ログイン日時保存

    localStorage.setItem(
        "loginTime",
        new Date().toISOString()
    );



    // トップページへ移動

    location.href="../index.html";


}

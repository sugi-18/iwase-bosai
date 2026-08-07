/*
================================

岩瀬自治会 防災アプリ
ログイン処理

================================
*/


// 岩瀬自治会用コード

const COMMUNITY_CODE = "IWASE2026";




// ログイン処理

function login(){



    const inputCode =
    document
    .getElementById("communityCode")
    .value
    .trim();



    const role =
    document
    .querySelector(
        'input[name="role"]:checked'
    )
    .value;



    const message =
    document.getElementById("message");




    // 地域コード確認

    if(inputCode !== COMMUNITY_CODE){


        message.textContent =
        "地域コードが違います。";


        return;


    }



    // 情報保存

    localStorage.setItem(
        "community",
        COMMUNITY_CODE
    );



    localStorage.setItem(
        "role",
        role
    );



    localStorage.setItem(
        "loginTime",
        new Date().toISOString()
    );




    // トップページへ移動

    location.href="../index.html";



}

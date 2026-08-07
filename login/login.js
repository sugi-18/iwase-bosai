// =====================================
// 岩瀬自治会 防災アプリ
// ログイン処理
// =====================================


// 共通パスワード
// 公開前に変更してください

const APP_PASSWORD = "iwasebosai";


// ログイン有効時間
// 24時間

const LOGIN_LIMIT = 24 * 60 * 60 * 1000;



// =====================================
// ページ読み込み時
// =====================================

window.onload = function(){

    checkLogin();

};




// =====================================
// 既にログイン済みか確認
// =====================================

function checkLogin(){


    const loginData =
    localStorage.getItem("iwaseLogin");


    if(!loginData){

        return;

    }



    const data =
    JSON.parse(loginData);



    const now =
    new Date().getTime();



    // 24時間以内ならトップページへ

    if(
        data.login === true &&
        now - data.time < LOGIN_LIMIT
    ){

        location.href = "../index.html";

    }


    else{


        // 期限切れ

        localStorage.removeItem("iwaseLogin");

    }


}




// =====================================
// ログイン実行
// =====================================

function login(){


    const password =
    document.getElementById("password").value;



    const error =
    document.getElementById("error-message");



    if(password === ""){


        error.textContent =
        "パスワードを入力してください。";


        return;

    }



    // パスワード確認

    if(password === APP_PASSWORD){



        const loginData = {


            login:true,


            time:
            new Date().getTime()


        };



        localStorage.setItem(

            "iwaseLogin",

            JSON.stringify(loginData)

        );



        // トップページへ移動

        location.href =
        "../index.html";



    }


    else{


        error.textContent =
        "パスワードが違います。";


    }


}

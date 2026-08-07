const MAX_STAMP = 10;


// 初期表示
window.onload = function(){
    loadData();
    loadQRData();
};


// ユーザー登録
function registerUser(){

    let name =
    document.getElementById("username").value;

    if(name===""){
        alert("氏名を入力してください");
        return;
    }


    let data = {
        name:name,
        stamps:[],
        history:[]
    };


    localStorage.setItem(
        "iwaseStamp",
        JSON.stringify(data)
    );


    loadData();
}



// データ表示
function loadData(){

    let data =
    JSON.parse(
        localStorage.getItem("iwaseStamp")
    );


    if(!data){

        let area =
        document.getElementById("register-area");

        if(area){
            area.style.display="block";
        }

        return;
    }


    document.getElementById("register-area")
    .style.display="none";


    document.getElementById("card-area")
    .style.display="block";


    document.getElementById("display-name")
    .innerHTML=data.name;


    document.getElementById("count")
    .innerHTML=data.stamps.length;



    showStamps(data.stamps.length);

    showHistory(data.history);



    let message =
    document.getElementById("message");


    if(data.stamps.length>=10){

        message.innerHTML =
        "🏆 スタンプ10個達成！<br>防災マスター認定です！";

        document.getElementById("certificate")
        .style.display="block";

    }

    else if(data.stamps.length>=5){

        message.innerHTML =
        "🎉 いわぽん防災マイスター認定対象です！";

    }

    else{

        message.innerHTML =
        "防災訓練に参加してスタンプを集めよう！";

    }

}



// スタンプ表示
function showStamps(count){

    let area =
    document.getElementById("stamps");

    area.innerHTML="";


    for(let i=1;i<=MAX_STAMP;i++){

        let div =
        document.createElement("div");


        div.className="stamp";


        if(i<=count){

            div.classList.add("active");
            div.innerHTML="★";

        }else{

            div.innerHTML="☆";

        }


        area.appendChild(div);

    }

}



// スタンプ追加
function addStamp(){

    let data =
    JSON.parse(
        localStorage.getItem("iwaseStamp")
    );


    if(!data){

        alert("先に利用者登録してください");
        return;

    }


    if(data.stamps.length>=MAX_STAMP){

        alert("最大10個までです");
        return;

    }



    let date =
    document.getElementById("training-date").value;


    let name =
    document.getElementById("training-name").value;


    let detail =
    document.getElementById("training-detail").value;



    if(!date || !name){

        alert("日付と訓練名を入力してください");
        return;

    }



    // 重複チェック

    let exists =
    data.history.some(
        item =>
        item.date===date &&
        item.name===name
    );


    if(exists){

        alert("この訓練は登録済みです");
        return;

    }



    let record={

        date:date,
        name:name

    };


    data.stamps.push(record);



    data.history.push({

        date:date,
        name:name,
        detail:detail

    });



    localStorage.setItem(

        "iwaseStamp",

        JSON.stringify(data)

    );



    loadData();

}




// 履歴表示

function showHistory(history){

    let area =
    document.getElementById("history");


    area.innerHTML="";


    history
    .slice()
    .reverse()
    .forEach(item=>{


        let div =
        document.createElement("div");


        div.className="history-item";


        div.innerHTML =

        `<strong>${item.date}</strong><br>
        ${item.name}<br>
        ${item.detail || ""}`;


        area.appendChild(div);


    });

}



// QR情報取得

function loadQRData(){

    let qr =
    JSON.parse(
        localStorage.getItem("qrTraining")
    );


    if(!qr){
        return;
    }



    document.getElementById(
        "training-date"
    ).value = qr.date || "";



    document.getElementById(
        "training-name"
    ).value = qr.name || "";



    document.getElementById(
        "training-detail"
    ).value = qr.detail || "";



    localStorage.removeItem(
        "qrTraining"
    );

}



// 認定証表示

function createCertificate(){

    let data =
    JSON.parse(
        localStorage.getItem("iwaseStamp")
    );


    if(!data || data.stamps.length < MAX_STAMP){

        alert("10個達成後に発行できます");
        return;

    }


    document.getElementById(
        "certificate-name"
    ).innerHTML=data.name;


    document.getElementById(
        "certificate"
    ).style.display="block";

}



// リセット

function resetData(){

    if(confirm("データを削除しますか？")){

        localStorage.removeItem(
            "iwaseStamp"
        );

        location.reload();

    }

}

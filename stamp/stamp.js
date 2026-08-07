```javascript
const MAX_STAMP = 10;


// 初期読み込み

window.onload = function(){

    loadData();

    loadQRData();

};




// 登録

function registerUser(){

    const name =
    document.getElementById("username").value.trim();


    if(name === ""){

        alert("氏名を入力してください");

        return;

    }


    const data = {

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


    const data =

    JSON.parse(

        localStorage.getItem("iwaseStamp")

    );



    if(!data){

        document.getElementById("register-area")
        .style.display="block";

        document.getElementById("card-area")
        .style.display="none";

        return;

    }



    document.getElementById("register-area")
    .style.display="none";


    document.getElementById("card-area")
    .style.display="block";



    document.getElementById("display-name")
    .textContent=data.name;


    document.getElementById("count")
    .textContent=data.stamps.length;



    showStamps(data.stamps.length);


    showHistory(data.history);



    const message =
    document.getElementById("message");



    if(data.stamps.length >= 5){

        message.innerHTML =
        "🏆 5個達成！<br>いわぽん防災マイスター認定対象です";

    }else{

        message.innerHTML =
        "防災訓練に参加してスタンプを集めよう！";

    }

}




// スタンプ表示

function showStamps(count){


    const area =
    document.getElementById("stamps");


    area.innerHTML="";



    for(let i=1;i<=MAX_STAMP;i++){


        const div =
        document.createElement("div");


        div.className="stamp";


        if(i<=count){

            div.className="stamp active";

            div.textContent="★";

        }else{

            div.textContent="☆";

        }


        area.appendChild(div);


    }


}





// スタンプ追加

function addStamp(){


    const data =

    JSON.parse(

        localStorage.getItem("iwaseStamp")

    );



    if(!data){

        alert("先に登録してください");

        return;

    }



    if(data.stamps.length >= MAX_STAMP){

        alert("スタンプは10個までです");

        return;

    }



    const date =
    document.getElementById("training-date").value;


    const name =
    document.getElementById("training-name").value.trim();


    const detail =
    document.getElementById("training-detail").value.trim();



    if(!date || !name){

        alert("日付と訓練名を入力してください");

        return;

    }



    const exists =

    data.history.some(item =>

        item.date === date &&
        item.name === name

    );



    if(exists){

        alert("登録済みの訓練です");

        return;

    }



    data.stamps.push({

        date:date,

        name:name

    });



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


    const area =
    document.getElementById("history");


    area.innerHTML="";



    history.slice().reverse().forEach(item=>{


        const div =
        document.createElement("div");


        div.className="history-item";


        div.innerHTML =

        `<strong>${item.date}</strong><br>
        ${item.name}<br>
        ${item.detail || ""}`;


        area.appendChild(div);


    });


}





// QR読み込み

function loadQRData(){


    const qr =

    JSON.parse(

        localStorage.getItem("qrTraining")

    );


    if(!qr){

        return;

    }



    document.getElementById("training-date")
    .value = qr.date || "";


    document.getElementById("training-name")
    .value = qr.name || "";


    document.getElementById("training-detail")
    .value = qr.detail || "";



    localStorage.removeItem("qrTraining");


}





// 認定証

function createCertificate(){


    const data =

    JSON.parse(

        localStorage.getItem("iwaseStamp")

    );



    if(!data || data.stamps.length < 5){

        alert(
        "スタンプ5個以上で認定証を発行できます"
        );

        return;

    }



    location.href="certificate.html";


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
```

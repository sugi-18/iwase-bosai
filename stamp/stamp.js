```javascript
// =================================
// いわぽん防災マイスター
// スタンプカード
// STEP7
// 履歴修正・削除対応
// =================================


const STORAGE_KEY = "iwaseStamp";

const MAX_STAMP = 10;

const CERTIFICATE_COUNT = 5;


let editIndex = null;



// ===============================
// 初期読み込み
// ===============================

window.onload = function(){


    document
    .getElementById("register-button")
    .addEventListener(
        "click",
        registerUser
    );


    document
    .getElementById("add-button")
    .addEventListener(
        "click",
        addStamp
    );


    loadCard();

};



// ===============================
// 利用者登録
// ===============================

function registerUser(){


    const name =
    document
    .getElementById("username")
    .value
    .trim();


    if(name === ""){

        alert("氏名を入力してください");

        return;

    }



    const data = {

        id:
        "IWASE-" + Date.now(),

        name:name,

        stamps:[]

    };



    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
    );



    displayCard(data);

}



// ===============================
// 読み込み
// ===============================

function loadCard(){


    const saved =
    localStorage.getItem(
        STORAGE_KEY
    );


    if(saved){

        displayCard(
            JSON.parse(saved)
        );

    }

}



// ===============================
// スタンプ追加
// ===============================

function addStamp(){


    const date =
    document
    .getElementById("stamp-date")
    .value;


    const event =
    document
    .getElementById("stamp-event")
    .value
    .trim();



    if(date === ""){

        alert("参加日を入力してください");

        return;

    }



    if(event === ""){

        alert("訓練内容を入力してください");

        return;

    }



    const saved =
    localStorage.getItem(
        STORAGE_KEY
    );


    if(!saved){

        alert("利用者登録をしてください");

        return;

    }



    const data =
    JSON.parse(saved);



    // ===========================
    // 履歴修正
    // ===========================

    if(editIndex !== null){


        data.stamps[editIndex] = {

            date:date,

            event:event

        };


        editIndex = null;

    }


    // ===========================
    // 新規追加
    // ===========================

    else{


        if(data.stamps.length >= MAX_STAMP){

            alert(
                "スタンプは10個まで登録できます"
            );

            return;

        }


        data.stamps.push({

            date:date,

            event:event

        });

    }



    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
    );



    document
    .getElementById("stamp-date")
    .value = "";


    document
    .getElementById("stamp-event")
    .value = "";


    document
    .getElementById("add-button")
    .textContent =
    "スタンプ追加";



    displayCard(data);

}



// ===============================
// 修正
// ===============================

function editStamp(index){


    const saved =
    localStorage.getItem(
        STORAGE_KEY
    );


    if(!saved){

        return;

    }


    const data =
    JSON.parse(saved);


    const stamp =
    data.stamps[index];



    if(!stamp){

        return;

    }



    document
    .getElementById("stamp-date")
    .value =
    stamp.date;


    document
    .getElementById("stamp-event")
    .value =
    stamp.event;



    editIndex = index;


    document
    .getElementById("add-button")
    .textContent =
    "修正保存";



    window.scrollTo({

        top:0,

        behavior:"smooth"

    });

}



// ===============================
// 参加記録削除
// ===============================

function deleteStamp(index){


    const result =
    confirm(
        "この参加記録を削除しますか？"
    );


    if(!result){

        return;

    }



    const saved =
    localStorage.getItem(
        STORAGE_KEY
    );


    if(!saved){

        return;

    }



    const data =
    JSON.parse(saved);



    data.stamps.splice(
        index,
        1
    );



    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
    );



    displayCard(data);

}



// ===============================
// 表示
// ===============================

function displayCard(data){


    document
    .getElementById("register-area")
    .style.display =
    "none";


    document
    .getElementById("card-area")
    .style.display =
    "block";



    // ===========================
    // 氏名
    // ===========================

    document
    .getElementById("user-name")
    .textContent =
    data.name + " さん";



    // ===========================
    // QRコード
    // ===========================

    document
    .getElementById("qrcode")
    .innerHTML = "";


    new QRCode(

        document
        .getElementById("qrcode"),

        {

            text:data.id,

            width:180,

            height:180

        }

    );



    document
    .getElementById("user-id")
    .textContent =
    "ID : " + data.id;



    // ===========================
    // スタンプ表示
    // ===========================

    const icons =
    document
    .getElementById("stamp-icons");


    icons.innerHTML = "";



    for(
        let i = 0;
        i < MAX_STAMP;
        i++
    ){


        const span =
        document.createElement("span");


        span.textContent =
        i < data.stamps.length
        ?
        "⭐"
        :
        "☆";


        icons.appendChild(span);

    }



    document
    .getElementById("stamp-count")
    .textContent =
    data.stamps.length;



    // ===========================
    // 認定判定
    // ===========================

    const message =
    document
    .getElementById("message");



    const certificateArea =
    document
    .getElementById("certificate-area");



    if(
        data.stamps.length >=
        CERTIFICATE_COUNT
    ){


        message.textContent =
        "🎉 いわぽん防災マイスター認定条件達成！";


        certificateArea.style.display =
        "block";


    }

    else{


        message.textContent =
        "認定まであと "
        +
        (
            CERTIFICATE_COUNT -
            data.stamps.length
        )
        +
        " 個です";


        certificateArea.style.display =
        "none";

    }



    // ===========================
    // 履歴表示
    // ===========================

    const list =
    document
    .getElementById("history-list");


    list.innerHTML = "";



    data.stamps.forEach(

        (stamp,index)=>{


            const li =
            document.createElement("li");



            li.innerHTML =

            `
            ${stamp.date}<br>
            ${stamp.event}<br>

            <button
            onclick="editStamp(${index})">

            修正

            </button>


            <button
            onclick="deleteStamp(${index})">

            削除

            </button>
            `;



            list.appendChild(li);

        }

    );

}



// ===============================
// テストデータ削除
// ===============================

function clearData(){


    if(
        confirm(
            "登録したテストデータをすべて削除しますか？"
        )
    ){


        // iwaseStampだけを削除
        // 他のlocalStorageデータは残す

        localStorage.removeItem(
            STORAGE_KEY
        );


        alert(
            "データを削除しました"
        );


        location.reload();

    }

}
```

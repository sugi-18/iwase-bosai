// =================================
// いわぽん防災マイスター
// スタンプカード
// 完成版
// =================================

const STORAGE_KEY = "iwaseStamp";

const MAX_STAMP = 10;
const CERTIFICATE_COUNT = 5;

let editIndex = null;


// =================================
// 初期読み込み
// =================================

window.addEventListener("DOMContentLoaded", function () {

    const registerButton =
        document.getElementById("register-button");

    const addButton =
        document.getElementById("add-button");


    if (registerButton) {

        registerButton.addEventListener(
            "click",
            registerUser
        );

    }


    if (addButton) {

        addButton.addEventListener(
            "click",
            addStamp
        );

    }


    loadCard();

});


// =================================
// 利用者登録
// =================================

function registerUser() {

    const username =
        document.getElementById("username");


    if (!username) {

        alert("氏名入力欄が見つかりません。");

        return;

    }


    const name =
        username.value.trim();


    if (name === "") {

        alert("氏名を入力してください。");

        username.focus();

        return;

    }


    const data = {

        id:
            "IWASE-" +
            Date.now(),

        name:
            name,

        stamps:
            []

    };


    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data)
        );

    }

    catch (error) {

        console.error(error);

        alert(
            "利用者情報を保存できませんでした。"
        );

        return;

    }


    displayCard(data);

}


// =================================
// 保存データ読み込み
// =================================

function loadCard() {

    const saved =
        localStorage.getItem(
            STORAGE_KEY
        );


    if (!saved) {

        return;

    }


    try {

        const data =
            JSON.parse(saved);


        if (
            !data ||
            !data.name ||
            !Array.isArray(data.stamps)
        ) {

            localStorage.removeItem(
                STORAGE_KEY
            );

            return;

        }


        displayCard(data);

    }

    catch (error) {

        console.error(error);

        localStorage.removeItem(
            STORAGE_KEY
        );

    }

}


// =================================
// スタンプ追加
// =================================

function addStamp() {

    const dateInput =
        document.getElementById(
            "stamp-date"
        );


    const eventInput =
        document.getElementById(
            "stamp-event"
        );


    if (!dateInput || !eventInput) {

        alert(
            "参加記録入力欄が見つかりません。"
        );

        return;

    }


    const date =
        dateInput.value;


    const event =
        eventInput.value.trim();


    if (date === "") {

        alert(
            "参加日を入力してください。"
        );

        dateInput.focus();

        return;

    }


    if (event === "") {

        alert(
            "訓練内容を入力してください。"
        );

        eventInput.focus();

        return;

    }


    const saved =
        localStorage.getItem(
            STORAGE_KEY
        );


    if (!saved) {

        alert(
            "先に利用者登録をしてください。"
        );

        return;

    }


    let data;


    try {

        data =
            JSON.parse(saved);

    }

    catch (error) {

        console.error(error);

        alert(
            "利用者データを読み込めませんでした。"
        );

        return;

    }


    if (!Array.isArray(data.stamps)) {

        data.stamps = [];

    }


    // =================================
    // 履歴修正
    // =================================

    if (editIndex !== null) {

        if (
            editIndex >= 0 &&
            editIndex < data.stamps.length
        ) {

            data.stamps[editIndex] = {

                date:
                    date,

                event:
                    event

            };

        }


        editIndex = null;

    }


    // =================================
    // 新規追加
    // =================================

    else {

        if (
            data.stamps.length >=
            MAX_STAMP
        ) {

            alert(
                "スタンプは10個まで登録できます。"
            );

            return;

        }


        data.stamps.push({

            date:
                date,

            event:
                event

        });

    }


    // =================================
    // 保存
    // =================================

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data)
        );

    }

    catch (error) {

        console.error(error);

        alert(
            "データを保存できませんでした。"
        );

        return;

    }


    dateInput.value = "";

    eventInput.value = "";


    const addButton =
        document.getElementById(
            "add-button"
        );


    if (addButton) {

        addButton.textContent =
            "スタンプ追加";

    }


    displayCard(data);

}


// =================================
// 参加履歴修正
// =================================

function editStamp(index) {

    const saved =
        localStorage.getItem(
            STORAGE_KEY
        );


    if (!saved) {

        return;

    }


    let data;


    try {

        data =
            JSON.parse(saved);

    }

    catch (error) {

        console.error(error);

        return;

    }


    if (!Array.isArray(data.stamps)) {

        return;

    }


    const stamp =
        data.stamps[index];


    if (!stamp) {

        return;

    }


    const dateInput =
        document.getElementById(
            "stamp-date"
        );


    const eventInput =
        document.getElementById(
            "stamp-event"
        );


    if (dateInput) {

        dateInput.value =
            stamp.date || "";

    }


    if (eventInput) {

        eventInput.value =
            stamp.event || "";

    }


    editIndex =
        index;


    const addButton =
        document.getElementById(
            "add-button"
        );


    if (addButton) {

        addButton.textContent =
            "修正保存";

    }


    window.scrollTo({

        top:
            0,

        behavior:
            "smooth"

    });

}


// =================================
// 参加履歴削除
// =================================

function deleteStamp(index) {

    const result =
        confirm(
            "この参加記録を削除しますか？"
        );


    if (!result) {

        return;

    }


    const saved =
        localStorage.getItem(
            STORAGE_KEY
        );


    if (!saved) {

        return;

    }


    let data;


    try {

        data =
            JSON.parse(saved);

    }

    catch (error) {

        console.error(error);

        return;

    }


    if (!Array.isArray(data.stamps)) {

        return;

    }


    if (
        index < 0 ||
        index >= data.stamps.length
    ) {

        return;

    }


    data.stamps.splice(
        index,
        1
    );


    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data)
        );

    }

    catch (error) {

        console.error(error);

        alert(
            "データを保存できませんでした。"
        );

        return;

    }


    displayCard(data);

}


// =================================
// スタンプカード表示
// =================================

function displayCard(data) {

    if (!data) {

        return;

    }


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


    // =================================
    // 氏名
    // =================================

    const userName =
        document.getElementById(
            "user-name"
        );


    if (userName) {

        userName.textContent =
            data.name +
            " さん";

    }


    // =================================
    // QRコード
    // =================================

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

        else {

            qrArea.textContent =
                "QRコードを読み込めませんでした。";

        }

    }


    // =================================
    // 利用者ID
    // =================================

    const userId =
        document.getElementById(
            "user-id"
        );


    if (userId) {

        userId.textContent =
            "ID : " +
            data.id;

    }


    // =================================
    // スタンプ表示
    // =================================

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


            if (
                i <
                data.stamps.length
            ) {

                span.textContent =
                    "⭐";

            }

            else {

                span.textContent =
                    "☆";

            }


            icons.appendChild(
                span
            );

        }

    }


    // =================================
    // スタンプ数
    // =================================

    const stampCount =
        document.getElementById(
            "stamp-count"
        );


    if (stampCount) {

        stampCount.textContent =
            data.stamps.length;

    }


    // =================================
    // 認定判定
    // =================================

    const message =
        document.getElementById(
            "message"
        );


    const certificateArea =
        document.getElementById(
            "certificate-area"
        );


    if (
        data.stamps.length >=
        CERTIFICATE_COUNT
    ) {

        if (message) {

            message.textContent =
                "🎉 いわぽん防災マイスター認定条件達成！";

        }


        if (certificateArea) {

            certificateArea.style.display =
                "block";

        }

    }

    else {

        const remaining =
            CERTIFICATE_COUNT -
            data.stamps.length;


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


    // =================================
    // 参加履歴表示
    // =================================

    const historyList =
        document.getElementById(
            "history-list"
        );


    if (!historyList) {

        return;

    }


    historyList.innerHTML =
        "";


    data.stamps.forEach(
        function (stamp, index) {

            const li =
                document.createElement(
                    "li"
                );


            // 日付
            const dateText =
                document.createElement(
                    "div"
                );


            dateText.textContent =
                stamp.date || "";


            // 内容
            const eventText =
                document.createElement(
                    "div"
                );


            eventText.textContent =
                stamp.event || "";


            // 修正ボタン
            const editButton =
                document.createElement(
                    "button"
                );


            editButton.type =
                "button";


            editButton.textContent =
                "修正";


            editButton.addEventListener(
                "click",
                function () {

                    editStamp(index);

                }
            );


            // 削除ボタン
            const deleteButton =
                document.createElement(
                    "button"
                );


            deleteButton.type =
                "button";


            deleteButton.textContent =
                "削除";


            deleteButton.addEventListener(
                "click",
                function () {

                    deleteStamp(index);

                }
            );


            li.appendChild(
                dateText
            );


            li.appendChild(
                eventText
            );


            li.appendChild(
                editButton
            );


            li.appendChild(
                deleteButton
            );


            historyList.appendChild(
                li
            );

        }
    );

}


// =================================
// テストデータ削除
// =================================

function clearData() {

    const result =
        confirm(
            "登録したテストデータをすべて削除しますか？"
        );


    if (!result) {

        return;

    }


    localStorage.removeItem(
        STORAGE_KEY
    );


    alert(
        "データを削除しました。"
    );


    location.reload();

}

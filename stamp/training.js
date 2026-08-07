// =============================
// 防災訓練QR参加登録
// =============================


const STORAGE_KEY = "iwaseStamp";



window.onload=function(){



// QRから情報取得

const params =
new URLSearchParams(
location.search
);



const event =
params.get("event");


const date =
params.get("date");





document
.getElementById("event-name")
.textContent =

event || "防災訓練";



document
.getElementById("event-date")
.textContent =

date || "";





document
.getElementById("add-training")
.addEventListener(

"click",

function(){


addTraining(

date,

event

);


}

);



};





function addTraining(date,event){



const saved =

localStorage.getItem(
STORAGE_KEY
);



if(!saved){


alert(

"先にスタンプカード登録をしてください"

);


return;


}




const data =

JSON.parse(saved);





// 重複防止

const exists =

data.stamps.some(

stamp =>

stamp.date===date

&&

stamp.event===event

);





if(exists){


document
.getElementById("result")
.textContent=

"この訓練は登録済みです";


return;


}





data.stamps.push({

date:date,

event:event

});





localStorage.setItem(

STORAGE_KEY,

JSON.stringify(data)

);





document
.getElementById("result")
.textContent=

"✅ スタンプを追加しました！";



}

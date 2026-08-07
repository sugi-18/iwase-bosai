// ===========================
// いわぽん防災マイスター
// スタンプカード
// STEP2
// ===========================


const STORAGE_KEY = "iwaseStamp";



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






// =================
// 利用者登録
// =================

function registerUser(){


const name =

document
.getElementById("username")
.value
.trim();



if(name===""){


alert("氏名を入力してください");


return;


}



const data = {


name:name,


stamps:[]


};



localStorage.setItem(

STORAGE_KEY,

JSON.stringify(data)

);



displayCard(data);


}








// =================
// 読み込み
// =================

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







// =================
// スタンプ追加
// =================

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




if(date===""){


alert("参加日を入力してください");


return;


}



if(event===""){


alert("訓練内容を入力してください");


return;


}





const data =

JSON.parse(

localStorage.getItem(
STORAGE_KEY
)

);





data.stamps.push({


date:date,


event:event


});






localStorage.setItem(

STORAGE_KEY,


JSON.stringify(data)

);





document
.getElementById("stamp-event")
.value="";



displayCard(data);



alert("スタンプを追加しました");



}









// =================
// 表示
// =================

function displayCard(data){



document
.getElementById("register-area")
.style.display="none";



document
.getElementById("card-area")
.style.display="block";





document
.getElementById("user-name")
.textContent=

data.name+" さん";





document
.getElementById("stamp-count")
.textContent=

data.stamps.length;






const message =

document
.getElementById("message");



if(data.stamps.length>=5){


message.textContent=

"🎉 いわぽん防災マイスター認定対象です！";


}
else{


message.textContent=

"認定まであと "
+
(5-data.stamps.length)
+
" 回です";


}







const list =

document
.getElementById("history-list");



list.innerHTML="";





data.stamps.forEach(

stamp=>{


const li =

document.createElement("li");



li.textContent=

stamp.date
+
" "
+
stamp.event;



list.appendChild(li);



}



);



}

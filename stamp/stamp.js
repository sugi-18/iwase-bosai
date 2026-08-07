// ===========================
// いわぽん防災マイスター
// スタンプカード
// STEP1
// ===========================


const STORAGE_KEY = "iwaseStamp";



window.onload = function(){


const button =
document.getElementById("register-button");


button.addEventListener(
"click",
registerUser
);



loadCard();


};




// 利用者登録

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


name:name,


stamps:[]


};



localStorage.setItem(

STORAGE_KEY,

JSON.stringify(data)

);



displayCard(data);



}






// データ読み込み

function loadCard(){



const saved =

localStorage.getItem(
STORAGE_KEY
);



if(saved){


const data =

JSON.parse(saved);



displayCard(data);



}



}





// カード表示

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

data.name + " さん";



document
.getElementById("stamp-count")
.textContent=

data.stamps.length;



const message =

document.getElementById(
"message"
);



if(data.stamps.length >=5){


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

document.getElementById(
"history-list"
);



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

// =================================
// いわぽん防災マイスター
// スタンプカード
// STEP6
// =================================


const STORAGE_KEY = "iwaseStamp";

const MAX_STAMP = 10;

const CERTIFICATE_COUNT = 5;



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
// 登録
// ===============================

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





localStorage.setItem(

STORAGE_KEY,

JSON.stringify(data)

);




document
.getElementById("stamp-event")
.value="";



displayCard(data);


}







// ===============================
// 表示
// ===============================

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







// スタンプ表示

const icons =

document
.getElementById("stamp-icons");



icons.innerHTML="";



for(let i=0;i<MAX_STAMP;i++){


const span =

document.createElement("span");



if(i < data.stamps.length){


span.textContent="⭐";


}

else{


span.textContent="☆";


}



icons.appendChild(span);


}







document
.getElementById("stamp-count")
.textContent=

data.stamps.length;








// 認定判定

const message =

document
.getElementById("message");



if(data.stamps.length >= CERTIFICATE_COUNT){



message.textContent=

"🎉 いわぽん防災マイスター認定条件達成！";



document
.getElementById("certificate-area")
.style.display="block";


}

else{


message.textContent=

"認定まであと "

+

(CERTIFICATE_COUNT - data.stamps.length)

+

" 個です";



document
.getElementById("certificate-area")
.style.display="none";


}









// 履歴表示

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

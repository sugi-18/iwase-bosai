// =================================
// いわぽん防災マイスター
// スタンプカード
// 完成版
// =================================


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







// ===============================
// 利用者登録
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
// データ読み込み
// ===============================


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





data.stamps.push({


date:date,


event:event


});





localStorage.setItem(

STORAGE_KEY,


JSON.stringify(data)

);





displayCard(data);





}





// ===============================
// カード表示
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







// QR表示

document
.getElementById("qrcode")
.innerHTML="";



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
.textContent=

"ID : "+data.id;









// 回数表示


document
.getElementById("stamp-count")
.textContent=

data.stamps.length;









// 認定判定


const message =

document
.getElementById("message");





if(data.stamps.length >=5){



message.textContent=

"🎉 いわぽん防災マイスター認定です！";




document
.getElementById("certificate-area")
.style.display="block";



}

else{



message.textContent=

"認定まであと "

+

(5-data.stamps.length)

+

" 回です";



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

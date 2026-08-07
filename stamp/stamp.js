const MAX_STAMP = 10;


// 初期表示

window.onload=function(){

loadData();

};



function registerUser(){


let name =
document.getElementById("username").value;


if(name===""){

alert("氏名を入力してください");

return;

}


let data={

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



// 表示

function loadData(){


let data =
JSON.parse(
localStorage.getItem("iwaseStamp")
);



if(!data){

document.getElementById("register-area")
.style.display="block";


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



if(data.stamps.length>=5){

document.getElementById("message")
.innerHTML=
"🎉 いわぽん防災マイスター認定対象です！";

}



if(data.stamps.length>=10){

document.getElementById("message")
.innerHTML=
"🏆 スタンプ10個達成！防災マスターです！";

}


}



// スタンプ表示

function showStamps(count){


let area=
document.getElementById("stamps");


area.innerHTML="";


for(let i=1;i<=MAX_STAMP;i++){


let div=document.createElement("div");


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



// 追加

function addStamp(){


let data =
JSON.parse(
localStorage.getItem("iwaseStamp")
);



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


let area=
document.getElementById("history");


area.innerHTML="";


history.reverse().forEach(item=>{


let div=document.createElement("div");


div.className="history-item";


div.innerHTML=

`
<strong>${item.date}</strong><br>
${item.name}<br>
${item.detail}
`;


area.appendChild(div);


});


}



// リセット

function resetData(){


if(confirm("データを削除しますか？")){


localStorage.removeItem("iwaseStamp");


location.reload();


}


}

// QR情報確認

window.addEventListener(
"load",
function(){

let qr =
JSON.parse(
localStorage.getItem("qrTraining")
);


if(qr){


document.getElementById(
"training-date"
).value=qr.date;


document.getElementById(
"training-name"
).value=qr.name;


document.getElementById(
"training-detail"
).value=qr.detail;


localStorage.removeItem(
"qrTraining"
);


}

});

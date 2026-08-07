function createCertificate(){


let data =
JSON.parse(
localStorage.getItem("iwaseStamp")
);



if(!data){

return;

}



if(data.stamps.length < 5){

alert(
"5個以上取得すると認定証を発行できます"
);

return;

}



let text =

`
いわぽん防災マイスター認定証


${data.name} 様


あなたは防災訓練・講座に
5回以上参加し、

地域防災力向上に
貢献しました。


認定日

${new Date().toLocaleDateString()}


岩瀬自治会

`;



let blob =
new Blob(
[text],
{
type:"text/plain"
}
);



let url =
URL.createObjectURL(blob);



let a =
document.createElement("a");


a.href=url;

a.download=
"いわぽん防災マイスター認定証.txt";


a.click();


}

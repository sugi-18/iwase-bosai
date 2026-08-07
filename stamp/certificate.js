// ------------------------
// 認定証データ表示
// ------------------------

window.onload = function () {

    const data = JSON.parse(localStorage.getItem("iwaseStamp"));

    if (!data) {
        alert("データがありません。");
        return;
    }

    if (data.stamps.length < 5) {
        alert("スタンプ5個以上で認定証を発行できます。");
        history.back();
        return;
    }

    document.getElementById("username").textContent = data.name;

    const today = new Date();

    const date =
        today.getFullYear() + "年" +
        (today.getMonth()+1) + "月" +
        today.getDate() + "日";

    document.getElementById("today").textContent = date;

    const number =
        "IW-" +
        today.getFullYear() +
        String(today.getMonth()+1).padStart(2,"0") +
        String(today.getDate()).padStart(2,"0") +
        "-" +
        Math.floor(Math.random()*9000+1000);

    document.getElementById("number").textContent = number;

}


// ------------------------
// PDF保存
// ------------------------

async function downloadPDF(){

    const { jsPDF } = window.jspdf;

    const target =
    document.getElementById("certificate");

    const canvas =
    await html2canvas(target,{

        scale:2,

        useCORS:true,

        backgroundColor:"#fffdf6"

    });

    const imgData =
    canvas.toDataURL("image/png");

    const pdf =
    new jsPDF({

        orientation:"landscape",

        unit:"mm",

        format:"a4"

    });

    pdf.addImage(

        imgData,

        "PNG",

        0,

        0,

        297,

        210

    );

    pdf.save("いわぽん防災マイスター認定証.pdf");

}

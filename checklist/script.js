let radarChart = null;


// =========================
// 診断処理
// =========================

function diagnose(){


    const checks =
    document.querySelectorAll(
        'input[type="checkbox"]'
    );


    let scores = {

        home:0,
        stock:0,
        evac:0,
        community:0

    };


    let totals = {

        home:0,
        stock:0,
        evac:0,
        community:0

    };


    let advice=[];



    checks.forEach(check=>{


        let category =
        check.dataset.category;


        totals[category]++;



        if(check.checked){


            scores[category]++;


        }else{


            advice.push(

                "「"
                + check.dataset.text
                + "」を準備・確認しましょう"

            );

        }


    });



    // 分野別100点換算

    let categoryScore={


        home:
        Math.round(
            scores.home / totals.home * 100
        ),


        stock:
        Math.round(
            scores.stock / totals.stock * 100
        ),


        evac:
        Math.round(
            scores.evac / totals.evac * 100
        ),


        community:
        Math.round(
            scores.community / totals.community * 100
        )


    };



    // 総合点

    let totalScore =
    Math.round(

        (
            categoryScore.home+
            categoryScore.stock+
            categoryScore.evac+
            categoryScore.community

        )/4

    );



    document.getElementById("score")
    .innerHTML =
    totalScore+"点";



    let rank="";


    if(totalScore>=90){

        rank="★★★★★ 防災マスター";

    }
    else if(totalScore>=75){

        rank="★★★★☆ 十分な備えがあります";

    }
    else if(totalScore>=50){

        rank="★★★☆☆ 改善するとさらに安心です";

    }
    else if(totalScore>=30){

        rank="★★☆☆☆ 備えを見直しましょう";

    }
    else{

        rank="★☆☆☆☆ 基本的な備えから始めましょう";

    }


    document.getElementById("rank")
    .innerHTML=rank;




    // 改善項目

    const list =
    document.getElementById(
        "adviceList"
    );


    list.innerHTML="";


    if(advice.length===0){


        let li=document.createElement("li");

        li.textContent=
        "すべての項目を確認しています。素晴らしい備えです。";

        list.appendChild(li);


    }else{


        advice.forEach(text=>{


            let li=
            document.createElement("li");


            li.textContent=text;


            list.appendChild(li);


        });


    }




    // 結果表示

    document.getElementById("result")
    .style.display="block";



    // 少し待ってチャート作成

    setTimeout(()=>{


        createRadarChart(categoryScore);


    },300);



    window.scrollTo({

        top:
        document.body.scrollHeight,

        behavior:"smooth"

    });


}




// =========================
// レーダーチャート
// =========================


function createRadarChart(data){



    const canvas =
    document.getElementById(
        "radarChart"
    );



    if(!canvas){

        console.log(
            "canvasがありません"
        );

        return;

    }



    const ctx =
    canvas.getContext("2d");



    if(radarChart){


        radarChart.destroy();


    }




    radarChart =
    new Chart(ctx,{


        type:"radar",


        data:{


            labels:[

                "家の安全",
                "備蓄",
                "避難",
                "地域"

            ],



            datasets:[{


                label:"防災力",

                data:[

                    data.home,
                    data.stock,
                    data.evac,
                    data.community

                ],


                borderWidth:2,


                fill:true


            }]


        },



        options:{


            responsive:true,


            maintainAspectRatio:false,


            scales:{


                r:{


                    min:0,


                    max:100,


                    ticks:{

                        stepSize:20

                    }


                }


            }


        }


    });


}






// =========================
// PDF保存
// =========================


async function savePDF(){



    const target =
    document.getElementById(
        "result"
    );



    // チャート描画待ち

    await new Promise(
        resolve=>setTimeout(resolve,500)
    );



    const canvas =
    await html2canvas(
        target,
        {

            scale:2,

            useCORS:true

        }

    );



    const imgData =
    canvas.toDataURL(
        "image/png"
    );



    const {
        jsPDF
    } =
    window.jspdf;



    const pdf =
    new jsPDF(
        "p",
        "mm",
        "a4"
    );



    const pageWidth =
    pdf.internal.pageSize.getWidth();



    const pageHeight =
    pdf.internal.pageSize.getHeight();



    const imgWidth =
    pageWidth-20;



    const imgHeight =
    canvas.height*
    imgWidth/
    canvas.width;



    let heightLeft =
    imgHeight;



    let position=10;



    pdf.text(

        "岩瀬自治会 防災チェック診断結果",

        10,

        10

    );



    pdf.addImage(

        imgData,

        "PNG",

        10,

        20,

        imgWidth,

        imgHeight

    );



    heightLeft -=
    pageHeight;



    while(heightLeft>0){


        position =
        heightLeft-imgHeight;


        pdf.addPage();



        pdf.addImage(

            imgData,

            "PNG",

            10,

            position,

            imgWidth,

            imgHeight

        );



        heightLeft -=
        pageHeight;


    }



    pdf.save(

        "岩瀬自治会_防災診断結果.pdf"

    );


}

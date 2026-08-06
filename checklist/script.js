let radarChart;


// 診断処理
function diagnose(){

    const checks = document.querySelectorAll(
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


    let advice = [];


    checks.forEach(check => {

        const category = check.dataset.category;

        totals[category]++;


        if(check.checked){

            scores[category]++;

        }else{

            advice.push(
                "「" + check.dataset.text + "」を確認しましょう"
            );

        }

    });



    // カテゴリ別点数（100点換算）

    let categoryScore = {

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

    let totalScore = Math.round(

        (
            categoryScore.home +
            categoryScore.stock +
            categoryScore.evac +
            categoryScore.community

        ) / 4

    );



    // 表示

    document.getElementById("score").innerHTML =
        totalScore + "点";



    let rankText="";


    if(totalScore >= 90){

        rankText =
        "★★★★★ 防災マスター";

    }
    else if(totalScore >= 75){

        rankText =
        "★★★★☆ 十分な備えがあります";

    }
    else if(totalScore >= 50){

        rankText =
        "★★★☆☆ もう少し改善しましょう";

    }
    else if(totalScore >= 30){

        rankText =
        "★★☆☆☆ 備えを見直しましょう";

    }
    else{

        rankText =
        "★☆☆☆☆ まず基本的な備えから始めましょう";

    }


    document.getElementById("rank").innerHTML =
        rankText;



    // 改善項目表示

    const list =
    document.getElementById("adviceList");


    list.innerHTML="";


    if(advice.length===0){

        let li=document.createElement("li");

        li.textContent =
        "すべての項目を確認できています。素晴らしい備えです！";

        list.appendChild(li);

    }
    else{

        advice.forEach(item=>{

            let li=document.createElement("li");

            li.textContent=item;

            list.appendChild(li);

        });

    }



    // レーダーチャート

    createRadarChart(categoryScore);



    document.getElementById("result").style.display="block";


    window.scrollTo({

        top:
        document.body.scrollHeight,

        behavior:"smooth"

    });

}



// レーダーチャート作成

function createRadarChart(data){


const ctx = document
    .getElementById("radarChart")
    .getContext("2d");   


    if(radarChart){

        radarChart.destroy();

    }



 radarChart = new Chart(ctx, {

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



// PDF保存

radarChart = new Chart(ctx, {

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

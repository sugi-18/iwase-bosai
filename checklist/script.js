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

async function savePDF(){


    const target =
    document.getElementById("result");


    const canvas =
    await html2canvas(target,{
        scale:2
    });


    const imgData =
    canvas.toDataURL("image/png");


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


    const width =
    190;


    const height =
    canvas.height *
    width /
    canvas.width;


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
        width,
        height
    );


    pdf.save(
        "防災チェック診断結果.pdf"
    );


}

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

        home: 0,
        stock: 0,
        evac: 0,
        community: 0

    };


    let totals = {

        home: 0,
        stock: 0,
        evac: 0,
        community: 0

    };


    let advice = [];


    // 保存用の回答内容

    let answers = [];


    checks.forEach(check => {

        let category =
            check.dataset.category;


        totals[category]++;


        answers.push({

            key:
                check.dataset.key || check.dataset.text,

            category:
                category,

            text:
                check.dataset.text,

            checked:
                check.checked === true

        });


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


    // =========================
    // 分野別100点換算
    // =========================

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


    // =========================
    // 総合点
    // =========================

    let totalScore =
        Math.round(

            (
                categoryScore.home +
                categoryScore.stock +
                categoryScore.evac +
                categoryScore.community

            ) / 4

        );


    document.getElementById("score")
        .innerHTML =
        totalScore + "点";


    // =========================
    // ランク
    // =========================

    let rank = "";


    if(totalScore >= 90){

        rank =
            "★★★★★ 防災マスター";

    }
    else if(totalScore >= 75){

        rank =
            "★★★★☆ 十分な備えがあります";

    }
    else if(totalScore >= 50){

        rank =
            "★★★☆☆ 改善するとさらに安心です";

    }
    else if(totalScore >= 30){

        rank =
            "★★☆☆☆ 備えを見直しましょう";

    }
    else{

        rank =
            "★☆☆☆☆ 基本的な備えから始めましょう";

    }


    document.getElementById("rank")
        .innerHTML = rank;


    // =========================
    // 改善項目
    // =========================

    const list =
        document.getElementById(
            "adviceList"
        );


    list.innerHTML = "";


    if(advice.length === 0){

        let li =
            document.createElement("li");


        li.textContent =
            "すべての項目を確認しています。素晴らしい備えです。";


        list.appendChild(li);

    }
    else{

        advice.forEach(text => {

            let li =
                document.createElement("li");


            li.textContent = text;


            list.appendChild(li);

        });

    }


    // =========================
    // 結果表示
    // =========================

    document.getElementById("result")
        .style.display = "block";


    // =========================
    // 少し待ってチャート作成
    // =========================

    setTimeout(() => {

        createRadarChart(categoryScore);

    }, 300);


    // =========================
    // 結果までスクロール
    // =========================

    window.scrollTo({

        top:
            document.body.scrollHeight,

        behavior:
            "smooth"

    });


    // =========================
    // 結果を保存
    //
    // 自治会側で集計するために送る。
    // 通信できなくても診断結果は
    // 画面に出たままにする。
    // =========================

    saveResult(
        totalScore,
        categoryScore,
        answers
    );

}


// =========================
// 診断結果の保存
//
// 同じ人が何度実施しても記録は残す。
// 集計側で最新の1件だけを使う。
// =========================

async function saveResult(
    totalScore,
    categoryScore,
    answers
){

    const status =
        document.getElementById("saveStatus");


    if(status){

        status.className = "save-status";

        status.textContent =
            "回答内容を保存しています...";

    }


    try{

        if(
            !window.supabaseClient ||
            !window.IwaseCommunity
        ){

            throw new Error(
                "保存の準備ができていません。"
            );

        }


        await window.IwaseIdentity.load();


        const user =
            window.IwaseCommunity.currentUser();


        const { error } =
            await window.supabaseClient.rpc(
                "submit_checklist_result",
                {
                    p_participant_id:
                        (user && user.id) ? user.id : null,

                    p_name:
                        (user && user.name) ? user.name : null,

                    p_member_type:
                        window.IwaseCommunity.memberType(),

                    p_client_key:
                        window.IwaseCommunity.clientKey(),

                    p_total_score:
                        totalScore,

                    p_scores:
                        categoryScore,

                    p_answers:
                        answers
                }
            );


        if(error){

            throw error;

        }


        if(status){

            status.className = "save-status ok";

            status.textContent =
                "回答内容を保存しました";

        }

    }
    catch(error){

        console.error(
            "診断結果の保存エラー:",
            error
        );


        if(status){

            status.className = "save-status ng";

            status.textContent =
                "回答内容を保存できませんでした。" +
                "通信状態をご確認ください。";

        }

    }

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


    // 既存チャートを削除
    if(radarChart){

        radarChart.destroy();

    }


    radarChart =
        new Chart(ctx, {

            type: "radar",


            data: {

                labels: [

                    "家の安全",
                    "備蓄",
                    "避難",
                    "地域"

                ],


                datasets: [{

                    label:
                        "防災力",


                    data: [

                        data.home,
                        data.stock,
                        data.evac,
                        data.community

                    ],


                    borderWidth: 2,


                    fill: true

                }]

            },


            options: {

                responsive: true,


                maintainAspectRatio: false,


                scales: {

                    r: {

                        min: 0,

                        max: 100,


                        ticks: {

                            stepSize: 20

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


    if(!target){

        alert(
            "診断結果が見つかりません。"
        );

        return;

    }


    // =========================
    // チャート描画待ち
    // =========================

    await new Promise(
        resolve =>
            setTimeout(resolve, 500)
    );


    // =========================
    // PDF保存ボタンを一時的に非表示
    // =========================

    const pdfButton =
        target.querySelector(
            "button"
        );


    if(pdfButton){

        pdfButton.style.display =
            "none";

    }


    /*
     * 保存状態の表示はPDFに残さない。
     *
     * 「回答内容を保存しました」は画面上の案内であって、
     * 印刷して手元に置く内容ではないため。
     */

    const statusLine =
        document.getElementById("saveStatus");


    const restoreLine =
        document.getElementById("restoreNotice");


    if(statusLine){

        statusLine.style.display = "none";

    }


    if(restoreLine){

        restoreLine.style.display = "none";

    }


    try{

        // =========================
        // HTMLを画像化
        // =========================

        const canvas =
            await html2canvas(

                target,

                {

                    scale: 2,

                    useCORS: true,

                    backgroundColor:
                        "#ffffff"

                }

            );


        const imgData =
            canvas.toDataURL(
                "image/png"
            );


        // =========================
        // jsPDF
        // =========================

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
            pdf.internal.pageSize
                .getWidth();


        const pageHeight =
            pdf.internal.pageSize
                .getHeight();


        const imgWidth =
            pageWidth - 20;


        const imgHeight =
            canvas.height *
            imgWidth /
            canvas.width;


        let heightLeft =
            imgHeight;


        let position = 10;


        // =========================
        // 1ページ目
        // =========================

        pdf.addImage(

            imgData,

            "PNG",

            10,

            position,

            imgWidth,

            imgHeight

        );


        heightLeft -=
            pageHeight - 10;


        // =========================
        // 2ページ目以降
        // =========================

        while(heightLeft > 0){

            position =
                heightLeft -
                imgHeight +
                10;


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


        // =========================
        // PDF保存
        // =========================

        pdf.save(

            "岩瀬自治会_防災診断結果.pdf"

        );

    }
    catch(error){

        console.error(
            "PDF保存エラー:",
            error
        );


        alert(
            "PDFの保存中にエラーが発生しました。"
        );

    }
    finally{

        // =========================
        // PDF保存ボタンを元に戻す
        // =========================

        if(pdfButton){

            pdfButton.style.display =
                "";

        }


        if(statusLine){

            statusLine.style.display = "";

        }


        if(restoreLine && restoreLine.textContent.trim() !== ""){

            restoreLine.style.display = "block";

        }

    }

}


// =========================
// 前回の回答を復元
//
// 2回目以降に開いたときは、
// 前回の選択状態を出しておく。
//
// 毎回すべて付け直すのは負担が大きい。
// 変わったところだけ直せるようにする。
// =========================

async function restorePreviousAnswers(){

    const notice =
        document.getElementById("restoreNotice");


    try{

        if(
            !window.supabaseClient ||
            !window.IwaseCommunity
        ){

            return;

        }


        await window.IwaseIdentity.load();


        const user =
            window.IwaseCommunity.currentUser();


        const { data, error } =
            await window.supabaseClient.rpc(
                "get_my_checklist_result",
                {
                    p_participant_id:
                        (user && user.id) ? user.id : null,

                    p_client_key:
                        window.IwaseCommunity.clientKey()
                }
            );


        if(error){

            throw error;

        }


        if(!data || !data.answers){

            return;

        }


        // 前回の回答を key で引けるようにする

        const previous = {};


        (Array.isArray(data.answers) ? data.answers : [])
            .forEach(answer => {

                const key =
                    answer.key || answer.text;


                if(key){

                    previous[key] =
                        answer.checked === true;

                }

            });


        const checks =
            document.querySelectorAll(
                'input[type="checkbox"]'
            );


        let restored = 0;


        checks.forEach(check => {

            const key =
                check.dataset.key || check.dataset.text;


            if(previous[key] === true){

                check.checked = true;

                restored++;

            }

        });


        if(notice){

            notice.style.display = "block";

            notice.textContent =
                "前回（" +
                window.IwaseCommunity.formatDateTime(
                    data.created_at
                ) +
                "）の回答を表示しています。変わったところを直して、もう一度診断してください。";

        }


        console.log(
            "前回の回答を復元しました:",
            restored + "件"
        );

    }
    catch(error){

        console.warn(
            "前回の回答を復元できませんでした:",
            error
        );

    }

}


document.addEventListener(
    "DOMContentLoaded",
    () => {

        restorePreviousAnswers();

    }
);

/* ==================================================
   岩瀬自治会 防災アプリ
   アンケート（回答側）

   ・公開中のアンケートを一覧表示する
   ・設問は管理者画面で自由に作れるので、
     ここでは種類ごとに描画を切り替えるだけにする
   ・記名／匿名は回答者が選ぶ
   ・送信は RPC（submit_survey_response）で行う

   回答済みの記録について

     端末側にも回答済みを残す。
     サーバー側でも二重回答は止めているが、
     一覧に「回答済み」と出したほうが
     利用者が迷わないため。
================================================== */

(function () {

"use strict";


/* ==================================================
   設定
================================================== */

var ANSWERED_STORAGE = "iwaseAnsweredSurveys";


/* 現在開いているアンケート */

var currentSurvey = null;

var currentQuestions = [];


/* ==================================================
   小さな道具
================================================== */

function esc(value) {

    return window.IwaseCommunity.escapeHtml(value);

}


function el(id) {

    return document.getElementById(id);

}


function today() {

    return new Date().toISOString().slice(0, 10);

}


/* ==================================================
   回答済みの記録
================================================== */

function readAnswered() {

    try {

        var raw = localStorage.getItem(ANSWERED_STORAGE);

        if (!raw) {
            return [];
        }

        var list = JSON.parse(raw);

        return Array.isArray(list) ? list : [];

    }
    catch (error) {

        console.warn("回答済み情報の読み取りに失敗:", error);

        return [];

    }

}


function addAnswered(surveyId) {

    try {

        var list = readAnswered();

        if (list.indexOf(surveyId) === -1) {

            list.push(surveyId);

        }

        localStorage.setItem(
            ANSWERED_STORAGE,
            JSON.stringify(list)
        );

    }
    catch (error) {

        console.warn("回答済み情報の保存に失敗:", error);

    }

}


/* ==================================================
   一覧の読み込み
================================================== */

async function loadSurveys() {

    var container = el("surveyList");

    if (!container) {
        return;
    }


    container.innerHTML =
        '<div class="tool-loading">読み込み中...</div>';


    try {

        var result =
            await window.supabaseClient
                .from("surveys")
                .select(
                    "id, title, description, " +
                    "start_date, end_date, " +
                    "allow_anonymous, allow_named, " +
                    "display_order, created_at"
                )
                .eq("is_published", true)
                .order("display_order", { ascending: true })
                .order("created_at", { ascending: false });


        if (result.error) {
            throw result.error;
        }


        var surveys = result.data || [];


        if (surveys.length === 0) {

            container.innerHTML =
                '<div class="tool-empty">' +
                '現在、公開されているアンケートはありません。' +
                '</div>';

            return;

        }


        var answered = readAnswered();

        var now = today();


        container.innerHTML = "";


        surveys.forEach(function (survey) {

            var isBefore =
                survey.start_date &&
                now < survey.start_date;

            var isAfter =
                survey.end_date &&
                now > survey.end_date;

            var isAnswered =
                answered.indexOf(survey.id) !== -1;


            var badge = "";

            if (isAnswered) {

                badge =
                    '<span class="tool-badge tool-badge-done">' +
                    '回答済み</span>';

            }
            else if (isAfter) {

                badge =
                    '<span class="tool-badge tool-badge-closed">' +
                    '受付終了</span>';

            }
            else if (isBefore) {

                badge =
                    '<span class="tool-badge tool-badge-closed">' +
                    '開始前</span>';

            }
            else {

                badge =
                    '<span class="tool-badge">受付中</span>';

            }


            var period = "";

            if (survey.start_date || survey.end_date) {

                period =
                    '<p style="color:#777;font-size:14px;">' +
                    (
                        survey.start_date
                            ? window.IwaseCommunity.formatDate(
                                  survey.start_date
                              )
                            : ""
                    ) +
                    ' 〜 ' +
                    (
                        survey.end_date
                            ? window.IwaseCommunity.formatDate(
                                  survey.end_date
                              )
                            : ""
                    ) +
                    '</p>';

            }


            var card = document.createElement("div");

            card.className = "tool-card";

            card.innerHTML =
                '<div style="margin-bottom:10px;">' +
                badge +
                '</div>' +

                '<h2>' + esc(survey.title) + '</h2>' +

                (
                    survey.description
                        ? '<p>' + esc(survey.description) + '</p>'
                        : ''
                ) +

                period;


            var button = document.createElement("button");

            button.type = "button";

            button.className = "tool-button";


            if (isAfter || isBefore) {

                button.textContent =
                    isAfter
                        ? "受付は終了しました"
                        : "まだ開始していません";

                button.disabled = true;

            }
            else if (isAnswered) {

                button.textContent = "もう一度開く";

                button.className =
                    "tool-button tool-button-sub";

            }
            else {

                button.textContent = "回答する";

            }


            if (!button.disabled) {

                button.addEventListener(
                    "click",
                    function () {
                        openSurvey(survey);
                    }
                );

            }


            card.appendChild(button);

            container.appendChild(card);

        });


    }
    catch (error) {

        console.error("アンケート取得エラー:", error);

        container.innerHTML =
            '<div class="tool-error">' +
            'アンケートを読み込めませんでした。<br>' +
            'しばらく時間をおいて再度お試しください。' +
            '</div>';

    }

}


/* ==================================================
   回答画面を開く
================================================== */

async function openSurvey(survey) {

    currentSurvey = survey;

    currentQuestions = [];


    el("surveyListArea").style.display = "none";

    el("surveyFormArea").style.display = "block";

    el("surveyMessage").innerHTML = "";

    el("surveySubmitButton").disabled = false;

    el("surveySubmitButton").textContent = "回答を送信する";


    el("surveyTitle").textContent = survey.title || "";

    el("surveyDescription").textContent =
        survey.description || "";


    if (survey.start_date || survey.end_date) {

        el("surveyPeriod").textContent =
            "回答期間：" +
            (
                survey.start_date
                    ? window.IwaseCommunity.formatDate(
                          survey.start_date
                      )
                    : ""
            ) +
            " 〜 " +
            (
                survey.end_date
                    ? window.IwaseCommunity.formatDate(
                          survey.end_date
                      )
                    : ""
            );

    }
    else {

        el("surveyPeriod").textContent = "";

    }


    window.scrollTo(0, 0);


    renderNameArea(survey);

    await loadQuestions(survey.id);

}


/* ==================================================
   記名・匿名の選択

   どちらか一方しか許可されていない場合は、
   選ばせずにその方式で固定する。
================================================== */

function renderNameArea(survey) {

    var area = el("surveyNameArea");

    var user = window.IwaseCommunity.currentUser();

    var userName =
        (user && user.name) ? user.name : "";


    var allowNamed =
        survey.allow_named !== false;

    var allowAnonymous =
        survey.allow_anonymous !== false;


    if (!allowNamed && !allowAnonymous) {

        allowAnonymous = true;

    }


    var html = "";


    if (allowNamed && allowAnonymous) {

        html +=
            '<label class="survey-choice">' +
            '<input type="radio" name="surveyNameMode" ' +
            'value="named" checked>' +
            '<span>記名で回答する<br>' +
            '<span style="font-size:14px;color:#666;">' +
            '自治会が誰の回答か分かります' +
            '</span></span>' +
            '</label>' +

            '<label class="survey-choice">' +
            '<input type="radio" name="surveyNameMode" ' +
            'value="anonymous">' +
            '<span>匿名で回答する<br>' +
            '<span style="font-size:14px;color:#666;">' +
            'お名前は記録されません' +
            '</span></span>' +
            '</label>';

    }
    else if (allowNamed) {

        html +=
            '<p>このアンケートは記名回答です。</p>' +
            '<input type="hidden" name="surveyNameMode" ' +
            'value="named">';

    }
    else {

        html +=
            '<p>このアンケートは匿名回答です。<br>' +
            'お名前は記録されません。</p>' +
            '<input type="hidden" name="surveyNameMode" ' +
            'value="anonymous">';

    }


    if (allowNamed) {

        html +=
            '<div id="surveyNameInputArea">' +
            '<label class="tool-label" for="surveyRespondentName">' +
            'お名前' +
            '</label>' +
            '<input type="text" id="surveyRespondentName" ' +
            'class="tool-input" placeholder="例：岩瀬 太郎" ' +
            'value="' + esc(userName) + '">' +
            '</div>';

    }


    area.innerHTML = html;


    /* 選択に応じて名前欄の表示を切り替える */

    var radios =
        area.querySelectorAll(
            'input[name="surveyNameMode"]'
        );

    radios.forEach(function (radio) {

        radio.addEventListener(
            "change",
            function () {

                updateChoiceStyle(area);

                var input = el("surveyNameInputArea");

                if (input) {

                    input.style.display =
                        (selectedNameMode() === "named")
                            ? "block"
                            : "none";

                }

            }
        );

    });


    updateChoiceStyle(area);


    var nameInputArea = el("surveyNameInputArea");

    if (nameInputArea) {

        nameInputArea.style.display =
            (selectedNameMode() === "named")
                ? "block"
                : "none";

    }

}


function selectedNameMode() {

    var checked =
        document.querySelector(
            'input[name="surveyNameMode"]:checked'
        );

    if (checked) {
        return checked.value;
    }


    var hidden =
        document.querySelector(
            'input[type="hidden"][name="surveyNameMode"]'
        );

    if (hidden) {
        return hidden.value;
    }


    return "anonymous";

}


/* ==================================================
   選ばれている項目に色を付ける

   高齢の方でも「どれを選んだか」が
   ひと目で分かるようにするため。
================================================== */

function updateChoiceStyle(scope) {

    var choices =
        (scope || document).querySelectorAll(
            ".survey-choice"
        );

    choices.forEach(function (choice) {

        var input = choice.querySelector("input");

        if (!input) {
            return;
        }

        if (input.checked) {

            choice.classList.add("selected");

        }
        else {

            choice.classList.remove("selected");

        }

    });

}


/* ==================================================
   設問の読み込み
================================================== */

async function loadQuestions(surveyId) {

    var container = el("surveyQuestions");

    container.innerHTML =
        '<div class="tool-loading">読み込み中...</div>';


    try {

        var result =
            await window.supabaseClient
                .from("survey_questions")
                .select(
                    "id, question_text, question_type, " +
                    "options, is_required, display_order"
                )
                .eq("survey_id", surveyId)
                .order("display_order", { ascending: true });


        if (result.error) {
            throw result.error;
        }


        currentQuestions = result.data || [];


        if (currentQuestions.length === 0) {

            container.innerHTML =
                '<div class="tool-empty">' +
                '設問が登録されていません。' +
                '</div>';

            return;

        }


        container.innerHTML =
            currentQuestions.map(renderQuestion).join("");


        /* 選択の見た目を更新する */

        container.addEventListener(
            "change",
            function () {
                updateChoiceStyle(container);
            }
        );


    }
    catch (error) {

        console.error("設問取得エラー:", error);

        container.innerHTML =
            '<div class="tool-error">' +
            '設問を読み込めませんでした。' +
            '</div>';

    }

}


/* ==================================================
   設問1問分の描画
================================================== */

function renderQuestion(question, index) {

    var required =
        question.is_required
            ? '<span class="survey-required">必須</span>'
            : '';


    var head =
        '<div class="survey-question" ' +
        'data-question-id="' + esc(question.id) + '">' +

        '<div class="survey-question-text">' +
        (index + 1) + '. ' +
        esc(question.question_text) +
        required +
        '</div>';


    var body = "";

    var options =
        Array.isArray(question.options)
            ? question.options
            : [];


    if (question.question_type === "text") {

        body =
            '<textarea class="tool-textarea" ' +
            'data-answer="text" ' +
            'placeholder="ご自由にお書きください"></textarea>';

    }
    else if (question.question_type === "multiple") {

        body =
            options.map(function (option, i) {

                return (
                    '<label class="survey-choice">' +
                    '<input type="checkbox" ' +
                    'data-answer="multiple" ' +
                    'value="' + esc(option) + '">' +
                    '<span>' + esc(option) + '</span>' +
                    '</label>'
                );

            }).join("");

    }
    else if (question.question_type === "scale5") {

        var labels =
            options.length === 5
                ? options
                : [
                      "1 まったくそう思わない",
                      "2 あまりそう思わない",
                      "3 どちらともいえない",
                      "4 ややそう思う",
                      "5 とてもそう思う"
                  ];


        body =
            labels.map(function (label, i) {

                return (
                    '<label class="survey-choice">' +
                    '<input type="radio" ' +
                    'name="q_' + esc(question.id) + '" ' +
                    'data-answer="single" ' +
                    'value="' + esc(label) + '">' +
                    '<span>' + esc(label) + '</span>' +
                    '</label>'
                );

            }).join("");

    }
    else {

        /* single（既定） */

        body =
            options.map(function (option) {

                return (
                    '<label class="survey-choice">' +
                    '<input type="radio" ' +
                    'name="q_' + esc(question.id) + '" ' +
                    'data-answer="single" ' +
                    'value="' + esc(option) + '">' +
                    '<span>' + esc(option) + '</span>' +
                    '</label>'
                );

            }).join("");


        if (options.length === 0) {

            body =
                '<textarea class="tool-textarea" ' +
                'data-answer="text" ' +
                'placeholder="ご自由にお書きください"></textarea>';

        }

    }


    return head + body + '</div>';

}


/* ==================================================
   入力内容の取り出しと確認
================================================== */

function collectAnswers() {

    var answers = [];

    var missing = [];


    var blocks =
        document.querySelectorAll(
            "#surveyQuestions .survey-question"
        );


    blocks.forEach(function (block, index) {

        var questionId =
            block.getAttribute("data-question-id");

        var question =
            currentQuestions.filter(function (item) {
                return item.id === questionId;
            })[0];

        if (!question) {
            return;
        }


        var answerText = null;

        var answerValues = [];


        var textInput =
            block.querySelector('[data-answer="text"]');

        if (textInput) {

            answerText = textInput.value.trim();

        }


        var radio =
            block.querySelector(
                '[data-answer="single"]:checked'
            );

        if (radio) {

            answerValues = [radio.value];

        }


        var checks =
            block.querySelectorAll(
                '[data-answer="multiple"]:checked'
            );

        if (checks.length > 0) {

            answerValues = Array.prototype.map.call(
                checks,
                function (item) {
                    return item.value;
                }
            );

        }


        var isEmpty =
            (!answerText || answerText === "") &&
            answerValues.length === 0;


        if (question.is_required && isEmpty) {

            missing.push(index + 1);

        }


        if (!isEmpty) {

            answers.push({
                question_id: questionId,
                answer_text: answerText || null,
                answer_values: answerValues
            });

        }

    });


    return {
        answers: answers,
        missing: missing
    };

}


/* ==================================================
   送信
================================================== */

async function submitSurvey() {

    if (!currentSurvey) {
        return;
    }


    var message = el("surveyMessage");

    var button = el("surveySubmitButton");


    var collected = collectAnswers();


    if (collected.missing.length > 0) {

        message.innerHTML =
            '<div class="tool-message tool-message-ng">' +
            '必須の設問に回答してください。<br>' +
            '（設問 ' + collected.missing.join("・") + '）' +
            '</div>';

        window.scrollTo(0, 0);

        return;

    }


    if (collected.answers.length === 0) {

        message.innerHTML =
            '<div class="tool-message tool-message-ng">' +
            '回答が入力されていません。' +
            '</div>';

        return;

    }


    var mode = selectedNameMode();

    var isAnonymous = (mode !== "named");


    var nameInput = el("surveyRespondentName");

    var name =
        nameInput ? nameInput.value.trim() : "";


    if (!isAnonymous && name === "") {

        message.innerHTML =
            '<div class="tool-message tool-message-ng">' +
            'お名前を入力してください。<br>' +
            '匿名で回答する場合は「匿名で回答する」を選んでください。' +
            '</div>';

        window.scrollTo(0, 0);

        return;

    }


    var user = window.IwaseCommunity.currentUser();


    button.disabled = true;

    button.textContent = "送信中...";

    message.innerHTML = "";


    try {

        var result =
            await window.supabaseClient.rpc(
                "submit_survey_response",
                {
                    p_survey_id: currentSurvey.id,

                    p_participant_id:
                        (user && user.id) ? user.id : null,

                    p_name: isAnonymous ? null : name,

                    p_is_anonymous: isAnonymous,

                    p_client_key:
                        window.IwaseCommunity.clientKey(),

                    p_answers: collected.answers
                }
            );


        if (result.error) {
            throw result.error;
        }


        addAnswered(currentSurvey.id);


        message.innerHTML =
            '<div class="tool-message tool-message-ok">' +
            'ご回答ありがとうございました。<br>' +
            '回答を受け付けました。' +
            '</div>';


        button.textContent = "送信しました";


        window.scrollTo(0, 0);


    }
    catch (error) {

        console.error("アンケート送信エラー:", error);


        var text =
            (error && error.message)
                ? error.message
                : "送信できませんでした。";


        /*
         * すでに回答済みの場合は、
         * 端末側にも記録しておく。
         */

        if (text.indexOf("回答済み") !== -1) {

            addAnswered(currentSurvey.id);

        }


        message.innerHTML =
            '<div class="tool-message tool-message-ng">' +
            esc(text) +
            '</div>';


        button.disabled = false;

        button.textContent = "回答を送信する";


        window.scrollTo(0, 0);

    }

}


/* ==================================================
   一覧へ戻る
================================================== */

function backToList() {

    currentSurvey = null;

    el("surveyFormArea").style.display = "none";

    el("surveyListArea").style.display = "block";

    window.scrollTo(0, 0);

    loadSurveys();

}


/* ==================================================
   起動
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        /* 会員向けの機能 */

        await window.IwaseIdentity.load();

        if (!window.IwaseCommunity.requireMember()) {

            return;

        }


        el("surveySubmitButton")
            .addEventListener("click", submitSurvey);

        el("surveyBackButton")
            .addEventListener("click", backToList);

        loadSurveys();

    }
);

})();

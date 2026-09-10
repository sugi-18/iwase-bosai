/* ==================================================
   岩瀬自治会 防災アプリ
   管理者画面 追加分

   ・アンケートの作成・集計
   ・自治会掲示板の管理
   ・岩瀬地区防災計画の画像と関連資料
   ・リンク集のオリジナルコンテンツ

   方針

     既存の admin.js / content-admin.js には手を入れず、
     このファイルだけで完結させている。
     関数名の衝突を避けるため全体をIIFEで囲む。

     Supabaseクライアントは admin.js が用意した
     adminSupabaseClient を使う。
================================================== */

(function () {

"use strict";


/* ==================================================
   設定
================================================== */

/* 画像を置くストレージ。既存の掲載コンテンツと同じ場所 */

const CONTENT_BUCKET = "site-content";


/* 地区防災計画は site_contents の1行として扱う */

const PLAN_CONTENT_TYPE = "district_plan";


const QUESTION_TYPES = [

    {
        value: "single",
        label: "単一選択（1つだけ選ぶ）"
    },

    {
        value: "multiple",
        label: "複数選択（いくつでも選ぶ）"
    },

    {
        value: "text",
        label: "自由記述"
    },

    {
        value: "scale5",
        label: "5段階評価"
    }

];


const SCALE5_DEFAULT = [

    "1 まったくそう思わない",
    "2 あまりそう思わない",
    "3 どちらともいえない",
    "4 ややそう思う",
    "5 とてもそう思う"

];


const CATEGORY_LABEL = {

    normal: "ふだんの交流",

    info:   "おしらせ",

    damage: "被害報告"

};


/* ==================================================
   状態
================================================== */

/* 編集中のアンケート */

let editingSurvey = null;

/* 編集中の設問（画面上の並び順そのまま） */

let editingQuestions = [];

/* 編集開始時点の設問ID。消された設問を判定するために持つ */

let originalQuestionIds = [];

/* 集計中のアンケート */

let resultSurvey = null;

let resultRows = [];


/* ==================================================
   小さな道具
================================================== */

function getClient() {

    if (
        typeof adminSupabaseClient !== "undefined" &&
        adminSupabaseClient
    ) {

        return adminSupabaseClient;

    }

    console.error("Supabaseクライアントを利用できません。");

    return null;

}


function el(id) {

    return document.getElementById(id);

}


function esc(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

}


const WEEK_DAYS = ["日", "月", "火", "水", "木", "金", "土"];


function fmtDate(value) {

    if (!value) {
        return "";
    }

    const parts =
        String(value).split("T")[0].split("-");

    if (parts.length !== 3) {
        return String(value);
    }

    const date =
        new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            Number(parts[2])
        );

    const week =
        isNaN(date.getTime())
            ? ""
            : "(" + WEEK_DAYS[date.getDay()] + ")";

    return (
        Number(parts[0]) + "年" +
        Number(parts[1]) + "月" +
        Number(parts[2]) + "日" +
        week
    );

}


function fmtDateTime(value) {

    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return String(value);
    }

    try {

        return date.toLocaleString(
            "ja-JP",
            {
                timeZone: "Asia/Tokyo",
                year:   "numeric",
                month:  "2-digit",
                day:    "2-digit",
                hour:   "2-digit",
                minute: "2-digit"
            }
        );

    }
    catch (error) {

        return date.toLocaleString();

    }

}


function showMessage(containerId, text, isError) {

    const container = el(containerId);

    if (!container) {
        return;
    }

    if (!text) {

        container.innerHTML = "";

        return;

    }

    container.innerHTML =
        '<div class="cm-message ' +
        (isError ? "cm-message-ng" : "cm-message-ok") +
        '">' + esc(text) + '</div>';

}


function today() {

    return new Date().toISOString().slice(0, 10);

}


/* ==================================================
   初期化
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupSurveyAdmin();

        setupBoardAdmin();

        setupCustomContentAdmin();

        setupChecklistAdmin();

        setupPinResetAdmin();

        setupMemberTypeAdmin();

        setupUsageAdmin();

    }
);


function onNavClick(target, handler) {

    const button =
        document.querySelector(
            '[data-target="' + target + '"]'
        );

    if (!button) {
        return;
    }

    button.addEventListener("click", handler);

}


/* ==================================================
   ==================================================
   アンケート管理
   ==================================================
================================================== */

function setupSurveyAdmin() {

    onNavClick(
        "surveyAdminSection",
        async () => {

            closeSurveyEditor();

            closeSurveyResult();

            await loadSurveys();

        }
    );


    el("addSurveyButton")
        ?.addEventListener(
            "click",
            () => {
                openSurveyEditor(null);
            }
        );


    el("addQuestionButton")
        ?.addEventListener(
            "click",
            () => {
                addQuestion();
            }
        );


    el("saveSurveyButton")
        ?.addEventListener("click", saveSurvey);


    el("cancelSurveyButton")
        ?.addEventListener(
            "click",
            () => {

                closeSurveyEditor();

                loadSurveys();

            }
        );


    el("closeSurveyResultButton")
        ?.addEventListener(
            "click",
            () => {

                closeSurveyResult();

                loadSurveys();

            }
        );


    el("exportSurveyCsvButton")
        ?.addEventListener("click", exportSurveyCsv);

}


/* ==================================================
   アンケート一覧
================================================== */

async function loadSurveys() {

    const container = el("surveyList");

    if (!container || !getClient()) {
        return;
    }


    container.innerHTML = "読み込み中...";


    try {

        const surveyResult =
            await getClient()
                .from("surveys")
                .select("*")
                .order("display_order", { ascending: true })
                .order("created_at", { ascending: false });


        if (surveyResult.error) {
            throw surveyResult.error;
        }


        const surveys = surveyResult.data || [];


        /* 回答数を数える */

        const responseResult =
            await getClient()
                .from("survey_responses")
                .select("survey_id");


        const counts = {};

        (responseResult.data || []).forEach(
            row => {

                counts[row.survey_id] =
                    (counts[row.survey_id] || 0) + 1;

            }
        );


        if (surveys.length === 0) {

            container.innerHTML =
                '<div class="cm-empty">' +
                'アンケートはまだありません。' +
                '「＋ アンケートを作成」から追加してください。' +
                '</div>';

            return;

        }


        container.innerHTML = "";


        surveys.forEach(
            survey => {

                container.appendChild(
                    createSurveyItem(
                        survey,
                        counts[survey.id] || 0
                    )
                );

            }
        );


    }
    catch (error) {

        console.error("アンケート取得エラー:", error);

        container.innerHTML =
            '<div class="cm-message cm-message-ng">' +
            'アンケートを読み込めませんでした。<br>' +
            'sql/03_community.sql を実行済みかご確認ください。' +
            '</div>';

    }

}


function createSurveyItem(survey, responseCount) {

    const item = document.createElement("div");

    item.className = "cm-item";


    const now = today();

    let statusLabel = "非公開";

    let statusClass = "cm-badge";


    if (survey.is_published) {

        if (survey.end_date && now > survey.end_date) {

            statusLabel = "受付終了";

            statusClass = "cm-badge cm-badge-closed";

        }
        else if (survey.start_date && now < survey.start_date) {

            statusLabel = "開始前";

            statusClass = "cm-badge cm-badge-closed";

        }
        else {

            statusLabel = "受付中";

            statusClass = "cm-badge cm-badge-open";

        }

    }


    const period =
        (survey.start_date || survey.end_date)
            ? (
                  (survey.start_date ? fmtDate(survey.start_date) : "") +
                  " 〜 " +
                  (survey.end_date ? fmtDate(survey.end_date) : "")
              )
            : "期間の指定なし";


    item.innerHTML =

        '<div class="cm-item-head">' +
        '<span class="' + statusClass + '">' +
        esc(statusLabel) + '</span>' +
        '<h4 class="cm-item-title">' +
        esc(survey.title) + '</h4>' +
        '</div>' +

        '<p class="cm-item-meta">' +
        '回答数：<strong>' + responseCount + '件</strong>　／　' +
        esc(period) + '<br>' +
        '回答方法：' +
        (survey.allow_named !== false ? "記名可" : "記名不可") +
        '・' +
        (survey.allow_anonymous !== false ? "匿名可" : "匿名不可") +
        '</p>' +

        (
            survey.description
                ? '<div class="cm-item-body">' +
                  esc(survey.description) + '</div>'
                : ''
        );


    const actions = document.createElement("div");

    actions.className = "cm-item-actions";


    actions.appendChild(
        makeButton(
            "集計を見る",
            "view-button",
            () => openSurveyResult(survey)
        )
    );


    actions.appendChild(
        makeButton(
            "編集",
            "edit-button",
            () => openSurveyEditor(survey)
        )
    );


    actions.appendChild(
        makeButton(
            survey.is_published ? "非公開にする" : "公開する",
            "secondary-button",
            () => togglePublishSurvey(survey)
        )
    );


    actions.appendChild(
        makeButton(
            "削除",
            "delete-button",
            () => deleteSurvey(survey, responseCount)
        )
    );


    item.appendChild(actions);


    return item;

}


function makeButton(label, className, handler) {

    const button = document.createElement("button");

    button.type = "button";

    button.className = className;

    button.textContent = label;

    button.addEventListener("click", handler);

    return button;

}


/* ==================================================
   公開・非公開
================================================== */

async function togglePublishSurvey(survey) {

    try {

        const { error } =
            await getClient()
                .from("surveys")
                .update({
                    is_published: !survey.is_published,
                    updated_at: new Date().toISOString()
                })
                .eq("id", survey.id);


        if (error) {
            throw error;
        }


        showMessage(
            "surveyMessage",
            survey.is_published
                ? "非公開にしました。"
                : "公開しました。アプリから回答できます。",
            false
        );


        await loadSurveys();


    }
    catch (error) {

        console.error("公開状態の変更エラー:", error);

        showMessage(
            "surveyMessage",
            "変更できませんでした。",
            true
        );

    }

}


/* ==================================================
   削除
================================================== */

async function deleteSurvey(survey, responseCount) {

    const message =
        responseCount > 0
            ? "「" + survey.title + "」を削除します。\n\n" +
              "回答 " + responseCount + "件もすべて消えます。\n" +
              "元に戻せません。よろしいですか？"
            : "「" + survey.title + "」を削除します。\n" +
              "よろしいですか？";


    if (!window.confirm(message)) {
        return;
    }


    try {

        const { error } =
            await getClient()
                .from("surveys")
                .delete()
                .eq("id", survey.id);


        if (error) {
            throw error;
        }


        showMessage(
            "surveyMessage",
            "削除しました。",
            false
        );


        await loadSurveys();


    }
    catch (error) {

        console.error("アンケート削除エラー:", error);

        showMessage(
            "surveyMessage",
            "削除できませんでした。",
            true
        );

    }

}


/* ==================================================
   編集画面
================================================== */

async function openSurveyEditor(survey) {

    editingSurvey = survey;

    editingQuestions = [];

    originalQuestionIds = [];


    el("surveyListArea").classList.add("hidden");

    el("surveyResultArea").classList.add("hidden");

    el("surveyEditorArea").classList.remove("hidden");


    el("surveyEditorTitle").textContent =
        survey ? "アンケートを編集" : "アンケートを作成";


    el("surveyTitleInput").value =
        survey ? (survey.title || "") : "";

    el("surveyDescriptionInput").value =
        survey ? (survey.description || "") : "";

    el("surveyStartInput").value =
        survey ? (survey.start_date || "") : "";

    el("surveyEndInput").value =
        survey ? (survey.end_date || "") : "";

    el("surveyOrderInput").value =
        survey ? (survey.display_order || 0) : 0;

    el("surveyPublishedInput").checked =
        survey ? !!survey.is_published : false;

    el("surveyAllowNamedInput").checked =
        survey ? (survey.allow_named !== false) : true;

    el("surveyAllowAnonymousInput").checked =
        survey ? (survey.allow_anonymous !== false) : true;


    showMessage("surveyEditorMessage", "", false);


    if (!survey) {

        /* 新規作成のときは1問だけ用意しておく */

        addQuestion();

        return;

    }


    /* 既存の設問を読み込む */

    try {

        const { data, error } =
            await getClient()
                .from("survey_questions")
                .select("*")
                .eq("survey_id", survey.id)
                .order("display_order", { ascending: true });


        if (error) {
            throw error;
        }


        editingQuestions =
            (data || []).map(
                row => ({
                    id: row.id,
                    question_text: row.question_text || "",
                    question_type: row.question_type || "single",
                    options:
                        Array.isArray(row.options)
                            ? row.options
                            : [],
                    is_required: !!row.is_required
                })
            );


        originalQuestionIds =
            editingQuestions.map(q => q.id);


        if (editingQuestions.length === 0) {

            addQuestion();

            return;

        }


        renderQuestions();


    }
    catch (error) {

        console.error("設問取得エラー:", error);

        showMessage(
            "surveyEditorMessage",
            "設問を読み込めませんでした。",
            true
        );

    }

}


function closeSurveyEditor() {

    editingSurvey = null;

    editingQuestions = [];

    originalQuestionIds = [];

    el("surveyEditorArea")?.classList.add("hidden");

    el("surveyListArea")?.classList.remove("hidden");

}


/* ==================================================
   設問の追加・並べ替え
================================================== */

function addQuestion() {

    editingQuestions.push({
        id: null,
        question_text: "",
        question_type: "single",
        options: ["はい", "いいえ"],
        is_required: false
    });

    renderQuestions();

}


function moveQuestion(index, direction) {

    const target = index + direction;

    if (target < 0 || target >= editingQuestions.length) {
        return;
    }

    readQuestionsFromDom();

    const temp = editingQuestions[index];

    editingQuestions[index] = editingQuestions[target];

    editingQuestions[target] = temp;

    renderQuestions();

}


function removeQuestion(index) {

    if (
        !window.confirm(
            "この設問を削除します。\n\n" +
            "既に回答がある設問を削除すると、\n" +
            "その設問への回答も消えます。\n" +
            "よろしいですか？"
        )
    ) {
        return;
    }

    readQuestionsFromDom();

    editingQuestions.splice(index, 1);

    renderQuestions();

}


/* ==================================================
   設問の描画

   入力途中の内容が消えないよう、
   並べ替えや追加の前に必ず
   readQuestionsFromDom() で拾い直す。
================================================== */

function renderQuestions() {

    const container = el("surveyQuestionList");

    if (!container) {
        return;
    }


    container.innerHTML = "";


    editingQuestions.forEach(
        (question, index) => {

            const box = document.createElement("div");

            box.className = "cm-question";

            box.dataset.index = String(index);


            const typeOptions =
                QUESTION_TYPES.map(
                    type =>
                        '<option value="' + type.value + '"' +
                        (
                            question.question_type === type.value
                                ? " selected"
                                : ""
                        ) +
                        '>' + esc(type.label) + '</option>'
                ).join("");


            box.innerHTML =

                '<div class="cm-question-head">' +
                '<span class="cm-question-number">設問 ' +
                (index + 1) + '</span>' +
                '<span class="cm-question-buttons"></span>' +
                '</div>' +

                '<div class="cm-field">' +
                '<label>質問文</label>' +
                '<input type="text" data-field="question_text" ' +
                'value="' + esc(question.question_text) + '" ' +
                'placeholder="例：防災訓練に参加して役に立ちましたか">' +
                '</div>' +

                '<div class="cm-row">' +

                '<div class="cm-field">' +
                '<label>種類</label>' +
                '<select data-field="question_type">' +
                typeOptions +
                '</select>' +
                '</div>' +

                '<div class="cm-field">' +
                '<label>必須にする</label>' +
                '<div class="cm-check">' +
                '<input type="checkbox" data-field="is_required"' +
                (question.is_required ? " checked" : "") + '>' +
                '<span>回答しないと送信できないようにする</span>' +
                '</div>' +
                '</div>' +

                '</div>' +

                '<div class="cm-field" data-options-area>' +
                '<label>選択肢（1行に1つ）</label>' +
                '<textarea data-field="options" ' +
                'placeholder="はい&#10;いいえ">' +
                esc(question.options.join("\n")) +
                '</textarea>' +
                '</div>';


            /* ボタン */

            const buttons =
                box.querySelector(".cm-question-buttons");

            buttons.appendChild(
                makeMiniButton(
                    "↑",
                    () => moveQuestion(index, -1)
                )
            );

            buttons.appendChild(
                makeMiniButton(
                    "↓",
                    () => moveQuestion(index, 1)
                )
            );

            buttons.appendChild(
                makeMiniButton(
                    "削除",
                    () => removeQuestion(index),
                    true
                )
            );


            /* 種類に応じて選択肢欄の出し入れをする */

            const typeSelect =
                box.querySelector('[data-field="question_type"]');

            const optionsArea =
                box.querySelector("[data-options-area]");

            const optionsInput =
                box.querySelector('[data-field="options"]');


            function updateOptionsArea() {

                const value = typeSelect.value;

                if (value === "text") {

                    optionsArea.style.display = "none";

                }
                else if (value === "scale5") {

                    optionsArea.style.display = "block";

                    if (optionsInput.value.trim() === "") {

                        optionsInput.value =
                            SCALE5_DEFAULT.join("\n");

                    }

                }
                else {

                    optionsArea.style.display = "block";

                }

            }


            typeSelect.addEventListener(
                "change",
                updateOptionsArea
            );

            updateOptionsArea();


            container.appendChild(box);

        }
    );

}


function makeMiniButton(label, handler, isDanger) {

    const button = document.createElement("button");

    button.type = "button";

    button.className =
        "cm-mini-button" + (isDanger ? " danger" : "");

    button.textContent = label;

    button.addEventListener("click", handler);

    return button;

}


/* ==================================================
   画面の入力を取り込む
================================================== */

function readQuestionsFromDom() {

    const boxes =
        document.querySelectorAll(
            "#surveyQuestionList .cm-question"
        );


    boxes.forEach(
        box => {

            const index = Number(box.dataset.index);

            const question = editingQuestions[index];

            if (!question) {
                return;
            }


            question.question_text =
                box.querySelector(
                    '[data-field="question_text"]'
                ).value.trim();


            question.question_type =
                box.querySelector(
                    '[data-field="question_type"]'
                ).value;


            question.is_required =
                box.querySelector(
                    '[data-field="is_required"]'
                ).checked;


            const optionsText =
                box.querySelector(
                    '[data-field="options"]'
                ).value;


            question.options =
                optionsText
                    .split("\n")
                    .map(line => line.trim())
                    .filter(line => line !== "");

        }
    );

}


/* ==================================================
   保存
================================================== */

async function saveSurvey() {

    readQuestionsFromDom();


    const title = el("surveyTitleInput").value.trim();


    if (title === "") {

        showMessage(
            "surveyEditorMessage",
            "アンケート名を入力してください。",
            true
        );

        return;

    }


    if (editingQuestions.length === 0) {

        showMessage(
            "surveyEditorMessage",
            "設問を1つ以上作成してください。",
            true
        );

        return;

    }


    for (let i = 0; i < editingQuestions.length; i++) {

        const question = editingQuestions[i];

        if (question.question_text === "") {

            showMessage(
                "surveyEditorMessage",
                "設問 " + (i + 1) + " の質問文を入力してください。",
                true
            );

            return;

        }


        const needsOptions =
            question.question_type === "single" ||
            question.question_type === "multiple";


        if (needsOptions && question.options.length < 2) {

            showMessage(
                "surveyEditorMessage",
                "設問 " + (i + 1) +
                " は選択肢を2つ以上入力してください。",
                true
            );

            return;

        }

    }


    const allowNamed =
        el("surveyAllowNamedInput").checked;

    const allowAnonymous =
        el("surveyAllowAnonymousInput").checked;


    if (!allowNamed && !allowAnonymous) {

        showMessage(
            "surveyEditorMessage",
            "記名・匿名のどちらかは許可してください。",
            true
        );

        return;

    }


    const payload = {

        title: title,

        description:
            el("surveyDescriptionInput").value.trim() || null,

        start_date:
            el("surveyStartInput").value || null,

        end_date:
            el("surveyEndInput").value || null,

        display_order:
            Number(el("surveyOrderInput").value) || 0,

        is_published:
            el("surveyPublishedInput").checked,

        allow_named: allowNamed,

        allow_anonymous: allowAnonymous,

        updated_at: new Date().toISOString()

    };


    const button = el("saveSurveyButton");

    button.disabled = true;

    button.textContent = "保存中...";


    try {

        let surveyId = editingSurvey ? editingSurvey.id : null;


        if (surveyId) {

            const { error } =
                await getClient()
                    .from("surveys")
                    .update(payload)
                    .eq("id", surveyId);

            if (error) {
                throw error;
            }

        }
        else {

            const { data, error } =
                await getClient()
                    .from("surveys")
                    .insert(payload)
                    .select("id")
                    .single();

            if (error) {
                throw error;
            }

            surveyId = data.id;

        }


        /* ---------- 設問 ---------- */

        const keptIds =
            editingQuestions
                .map(q => q.id)
                .filter(id => id);


        const removedIds =
            originalQuestionIds.filter(
                id => keptIds.indexOf(id) === -1
            );


        if (removedIds.length > 0) {

            const { error } =
                await getClient()
                    .from("survey_questions")
                    .delete()
                    .in("id", removedIds);

            if (error) {
                throw error;
            }

        }


        for (let i = 0; i < editingQuestions.length; i++) {

            const question = editingQuestions[i];

            const row = {

                survey_id: surveyId,

                question_text: question.question_text,

                question_type: question.question_type,

                options:
                    question.question_type === "text"
                        ? []
                        : question.options,

                is_required: question.is_required,

                display_order: i

            };


            if (question.id) {

                const { error } =
                    await getClient()
                        .from("survey_questions")
                        .update(row)
                        .eq("id", question.id);

                if (error) {
                    throw error;
                }

            }
            else {

                const { data, error } =
                    await getClient()
                        .from("survey_questions")
                        .insert(row)
                        .select("id")
                        .single();

                if (error) {
                    throw error;
                }

                question.id = data.id;

            }

        }


        closeSurveyEditor();

        showMessage(
            "surveyMessage",
            "保存しました。",
            false
        );

        await loadSurveys();


    }
    catch (error) {

        console.error("アンケート保存エラー:", error);

        showMessage(
            "surveyEditorMessage",
            "保存できませんでした。" +
            (error.message ? "（" + error.message + "）" : ""),
            true
        );

    }
    finally {

        button.disabled = false;

        button.textContent = "保存する";

    }

}


/* ==================================================
   集計
================================================== */

async function openSurveyResult(survey) {

    resultSurvey = survey;

    resultRows = [];


    el("surveyListArea").classList.add("hidden");

    el("surveyEditorArea").classList.add("hidden");

    el("surveyResultArea").classList.remove("hidden");


    el("surveyResultTitle").textContent =
        "集計：" + (survey.title || "");

    el("surveyResultSummary").innerHTML = "読み込み中...";

    el("surveyResultBody").innerHTML = "";


    try {

        const questionResult =
            await getClient()
                .from("survey_questions")
                .select("*")
                .eq("survey_id", survey.id)
                .order("display_order", { ascending: true });

        if (questionResult.error) {
            throw questionResult.error;
        }


        const responseResult =
            await getClient()
                .from("survey_responses")
                .select("*")
                .eq("survey_id", survey.id)
                .order("created_at", { ascending: true });

        if (responseResult.error) {
            throw responseResult.error;
        }


        const questions = questionResult.data || [];

        const responses = responseResult.data || [];


        if (responses.length === 0) {

            el("surveyResultSummary").innerHTML =
                '<div class="cm-empty">' +
                'まだ回答がありません。' +
                '</div>';

            return;

        }


        const responseIds = responses.map(r => r.id);


        const answerResult =
            await getClient()
                .from("survey_answers")
                .select("*")
                .in("response_id", responseIds);

        if (answerResult.error) {
            throw answerResult.error;
        }


        const answers = answerResult.data || [];


        renderSurveyResult(
            survey,
            questions,
            responses,
            answers
        );


        /* CSV用に保持しておく */

        resultRows = {
            questions: questions,
            responses: responses,
            answers: answers
        };


    }
    catch (error) {

        console.error("集計取得エラー:", error);

        el("surveyResultSummary").innerHTML =
            '<div class="cm-message cm-message-ng">' +
            '集計を読み込めませんでした。' +
            '</div>';

    }

}


function closeSurveyResult() {

    resultSurvey = null;

    resultRows = [];

    el("surveyResultArea")?.classList.add("hidden");

    el("surveyListArea")?.classList.remove("hidden");

}


function renderSurveyResult(survey, questions, responses, answers) {

    /* ---------- 概要 ---------- */

    const namedCount =
        responses.filter(r => r.is_anonymous === false).length;


    el("surveyResultSummary").innerHTML =

        '<p class="cm-item-meta">' +
        '回答数：<strong>' + responses.length + '件</strong>　／　' +
        '記名 ' + namedCount + '件・' +
        '匿名 ' + (responses.length - namedCount) + '件<br>' +
        '最初の回答：' +
        esc(fmtDateTime(responses[0].created_at)) + '<br>' +
        '最後の回答：' +
        esc(
            fmtDateTime(
                responses[responses.length - 1].created_at
            )
        ) +
        '</p>';


    /* ---------- 設問ごと ---------- */

    const body = el("surveyResultBody");

    body.innerHTML = "";


    questions.forEach(
        (question, index) => {

            const block = document.createElement("div");

            block.className = "cm-result-question";


            const mine =
                answers.filter(
                    answer => answer.question_id === question.id
                );


            let html =
                '<p class="cm-result-title">' +
                (index + 1) + '. ' +
                esc(question.question_text) +
                '　<span style="font-weight:normal;color:#777;">' +
                '（回答 ' + mine.length + '件）</span>' +
                '</p>';


            if (question.question_type === "text") {

                const texts =
                    mine
                        .map(answer => answer.answer_text)
                        .filter(text => text && text.trim() !== "");


                if (texts.length === 0) {

                    html +=
                        '<p style="color:#777;">回答はありません。</p>';

                }
                else {

                    html +=
                        '<ul class="cm-free-answers">' +
                        texts.map(
                            text => '<li>' + esc(text) + '</li>'
                        ).join("") +
                        '</ul>';

                }

            }
            else {

                /* 選択肢の集計 */

                const counts = {};

                const options =
                    Array.isArray(question.options)
                        ? question.options.slice()
                        : [];


                options.forEach(option => {
                    counts[option] = 0;
                });


                let total = 0;


                mine.forEach(
                    answer => {

                        const values =
                            Array.isArray(answer.answer_values)
                                ? answer.answer_values
                                : [];


                        values.forEach(
                            value => {

                                if (counts[value] === undefined) {

                                    counts[value] = 0;

                                    options.push(value);

                                }

                                counts[value] += 1;

                                total += 1;

                            }
                        );


                        /* 自由記述が混ざっている場合 */

                        if (
                            values.length === 0 &&
                            answer.answer_text
                        ) {

                            const value = answer.answer_text;

                            if (counts[value] === undefined) {

                                counts[value] = 0;

                                options.push(value);

                            }

                            counts[value] += 1;

                            total += 1;

                        }

                    }
                );


                const max =
                    Math.max(
                        1,
                        ...options.map(option => counts[option] || 0)
                    );


                html +=
                    options.map(
                        option => {

                            const count = counts[option] || 0;

                            const width =
                                Math.round((count / max) * 100);

                            const percent =
                                total > 0
                                    ? Math.round((count / total) * 100)
                                    : 0;


                            return (
                                '<div class="cm-bar-row">' +
                                '<div>' + esc(option) + '</div>' +
                                '<div class="cm-bar-track">' +
                                '<div class="cm-bar-fill" ' +
                                'style="width:' + width + '%;"></div>' +
                                '</div>' +
                                '<div class="cm-bar-value">' +
                                count + '件 (' + percent + '%)' +
                                '</div>' +
                                '</div>'
                            );

                        }
                    ).join("");

            }


            block.innerHTML = html;

            body.appendChild(block);

        }
    );

}


/* ==================================================
   CSV出力

   Excelで開いても文字化けしないよう
   先頭にBOMを付ける。
================================================== */

function exportSurveyCsv() {

    if (
        !resultSurvey ||
        !resultRows ||
        !resultRows.questions
    ) {

        window.alert("集計を表示してから実行してください。");

        return;

    }


    const questions = resultRows.questions;

    const responses = resultRows.responses;

    const answers   = resultRows.answers;


    const header = [
        "回答日時",
        "記名/匿名",
        "氏名",
        "参加者ID"
    ].concat(
        questions.map(q => q.question_text)
    );


    const lines = [header];


    responses.forEach(
        response => {

            const row = [

                fmtDateTime(response.created_at),

                response.is_anonymous ? "匿名" : "記名",

                response.respondent_name || "",

                response.participant_id || ""

            ];


            questions.forEach(
                question => {

                    const answer =
                        answers.filter(
                            item =>
                                item.response_id === response.id &&
                                item.question_id === question.id
                        )[0];


                    if (!answer) {

                        row.push("");

                        return;

                    }


                    const values =
                        Array.isArray(answer.answer_values)
                            ? answer.answer_values
                            : [];


                    row.push(
                        values.length > 0
                            ? values.join(" / ")
                            : (answer.answer_text || "")
                    );

                }
            );


            lines.push(row);

        }
    );


    const csv =
        lines.map(
            row =>
                row.map(
                    cell =>
                        '"' +
                        String(cell === null ? "" : cell)
                            .replace(/"/g, '""') +
                        '"'
                ).join(",")
        ).join("\r\n");


    const blob =
        new Blob(
            ["\uFEFF" + csv],
            { type: "text/csv;charset=utf-8;" }
        );


    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);

    link.download =
        "アンケート_" +
        (resultSurvey.title || "回答") +
        "_" +
        today() +
        ".csv";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(link.href);

}


/* ==================================================
   ==================================================
   掲示板管理
   ==================================================
================================================== */

function setupBoardAdmin() {

    onNavClick(
        "boardAdminSection",
        async () => {

            await loadBoardPosts();

        }
    );


    el("boardAdminFilter")
        ?.addEventListener(
            "change",
            () => {
                loadBoardPosts();
            }
        );


    el("refreshBoardButton")
        ?.addEventListener(
            "click",
            () => {
                loadBoardPosts();
            }
        );

}


async function loadBoardPosts() {

    const container = el("boardAdminList");

    if (!container || !getClient()) {
        return;
    }


    container.innerHTML = "読み込み中...";


    const filter =
        el("boardAdminFilter")
            ? el("boardAdminFilter").value
            : "all";


    try {

        let query =
            getClient()
                .from("board_posts")
                .select("*");


        if (filter === "hidden") {

            query = query.eq("is_hidden", true);

        }
        else if (filter !== "all") {

            query = query.eq("category", filter);

        }


        const { data, error } =
            await query
                .order("created_at", { ascending: false })
                .limit(200);


        if (error) {
            throw error;
        }


        const posts = data || [];


        if (posts.length === 0) {

            container.innerHTML =
                '<div class="cm-empty">投稿はありません。</div>';

            return;

        }


        /* コメントもまとめて取得する */

        const commentResult =
            await getClient()
                .from("board_comments")
                .select("*")
                .in("post_id", posts.map(post => post.id))
                .order("created_at", { ascending: true });


        const comments = {};

        (commentResult.data || []).forEach(
            comment => {

                if (!comments[comment.post_id]) {

                    comments[comment.post_id] = [];

                }

                comments[comment.post_id].push(comment);

            }
        );


        container.innerHTML = "";


        posts.forEach(
            post => {

                container.appendChild(
                    createBoardItem(
                        post,
                        comments[post.id] || []
                    )
                );

            }
        );


    }
    catch (error) {

        console.error("投稿取得エラー:", error);

        container.innerHTML =
            '<div class="cm-message cm-message-ng">' +
            '投稿を読み込めませんでした。<br>' +
            'sql/03_community.sql を実行済みかご確認ください。' +
            '</div>';

    }

}


function createBoardItem(post, comments) {

    const item = document.createElement("div");

    item.className = "cm-item";


    let badgeClass = "cm-badge";

    if (post.category === "damage") {

        badgeClass = "cm-badge cm-badge-damage";

    }
    else if (post.category === "info") {

        badgeClass = "cm-badge cm-badge-info";

    }


    item.innerHTML =

        '<div class="cm-item-head">' +
        '<span class="' + badgeClass + '">' +
        esc(CATEGORY_LABEL[post.category] || "投稿") +
        '</span>' +
        (
            post.is_hidden
                ? '<span class="cm-badge cm-badge-hidden">非表示中</span>'
                : ''
        ) +
        '<h4 class="cm-item-title">' +
        esc(post.display_name) + '</h4>' +
        '</div>' +

        '<p class="cm-item-meta">' +
        esc(fmtDateTime(post.created_at)) +
        '　／　いいね ' + (post.like_count || 0) + '件' +
        (
            post.participant_id
                ? '<br>参加者ID：' + esc(post.participant_id)
                : ''
        ) +
        '</p>' +

        '<div class="cm-item-body">' +
        esc(post.body) +
        '</div>';


    const actions = document.createElement("div");

    actions.className = "cm-item-actions";


    actions.appendChild(
        makeButton(
            post.is_hidden ? "表示に戻す" : "非表示にする",
            "secondary-button",
            () => toggleHiddenPost(post)
        )
    );


    actions.appendChild(
        makeButton(
            "削除",
            "delete-button",
            () => deleteBoardPost(post)
        )
    );


    item.appendChild(actions);


    /* ---------- 返信 ---------- */

    const list = comments || [];


    if (list.length > 0) {

        const wrapper = document.createElement("div");

        wrapper.className = "cm-comment-list";


        const heading = document.createElement("p");

        heading.className = "cm-comment-heading";

        heading.textContent =
            "返信 " + list.length + "件";

        wrapper.appendChild(heading);


        list.forEach(
            comment => {

                const box = document.createElement("div");

                box.className = "cm-comment";


                box.innerHTML =

                    '<div class="cm-comment-head">' +
                    '<strong>' +
                    esc(comment.display_name) +
                    '</strong>' +
                    '<span>' +
                    esc(fmtDateTime(comment.created_at)) +
                    '</span>' +
                    (
                        comment.is_hidden
                            ? '<span class="cm-badge cm-badge-hidden">' +
                              '非表示中</span>'
                            : ''
                    ) +
                    '</div>' +

                    '<div class="cm-comment-body">' +
                    esc(comment.body) +
                    '</div>';


                const commentActions =
                    document.createElement("div");

                commentActions.className = "cm-item-actions";


                commentActions.appendChild(
                    makeButton(
                        comment.is_hidden
                            ? "表示に戻す"
                            : "非表示にする",
                        "secondary-button",
                        () => toggleHiddenComment(comment)
                    )
                );


                commentActions.appendChild(
                    makeButton(
                        "削除",
                        "delete-button",
                        () => deleteBoardComment(comment)
                    )
                );


                box.appendChild(commentActions);

                wrapper.appendChild(box);

            }
        );


        item.appendChild(wrapper);

    }


    return item;

}


/* ==================================================
   返信の非表示・削除
================================================== */

async function toggleHiddenComment(comment) {

    try {

        const { data, error } =
            await getClient()
                .from("board_comments")
                .update({ is_hidden: !comment.is_hidden })
                .eq("id", comment.id)
                .select("id");


        if (error) {
            throw error;
        }


        if (!data || data.length === 0) {

            throw new Error(
                "権限設定により更新できませんでした。"
            );

        }


        await loadBoardPosts();


    }
    catch (error) {

        console.error("返信の表示切替エラー:", error);

        showMessage(
            "boardAdminMessage",
            "変更できませんでした。" +
            (error.message ? "（" + error.message + "）" : ""),
            true
        );

    }

}


async function deleteBoardComment(comment) {

    if (
        !window.confirm(
            "この返信を削除します。\n元に戻せません。\n\n" +
            "よろしいですか？"
        )
    ) {
        return;
    }


    try {

        const { error } =
            await getClient()
                .from("board_comments")
                .delete()
                .eq("id", comment.id);


        if (error) {
            throw error;
        }


        showMessage(
            "boardAdminMessage",
            "返信を削除しました。",
            false
        );


        await loadBoardPosts();


    }
    catch (error) {

        console.error("返信削除エラー:", error);

        showMessage(
            "boardAdminMessage",
            "削除できませんでした。",
            true
        );

    }

}


async function toggleHiddenPost(post) {

    try {

        const { error } =
            await getClient()
                .from("board_posts")
                .update({ is_hidden: !post.is_hidden })
                .eq("id", post.id);


        if (error) {
            throw error;
        }


        showMessage(
            "boardAdminMessage",
            post.is_hidden
                ? "表示に戻しました。"
                : "非表示にしました。アプリからは見えません。",
            false
        );


        await loadBoardPosts();


    }
    catch (error) {

        console.error("投稿の表示切替エラー:", error);

        showMessage(
            "boardAdminMessage",
            "変更できませんでした。",
            true
        );

    }

}


async function deleteBoardPost(post) {

    if (
        !window.confirm(
            "この投稿を削除します。\n元に戻せません。\n\n" +
            "よろしいですか？"
        )
    ) {
        return;
    }


    try {

        const { error } =
            await getClient()
                .from("board_posts")
                .delete()
                .eq("id", post.id);


        if (error) {
            throw error;
        }


        showMessage(
            "boardAdminMessage",
            "削除しました。",
            false
        );


        await loadBoardPosts();


    }
    catch (error) {

        console.error("投稿削除エラー:", error);

        showMessage(
            "boardAdminMessage",
            "削除できませんでした。",
            true
        );

    }

}


/* ==================================================
   ==================================================
   地区防災計画・オリジナルコンテンツ
   ==================================================
================================================== */

let editingCustomContent = null;

let editingCustomCategory = "original";


function setupCustomContentAdmin() {

    onNavClick(
        "customContentSection",
        async () => {

            closeCustomEditor();

            await loadPlanAssets();

            await loadCustomContents();

        }
    );


    el("addPlanDocButton")
        ?.addEventListener(
            "click",
            () => {
                openCustomEditor(null, "district_plan");
            }
        );


    el("addOriginalButton")
        ?.addEventListener(
            "click",
            () => {
                openCustomEditor(null, "original");
            }
        );


    el("saveCustomButton")
        ?.addEventListener("click", saveCustomContent);


    el("cancelCustomButton")
        ?.addEventListener("click", closeCustomEditor);

}


/* ==================================================
   地区防災計画（表紙とPDF）

   計画は1つのPDFにまとまっているので、
   写真を何枚も並べる作りはやめている。

   PDFは外部リンクではなくファイルとして置く。
   アプリ側がファイルとして取り込めるため、
   一度開けば通信が無くても読める。
================================================== */

async function loadPlanAssets() {

    const container = el("planPdfArea");

    if (!container || !getClient()) {
        return;
    }


    container.innerHTML = "読み込み中...";


    try {

        const { data, error } =
            await getClient()
                .from("site_contents")
                .select("*")
                .eq("content_type", PLAN_CONTENT_TYPE)
                .maybeSingle();


        if (error) {
            throw error;
        }


        const row = data || {};


        container.innerHTML = "";

        container.appendChild(createCoverSlot(row));

        container.appendChild(createPdfSlot(row));


    }
    catch (error) {

        console.error("地区防災計画の取得エラー:", error);

        container.innerHTML =
            '<div class="cm-message cm-message-ng">' +
            '読み込めませんでした。<br>' +
            'sql/08_district_plan_pdf.sql を' +
            '実行済みかご確認ください。' +
            '</div>';

    }

}


/* ---------- 表紙の画像 ---------- */

function createCoverSlot(row) {

    const slot = document.createElement("div");

    slot.className = "cm-image-slot";


    const url = row.image1_url;


    slot.innerHTML =
        '<p style="font-weight:bold;margin:0 0 10px;">' +
        '表紙の画像</p>' +
        (
            url
                ? '<img src="' + esc(url) + '" alt="表紙">'
                : '<div class="cm-image-empty">' +
                  '未登録<br>（PDFの1ページ目を' +
                  '画像にしたものが分かりやすいです）' +
                  '</div>'
        );


    const input = document.createElement("input");

    input.type = "file";

    input.accept = "image/*";

    input.style.width = "100%";

    input.addEventListener(
        "change",
        async event => {

            const file = event.target.files[0];

            if (file) {

                await uploadPlanCover(file);

            }

        }
    );


    slot.appendChild(input);


    if (url) {

        const remove =
            makeButton(
                "表紙を削除",
                "delete-button",
                () => deletePlanFile("image1_url", url)
            );

        remove.style.marginTop = "10px";

        slot.appendChild(remove);

    }


    return slot;

}


/* ---------- PDF本体 ---------- */

function createPdfSlot(row) {

    const slot = document.createElement("div");

    slot.className = "cm-image-slot";


    const url = row.pdf_url;


    slot.innerHTML =
        '<p style="font-weight:bold;margin:0 0 10px;">' +
        '計画のPDF</p>' +
        (
            url
                ? '<div class="cm-image-empty" ' +
                  'style="color:#2e7d32;background:#e8f5e9;">' +
                  '登録済み<br>' +
                  esc(row.pdf_name || "plan.pdf") +
                  (
                      row.pdf_updated_at
                          ? '<br>' +
                            esc(fmtDateTime(row.pdf_updated_at))
                          : ''
                  ) +
                  '</div>'
                : '<div class="cm-image-empty">未登録</div>'
        );


    if (url) {

        const link = document.createElement("a");

        link.href = url;

        link.target = "_blank";

        link.rel = "noopener";

        link.className = "action-button view-button";

        link.textContent = "PDFを確認する";

        link.style.display = "inline-block";

        link.style.marginBottom = "10px";

        slot.appendChild(link);

    }


    const input = document.createElement("input");

    input.type = "file";

    input.accept = "application/pdf,.pdf";

    input.style.width = "100%";

    input.addEventListener(
        "change",
        async event => {

            const file = event.target.files[0];

            if (file) {

                await uploadPlanPdf(file);

            }

        }
    );


    slot.appendChild(input);


    if (url) {

        const remove =
            makeButton(
                "PDFを削除",
                "delete-button",
                () => deletePlanFile("pdf_url", url)
            );

        remove.style.marginTop = "10px";

        slot.appendChild(remove);

    }


    return slot;

}


function getFileExtension(name) {

    const parts = String(name).split(".");

    if (parts.length < 2) {
        return "jpg";
    }

    return parts.pop().toLowerCase();

}


/* ==================================================
   site_contents への書き込み

   行が無ければ作る。
================================================== */

async function savePlanColumns(values) {

    const existing =
        await getClient()
            .from("site_contents")
            .select("id")
            .eq("content_type", PLAN_CONTENT_TYPE)
            .maybeSingle();


    if (existing.data && existing.data.id) {

        const { error } =
            await getClient()
                .from("site_contents")
                .update(
                    Object.assign(
                        {},
                        values,
                        { updated_at: new Date().toISOString() }
                    )
                )
                .eq("id", existing.data.id);

        if (error) {
            throw error;
        }

    }
    else {

        const { error } =
            await getClient()
                .from("site_contents")
                .insert(
                    Object.assign(
                        {},
                        values,
                        { content_type: PLAN_CONTENT_TYPE }
                    )
                );

        if (error) {
            throw error;
        }

    }

}


async function uploadPlanCover(file) {

    showMessage(
        "customContentMessage",
        "表紙をアップロードしています...",
        false
    );


    try {

        const path =
            PLAN_CONTENT_TYPE +
            "/cover_" + Date.now() +
            "." + getFileExtension(file.name);


        const uploadResult =
            await getClient()
                .storage
                .from(CONTENT_BUCKET)
                .upload(
                    path,
                    file,
                    {
                        upsert: false,
                        contentType: file.type
                    }
                );


        if (uploadResult.error) {
            throw uploadResult.error;
        }


        const publicUrl =
            getClient()
                .storage
                .from(CONTENT_BUCKET)
                .getPublicUrl(path)
                .data
                .publicUrl;


        await savePlanColumns({ image1_url: publicUrl });


        showMessage(
            "customContentMessage",
            "表紙を登録しました。",
            false
        );


        await loadPlanAssets();


    }
    catch (error) {

        console.error("表紙のアップロードエラー:", error);

        showMessage(
            "customContentMessage",
            "アップロードできませんでした。" +
            (error.message ? "（" + error.message + "）" : ""),
            true
        );

    }

}


async function uploadPlanPdf(file) {

    if (file.type && file.type.indexOf("pdf") === -1) {

        showMessage(
            "customContentMessage",
            "PDFファイルを選んでください。",
            true
        );

        return;

    }


    /*
     * 大きすぎるPDFは、通信の細い場所で
     * 開けなくなる。目安を出して止める。
     */

    if (file.size > 20 * 1024 * 1024) {

        showMessage(
            "customContentMessage",
            "PDFが大きすぎます（" +
            Math.round(file.size / 1024 / 1024) +
            "MB）。20MB以下にしてください。",
            true
        );

        return;

    }


    showMessage(
        "customContentMessage",
        "PDFをアップロードしています...",
        false
    );


    try {

        const path =
            PLAN_CONTENT_TYPE +
            "/plan_" + Date.now() + ".pdf";


        const uploadResult =
            await getClient()
                .storage
                .from(CONTENT_BUCKET)
                .upload(
                    path,
                    file,
                    {
                        upsert: false,
                        contentType: "application/pdf"
                    }
                );


        if (uploadResult.error) {
            throw uploadResult.error;
        }


        const publicUrl =
            getClient()
                .storage
                .from(CONTENT_BUCKET)
                .getPublicUrl(path)
                .data
                .publicUrl;


        await savePlanColumns({
            pdf_url:        publicUrl,
            pdf_name:       file.name,
            pdf_updated_at: new Date().toISOString()
        });


        showMessage(
            "customContentMessage",
            "PDFを登録しました。" +
            "利用者の端末では、次に画面を開いたときに取り込まれます。",
            false
        );


        await loadPlanAssets();


    }
    catch (error) {

        console.error("PDFのアップロードエラー:", error);

        showMessage(
            "customContentMessage",
            "アップロードできませんでした。" +
            (error.message ? "（" + error.message + "）" : "") +
            " ストレージがPDFを受け付ける設定か" +
            "ご確認ください。",
            true
        );

    }

}


async function deletePlanFile(column, url) {

    const label =
        column === "pdf_url" ? "PDF" : "表紙";


    if (
        !window.confirm(
            label + "を削除します。\nよろしいですか？"
        )
    ) {
        return;
    }


    try {

        /* 保存先のパスを取り出す */

        const marker =
            "/storage/v1/object/public/" +
            CONTENT_BUCKET + "/";

        const index = String(url).indexOf(marker);

        if (index !== -1) {

            const path =
                String(url).slice(index + marker.length);

            await getClient()
                .storage
                .from(CONTENT_BUCKET)
                .remove([decodeURIComponent(path)]);

        }


        const values = {};

        values[column] = null;

        if (column === "pdf_url") {

            values.pdf_name = null;

            values.pdf_updated_at = null;

        }


        await savePlanColumns(values);


        showMessage(
            "customContentMessage",
            label + "を削除しました。",
            false
        );


        await loadPlanAssets();


    }
    catch (error) {

        console.error("削除エラー:", error);

        showMessage(
            "customContentMessage",
            "削除できませんでした。",
            true
        );

    }

}


/* ==================================================
   資料・オリジナルコンテンツの一覧
================================================== */

async function loadCustomContents() {

    if (!getClient()) {
        return;
    }


    const planList = el("planDocList");

    const originalList = el("originalList");


    if (planList) {
        planList.innerHTML = "読み込み中...";
    }

    if (originalList) {
        originalList.innerHTML = "読み込み中...";
    }


    try {

        const { data, error } =
            await getClient()
                .from("custom_contents")
                .select("*")
                .order("display_order", { ascending: true })
                .order("created_at", { ascending: true });


        if (error) {
            throw error;
        }


        const rows = data || [];


        renderCustomList(
            planList,
            rows.filter(
                row => row.category === "district_plan"
            )
        );


        renderCustomList(
            originalList,
            rows.filter(
                row => row.category === "original"
            )
        );


    }
    catch (error) {

        console.error("コンテンツ取得エラー:", error);

        const html =
            '<div class="cm-message cm-message-ng">' +
            '読み込めませんでした。<br>' +
            'sql/03_community.sql を実行済みかご確認ください。' +
            '</div>';

        if (planList) {
            planList.innerHTML = html;
        }

        if (originalList) {
            originalList.innerHTML = html;
        }

    }

}


function renderCustomList(container, rows) {

    if (!container) {
        return;
    }


    if (rows.length === 0) {

        container.innerHTML =
            '<div class="cm-empty">まだ登録されていません。</div>';

        return;

    }


    container.innerHTML = "";


    rows.forEach(
        row => {

            const item = document.createElement("div");

            item.className = "cm-item";


            item.innerHTML =

                '<div class="cm-item-head">' +
                '<span class="cm-badge ' +
                (
                    row.is_published
                        ? "cm-badge-open"
                        : "cm-badge-closed"
                ) +
                '">' +
                (row.is_published ? "公開中" : "非公開") +
                '</span>' +
                '<h4 class="cm-item-title">' +
                esc(row.icon || "📄") + " " +
                esc(row.title) +
                '</h4>' +
                '</div>' +

                (
                    row.description
                        ? '<div class="cm-item-body">' +
                          esc(row.description) + '</div>'
                        : ''
                ) +

                '<p class="cm-item-meta">' +
                '並び順：' + (row.display_order || 0) + '<br>' +
                'URL：' +
                (
                    row.url
                        ? '<a href="' + esc(row.url) +
                          '" target="_blank" rel="noopener">' +
                          esc(row.url) + '</a>'
                        : "（未設定）"
                ) +
                '</p>';


            const actions = document.createElement("div");

            actions.className = "cm-item-actions";


            actions.appendChild(
                makeButton(
                    "編集",
                    "edit-button",
                    () => openCustomEditor(row, row.category)
                )
            );


            actions.appendChild(
                makeButton(
                    row.is_published ? "非公開にする" : "公開する",
                    "secondary-button",
                    () => toggleCustomPublish(row)
                )
            );


            actions.appendChild(
                makeButton(
                    "削除",
                    "delete-button",
                    () => deleteCustomContent(row)
                )
            );


            item.appendChild(actions);

            container.appendChild(item);

        }
    );

}


/* ==================================================
   編集
================================================== */

function openCustomEditor(row, category) {

    editingCustomContent = row;

    editingCustomCategory =
        category || (row ? row.category : "original");


    el("customEditorArea").classList.remove("hidden");


    el("customEditorTitle").textContent =
        (row ? "編集：" : "追加：") +
        (
            editingCustomCategory === "district_plan"
                ? "地区防災計画の資料"
                : "オリジナルコンテンツ"
        );


    el("customTitleInput").value =
        row ? (row.title || "") : "";

    el("customUrlInput").value =
        row ? (row.url || "") : "";

    el("customDescriptionInput").value =
        row ? (row.description || "") : "";

    el("customIconInput").value =
        row ? (row.icon || "📄") : "📄";

    el("customOrderInput").value =
        row ? (row.display_order || 0) : 0;

    el("customPublishedInput").checked =
        row ? !!row.is_published : true;


    showMessage("customEditorMessage", "", false);


    el("customEditorArea")
        .scrollIntoView({ behavior: "smooth", block: "start" });

}


function closeCustomEditor() {

    editingCustomContent = null;

    el("customEditorArea")?.classList.add("hidden");

}


async function saveCustomContent() {

    const title = el("customTitleInput").value.trim();

    const url = el("customUrlInput").value.trim();


    if (title === "") {

        showMessage(
            "customEditorMessage",
            "タイトルを入力してください。",
            true
        );

        return;

    }


    if (url === "") {

        showMessage(
            "customEditorMessage",
            "URLを入力してください。<br>" +
            "GoogleドライブやPDFのURLを貼り付けてください。",
            true
        );

        return;

    }


    const payload = {

        category: editingCustomCategory,

        title: title,

        url: url,

        description:
            el("customDescriptionInput").value.trim() || null,

        icon:
            el("customIconInput").value.trim() || "📄",

        display_order:
            Number(el("customOrderInput").value) || 0,

        is_published:
            el("customPublishedInput").checked,

        updated_at: new Date().toISOString()

    };


    try {

        if (editingCustomContent) {

            const { error } =
                await getClient()
                    .from("custom_contents")
                    .update(payload)
                    .eq("id", editingCustomContent.id);

            if (error) {
                throw error;
            }

        }
        else {

            const { error } =
                await getClient()
                    .from("custom_contents")
                    .insert(payload);

            if (error) {
                throw error;
            }

        }


        closeCustomEditor();

        showMessage(
            "customContentMessage",
            "保存しました。",
            false
        );

        await loadCustomContents();


    }
    catch (error) {

        console.error("コンテンツ保存エラー:", error);

        showMessage(
            "customEditorMessage",
            "保存できませんでした。" +
            (error.message ? "（" + error.message + "）" : ""),
            true
        );

    }

}


async function toggleCustomPublish(row) {

    try {

        const { error } =
            await getClient()
                .from("custom_contents")
                .update({
                    is_published: !row.is_published,
                    updated_at: new Date().toISOString()
                })
                .eq("id", row.id);


        if (error) {
            throw error;
        }


        await loadCustomContents();


    }
    catch (error) {

        console.error("公開状態の変更エラー:", error);

        showMessage(
            "customContentMessage",
            "変更できませんでした。",
            true
        );

    }

}


async function deleteCustomContent(row) {

    if (
        !window.confirm(
            "「" + row.title + "」を削除します。\nよろしいですか？"
        )
    ) {
        return;
    }


    try {

        const { error } =
            await getClient()
                .from("custom_contents")
                .delete()
                .eq("id", row.id);


        if (error) {
            throw error;
        }


        showMessage(
            "customContentMessage",
            "削除しました。",
            false
        );


        await loadCustomContents();


    }
    catch (error) {

        console.error("コンテンツ削除エラー:", error);

        showMessage(
            "customContentMessage",
            "削除できませんでした。",
            true
        );

    }

}



/* ==================================================
   ==================================================
   防災力診断の集計
   ==================================================

   同じ人が何度も実施することを想定している。
   集計には最新の1件だけを使う。

   同一人物の判定は
     ・ログインしている場合は参加者ID
     ・していない場合は端末識別子
   で行う。
================================================== */

let checklistLatest = [];


function setupChecklistAdmin() {

    onNavClick(
        "checklistAdminSection",
        async () => {

            await loadChecklistResults();

        }
    );


    el("refreshChecklistButton")
        ?.addEventListener(
            "click",
            () => {
                loadChecklistResults();
            }
        );


    el("exportChecklistCsvButton")
        ?.addEventListener("click", exportChecklistCsv);

}


async function loadChecklistResults() {

    if (!getClient()) {
        return;
    }


    const summary = el("checklistSummary");

    const list = el("checklistList");


    if (summary) {
        summary.innerHTML = "読み込み中...";
    }

    if (list) {
        list.innerHTML = "読み込み中...";
    }


    try {

        const { data, error } =
            await getClient()
                .from("checklist_results")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(2000);


        if (error) {
            throw error;
        }


        const rows = data || [];


        /* 最新の1件だけを残す */

        const seen = {};

        checklistLatest = [];


        rows.forEach(
            row => {

                const key =
                    row.participant_id ||
                    row.client_key ||
                    row.id;


                if (seen[key]) {
                    return;
                }


                seen[key] = true;

                checklistLatest.push(row);

            }
        );


        renderChecklistSummary(checklistLatest, rows.length);

        renderChecklistCategories(checklistLatest);

        renderChecklistItems(checklistLatest);

        renderChecklistList(checklistLatest);


    }
    catch (error) {

        console.error("診断結果の取得エラー:", error);

        const html =
            '<div class="cm-message cm-message-ng">' +
            '診断結果を読み込めませんでした。<br>' +
            'sql/05_membership_and_checklist.sql を' +
            '実行済みかご確認ください。' +
            '</div>';

        if (summary) {
            summary.innerHTML = html;
        }

        if (list) {
            list.innerHTML = "";
        }

    }

}


/* ==================================================
   概要
================================================== */

function renderChecklistSummary(latest, totalCount) {

    const summary = el("checklistSummary");

    if (!summary) {
        return;
    }


    if (latest.length === 0) {

        summary.innerHTML =
            '<div class="cm-empty">' +
            'まだ診断結果がありません。' +
            '</div>';

        return;

    }


    const average =
        Math.round(
            latest.reduce(
                (sum, row) => sum + (row.total_score || 0),
                0
            ) / latest.length
        );


    const members =
        latest.filter(
            row => row.member_type !== "guest"
        ).length;


    const loggedIn =
        latest.filter(
            row => row.participant_id
        ).length;


    summary.innerHTML =

        '<div class="stats-grid dashboard-stats">' +

        '<div class="stat-card">' +
        '<span class="stat-label">回答者数（最新のみ）</span>' +
        '<div><strong class="stat-value">' +
        latest.length +
        '</strong><span class="stat-unit">人</span></div>' +
        '</div>' +

        '<div class="stat-card">' +
        '<span class="stat-label">平均点</span>' +
        '<div><strong class="stat-value">' +
        average +
        '</strong><span class="stat-unit">点</span></div>' +
        '</div>' +

        '<div class="stat-card">' +
        '<span class="stat-label">自治会員</span>' +
        '<div><strong class="stat-value">' +
        members +
        '</strong><span class="stat-unit">人</span></div>' +
        '</div>' +

        '<div class="stat-card">' +
        '<span class="stat-label">のべ実施回数</span>' +
        '<div><strong class="stat-value">' +
        totalCount +
        '</strong><span class="stat-unit">回</span></div>' +
        '</div>' +

        '</div>' +

        '<p class="cm-item-meta">' +
        'ログインして実施：' + loggedIn + '人　／　' +
        '未ログイン：' + (latest.length - loggedIn) + '人' +
        '</p>';

}


/* ==================================================
   分野別の平均
================================================== */

function renderChecklistCategories(latest) {

    const container = el("checklistCategoryChart");

    if (!container) {
        return;
    }


    if (latest.length === 0) {

        container.innerHTML =
            '<div class="cm-empty">データがありません。</div>';

        return;

    }


    const fields = [

        { key: "score_home",      label: "家の安全" },
        { key: "score_stock",     label: "備蓄" },
        { key: "score_evac",      label: "避難" },
        { key: "score_community", label: "地域" }

    ];


    container.innerHTML =
        fields.map(
            field => {

                const average =
                    Math.round(
                        latest.reduce(
                            (sum, row) =>
                                sum + (row[field.key] || 0),
                            0
                        ) / latest.length
                    );


                return (
                    '<div class="cm-bar-row">' +
                    '<div>' + esc(field.label) + '</div>' +
                    '<div class="cm-bar-track">' +
                    '<div class="cm-bar-fill" style="width:' +
                    average + '%;"></div>' +
                    '</div>' +
                    '<div class="cm-bar-value">' +
                    average + '点</div>' +
                    '</div>'
                );

            }
        ).join("");

}


/* ==================================================
   設問ごとの実施率
================================================== */

function renderChecklistItems(latest) {

    const container = el("checklistItemChart");

    if (!container) {
        return;
    }


    if (latest.length === 0) {

        container.innerHTML =
            '<div class="cm-empty">データがありません。</div>';

        return;

    }


    /*
     * 設問は文言が変わることがあるため、
     * key でまとめ、表示名は最新のものを使う。
     */

    const items = {};

    const order = [];


    latest.forEach(
        row => {

            const answers =
                Array.isArray(row.answers)
                    ? row.answers
                    : [];


            answers.forEach(
                answer => {

                    const key =
                        answer.key || answer.text;

                    if (!key) {
                        return;
                    }


                    if (!items[key]) {

                        items[key] = {
                            label: answer.text || key,
                            total: 0,
                            checked: 0
                        };

                        order.push(key);

                    }


                    items[key].total += 1;

                    if (answer.checked) {

                        items[key].checked += 1;

                    }

                }
            );

        }
    );


    if (order.length === 0) {

        container.innerHTML =
            '<div class="cm-empty">データがありません。</div>';

        return;

    }


    container.innerHTML =
        order.map(
            key => {

                const item = items[key];

                const percent =
                    item.total > 0
                        ? Math.round(
                              (item.checked / item.total) * 100
                          )
                        : 0;


                return (
                    '<div class="cm-bar-row">' +
                    '<div>' + esc(item.label) + '</div>' +
                    '<div class="cm-bar-track">' +
                    '<div class="cm-bar-fill" style="width:' +
                    percent + '%;"></div>' +
                    '</div>' +
                    '<div class="cm-bar-value">' +
                    percent + '% (' + item.checked +
                    '/' + item.total + ')</div>' +
                    '</div>'
                );

            }
        ).join("");

}


/* ==================================================
   回答一覧
================================================== */

function renderChecklistList(latest) {

    const container = el("checklistList");

    if (!container) {
        return;
    }


    if (latest.length === 0) {

        container.innerHTML =
            '<div class="cm-empty">' +
            'まだ診断結果がありません。' +
            '</div>';

        return;

    }


    const sorted =
        latest.slice().sort(
            (a, b) =>
                (b.total_score || 0) - (a.total_score || 0)
        );


    container.innerHTML =
        sorted.map(
            row => {

                const name =
                    row.participant_name ||
                    (
                        row.participant_id
                            ? "（氏名未登録）"
                            : "（未ログイン）"
                    );


                return (
                    '<div class="cm-item">' +

                    '<div class="cm-item-head">' +
                    '<span class="cm-badge ' +
                    (
                        row.member_type === "guest"
                            ? "cm-badge-closed"
                            : "cm-badge-open"
                    ) +
                    '">' +
                    (
                        row.member_type === "guest"
                            ? "会員以外"
                            : "自治会員"
                    ) +
                    '</span>' +
                    '<h4 class="cm-item-title">' +
                    esc(name) +
                    '</h4>' +
                    '</div>' +

                    '<p class="cm-item-meta">' +
                    '総合 <strong>' + (row.total_score || 0) +
                    '点</strong>　／　' +
                    '家の安全 ' + (row.score_home || 0) + '　' +
                    '備蓄 ' + (row.score_stock || 0) + '　' +
                    '避難 ' + (row.score_evac || 0) + '　' +
                    '地域 ' + (row.score_community || 0) + '<br>' +
                    '実施日時：' +
                    esc(fmtDateTime(row.created_at)) +
                    '</p>' +

                    '</div>'
                );

            }
        ).join("");

}


/* ==================================================
   CSV出力
================================================== */

function exportChecklistCsv() {

    if (!checklistLatest || checklistLatest.length === 0) {

        window.alert("集計を表示してから実行してください。");

        return;

    }


    /* 設問の並びを最新の回答から作る */

    const keys = [];

    const labels = {};


    checklistLatest.forEach(
        row => {

            (Array.isArray(row.answers) ? row.answers : [])
                .forEach(
                    answer => {

                        const key =
                            answer.key || answer.text;

                        if (!key) {
                            return;
                        }

                        if (keys.indexOf(key) === -1) {

                            keys.push(key);

                            labels[key] =
                                answer.text || key;

                        }

                    }
                );

        }
    );


    const header = [
        "実施日時",
        "氏名",
        "会員区分",
        "参加者ID",
        "総合点",
        "家の安全",
        "備蓄",
        "避難",
        "地域"
    ].concat(
        keys.map(key => labels[key])
    );


    const lines = [header];


    checklistLatest.forEach(
        row => {

            const answers = {};

            (Array.isArray(row.answers) ? row.answers : [])
                .forEach(
                    answer => {

                        answers[answer.key || answer.text] =
                            answer.checked ? "○" : "";

                    }
                );


            lines.push(
                [
                    fmtDateTime(row.created_at),
                    row.participant_name || "",
                    row.member_type === "guest"
                        ? "会員以外"
                        : "自治会員",
                    row.participant_id || "",
                    row.total_score || 0,
                    row.score_home || 0,
                    row.score_stock || 0,
                    row.score_evac || 0,
                    row.score_community || 0
                ].concat(
                    keys.map(key => answers[key] || "")
                )
            );

        }
    );


    const csv =
        lines.map(
            row =>
                row.map(
                    cell =>
                        '"' +
                        String(cell === null ? "" : cell)
                            .replace(/"/g, '""') +
                        '"'
                ).join(",")
        ).join("\r\n");


    const blob =
        new Blob(
            ["\uFEFF" + csv],
            { type: "text/csv;charset=utf-8;" }
        );


    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);

    link.download =
        "防災力診断_" + today() + ".csv";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(link.href);

}




/* ==================================================
   ==================================================
   暗証番号の再設定
   ==================================================

   元の番号を調べる機能ではない。再設定のみ。

   参加者IDは変えないため、
   スタンプや訓練参加記録はそのまま残る。
================================================== */

let pinResetTarget = null;


function setupPinResetAdmin() {

    onNavClick(
        "pinResetSection",
        async () => {

            closePinResetEditor();

            await loadPinResetLogs();

        }
    );


    el("pinSearchButton")
        ?.addEventListener("click", searchParticipants);


    el("pinSearchInput")
        ?.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    searchParticipants();

                }

            }
        );


    el("pinResetButton")
        ?.addEventListener("click", resetParticipantPin);


    el("pinResetCancelButton")
        ?.addEventListener("click", closePinResetEditor);


    el("pinLogRefreshButton")
        ?.addEventListener(
            "click",
            () => {
                loadPinResetLogs();
            }
        );

}


/* ==================================================
   対象者を探す
================================================== */

async function searchParticipants() {

    const container = el("pinSearchResult");

    if (!container || !getClient()) {
        return;
    }


    const keyword =
        (el("pinSearchInput")?.value || "").trim();


    container.innerHTML = "検索中...";

    showMessage("pinResetMessage", "", false);


    try {

        let query =
            getClient()
                .from("participants")
                .select(
                    "id, participant_id, name, " +
                    "member_type, created_at"
                );


        if (keyword !== "") {

            query = query.ilike("name", "%" + keyword + "%");

        }


        const { data, error } =
            await query
                .order("created_at", { ascending: false })
                .limit(50);


        if (error) {
            throw error;
        }


        const rows = data || [];


        if (rows.length === 0) {

            container.innerHTML =
                '<div class="cm-empty">' +
                '該当する方が見つかりませんでした。' +
                '</div>';

            return;

        }


        container.innerHTML = "";


        rows.forEach(
            row => {

                const item = document.createElement("div");

                item.className = "cm-item";


                item.innerHTML =

                    '<div class="cm-item-head">' +
                    '<span class="cm-badge ' +
                    (
                        row.member_type === "guest"
                            ? "cm-badge-closed"
                            : "cm-badge-open"
                    ) +
                    '">' +
                    (
                        row.member_type === "guest"
                            ? "会員以外"
                            : "自治会員"
                    ) +
                    '</span>' +
                    '<h4 class="cm-item-title">' +
                    esc(row.name) +
                    '</h4>' +
                    '</div>' +

                    '<p class="cm-item-meta">' +
                    '登録日：' +
                    esc(fmtDateTime(row.created_at)) + '<br>' +
                    '参加者ID：' +
                    '<span style="font-size:12px;">' +
                    esc(row.participant_id || row.id) +
                    '</span>' +
                    '</p>';


                const actions = document.createElement("div");

                actions.className = "cm-item-actions";

                actions.appendChild(
                    makeButton(
                        "この方の暗証番号を再設定",
                        "edit-button",
                        () => openPinResetEditor(row)
                    )
                );


                item.appendChild(actions);

                container.appendChild(item);

            }
        );


    }
    catch (error) {

        console.error("参加者検索エラー:", error);

        container.innerHTML =
            '<div class="cm-message cm-message-ng">' +
            '検索できませんでした。' +
            '</div>';

    }

}


/* ==================================================
   再設定画面
================================================== */

function openPinResetEditor(row) {

    pinResetTarget = row;


    el("pinResetEditor").classList.remove("hidden");


    el("pinResetTarget").textContent =
        "再設定：" + (row.name || "");


    el("pinNewInput").value = "";

    el("pinNewConfirmInput").value = "";

    el("pinNoteInput").value = "";


    showMessage("pinResetEditorMessage", "", false);


    el("pinResetEditor")
        .scrollIntoView({ behavior: "smooth", block: "start" });


    el("pinNewInput").focus();

}


function closePinResetEditor() {

    pinResetTarget = null;

    el("pinResetEditor")?.classList.add("hidden");

}


/* ==================================================
   再設定の実行
================================================== */

async function resetParticipantPin() {

    if (!pinResetTarget) {

        return;

    }


    const pin =
        (el("pinNewInput").value || "").trim();

    const confirmPin =
        (el("pinNewConfirmInput").value || "").trim();

    const note =
        (el("pinNoteInput").value || "").trim();


    if (!/^[0-9]{4}$/.test(pin)) {

        showMessage(
            "pinResetEditorMessage",
            "暗証番号は数字4桁で入力してください。",
            true
        );

        return;

    }


    if (pin !== confirmPin) {

        showMessage(
            "pinResetEditorMessage",
            "確認用の暗証番号が一致しません。",
            true
        );

        return;

    }


    const ok =
        window.confirm(
            pinResetTarget.name +
            " さんの暗証番号を " + pin + " に再設定します。\n\n" +
            "元の暗証番号は分からなくなります。\n" +
            "新しい番号を必ずご本人にお伝えください。\n\n" +
            "よろしいですか？"
        );


    if (!ok) {

        return;

    }


    const button = el("pinResetButton");

    button.disabled = true;

    button.textContent = "再設定中...";


    try {

        const { data, error } =
            await getClient().rpc(
                "admin_reset_participant_pin",
                {
                    p_participant_id:
                        pinResetTarget.participant_id ||
                        pinResetTarget.id,

                    p_new_pin: pin,

                    p_note: note || null
                }
            );


        if (error) {
            throw error;
        }


        const result = data || {};


        if (result.success !== true) {

            if (result.error === "pin_duplicate") {

                showMessage(
                    "pinResetEditorMessage",
                    "同じ氏名の別の方が、その暗証番号を使っています。" +
                    "別の番号でお試しください。",
                    true
                );

            }
            else {

                showMessage(
                    "pinResetEditorMessage",
                    "再設定できませんでした。（" +
                    esc(result.error || "unknown") + "）",
                    true
                );

            }

            return;

        }


        closePinResetEditor();


        showMessage(
            "pinResetMessage",
            result.unchanged
                ? "すでにこの暗証番号が設定されていました。"
                : "暗証番号を再設定しました。" +
                  "新しい番号をご本人にお伝えください。",
            false
        );


        await loadPinResetLogs();


    }
    catch (error) {

        console.error("暗証番号の再設定エラー:", error);

        showMessage(
            "pinResetEditorMessage",
            "再設定できませんでした。" +
            (error.message ? "（" + error.message + "）" : "") +
            " sql/07_pin_reset.sql を実行済みかご確認ください。",
            true
        );

    }
    finally {

        button.disabled = false;

        button.textContent = "この内容で再設定する";

    }

}


/* ==================================================
   再設定の記録
================================================== */

async function loadPinResetLogs() {

    const container = el("pinResetLogList");

    if (!container || !getClient()) {
        return;
    }


    container.innerHTML = "読み込み中...";


    try {

        const { data, error } =
            await getClient()
                .from("pin_reset_logs")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50);


        if (error) {
            throw error;
        }


        const rows = data || [];


        if (rows.length === 0) {

            container.innerHTML =
                '<div class="cm-empty">' +
                'まだ再設定の記録はありません。' +
                '</div>';

            return;

        }


        container.innerHTML =
            rows.map(
                row =>
                    '<div class="cm-item">' +
                    '<p class="cm-item-meta" style="margin:0;">' +
                    '<strong>' +
                    esc(row.participant_name || "（氏名不明）") +
                    '</strong>　' +
                    esc(fmtDateTime(row.created_at)) +
                    (
                        row.note
                            ? '<br>' + esc(row.note)
                            : ''
                    ) +
                    '</p>' +
                    '</div>'
            ).join("");


    }
    catch (error) {

        console.error("再設定記録の取得エラー:", error);

        container.innerHTML =
            '<div class="cm-message cm-message-ng">' +
            '記録を読み込めませんでした。<br>' +
            'sql/07_pin_reset.sql を実行済みかご確認ください。' +
            '</div>';

    }

}




/* ==================================================
   ==================================================
   会員区分の変更（参加者管理）
   ==================================================

   参加者一覧の行は admin.js が作っている。
   そこへ処理を足すのではなく、
   クリックを拾う形にして独立させている。

   会員区分は自治会コードで決まるが、
   この仕組みを入れる前に登録した方は
   全員が自治会員として扱われる。
   実際には会員以外の方も含まれているため、
   管理者が直せるようにする。
================================================== */

function setupMemberTypeAdmin() {

    /*
     * 参加者一覧は再読み込みのたびに作り直される。
     * ボタン1つずつに付けると付け直しが要るので、
     * 上位でまとめて拾う。
     */

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    '[data-action="change-member-type"]'
                );


            if (!button) {
                return;
            }


            changeMemberType(button);

        }
    );


    el("participantMemberFilter")
        ?.addEventListener(
            "change",
            applyMemberFilter
        );


    /*
     * 一覧が読み込み直されたあとにも
     * 絞り込みを効かせたいので、
     * 表の変化を見て掛け直す。
     */

    const tbody = el("participantsTable");

    if (tbody && window.MutationObserver) {

        new MutationObserver(applyMemberFilter)
            .observe(tbody, { childList: true });

    }

}


function applyMemberFilter() {

    const select = el("participantMemberFilter");

    const tbody = el("participantsTable");


    if (!select || !tbody) {
        return;
    }


    const value = select.value;


    Array.prototype.forEach.call(
        tbody.querySelectorAll("tr"),
        row => {

            const type = row.dataset.memberType;


            /* 「読み込み中」などの行は触らない */

            if (!type) {
                return;
            }


            row.style.display =
                (value === "all" || value === type)
                    ? ""
                    : "none";

        }
    );

}


async function changeMemberType(button) {

    const id = button.dataset.id;

    const name = button.dataset.name || "この方";

    const current = button.dataset.memberType;


    const next =
        current === "guest" ? "member" : "guest";


    const nextLabel =
        next === "guest" ? "会員以外" : "自治会員";


    const ok =
        window.confirm(
            name + " さんの会員区分を「" + nextLabel +
            "」に変更します。\n\n" +
            (
                next === "guest"
                    ? "地区防災計画・自治会ツール・" +
                      "オリジナルコンテンツが使えなくなり、\n" +
                      "活動実績は文字だけの表示になります。\n\n"
                    : "すべての機能が使えるようになります。\n\n"
            ) +
            "なお、次にご本人がログインし直すと、\n" +
            "入力した自治会コードの区分に戻ります。\n\n" +
            "よろしいですか？"
        );


    if (!ok) {
        return;
    }


    button.disabled = true;


    try {

        const { data, error } =
            await getClient()
                .from("participants")
                .update({
                    member_type: next,
                    updated_at: new Date().toISOString()
                })
                .eq("id", id)
                .select("id");


        if (error) {
            throw error;
        }


        if (!data || data.length === 0) {

            throw new Error(
                "権限設定により変更できませんでした。"
            );

        }


        if (typeof loadParticipants === "function") {

            await loadParticipants();

        }
        else {

            location.reload();

        }


    }
    catch (error) {

        console.error("会員区分の変更エラー:", error);

        window.alert(
            "会員区分を変更できませんでした。\n" +
            (error.message || "")
        );

    }
    finally {

        button.disabled = false;

    }

}




/* ==================================================
   ==================================================
   利用状況
   ==================================================

   どの画面が開かれているかの記録を集計する。

   「延べ回数」と「人数」を分けて出している。
   1人が何度も開いたのか、
   何人が開いたのかで意味が違うため。
================================================== */

function setupUsageAdmin() {

    onNavClick(
        "usageSection",
        async () => {

            await loadUsage();

        }
    );


    el("usageRefreshButton")
        ?.addEventListener(
            "click",
            () => {
                loadUsage();
            }
        );


    el("usageRangeSelect")
        ?.addEventListener(
            "change",
            () => {
                loadUsage();
            }
        );

}


async function loadUsage() {

    if (!getClient()) {
        return;
    }


    const summary = el("usageSummary");

    const pageChart = el("usagePageChart");

    const dailyChart = el("usageDailyChart");


    if (summary) {
        summary.innerHTML = "読み込み中...";
    }


    const days =
        Number(el("usageRangeSelect")?.value || 30);


    const since =
        new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            .toISOString();


    try {

        const { data, error } =
            await getClient()
                .from("page_views")
                .select(
                    "page, participant_id, client_key, " +
                    "member_type, created_at"
                )
                .gte("created_at", since)
                .order("created_at", { ascending: false })
                .limit(10000);


        if (error) {
            throw error;
        }


        const rows = data || [];


        if (rows.length === 0) {

            summary.innerHTML =
                '<div class="cm-empty">' +
                'この期間の記録はまだありません。' +
                '</div>';

            pageChart.innerHTML = "";

            dailyChart.innerHTML = "";

            return;

        }


        renderUsageSummary(rows, days);

        renderUsagePages(rows);

        renderUsageDaily(rows);


    }
    catch (error) {

        console.error("利用状況の取得エラー:", error);

        summary.innerHTML =
            '<div class="cm-message cm-message-ng">' +
            '利用状況を読み込めませんでした。<br>' +
            'sql/09_page_views.sql を実行済みかご確認ください。' +
            '</div>';

    }

}


function personKey(row) {

    return (
        row.participant_id ||
        row.client_key ||
        "unknown"
    );

}


function renderUsageSummary(rows, days) {

    const summary = el("usageSummary");


    const people = {};

    const members = {};


    rows.forEach(
        row => {

            people[personKey(row)] = true;

            if (row.member_type !== "guest") {

                members[personKey(row)] = true;

            }

        }
    );


    const peopleCount =
        Object.keys(people).length;


    summary.innerHTML =

        '<div class="stats-grid dashboard-stats">' +

        '<div class="stat-card">' +
        '<span class="stat-label">利用した人数</span>' +
        '<div><strong class="stat-value">' +
        peopleCount +
        '</strong><span class="stat-unit">人</span></div>' +
        '</div>' +

        '<div class="stat-card">' +
        '<span class="stat-label">画面を開いた回数</span>' +
        '<div><strong class="stat-value">' +
        rows.length +
        '</strong><span class="stat-unit">回</span></div>' +
        '</div>' +

        '<div class="stat-card">' +
        '<span class="stat-label">1人あたり</span>' +
        '<div><strong class="stat-value">' +
        (
            peopleCount > 0
                ? Math.round((rows.length / peopleCount) * 10) / 10
                : 0
        ) +
        '</strong><span class="stat-unit">回</span></div>' +
        '</div>' +

        '<div class="stat-card">' +
        '<span class="stat-label">自治会員</span>' +
        '<div><strong class="stat-value">' +
        Object.keys(members).length +
        '</strong><span class="stat-unit">人</span></div>' +
        '</div>' +

        '</div>' +

        '<p class="cm-item-meta">対象期間：過去' + days + '日</p>';

}


function renderUsagePages(rows) {

    const container = el("usagePageChart");


    const pages = {};


    rows.forEach(
        row => {

            const name = row.page || "その他";


            if (!pages[name]) {

                pages[name] = {
                    count: 0,
                    people: {}
                };

            }


            pages[name].count += 1;

            pages[name].people[personKey(row)] = true;

        }
    );


    const list =
        Object.keys(pages)
            .map(
                name => ({
                    name: name,
                    count: pages[name].count,
                    people: Object.keys(pages[name].people).length
                })
            )
            .sort((a, b) => b.count - a.count);


    const max =
        Math.max(1, ...list.map(item => item.count));


    container.innerHTML =
        list.map(
            item =>
                '<div class="cm-bar-row">' +
                '<div>' + esc(item.name) + '</div>' +
                '<div class="cm-bar-track">' +
                '<div class="cm-bar-fill" style="width:' +
                Math.round((item.count / max) * 100) +
                '%;"></div>' +
                '</div>' +
                '<div class="cm-bar-value">' +
                item.count + '回 / ' + item.people + '人' +
                '</div>' +
                '</div>'
        ).join("");

}


function renderUsageDaily(rows) {

    const container = el("usageDailyChart");


    const days = [];

    const counts = {};


    for (let i = 13; i >= 0; i--) {

        const date =
            new Date(Date.now() - i * 24 * 60 * 60 * 1000);

        const key =
            date.toISOString().slice(0, 10);

        days.push(key);

        counts[key] = 0;

    }


    rows.forEach(
        row => {

            const key =
                String(row.created_at).slice(0, 10);

            if (counts[key] !== undefined) {

                counts[key] += 1;

            }

        }
    );


    const max =
        Math.max(1, ...days.map(key => counts[key]));


    container.innerHTML =
        days.map(
            key => {

                const label =
                    Number(key.slice(5, 7)) + "/" +
                    Number(key.slice(8, 10));


                return (
                    '<div class="cm-bar-row">' +
                    '<div>' + esc(label) + '</div>' +
                    '<div class="cm-bar-track">' +
                    '<div class="cm-bar-fill" style="width:' +
                    Math.round((counts[key] / max) * 100) +
                    '%;"></div>' +
                    '</div>' +
                    '<div class="cm-bar-value">' +
                    counts[key] + '回</div>' +
                    '</div>'
                );

            }
        ).join("");

}




/* ==================================================
   ==================================================
   訓練の受付番号（4桁）
   ==================================================

   QRコードが読めなかった方のための、
   もう一つの受付方法。

   カメラを使わず、この4桁をアプリに入力すれば
   参加登録できる。

   QRコードの画面を開いたときに、
   admin.js から呼ばれる。
================================================== */

window.IwaseFillAccessCode = async function (trainingId) {

    const area = el("qrAccessCode");

    if (!area || !getClient()) {
        return;
    }


    area.textContent = "受付番号：確認中...";


    try {

        const { data, error } =
            await getClient().rpc(
                "ensure_training_access_code",
                { p_training_id: trainingId }
            );


        if (error) {
            throw error;
        }


        if (!data) {

            throw new Error("受付番号を取得できませんでした。");

        }


        area.innerHTML =
            '受付番号：<strong style="font-size:20px;">' +
            esc(data) +
            '</strong>' +
            '<br><span style="font-size:12px;color:#777;">' +
            'QRが読めない方は、この番号をアプリに' +
            '入力すれば登録できます' +
            '</span>';


    }
    catch (error) {

        console.error("受付番号の取得エラー:", error);

        area.innerHTML =
            '<span style="color:#b71c1c;">' +
            '受付番号を発行できませんでした。' +
            'sql/10_training_access_code.sql を' +
            '実行済みかご確認ください。' +
            '</span>';

    }

};


})();

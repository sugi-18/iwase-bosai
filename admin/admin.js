/* ==================================================
   岩瀬自治会 防災アプリ
   管理者画面

   ・登録日時を日本時間で表示
   ・訓練の複数日開催に対応
   ・印刷時のグラフ再描画に対応
   ・他ファイルとの関数名重複を解消
================================================== */

"use strict";


/* ==================================================
   Supabase
   共通クライアントを使用
================================================== */

let adminSupabaseClient = null;

try {

    if (
        typeof supabaseClient === "undefined" ||
        !supabaseClient
    ) {

        throw new Error(
            "共通Supabaseクライアントが初期化されていません。"
        );

    }


    adminSupabaseClient =
        supabaseClient;


    console.log(
        "Admin Supabase client: shared client"
    );

} catch (error) {

    console.error(
        "Admin Supabase initialization error:",
        error
    );

    adminSupabaseClient = null;

}


/* ==================================================
   DOM
================================================== */

const loginScreen =
    document.getElementById(
        "loginScreen"
    );

const adminScreen =
    document.getElementById(
        "adminScreen"
    );

const loginForm =
    document.getElementById(
        "loginForm"
    );

const loginError =
    document.getElementById(
        "loginError"
    );

const logoutButton =
    document.getElementById(
        "logoutButton"
    );


/* ==================================================
   初期化
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupNavigation();

        setupParticipantModal();

        setupParticipantHistoryModal();

        setupTrainingModal();

        setupTrainingParticipantsModal();


        document
            .getElementById(
                "refreshDashboardButton"
            )
            ?.addEventListener(
                "click",
                async () => {

                    await loadDashboard();

                }
            );


        /*
         * 参加者分析のPDF出力
         *
         * 更新ボタンは participant-analysis.js 側で
         * 設定しているため、ここでは登録しない。
         */

        document
            .getElementById(
                "exportParticipantAnalysisPdfButton"
            )
            ?.addEventListener(
                "click",
                () => {

                    if (
                        typeof window.exportParticipantAnalysisPdf ===
                        "function"
                    ) {

                        window.exportParticipantAnalysisPdf();

                    } else {

                        alert(
                            "PDF出力機能を読み込めませんでした。"
                        );

                    }

                }
            );


        await checkAuth();

    }
);


/* ==================================================
   Supabase確認
================================================== */

function checkSupabaseClient() {

    if (
        !adminSupabaseClient
    ) {

        throw new Error(
            "Supabaseクライアントが初期化されていません。"
        );

    }


    if (
        !adminSupabaseClient.auth
    ) {

        throw new Error(
            "Supabase Authが利用できません。"
        );

    }

}


/* ==================================================
   認証確認

   ※ 管理者画面を開いた際は必ずログインを要求
   ※ 既存のSupabaseセッションは信用しない
================================================== */

async function checkAuth() {

    try {

        checkSupabaseClient();


        await adminSupabaseClient
            .auth
            .signOut();


        console.log(
            "ADMIN: 既存セッションを解除しました。"
        );


        showLoginScreen();


    } catch (error) {

        console.error(
            "Authentication initialization error:",
            error
        );

        showLoginScreen();

    }

}


/* ==================================================
   ログイン
================================================== */

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            loginError.textContent =
                "";


            const email =
                document
                    .getElementById(
                        "email"
                    )
                    .value
                    .trim();


            const password =
                document
                    .getElementById(
                        "password"
                    )
                    .value;


            try {

                checkSupabaseClient();


                const {
                    data,
                    error
                } =
                    await adminSupabaseClient
                        .auth
                        .signInWithPassword({

                            email,

                            password

                        });


                if (error) {

                    throw error;

                }


                if (
                    !data ||
                    !data.session
                ) {

                    throw new Error(
                        "ログインセッションを取得できませんでした。"
                    );

                }


                showAdminScreen();

                await loadAllData();


            } catch (error) {

                console.error(
                    "Login error:",
                    error
                );


                loginError.textContent =
                    "ログインに失敗しました。メールアドレスまたはパスワードを確認してください。";

            }

        }
    );

}


/* ==================================================
   ログアウト
================================================== */

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            try {

                checkSupabaseClient();


                await adminSupabaseClient
                    .auth
                    .signOut();


                showLoginScreen();


            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

            }

        }
    );

}


/* ==================================================
   画面切り替え
================================================== */

function showLoginScreen() {

    loginScreen
        ?.classList
        .remove(
            "hidden"
        );


    adminScreen
        ?.classList
        .add(
            "hidden"
        );

}


function showAdminScreen() {

    loginScreen
        ?.classList
        .add(
            "hidden"
        );


    adminScreen
        ?.classList
        .remove(
            "hidden"
        );

}


/* ==================================================
   ナビゲーション
================================================== */

function setupNavigation() {

    const buttons =
        document.querySelectorAll(
            ".nav-button"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                async () => {

                    const target =
                        button.dataset.target;


                    document
                        .querySelectorAll(
                            ".content-section"
                        )
                        .forEach(
                            section => {

                                section.classList.add(
                                    "hidden"
                                );

                            }
                        );


                    document
                        .getElementById(
                            target
                        )
                        ?.classList.remove(
                            "hidden"
                        );


                    buttons.forEach(
                        item => {

                            item.classList.remove(
                                "active"
                            );

                        }
                    );


                    button.classList.add(
                        "active"
                    );


                    /*
                     * 参加者分析は
                     * participant-analysis.js の
                     * MutationObserver が自動で
                     * 再読み込みするため
                     * ここでは呼び出さない。
                     */

                    if (
                        target ===
                        "participantsSection"
                    ) {

                        await loadParticipants();

                    }


                    if (
                        target ===
                        "trainingsSection"
                    ) {

                        await loadTrainings();

                    }


                    if (
                        target ===
                        "participationsSection"
                    ) {

                        await loadParticipations();

                    }

                }
            );

        }
    );

}


/* ==================================================
   全データ
================================================== */

async function loadAllData() {

    try {

        await Promise.all([

            loadParticipants(),

            loadTrainings(),

            loadParticipations(),

            loadDashboard()

        ]);


        /*
         * 参加者分析は participant-analysis.js 側で
         * 公開されている関数を使用する
         */

        if (
            typeof window.loadParticipantAnalysis ===
            "function"
        ) {

            await window.loadParticipantAnalysis();

        }


    } catch (error) {

        console.error(
            "Load all data error:",
            error
        );

    }

}


/* ==================================================
   ダッシュボード
================================================== */

async function loadDashboard() {

    try {

        const [

            participantsResult,

            trainingsResult,

            participationsResult

        ] =
            await Promise.all([

                adminSupabaseClient
                    .from("participants")
                    .select("*"),

                adminSupabaseClient
                    .from("trainings")
                    .select("*"),

                adminSupabaseClient
                    .from("participations")
                    .select("*")

            ]);


        if (
            participantsResult.error
        ) {

            throw participantsResult.error;

        }


        if (
            trainingsResult.error
        ) {

            throw trainingsResult.error;

        }


        if (
            participationsResult.error
        ) {

            throw participationsResult.error;

        }


        const participants =
            participantsResult.data || [];


        const trainings =
            trainingsResult.data || [];


        const participations =
            participationsResult.data || [];


        const participantCount =
            participants.length;


        const trainingCount =
            trainings.length;


        const participationCount =
            participations.length;


        const activeParticipantIds =
            new Set(
                participations
                    .map(
                        item =>
                            item.participant_id
                    )
                    .filter(Boolean)
            );


        const activeParticipantCount =
            activeParticipantIds.size;


        const averageParticipation =
            participantCount > 0
                ? (
                    participationCount /
                    participantCount
                ).toFixed(1)
                : "0";


        setText(
            "participantCount",
            participantCount
        );


        setText(
            "activeParticipantCount",
            activeParticipantCount
        );


        setText(
            "trainingCount",
            trainingCount
        );


        setText(
            "participationCount",
            participationCount
        );


        setText(
            "averageParticipation",
            averageParticipation
        );


        /* ------------------------------------------
           今月の参加状況
           訓練開始日を基準に集計
        ------------------------------------------ */

        const now =
            new Date();


        const currentYear =
            now.getFullYear();


        const currentMonth =
            now.getMonth();


        const currentMonthParticipations =
            participations.filter(
                participation => {

                    const training =
                        trainings.find(
                            item =>
                                item.training_id ===
                                participation.training_id
                        );


                    return isSameTrainingMonth(
                        training?.training_date,
                        currentYear,
                        currentMonth
                    );

                }
            );


        const currentMonthParticipantIds =
            new Set(
                currentMonthParticipations
                    .map(
                        item =>
                            item.participant_id
                    )
                    .filter(Boolean)
            );


        setText(
            "monthlyParticipantCount",
            currentMonthParticipantIds.size
        );


        setText(
            "monthlyParticipationCount",
            currentMonthParticipations.length
        );


        /* ------------------------------------------
           最多参加訓練
        ------------------------------------------ */

        updateMostPopularTraining(
            trainings,
            participations
        );


    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

    }

}


/* ==================================================
   最多参加訓練

   ※ダッシュボードのランキング表示は廃止済み
   ※「最多参加訓練」の集計のみ行う
================================================== */

function updateMostPopularTraining(
    trainings,
    participations
) {

    const ranking =
        trainings
            .map(
                training => {

                    const count =
                        participations.filter(
                            item =>
                                item.training_id ===
                                training.training_id
                        ).length;


                    return {

                        training,

                        count

                    };

                }
            )
            .filter(
                item =>
                    item.count > 0
            )
            .sort(
                (a, b) =>
                    b.count -
                    a.count
            );


    if (
        ranking.length === 0
    ) {

        setText(
            "mostPopularTraining",
            "-"
        );

        return;

    }


    const mostPopular =
        ranking[0];


    setText(
        "mostPopularTraining",
        mostPopular.training.title ||
        mostPopular.training.training_id ||
        "-"
    );

}


/* ==================================================
   参加者管理
================================================== */

async function loadParticipants() {

    const tbody =
        document.getElementById(
            "participantsTable"
        );


    if (!tbody) {

        return;

    }


    tbody.innerHTML =
        `<tr>
            <td colspan="4">
                読み込み中...
            </td>
        </tr>`;


    const {
        data,
        error
    } =
        await adminSupabaseClient
            .from("participants")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Participants loading error:",
            error
        );


        tbody.innerHTML =
            `<tr>
                <td colspan="4">
                    読み込みに失敗しました。
                </td>
            </tr>`;

        return;

    }


    const {
        data: participations,
        error: participationError
    } =
        await adminSupabaseClient
            .from("participations")
            .select(
                "participant_id"
            );


    if (
        participationError
    ) {

        console.error(
            "Participation loading error:",
            participationError
        );

    }


    tbody.innerHTML =
        "";


    if (
        !data ||
        data.length === 0
    ) {

        tbody.innerHTML =
            `<tr>
                <td colspan="4">
                    参加者はいません。
                </td>
            </tr>`;

        return;

    }


    const list =
        participations || [];


    data.forEach(
        participant => {

            const count =
                list.filter(
                    item =>
                        item.participant_id ===
                        participant.participant_id
                ).length;


            const tr =
                document.createElement(
                    "tr"
                );


            tr.innerHTML = `

                <td>
                    <strong>
                        ${escapeHtml(
                            participant.name ||
                            "名前未登録"
                        )}
                    </strong>
                </td>

                <td>
                    <span class="participant-count">
                        ${count}回
                    </span>
                </td>

                <td>
                    ${formatDateTimeJst(
                        participant.created_at
                    )}
                </td>

                <td>

                    <button
                        type="button"
                        class="action-button view-button"
                        data-action="participant-history"
                        data-id="${escapeHtml(
                            participant.id
                        )}"
                    >
                        参加履歴
                    </button>

                    <button
                        type="button"
                        class="action-button edit-button"
                        data-action="edit-participant"
                        data-id="${escapeHtml(
                            participant.id
                        )}"
                    >
                        編集
                    </button>

                    <button
                        type="button"
                        class="action-button delete-button"
                        data-action="delete-participant"
                        data-id="${escapeHtml(
                            participant.id
                        )}"
                    >
                        削除
                    </button>

                </td>

            `;


            tbody.appendChild(
                tr
            );

        }
    );


    tbody
        .querySelectorAll(
            '[data-action="participant-history"]'
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const participant =
                            data.find(
                                item =>
                                    item.id ===
                                    button.dataset.id
                            );


                        if (participant) {

                            openParticipantHistory(
                                participant
                            );

                        }

                    }
                );

            }
        );


    tbody
        .querySelectorAll(
            '[data-action="edit-participant"]'
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const participant =
                            data.find(
                                item =>
                                    item.id ===
                                    button.dataset.id
                            );


                        if (participant) {

                            openParticipantModal(
                                participant
                            );

                        }

                    }
                );

            }
        );


    tbody
        .querySelectorAll(
            '[data-action="delete-participant"]'
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteParticipant(
                            button.dataset.id
                        );

                    }
                );

            }
        );

}


/* ==================================================
   参加者モーダル
================================================== */

function setupParticipantModal() {

    document
        .getElementById(
            "cancelParticipantButton"
        )
        ?.addEventListener(
            "click",
            closeParticipantModal
        );


    document
        .getElementById(
            "saveParticipantButton"
        )
        ?.addEventListener(
            "click",
            saveParticipant
        );

}


function openParticipantModal(
    participant
) {

    document.getElementById(
        "editParticipantDbId"
    ).value =
        participant?.id || "";


    document.getElementById(
        "editParticipantId"
    ).value =
        participant?.participant_id || "";


    document.getElementById(
        "editParticipantName"
    ).value =
        participant?.name || "";


    document.getElementById(
        "participantModal"
    )?.classList.remove(
        "hidden"
    );

}


function closeParticipantModal() {

    document.getElementById(
        "participantModal"
    )?.classList.add(
        "hidden"
    );

}


async function saveParticipant() {

    const id =
        document.getElementById(
            "editParticipantDbId"
        ).value;


    const name =
        document.getElementById(
            "editParticipantName"
        ).value
        .trim();


    if (!name) {

        alert(
            "名前を入力してください。"
        );

        return;

    }


    try {

        const result =
            await adminSupabaseClient
                .from("participants")
                .update({
                    name
                })
                .eq(
                    "id",
                    id
                );


        if (result.error) {

            throw result.error;

        }


        closeParticipantModal();

        await loadAllData();


    } catch (error) {

        console.error(
            "Save participant error:",
            error
        );


        alert(
            "保存に失敗しました。\n" +
            error.message
        );

    }

}


/* ==================================================
   参加者削除
================================================== */

async function deleteParticipant(
    id
) {

    if (
        !confirm(
            "この参加者を削除しますか？\n\n" +
            "この参加者の参加履歴も削除されます。"
        )
    ) {

        return;

    }


    try {

        const {
            data: participant,
            error
        } =
            await adminSupabaseClient
                .from("participants")
                .select(
                    "participant_id"
                )
                .eq(
                    "id",
                    id
                )
                .single();


        if (error) {

            throw error;

        }


        const historyResult =
            await adminSupabaseClient
                .from("participations")
                .delete()
                .eq(
                    "participant_id",
                    participant.participant_id
                );


        if (
            historyResult.error
        ) {

            throw historyResult.error;

        }


        const result =
            await adminSupabaseClient
                .from("participants")
                .delete()
                .eq(
                    "id",
                    id
                );


        if (result.error) {

            throw result.error;

        }


        await loadAllData();


    } catch (error) {

        console.error(
            "Delete participant error:",
            error
        );


        alert(
            "削除に失敗しました。\n" +
            error.message
        );

    }

}


/* ==================================================
   参加者履歴モーダル
================================================== */

function setupParticipantHistoryModal() {

    document
        .getElementById(
            "closeParticipantHistoryButton"
        )
        ?.addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "participantHistoryModal"
                    )
                    ?.classList.add(
                        "hidden"
                    );

            }
        );

}


async function openParticipantHistory(
    participant
) {

    const modal =
        document.getElementById(
            "participantHistoryModal"
        );


    const title =
        document.getElementById(
            "participantHistoryTitle"
        );


    const content =
        document.getElementById(
            "participantHistoryContent"
        );


    if (
        !modal ||
        !title ||
        !content
    ) {

        return;

    }


    title.textContent =
        `${participant.name || "名前未登録"}さんの参加履歴`;


    content.innerHTML =
        "読み込み中...";


    modal.classList.remove(
        "hidden"
    );


    const {
        data,
        error
    } =
        await adminSupabaseClient
            .from("participations")
            .select(
                "id, registered_at, training_id"
            )
            .eq(
                "participant_id",
                participant.participant_id
            )
            .order(
                "registered_at",
                {
                    ascending: false
                }
            );


    if (error) {

        content.innerHTML =
            "読み込みに失敗しました。";

        return;

    }


    const {
        data: trainings,
        error: trainingError
    } =
        await adminSupabaseClient
            .from("trainings")
            .select(
                "training_id, title, training_date, training_end_date"
            );


    if (trainingError) {

        content.innerHTML =
            "訓練情報の読み込みに失敗しました。";

        return;

    }


    if (
        !data ||
        data.length === 0
    ) {

        content.innerHTML =
            `<div class="empty-message">
                参加履歴はありません。
            </div>`;

        return;

    }


    const trainingList =
        trainings || [];


    content.innerHTML = `

        <div class="history-summary">
            参加回数：${data.length}回
        </div>

        <div class="history-list"></div>

    `;


    const list =
        content.querySelector(
            ".history-list"
        );


    data.forEach(
        item => {

            const training =
                trainingList.find(
                    t =>
                        t.training_id ===
                        item.training_id
                );


            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "history-item";


            div.innerHTML = `

                <div class="history-main">

                    <div class="history-title">

                        ${escapeHtml(
                            training?.title ||
                            item.training_id
                        )}

                    </div>

                    <div class="history-date">

                        実施日：
                        ${formatTrainingPeriod(
                            training?.training_date,
                            training?.training_end_date
                        )}

                        <br>

                        登録：
                        ${formatDateTimeJst(
                            item.registered_at
                        )}

                    </div>

                </div>


                <button
                    type="button"
                    class="action-button delete-button"
                >
                    削除
                </button>

            `;


            div
                .querySelector(
                    "button"
                )
                .addEventListener(
                    "click",
                    async () => {

                        const deleted =
                            await deleteParticipation(
                                item.id
                            );


                        if (deleted) {

                            openParticipantHistory(
                                participant
                            );

                        }

                    }
                );


            list.appendChild(
                div
            );

        }
    );

}


/* ==================================================
   訓練モーダル
================================================== */

function setupTrainingModal() {

    document
        .getElementById(
            "addTrainingButton"
        )
        ?.addEventListener(
            "click",
            () => {

                openTrainingModal();

            }
        );


    document
        .getElementById(
            "cancelTrainingButton"
        )
        ?.addEventListener(
            "click",
            closeTrainingModal
        );


    document
        .getElementById(
            "saveTrainingButton"
        )
        ?.addEventListener(
            "click",
            saveTraining
        );

}


/* ==================================================
   訓練ID自動生成
   タイトル + 開始日 + 終了日から一意のIDを作成
================================================== */

function generateTrainingId(
    title,
    trainingDate,
    trainingEndDate
) {

    /*
     * 開始日
     * 2026-09-06
     * ↓
     * 20260906
     */

    const datePart =
        String(trainingDate || "")
            .replace(
                /[^0-9]/g,
                ""
            );


    /*
     * タイトル + 開始日 + 終了日から
     * 安定したハッシュ値を作成
     *
     * 日本語タイトルでも使用可能。
     */

    const source =
        `${title}|${trainingDate}|${trainingEndDate || ""}`;


    let hash = 0;


    for (
        let i = 0;
        i < source.length;
        i++
    ) {

        hash =
            (
                (
                    hash << 5
                ) -
                hash +
                source.charCodeAt(i)
            ) |
            0;

    }


    const hashValue =
        Math.abs(hash)
            .toString(16)
            .padStart(
                6,
                "0"
            )
            .slice(
                -6
            );


    return `${datePart}-${hashValue}`;

}


/* ==================================================
   訓練モーダルを開く
================================================== */

function openTrainingModal(
    training = null
) {

    const idInput =
        document.getElementById(
            "editTrainingDbId"
        );


    const trainingIdInput =
        document.getElementById(
            "editTrainingId"
        );


    const titleInput =
        document.getElementById(
            "editTrainingTitle"
        );


    const dateInput =
        document.getElementById(
            "editTrainingDate"
        );


    const endDateInput =
        document.getElementById(
            "editTrainingEndDate"
        );


    if (
        !idInput ||
        !trainingIdInput ||
        !titleInput ||
        !dateInput
    ) {

        return;

    }


    /*
     * DB上のID
     */

    idInput.value =
        training?.id || "";


    /*
     * 既存訓練の場合のみ
     * 現在のtraining_idを表示
     */

    trainingIdInput.value =
        training?.training_id || "";


    titleInput.value =
        training?.title || "";


    dateInput.value =
        training?.training_date || "";


    if (endDateInput) {

        endDateInput.value =
            training?.training_end_date || "";

    }


    /*
     * training_idは自動生成のため手入力不可
     */

    trainingIdInput.readOnly =
        true;


    if (!training) {

        /*
         * 新規登録時は
         * タイトル・開始日・終了日から
         * リアルタイムでIDを作成
         */

        const updateTrainingId =
            () => {

                const title =
                    titleInput.value.trim();


                const trainingDate =
                    dateInput.value;


                const trainingEndDate =
                    endDateInput
                        ? endDateInput.value
                        : "";


                if (
                    !title ||
                    !trainingDate
                ) {

                    trainingIdInput.value =
                        "";

                    return;

                }


                trainingIdInput.value =
                    generateTrainingId(
                        title,
                        trainingDate,
                        trainingEndDate
                    );

            };


        titleInput.oninput =
            updateTrainingId;


        dateInput.oninput =
            updateTrainingId;


        dateInput.onchange =
            updateTrainingId;


        if (endDateInput) {

            endDateInput.oninput =
                updateTrainingId;


            endDateInput.onchange =
                updateTrainingId;

        }


        updateTrainingId();


    } else {

        /*
         * 編集時は既存IDを維持
         */

        titleInput.oninput =
            null;

        dateInput.oninput =
            null;

        dateInput.onchange =
            null;


        if (endDateInput) {

            endDateInput.oninput =
                null;

            endDateInput.onchange =
                null;

        }

    }


    setText(
        "trainingIdEditNote",
        training
            ? "※既存の訓練を編集する場合、訓練IDは変更されません。"
            : "※訓練IDはタイトルと開催日から自動生成されます。"
    );


    setText(
        "trainingModalTitle",
        training
            ? "訓練・講座を編集"
            : "訓練・講座を登録"
    );


    document
        .getElementById(
            "trainingModal"
        )
        ?.classList.remove(
            "hidden"
        );

}


/* ==================================================
   訓練モーダルを閉じる
================================================== */

function closeTrainingModal() {

    document
        .getElementById(
            "trainingModal"
        )
        ?.classList.add(
            "hidden"
        );

}


/* ==================================================
   訓練保存
================================================== */

async function saveTraining() {

    const id =
        document
            .getElementById(
                "editTrainingDbId"
            )
            .value;


    const trainingIdInput =
        document.getElementById(
            "editTrainingId"
        );


    const title =
        document
            .getElementById(
                "editTrainingTitle"
            )
            .value
            .trim();


    const trainingDate =
        document
            .getElementById(
                "editTrainingDate"
            )
            .value;


    const endDateInput =
        document.getElementById(
            "editTrainingEndDate"
        );


    const trainingEndDateRaw =
        endDateInput
            ? endDateInput.value
            : "";


    /*
     * 終了日が空欄、または開始日と同じ場合は
     * 1日開催としてnullで保存する
     */

    const trainingEndDate =
        (
            trainingEndDateRaw &&
            trainingEndDateRaw !== trainingDate
        )
            ? trainingEndDateRaw
            : null;


    /*
     * 入力チェック
     */

    if (
        !title ||
        !trainingDate
    ) {

        alert(
            "タイトルと開始日を入力してください。"
        );

        return;

    }


    if (
        trainingEndDate &&
        trainingEndDate < trainingDate
    ) {

        alert(
            "終了日は開始日以降の日付を指定してください。"
        );

        return;

    }


    /*
     * 新規登録の場合はIDを再生成
     * 編集の場合は既存IDをそのまま使用
     */

    let trainingId;


    if (!id) {

        trainingId =
            generateTrainingId(
                title,
                trainingDate,
                trainingEndDate
            );


        if (trainingIdInput) {

            trainingIdInput.value =
                trainingId;

        }

    } else {

        trainingId =
            trainingIdInput.value.trim();

    }


    if (!trainingId) {

        alert(
            "訓練IDの生成に失敗しました。"
        );

        return;

    }


    /*
     * セッション確認
     */

    const {
        data: sessionData,
        error: sessionError
    } =
        await adminSupabaseClient
            .auth
            .getSession();


    if (
        sessionError ||
        !sessionData?.session
    ) {

        alert(
            "管理者ログインのセッションを確認できませんでした。\n\n" +
            "一度ログアウトして、もう一度ログインしてください。"
        );

        return;

    }


    try {

        let result;


        /* ==================================================
           編集
        ================================================== */

        if (id) {

            result =
                await adminSupabaseClient
                    .from("trainings")
                    .update({

                        title,

                        training_date:
                            trainingDate,

                        training_end_date:
                            trainingEndDate

                    })
                    .eq(
                        "id",
                        id
                    );

        }


        /* ==================================================
           新規登録
        ================================================== */

        else {

            const existing =
                await adminSupabaseClient
                    .from("trainings")
                    .select(
                        "id, training_id"
                    )
                    .eq(
                        "training_id",
                        trainingId
                    )
                    .maybeSingle();


            if (
                existing.error
            ) {

                throw existing.error;

            }


            /*
             * 万が一同じIDが存在する場合は
             * -2 / -3 ... として重複を回避
             */

            if (
                existing.data
            ) {

                let number =
                    2;


                let candidateId;


                while (true) {

                    candidateId =
                        `${trainingId}-${number}`;


                    const duplicate =
                        await adminSupabaseClient
                            .from("trainings")
                            .select(
                                "id"
                            )
                            .eq(
                                "training_id",
                                candidateId
                            )
                            .maybeSingle();


                    if (
                        duplicate.error
                    ) {

                        throw duplicate.error;

                    }


                    if (
                        !duplicate.data
                    ) {

                        break;

                    }


                    number++;

                }


                trainingId =
                    candidateId;


                if (
                    trainingIdInput
                ) {

                    trainingIdInput.value =
                        trainingId;

                }

            }


            result =
                await adminSupabaseClient
                    .from("trainings")
                    .insert({

                        training_id:
                            trainingId,

                        title,

                        training_date:
                            trainingDate,

                        training_end_date:
                            trainingEndDate

                    });

        }


        if (
            result.error
        ) {

            throw result.error;

        }


        closeTrainingModal();


        await loadAllData();


        alert(
            id
                ? "訓練・講座を更新しました。"
                : `訓練・講座を登録しました。\n\n訓練ID：${trainingId}`
        );


    } catch (error) {

        console.error(
            "Save training error:",
            error
        );


        alert(
            "保存に失敗しました。\n" +
            error.message
        );

    }

}


/* ==================================================
   訓練一覧
================================================== */

async function loadTrainings() {

    const tbody =
        document.getElementById(
            "trainingsTable"
        );


    if (!tbody) {

        return;

    }


    tbody.innerHTML =
        `<tr>
            <td colspan="6">
                読み込み中...
            </td>
        </tr>`;


    const {
        data,
        error
    } =
        await adminSupabaseClient
            .from("trainings")
            .select("*")
            .order(
                "training_date",
                {
                    ascending: false,
                    nullsFirst: false
                }
            );


    if (error) {

        console.error(
            "Trainings loading error:",
            error
        );


        tbody.innerHTML =
            `<tr>
                <td colspan="6">
                    読み込みに失敗しました。
                </td>
            </tr>`;

        return;

    }


    const {
        data: participations,
        error: participationError
    } =
        await adminSupabaseClient
            .from("participations")
            .select(
                "training_id"
            );


    if (participationError) {

        console.error(
            "Training participation loading error:",
            participationError
        );

    }


    tbody.innerHTML =
        "";


    if (
        !data ||
        data.length === 0
    ) {

        tbody.innerHTML =
            `<tr>
                <td colspan="6">
                    訓練・講座はありません。
                </td>
            </tr>`;

        return;

    }


    data.forEach(
        training => {

            const count =
                (
                    participations || []
                )
                .filter(
                    item =>
                        item.training_id ===
                        training.training_id
                )
                .length;


            const tr =
                document.createElement(
                    "tr"
                );


            tr.innerHTML = `

                <td>
                    ${escapeHtml(
                        training.training_id
                    )}
                </td>

                <td>
                    <strong>
                        ${escapeHtml(
                            training.title
                        )}
                    </strong>
                </td>

                <td>
                    ${
                        training.training_date
                            ? formatTrainingPeriod(
                                training.training_date,
                                training.training_end_date
                            )
                            : "未設定"
                    }
                </td>

                <td>
                    <span class="participant-count">
                        ${count}人
                    </span>
                </td>

                <td>
                    ${formatDateTimeJst(
                        training.created_at
                    )}
                </td>

                <td>

                    <button
                        type="button"
                        class="action-button view-button"
                    >
                        参加者を見る
                    </button>

                    <button
                        type="button"
                        class="action-button qr-button"
                        data-action="training-qr"
                    >
                        QRコード
                    </button>

                    <button
                        type="button"
                        class="action-button edit-button"
                    >
                        編集
                    </button>

                    <button
                        type="button"
                        class="action-button delete-button"
                    >
                        削除
                    </button>

                </td>

            `;


            const buttons =
                tr.querySelectorAll(
                    "button"
                );


            /* 参加者を見る */

            buttons[0]
                ?.addEventListener(
                    "click",
                    () => {

                        openTrainingParticipants(
                            training
                        );

                    }
                );


            /* QRコード */

            buttons[1]
                ?.addEventListener(
                    "click",
                    () => {

                        if (
                            typeof window.openTrainingQrModal ===
                            "function"
                        ) {

                            window.openTrainingQrModal(
                                training
                            );

                        } else {

                            alert(
                                "QRコード機能を読み込めませんでした。"
                            );

                        }

                    }
                );


            /* 編集 */

            buttons[2]
                ?.addEventListener(
                    "click",
                    () => {

                        openTrainingModal(
                            training
                        );

                    }
                );


            /* 削除 */

            buttons[3]
                ?.addEventListener(
                    "click",
                    () => {

                        deleteTraining(
                            training.id
                        );

                    }
                );


            tbody.appendChild(
                tr
            );

        }
    );

}


/* ==================================================
   訓練参加者モーダル
================================================== */

function setupTrainingParticipantsModal() {

    document
        .getElementById(
            "closeTrainingParticipantsButton"
        )
        ?.addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "trainingParticipantsModal"
                    )
                    ?.classList.add(
                        "hidden"
                    );

            }
        );


    document
        .getElementById(
            "addSelectedParticipantsButton"
        )
        ?.addEventListener(
            "click",
            addSelectedParticipants
        );

}


/* ==================================================
   訓練参加者モーダルを開く
================================================== */

async function openTrainingParticipants(
    training
) {

    const modal =
        document.getElementById(
            "trainingParticipantsModal"
        );


    const title =
        document.getElementById(
            "trainingParticipantsTitle"
        );


    const summary =
        document.getElementById(
            "trainingParticipantsSummary"
        );


    const available =
        document.getElementById(
            "availableParticipants"
        );


    const content =
        document.getElementById(
            "trainingParticipantsContent"
        );


    if (
        !modal ||
        !title ||
        !summary ||
        !available ||
        !content
    ) {

        return;

    }


    title.textContent =
        `${training.title}：参加者管理`;


    summary.innerHTML =
        "読み込み中...";


    available.innerHTML =
        "読み込み中...";


    content.innerHTML =
        "読み込み中...";


    modal.classList.remove(
        "hidden"
    );


    try {

        const [
            participationsResult,
            participantsResult
        ] =
            await Promise.all([

                adminSupabaseClient
                    .from("participations")
                    .select(
                        "id, participant_id, registered_at"
                    )
                    .eq(
                        "training_id",
                        training.training_id
                    )
                    .order(
                        "registered_at",
                        {
                            ascending: true
                        }
                    ),

                adminSupabaseClient
                    .from("participants")
                    .select(
                        "id, participant_id, name, created_at"
                    )
                    .order(
                        "name",
                        {
                            ascending: true
                        }
                    )

            ]);


        if (
            participationsResult.error
        ) {

            throw participationsResult.error;

        }


        if (
            participantsResult.error
        ) {

            throw participantsResult.error;

        }


        const participations =
            participationsResult.data || [];


        const participants =
            participantsResult.data || [];


        const currentIds =
            new Set(
                participations.map(
                    item =>
                        item.participant_id
                )
            );


        summary.innerHTML = `

            <strong>
                ${escapeHtml(
                    training.title
                )}
            </strong>

            <br>

            実施日：
            ${formatTrainingPeriod(
                training.training_date,
                training.training_end_date
            )}

            <br>

            現在の参加者：
            ${participations.length}人

        `;


        /* ------------------------------------------
           追加可能な参加者
        ------------------------------------------ */

        const availableParticipants =
            participants.filter(
                participant =>
                    !currentIds.has(
                        participant.participant_id
                    )
            );


        if (
            availableParticipants.length === 0
        ) {

            available.innerHTML =
                `<div class="empty-message">
                    追加できる参加者はいません。
                </div>`;

        } else {

            available.innerHTML =
                "";


            availableParticipants.forEach(
                participant => {

                    const label =
                        document.createElement(
                            "label"
                        );


                    label.className =
                        "participant-select-item";


                    label.innerHTML = `

                        <input
                            type="checkbox"
                            class="available-participant-checkbox"
                            value="${escapeHtml(
                                participant.participant_id
                            )}"
                        >

                        <span>
                            ${escapeHtml(
                                participant.name ||
                                "名前未登録"
                            )}
                        </span>

                    `;


                    available.appendChild(
                        label
                    );

                }
            );

        }


        /* ------------------------------------------
           現在の参加者
        ------------------------------------------ */

        if (
            participations.length === 0
        ) {

            content.innerHTML =
                `<div class="empty-message">
                    この訓練への参加者はいません。
                </div>`;

        } else {

            content.innerHTML = `

                <div class="history-list"></div>

            `;


            const list =
                content.querySelector(
                    ".history-list"
                );


            participations.forEach(
                item => {

                    const participant =
                        participants.find(
                            p =>
                                p.participant_id ===
                                item.participant_id
                        );


                    const div =
                        document.createElement(
                            "div"
                        );


                    div.className =
                        "history-item";


                    div.innerHTML = `

                        <div class="history-main">

                            <div class="history-title">

                                ${escapeHtml(
                                    participant?.name ||
                                    "名前未登録"
                                )}

                            </div>

                            <div class="history-date">

                                登録：
                                ${formatDateTimeJst(
                                    item.registered_at
                                )}

                            </div>

                        </div>


                        <button
                            type="button"
                            class="action-button delete-button"
                        >
                            削除
                        </button>

                    `;


                    div
                        .querySelector(
                            "button"
                        )
                        .addEventListener(
                            "click",
                            async () => {

                                const deleted =
                                    await deleteParticipation(
                                        item.id
                                    );


                                if (deleted) {

                                    await openTrainingParticipants(
                                        training
                                    );

                                }

                            }
                        );


                    list.appendChild(
                        div
                    );

                }
            );

        }


        /*
         * 現在開いている訓練を記憶
         */

        modal.dataset.trainingId =
            training.training_id;


    } catch (error) {

        console.error(
            "Training participants loading error:",
            error
        );


        summary.innerHTML =
            "読み込みに失敗しました。";


        available.innerHTML =
            "";


        content.innerHTML =
            "参加者情報の読み込みに失敗しました。";

    }

}


/* ==================================================
   参加者を追加
================================================== */

async function addSelectedParticipants() {

    const modal =
        document.getElementById(
            "trainingParticipantsModal"
        );


    if (!modal) {

        return;

    }


    const trainingId =
        modal.dataset.trainingId;


    if (!trainingId) {

        alert(
            "訓練情報を取得できませんでした。"
        );

        return;

    }


    const checked =
        document.querySelectorAll(
            ".available-participant-checkbox:checked"
        );


    if (
        checked.length === 0
    ) {

        alert(
            "追加する参加者を選択してください。"
        );

        return;

    }


    const participantIds =
        Array.from(
            checked
        )
        .map(
            checkbox =>
                checkbox.value
        )
        .filter(Boolean);


    try {

        /*
         * 念のため現在の参加者を再確認
         * 二重登録を防止
         */

        const {
            data: existing,
            error: existingError
        } =
            await adminSupabaseClient
                .from("participations")
                .select(
                    "participant_id"
                )
                .eq(
                    "training_id",
                    trainingId
                );


        if (existingError) {

            throw existingError;

        }


        const existingIds =
            new Set(
                (existing || []).map(
                    item =>
                        item.participant_id
                )
            );


        const rows =
            participantIds
                .filter(
                    participantId =>
                        !existingIds.has(
                            participantId
                        )
                )
                .map(
                    participantId => ({

                        participant_id:
                            participantId,

                        training_id:
                            trainingId,

                        registered_at:
                            new Date().toISOString()

                    })
                );


        if (
            rows.length === 0
        ) {

            alert(
                "選択した参加者はすでに登録されています。"
            );

            return;

        }


        const {
            error
        } =
            await adminSupabaseClient
                .from("participations")
                .insert(
                    rows
                );


        if (error) {

            throw error;

        }


        alert(
            `${rows.length}人を参加者として追加しました。`
        );


        await loadAllData();


        const training =
            await getTrainingByTrainingId(
                trainingId
            );


        if (training) {

            await openTrainingParticipants(
                training
            );

        }


    } catch (error) {

        console.error(
            "Add participants error:",
            error
        );


        alert(
            "参加者の追加に失敗しました。\n" +
            error.message
        );

    }

}


/* ==================================================
   訓練取得
================================================== */

async function getTrainingByTrainingId(
    trainingId
) {

    const {
        data,
        error
    } =
        await adminSupabaseClient
            .from("trainings")
            .select("*")
            .eq(
                "training_id",
                trainingId
            )
            .maybeSingle();


    if (error) {

        console.error(
            "Training lookup error:",
            error
        );

        return null;

    }


    return data || null;

}


/* ==================================================
   訓練削除
================================================== */

async function deleteTraining(
    id
) {

    if (
        !confirm(
            "この訓練・講座を削除しますか？\n\n" +
            "この訓練の参加履歴も削除されます。"
        )
    ) {

        return;

    }


    try {

        const {
            data: training,
            error
        } =
            await adminSupabaseClient
                .from("trainings")
                .select(
                    "training_id"
                )
                .eq(
                    "id",
                    id
                )
                .single();


        if (error) {

            throw error;

        }


        const historyResult =
            await adminSupabaseClient
                .from("participations")
                .delete()
                .eq(
                    "training_id",
                    training.training_id
                );


        if (
            historyResult.error
        ) {

            throw historyResult.error;

        }


        const result =
            await adminSupabaseClient
                .from("trainings")
                .delete()
                .eq(
                    "id",
                    id
                );


        if (result.error) {

            throw result.error;

        }


        await loadAllData();


        alert(
            "訓練・講座を削除しました。"
        );


    } catch (error) {

        console.error(
            "Delete training error:",
            error
        );


        alert(
            "削除に失敗しました。\n" +
            error.message
        );

    }

}


/* ==================================================
   参加履歴
================================================== */

async function loadParticipations() {

    const tbody =
        document.getElementById(
            "participationsTable"
        );


    if (!tbody) {

        return;

    }


    tbody.innerHTML =
        `<tr>
            <td colspan="5">
                読み込み中...
            </td>
        </tr>`;


    const {
        data,
        error
    } =
        await adminSupabaseClient
            .from("participations")
            .select(
                "id, registered_at, participant_id, training_id"
            )
            .order(
                "registered_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Participations loading error:",
            error
        );


        tbody.innerHTML =
            `<tr>
                <td colspan="5">
                    読み込みに失敗しました。
                </td>
            </tr>`;

        return;

    }


    const [
        participantsResult,
        trainingsResult
    ] =
        await Promise.all([

            adminSupabaseClient
                .from("participants")
                .select(
                    "participant_id, name"
                ),

            adminSupabaseClient
                .from("trainings")
                .select(
                    "training_id, title, training_date, training_end_date"
                )

        ]);


    const participants =
        participantsResult.data || [];


    const trainings =
        trainingsResult.data || [];


    tbody.innerHTML =
        "";


    if (
        !data ||
        data.length === 0
    ) {

        tbody.innerHTML =
            `<tr>
                <td colspan="5">
                    参加履歴はありません。
                </td>
            </tr>`;

        return;

    }


    data.forEach(
        item => {

            const participant =
                participants.find(
                    p =>
                        p.participant_id ===
                        item.participant_id
                );


            const training =
                trainings.find(
                    t =>
                        t.training_id ===
                        item.training_id
                );


            const tr =
                document.createElement(
                    "tr"
                );


            tr.innerHTML = `

                <td>
                    ${escapeHtml(
                        participant?.name ||
                        "名前未登録"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        training?.title ||
                        item.training_id
                    )}
                </td>

                <td>
                    ${
                        training?.training_date
                            ? formatTrainingPeriod(
                                training.training_date,
                                training.training_end_date
                            )
                            : "未設定"
                    }
                </td>

                <td>
                    ${formatDateTimeJst(
                        item.registered_at
                    )}
                </td>

                <td>

                    <button
                        type="button"
                        class="action-button delete-button"
                    >
                        削除
                    </button>

                </td>

            `;


            tr
                .querySelector(
                    "button"
                )
                .addEventListener(
                    "click",
                    async () => {

                        await deleteParticipation(
                            item.id
                        );

                    }
                );


            tbody.appendChild(
                tr
            );

        }
    );

}


/* ==================================================
   参加履歴削除
================================================== */

async function deleteParticipation(
    id
) {

    if (
        !confirm(
            "この参加履歴を削除しますか？"
        )
    ) {

        return false;

    }


    try {

        const {
            error
        } =
            await adminSupabaseClient
                .from("participations")
                .delete()
                .eq(
                    "id",
                    id
                );


        if (error) {

            throw error;

        }


        await loadAllData();


        return true;


    } catch (error) {

        console.error(
            "Delete participation error:",
            error
        );


        alert(
            "削除に失敗しました。\n" +
            error.message
        );


        return false;

    }

}


/* ==================================================
   共通テキスト
================================================== */

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


/* ==================================================
   訓練月判定
   訓練開始日を基準に判定する
================================================== */

function isSameTrainingMonth(
    trainingDate,
    year,
    month
) {

    if (!trainingDate) {

        return false;

    }


    const parts =
        String(
            trainingDate
        ).split("-");


    if (
        parts.length !== 3
    ) {

        return false;

    }


    return (
        Number(parts[0]) ===
        year &&
        Number(parts[1]) - 1 ===
        month
    );

}


/* ==================================================
   タイムスタンプ解析

   Supabaseの列型が
   timestamptz → そのままUTCとして解釈される
   timestamp   → タイムゾーン情報がないため
                 UTCとみなして補正する
================================================== */

function parseTimestamp(
    value
) {

    if (!value) {

        return null;

    }


    let text =
        String(value).trim();


    const hasTimezone =
        /(Z|z|[+-]\d{2}:?\d{2})$/.test(
            text
        );


    if (!hasTimezone) {

        text =
            text.replace(" ", "T") + "Z";

    }


    const date =
        new Date(text);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return null;

    }


    return date;

}


/* ==================================================
   登録日時
   日本時間（Asia/Tokyo）で表示

   ※他のJSファイルにも formatDate があるため
     名前を分けて衝突を避けている
================================================== */

function formatDateTimeJst(
    value
) {

    const date =
        parseTimestamp(value);


    if (!date) {

        return "-";

    }


    return new Intl.DateTimeFormat(
        "ja-JP",
        {

            timeZone: "Asia/Tokyo",

            year: "numeric",

            month: "2-digit",

            day: "2-digit",

            hour: "2-digit",

            minute: "2-digit"

        }
    ).format(date);

}


/* ==================================================
   訓練実施日
   timezoneによる日付ずれを防止
================================================== */

function formatTrainingDate(
    value
) {

    if (!value) {

        return "-";

    }


    const parts =
        String(
            value
        ).split("-");


    if (
        parts.length !== 3
    ) {

        return String(
            value
        );

    }


    return (
        Number(parts[0]) +
        "年" +
        Number(parts[1]) +
        "月" +
        Number(parts[2]) +
        "日"
    );

}


/* ==================================================
   訓練開催期間
   複数日開催に対応
================================================== */

function formatTrainingPeriod(
    startDate,
    endDate
) {

    if (!startDate) {

        return "-";

    }


    if (
        !endDate ||
        endDate === startDate
    ) {

        return formatTrainingDate(
            startDate
        );

    }


    const start =
        String(startDate).split("-");


    const end =
        String(endDate).split("-");


    if (
        start.length !== 3 ||
        end.length !== 3
    ) {

        return formatTrainingDate(
            startDate
        );

    }


    /*
     * 同じ年・同じ月
     * 2026年9月6日〜8日
     */

    if (
        start[0] === end[0] &&
        start[1] === end[1]
    ) {

        return (
            Number(start[0]) + "年" +
            Number(start[1]) + "月" +
            Number(start[2]) + "日〜" +
            Number(end[2]) + "日"
        );

    }


    /*
     * 同じ年・違う月
     * 2026年9月30日〜10月2日
     */

    if (
        start[0] === end[0]
    ) {

        return (
            Number(start[0]) + "年" +
            Number(start[1]) + "月" +
            Number(start[2]) + "日〜" +
            Number(end[1]) + "月" +
            Number(end[2]) + "日"
        );

    }


    /*
     * 年をまたぐ場合
     */

    return (
        formatTrainingDate(startDate) +
        "〜" +
        formatTrainingDate(endDate)
    );

}


/* ==================================================
   HTMLエスケープ
================================================== */

function escapeHtml(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(
        value
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* ==================================================
   訓練QRコード機能
   training_id直接指定方式
================================================== */

(function () {

    "use strict";


    /* ==================================================
       現在表示中の訓練
    ================================================== */

    let currentQrTraining = null;


    /* ==================================================
       初期化
    ================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            setupTrainingQrEvents();

        }
    );


    /* ==================================================
       イベント設定
    ================================================== */

    function setupTrainingQrEvents() {

        const closeButton =
            document.getElementById(
                "closeTrainingQrButton"
            );


        const downloadButton =
            document.getElementById(
                "downloadTrainingQrButton"
            );


        const printButton =
            document.getElementById(
                "printTrainingQrButton"
            );


        const modal =
            document.getElementById(
                "trainingQrModal"
            );


        if (closeButton) {

            closeButton.addEventListener(
                "click",
                closeTrainingQrModal
            );

        }


        if (downloadButton) {

            downloadButton.addEventListener(
                "click",
                downloadTrainingQr
            );

        }


        if (printButton) {

            printButton.addEventListener(
                "click",
                printTrainingQr
            );

        }


        if (modal) {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target === modal
                    ) {

                        closeTrainingQrModal();

                    }

                }
            );

        }

    }


    /* ==================================================
       QRコードボタン生成
    ================================================== */

    window.createTrainingQrButton =
        function (training) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "qr-button";


            button.textContent =
                "QRコード";


            button.addEventListener(
                "click",
                () => {

                    window.openTrainingQrModal(
                        training
                    );

                }
            );


            return button;

        };


    /* ==================================================
       QRコードモーダル表示
    ================================================== */

    window.openTrainingQrModal =
        function (training) {

            currentQrTraining =
                training;


            const modal =
                document.getElementById(
                    "trainingQrModal"
                );


            const summary =
                document.getElementById(
                    "trainingQrSummary"
                );


            const qrContainer =
                document.getElementById(
                    "trainingQrCode"
                );


            const urlContainer =
                document.getElementById(
                    "trainingQrUrl"
                );


            if (
                !modal ||
                !summary ||
                !qrContainer ||
                !urlContainer
            ) {

                console.error(
                    "QRコード表示用HTMLが見つかりません。"
                );

                return;

            }


            const trainingId =
                training?.training_id ||
                "";


            const title =
                training?.title ||
                training?.name ||
                "訓練・講座";


            /*
             * 実施日
             * 複数日開催に対応
             */

            const date =
                training?.training_date
                    ? formatTrainingPeriod(
                        training.training_date,
                        training.training_end_date
                    )
                    : "";


            if (!trainingId) {

                summary.innerHTML = `
                    <div class="qr-summary-title">
                        QRコードを作成できません
                    </div>

                    <div class="qr-summary-date">
                        training_id が設定されていません。
                    </div>
                `;


                qrContainer.innerHTML =
                    "";


                urlContainer.textContent =
                    "";


                modal.classList.remove(
                    "hidden"
                );


                return;

            }


            qrContainer.innerHTML =
                "";


            summary.innerHTML = `

                <div class="qr-summary-title">
                    ${escapeQrHtml(title)}
                </div>

                <div class="qr-summary-date">
                    実施日：
                    ${escapeQrHtml(
                        date || "未設定"
                    )}
                </div>

                <div class="qr-summary-id">
                    訓練ID：
                    ${escapeQrHtml(
                        trainingId
                    )}
                </div>

            `;


            const trainingUrl =
                createTrainingUrl(
                    trainingId
                );


            urlContainer.textContent =
                trainingUrl;


            if (
                typeof QRCode ===
                "undefined"
            ) {

                qrContainer.innerHTML =
                    `
                    <p>
                        QRコードライブラリを
                        読み込めませんでした。
                    </p>
                    `;

                modal.classList.remove(
                    "hidden"
                );

                return;

            }


            new QRCode(
                qrContainer,
                {

                    text:
                        trainingUrl,

                    width:
                        260,

                    height:
                        260,

                    correctLevel:
                        QRCode.CorrectLevel.H

                }
            );


            modal.classList.remove(
                "hidden"
            );

        };


    /* ==================================================
       training.html URL生成

       ★重要
       event/date方式ではなく
       training_idを直接渡す
    ================================================== */

    function createTrainingUrl(
        trainingId
    ) {

        try {

            const url =
                new URL(
                    "../stamp/training.html",
                    window.location.href
                );


            url.searchParams.set(
                "training_id",
                trainingId
            );


            return url.toString();


        } catch (error) {

            console.error(
                "training URL generation error:",
                error
            );


            return "";

        }

    }


    /* ==================================================
       QRコード保存
    ================================================== */

    function downloadTrainingQr() {

        const qrContainer =
            document.getElementById(
                "trainingQrCode"
            );


        if (!qrContainer) {

            return;

        }


        const canvas =
            qrContainer.querySelector(
                "canvas"
            );


        const image =
            qrContainer.querySelector(
                "img"
            );


        let dataUrl =
            null;


        if (canvas) {

            dataUrl =
                canvas.toDataURL(
                    "image/png"
                );

        } else if (image) {

            dataUrl =
                image.src;

        }


        if (!dataUrl) {

            alert(
                "QRコードを保存できませんでした。"
            );

            return;

        }


        const title =
            currentQrTraining?.title ||
            currentQrTraining?.name ||
            "training";


        const safeTitle =
            String(title)
                .replace(
                    /[\\/:*?"<>|]/g,
                    "_"
                );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            dataUrl;


        link.download =
            `${safeTitle}_QRコード.png`;


        document.body.appendChild(
            link
        );


        link.click();


        document.body.removeChild(
            link
        );

    }


    /* ==================================================
       QRコード印刷
    ================================================== */

    function printTrainingQr() {

        const modal =
            document.getElementById(
                "trainingQrModal"
            );


        if (!modal) {

            return;

        }


        document.body.classList.add(
            "qr-print-mode"
        );


        modal.classList.remove(
            "hidden"
        );


        window.print();

    }


    /* ==================================================
       QRモーダルを閉じる
    ================================================== */

    function closeTrainingQrModal() {

        const modal =
            document.getElementById(
                "trainingQrModal"
            );


        if (modal) {

            modal.classList.add(
                "hidden"
            );

        }


        currentQrTraining =
            null;

    }


    /* ==================================================
       QR用HTMLエスケープ
    ================================================== */

    function escapeQrHtml(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }


        return String(value)

            .replace(
                /&/g,
                "&amp;"
            )

            .replace(
                /</g,
                "&lt;"
            )

            .replace(
                />/g,
                "&gt;"
            )

            .replace(
                /"/g,
                "&quot;"
            )

            .replace(
                /'/g,
                "&#039;"
            );

    }


})();


/* ==================================================
   ブラウザ印刷
   Ctrl + P / QRコード印刷対応
================================================== */

(function setupBrowserPrint() {

    "use strict";


    function getCurrentPrintSection() {

        const sections =
            document.querySelectorAll(
                ".content-section"
            );


        for (const section of sections) {

            if (
                !section.classList.contains(
                    "hidden"
                )
            ) {

                return section;

            }

        }


        return null;

    }


    /* ==================================================
       グラフの再描画

       Chart.jsのcanvasは画面幅で実サイズが
       決まっているため、印刷レイアウトに
       合わせて計算し直さないと
       次の要素に重なって表示される
    ================================================== */

    function resizeCharts(
        root
    ) {

        if (
            typeof Chart ===
            "undefined"
        ) {

            return;

        }


        const target =
            root || document;


        target
            .querySelectorAll(
                ".chart-container canvas"
            )
            .forEach(
                canvas => {

                    try {

                        const chart =
                            Chart.getChart(
                                canvas
                            );


                        if (chart) {

                            chart.resize();

                        }

                    } catch (error) {

                        console.warn(
                            "Chart resize error:",
                            error
                        );

                    }

                }
            );

    }


    /* ==================================================
       印刷開始前
    ================================================== */

    window.addEventListener(
        "beforeprint",
        () => {

            /*
             * QRコード印刷中は
             * 通常画面の印刷対象を変更しない
             */

            if (
                document.body.classList.contains(
                    "qr-print-mode"
                )
            ) {

                return;

            }


            const section =
                getCurrentPrintSection();


            if (!section) {

                console.warn(
                    "印刷対象の画面が見つかりません。"
                );

                return;

            }


            section.classList.add(
                "print-target"
            );


            resizeCharts(
                section
            );

        }
    );


    /* ==================================================
       印刷終了後
    ================================================== */

    window.addEventListener(
        "afterprint",
        () => {

            document.body.classList.remove(
                "qr-print-mode"
            );


            document
                .querySelectorAll(
                    ".print-target"
                )
                .forEach(
                    section => {

                        section.classList.remove(
                            "print-target"
                        );

                    }
                );


            /*
             * 画面表示用にサイズを戻す
             */

            resizeCharts();

        }
    );

})();

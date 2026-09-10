/* ==================================================
   岩瀬自治会 防災アプリ
   参加者分析ダッシュボード

   ・training_date 対応
   ・複数日開催の表示に対応
   ・いわぽんトップ防災マイスターに対応
   ・他ファイルとの関数名衝突を避けるため
     全体をIIFEで囲んだ
================================================== */

(function () {

"use strict";


/* ==================================================
   状態
================================================== */

let participantAnalysisChart = null;

let participantMonthlyChart = null;

let analysisParticipants = [];

let analysisParticipations = [];

let analysisTrainings = [];


/* ==================================================
   設定
================================================== */

const ANALYSIS_FISCAL_YEAR = 2026;


/*
 * いわぽん防災マイスター
 */

const MASTER_TARGET = 5;


/*
 * いわぽんトップ防災マイスター
 */

const TOP_MASTER_TARGET = 10;


/* ==================================================
   初期化
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupParticipantAnalysis();

    }
);


/* ==================================================
   セットアップ
================================================== */

function setupParticipantAnalysis() {

    const refreshButton =
        document.getElementById(
            "refreshParticipantAnalysisButton"
        );


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            async () => {

                await loadParticipantAnalysis();

            }
        );

    }


    const analysisSection =
        document.getElementById(
            "participantAnalysisSection"
        );


    if (analysisSection) {

        const observer =
            new MutationObserver(
                mutations => {

                    mutations.forEach(
                        mutation => {

                            if (
                                mutation.attributeName ===
                                "class"
                            ) {

                                if (
                                    !analysisSection
                                        .classList
                                        .contains(
                                            "hidden"
                                        )
                                ) {

                                    loadParticipantAnalysis();

                                }

                            }

                        }
                    );

                }
            );


        observer.observe(
            analysisSection,
            {
                attributes: true
            }
        );

    }

}


/* ==================================================
   Supabase
================================================== */

function getAnalysisSupabaseClient() {

    if (
        typeof adminSupabaseClient !==
        "undefined" &&
        adminSupabaseClient
    ) {

        return adminSupabaseClient;

    }


    return null;

}


/* ==================================================
   分析データ読み込み
================================================== */

async function loadParticipantAnalysis() {

    const client =
        getAnalysisSupabaseClient();


    if (!client) {

        showAnalysisError(
            "Supabaseに接続できません。"
        );

        return;

    }


    try {

        showAnalysisLoading();


        const [
            participantsResult,
            participationsResult,
            trainingsResult
        ] =
            await Promise.all([

                client
                    .from("participants")
                    .select(
                        "id, participant_id, name, created_at"
                    ),

                client
                    .from("participations")
                    .select(
                        "id, participant_id, training_id, registered_at"
                    ),

                client
                    .from("trainings")
                    .select(
                        "*"
                    )

            ]);


        if (
            participantsResult.error
        ) {

            throw participantsResult.error;

        }


        if (
            participationsResult.error
        ) {

            throw participationsResult.error;

        }


        if (
            trainingsResult.error
        ) {

            throw trainingsResult.error;

        }


        analysisParticipants =
            participantsResult.data ||
            [];


        analysisParticipations =
            participationsResult.data ||
            [];


        analysisTrainings =
            trainingsResult.data ||
            [];


        renderParticipantAnalysis();


    } catch (error) {

        console.error(
            "Participant analysis error:",
            error
        );


        showAnalysisError(
            "参加者分析の読み込みに失敗しました。\n" +
            (
                error.message ||
                "不明なエラー"
            )
        );

    }

}


/* ==================================================
   メイン分析
================================================== */

function renderParticipantAnalysis() {

    const participantCount =
        analysisParticipants.length;


    const participationCount =
        analysisParticipations.length;


    /* ==================================================
       参加回数マップ
    ================================================== */

    const participationMap =
        {};


    analysisParticipants.forEach(
        participant => {

            participationMap[
                normalizeId(
                    participant.participant_id
                )
            ] = 0;

        }
    );


    analysisParticipations.forEach(
        participation => {

            const id =
                normalizeId(
                    participation.participant_id
                );


            if (
                Object.prototype.hasOwnProperty.call(
                    participationMap,
                    id
                )
            ) {

                participationMap[id]++;

            }

        }
    );


    /* ==================================================
       基本統計
    ================================================== */

    let activeCount = 0;

    let repeatCount = 0;

    let masterCount = 0;

    let topMasterCount = 0;


    analysisParticipants.forEach(
        participant => {

            const count =
                participationMap[
                    normalizeId(
                        participant.participant_id
                    )
                ] || 0;


            if (count >= 1) {

                activeCount++;

            }


            if (count >= 2) {

                repeatCount++;

            }


            if (count >= MASTER_TARGET) {

                masterCount++;

            }


            if (count >= TOP_MASTER_TARGET) {

                topMasterCount++;

            }

        }
    );


    const inactiveCount =
        Math.max(
            participantCount -
            activeCount,
            0
        );


    const participationRate =
        participantCount > 0
            ? (
                activeCount /
                participantCount *
                100
            )
            : 0;


    const averageParticipation =
        participantCount > 0
            ? (
                participationCount /
                participantCount
            )
            : 0;


    const masterRate =
        participantCount > 0
            ? (
                masterCount /
                participantCount *
                100
            )
            : 0;


    /* ==================================================
       訓練情報と参加履歴を結合
    ================================================== */

    const detailedParticipations =
        analysisParticipations.map(
            participation => {

                const training =
                    findTraining(
                        participation.training_id
                    );


                return {

                    ...participation,

                    training,

                    trainingDate:
                        getTrainingDate(
                            training
                        ),

                    trainingEndDate:
                        training?.training_end_date ||
                        null

                };

            }
        );


    /* ==================================================
       2026年度
    ================================================== */

    const fiscalYearParticipations =
        detailedParticipations.filter(
            item =>
                isInFiscalYear(
                    item.trainingDate,
                    ANALYSIS_FISCAL_YEAR
                )
        );


    const fiscalYearParticipantIds =
        new Set(
            fiscalYearParticipations
                .map(
                    item =>
                        normalizeId(
                            item.participant_id
                        )
                )
                .filter(Boolean)
        );


    const fiscalYearParticipantCount =
        fiscalYearParticipantIds.size;


    const fiscalYearParticipationCount =
        fiscalYearParticipations.length;


    /* ==================================================
       表示
    ================================================== */

    setText(
        "analysisTotalParticipants",
        participantCount
    );


    setText(
        "analysisActiveParticipants",
        activeCount
    );


    setText(
        "analysisInactiveParticipants",
        inactiveCount
    );


    setText(
        "analysisParticipationRate",
        participationRate.toFixed(1)
    );


    setText(
        "analysisAverageParticipation",
        averageParticipation.toFixed(1)
    );


    setText(
        "analysisRepeatParticipants",
        repeatCount
    );


    setText(
        "analysisMasterParticipants",
        masterCount
    );


    setText(
        "analysisTopMasterParticipants",
        topMasterCount
    );


    setText(
        "analysisMasterRate",
        masterRate.toFixed(1)
    );


    /* ==================================================
       参加回数分布
    ================================================== */

    const distribution =
        createDistribution(
            participationMap
        );


    renderDistributionChart(
        distribution
    );


    /* ==================================================
       月別分析
    ================================================== */

    renderMonthlyAnalysis(
        detailedParticipations
    );


    /* ==================================================
       参加者ランキング
    ================================================== */

    renderRanking(
        participationMap
    );


    /* ==================================================
       未参加者
    ================================================== */

    renderInactiveParticipants(
        participationMap
    );


    /* ==================================================
       参加者一覧
    ================================================== */

    renderParticipantTable(
        participationMap,
        detailedParticipations
    );


    /* ==================================================
       訓練別分析
    ================================================== */

    renderTrainingAnalysis(
        detailedParticipations
    );


    /* ==================================================
       年度統計
    ================================================== */

    renderFiscalYearSummary(
        fiscalYearParticipantCount,
        fiscalYearParticipationCount
    );

}


/* ==================================================
   訓練検索
================================================== */

function findTraining(
    trainingId
) {

    const target =
        normalizeId(
            trainingId
        );


    return (
        analysisTrainings.find(
            training =>
                normalizeId(
                    training.training_id
                ) === target
        ) ||
        null
    );

}


/* ==================================================
   訓練実施日
================================================== */

function getTrainingDate(
    training
) {

    if (!training) {

        return null;

    }


    if (
        training.training_date
    ) {

        return training.training_date;

    }


    if (
        training.date
    ) {

        return training.date;

    }


    return null;

}


/* ==================================================
   参加回数分布
================================================== */

function createDistribution(
    participationMap
) {

    const distribution = {

        zero: 0,

        one: 0,

        twoThree: 0,

        four: 0,

        fivePlus: 0

    };


    Object.values(
        participationMap
    ).forEach(
        count => {

            if (
                count === 0
            ) {

                distribution.zero++;

            } else if (
                count === 1
            ) {

                distribution.one++;

            } else if (
                count >= 2 &&
                count <= 3
            ) {

                distribution.twoThree++;

            } else if (
                count === 4
            ) {

                distribution.four++;

            } else {

                distribution.fivePlus++;

            }

        }
    );


    return distribution;

}


/* ==================================================
   参加回数分布グラフ
================================================== */

function renderDistributionChart(
    distribution
) {

    const canvas =
        document.getElementById(
            "participantDistributionChart"
        );


    if (!canvas) {

        return;

    }


    if (
        typeof Chart ===
        "undefined"
    ) {

        console.error(
            "Chart.jsが読み込まれていません。"
        );

        return;

    }


    if (
        participantAnalysisChart
    ) {

        participantAnalysisChart.destroy();

    }


    participantAnalysisChart =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels: [

                        "0回",

                        "1回",

                        "2～3回",

                        "4回",

                        "5回以上"

                    ],

                    datasets: [

                        {

                            label:
                                "参加者数",

                            data: [

                                distribution.zero,

                                distribution.one,

                                distribution.twoThree,

                                distribution.four,

                                distribution.fivePlus

                            ],

                            borderWidth: 1

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    plugins: {

                        legend: {

                            display: false

                        }

                    },

                    scales: {

                        y: {

                            beginAtZero: true,

                            ticks: {

                                precision: 0

                            }

                        }

                    }

                }

            }
        );

}


/* ==================================================
   月別分析
================================================== */

function renderMonthlyAnalysis(
    detailedParticipations
) {

    const canvas =
        document.getElementById(
            "participantMonthlyChart"
        );


    if (!canvas) {

        return;

    }


    if (
        typeof Chart ===
        "undefined"
    ) {

        return;

    }


    const months = [];

    const counts = [];


    const today =
        new Date();


    for (
        let i = 11;
        i >= 0;
        i--
    ) {

        const date =
            new Date(
                today.getFullYear(),
                today.getMonth() - i,
                1
            );


        const key =
            date.getFullYear() +
            "-" +
            String(
                date.getMonth() + 1
            ).padStart(
                2,
                "0"
            );


        months.push(
            key
        );


        counts.push(
            0
        );

    }


    detailedParticipations.forEach(
        item => {

            const date =
                parseDateValue(
                    item.trainingDate
                );


            if (!date) {

                return;

            }


            const key =
                date.getFullYear() +
                "-" +
                String(
                    date.getMonth() + 1
                ).padStart(
                    2,
                    "0"
                );


            const index =
                months.indexOf(
                    key
                );


            if (
                index !== -1
            ) {

                counts[index]++;

            }

        }
    );


    if (
        participantMonthlyChart
    ) {

        participantMonthlyChart.destroy();

    }


    participantMonthlyChart =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    labels:
                        months.map(
                            value =>
                                value.replace(
                                    "-",
                                    "/"
                                )
                        ),

                    datasets: [

                        {

                            label:
                                "延べ参加回数",

                            data:
                                counts,

                            tension:
                                0.25,

                            borderWidth:
                                2,

                            fill:
                                false

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    scales: {

                        y: {

                            beginAtZero:
                                true,

                            ticks: {

                                precision:
                                    0

                            }

                        }

                    }

                }

            }
        );

}


/* ==================================================
   認定バッジ
================================================== */

function createMasterBadge(
    count
) {

    if (
        count >= TOP_MASTER_TARGET
    ) {

        return `<span class="analysis-status top-master">★トップ</span>`;

    }


    if (
        count >= MASTER_TARGET
    ) {

        return `<span class="analysis-status master">マイスター</span>`;

    }


    return "";

}


/* ==================================================
   参加者ランキング
================================================== */

function renderRanking(
    participationMap
) {

    const container =
        document.getElementById(
            "analysisRanking"
        );


    if (!container) {

        return;

    }


    const ranking =
        analysisParticipants

            .map(
                participant => ({

                    participant,

                    count:
                        participationMap[
                            normalizeId(
                                participant.participant_id
                            )
                        ] || 0

                })
            )

            .sort(
                (a, b) =>
                    b.count -
                    a.count
            );


    if (
        ranking.length === 0
    ) {

        container.innerHTML =
            `
            <div class="analysis-empty">
                参加者が登録されていません。
            </div>
            `;

        return;

    }


    container.innerHTML =
        "";


    ranking
        .slice(
            0,
            10
        )
        .forEach(
            (item, index) => {

                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "analysis-ranking-item";


                row.innerHTML = `

                    <span
                        class="analysis-rank"
                    >
                        ${index + 1}
                    </span>

                    <div
                        class="analysis-ranking-name"
                    >
                        ${escapeHtml(
                            item.participant.name ||
                            "名前未登録"
                        )}

                        ${createMasterBadge(
                            item.count
                        )}
                    </div>

                    <strong>
                        ${item.count}
                        <span>回</span>
                    </strong>

                `;


                container.appendChild(
                    row
                );

            }
        );

}


/* ==================================================
   未参加者
================================================== */

function renderInactiveParticipants(
    participationMap
) {

    const container =
        document.getElementById(
            "analysisInactiveList"
        );


    if (!container) {

        return;

    }


    const inactive =
        analysisParticipants

            .filter(
                participant =>
                    (
                        participationMap[
                            normalizeId(
                                participant.participant_id
                            )
                        ] || 0
                    ) === 0
            )

            .sort(
                (a, b) =>
                    String(
                        a.name || ""
                    ).localeCompare(
                        String(
                            b.name || ""
                        ),
                        "ja"
                    )
            );


    if (
        inactive.length === 0
    ) {

        container.innerHTML =
            `
            <div class="analysis-empty success">
                全員が1回以上参加しています。
            </div>
            `;

        return;

    }


    container.innerHTML =
        "";


    inactive.forEach(
        participant => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "analysis-inactive-item";


            item.innerHTML = `

                <span>
                    ${escapeHtml(
                        participant.name ||
                        "名前未登録"
                    )}
                </span>

                <span
                    class="inactive-badge"
                >
                    未参加
                </span>

            `;


            container.appendChild(
                item
            );

        }
    );

}


/* ==================================================
   参加者別分析
================================================== */

function renderParticipantTable(
    participationMap,
    detailedParticipations
) {

    const tbody =
        document.getElementById(
            "participantAnalysisTable"
        );


    if (!tbody) {

        return;

    }


    const ranking =
        analysisParticipants

            .map(
                participant => {

                    const participantId =
                        normalizeId(
                            participant.participant_id
                        );


                    const count =
                        participationMap[
                            participantId
                        ] || 0;


                    const records =
                        detailedParticipations.filter(
                            item =>
                                normalizeId(
                                    item.participant_id
                                ) === participantId
                        );


                    const validDates =
                        records

                            .map(
                                item =>
                                    parseDateValue(
                                        item.trainingDate
                                    )
                            )

                            .filter(Boolean);


                    validDates.sort(
                        (a, b) =>
                            a - b
                    );


                    return {

                        participant,

                        count,

                        firstDate:
                            validDates[0] ||
                            null,

                        latestDate:
                            validDates[
                                validDates.length - 1
                            ] ||
                            null

                    };

                }
            )

            .sort(
                (a, b) => {

                    if (
                        b.count !==
                        a.count
                    ) {

                        return (
                            b.count -
                            a.count
                        );

                    }


                    return String(
                        a.participant.name ||
                        ""
                    ).localeCompare(
                        String(
                            b.participant.name ||
                            ""
                        ),
                        "ja"
                    );

                }
            );


    tbody.innerHTML =
        "";


    if (
        ranking.length === 0
    ) {

        tbody.innerHTML =
            `
            <tr>
                <td colspan="4">
                    参加者が登録されていません。
                </td>
            </tr>
            `;

        return;

    }


    ranking.forEach(
        (item, index) => {

            let status = "";


            if (
                item.count === 0
            ) {

                status =
                    `
                    <span
                        class="analysis-status inactive"
                    >
                        未参加
                    </span>
                    `;

            } else if (
                item.count >=
                TOP_MASTER_TARGET
            ) {

                status =
                    `
                    <span
                        class="analysis-status top-master"
                    >
                        トップマイスター
                    </span>
                    `;

            } else if (
                item.count >=
                MASTER_TARGET
            ) {

                status =
                    `
                    <span
                        class="analysis-status master"
                    >
                        マイスター
                    </span>
                    `;

            } else if (
                item.count >= 2
            ) {

                status =
                    `
                    <span
                        class="analysis-status repeat"
                    >
                        リピーター
                    </span>
                    `;

            } else {

                status =
                    `
                    <span
                        class="analysis-status active"
                    >
                        参加経験あり
                    </span>
                    `;

            }


            const tr =
                document.createElement(
                    "tr"
                );


            tr.innerHTML = `

                <td>
                    ${index + 1}
                </td>

                <td>
                    ${escapeHtml(
                        item.participant.name ||
                        "名前未登録"
                    )}
                </td>

                <td>

                    <strong>
                        ${item.count}
                    </strong>

                    回

                    ${
                        item.latestDate
                            ? `
                                <br>
                                <small>
                                    最終：
                                    ${formatDate(
                                        item.latestDate
                                    )}
                                </small>
                              `
                            : ""
                    }

                </td>

                <td>
                    ${status}
                </td>

            `;


            tbody.appendChild(
                tr
            );

        }
    );

}


/* ==================================================
   訓練別分析
================================================== */

function renderTrainingAnalysis(
    detailedParticipations
) {

    const container =
        document.getElementById(
            "trainingAnalysisList"
        );


    if (!container) {

        return;

    }


    const map =
        {};


    detailedParticipations.forEach(
        item => {

            const training =
                item.training;


            const id =
                normalizeId(
                    item.training_id
                );


            if (!id) {

                return;

            }


            if (!map[id]) {

                map[id] = {

                    training,

                    count: 0,

                    participantIds:
                        new Set()

                };

            }


            map[id].count++;


            map[id]
                .participantIds
                .add(
                    normalizeId(
                        item.participant_id
                    )
                );

        }
    );


    const ranking =
        Object.values(
            map
        )
            .sort(
                (a, b) =>
                    b.count -
                    a.count
            );


    if (
        ranking.length === 0
    ) {

        container.innerHTML =
            `
            <div class="analysis-empty">
                参加記録がありません。
            </div>
            `;

        return;

    }


    container.innerHTML =
        "";


    ranking.forEach(
        item => {

            const training =
                item.training;


            const title =
                training?.title ||
                "訓練・講座";


            const date =
                getTrainingDate(
                    training
                );


            const endDate =
                training?.training_end_date ||
                null;


            const location =
                training?.location ||
                "";


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "analysis-training-item";


            row.innerHTML = `

                <div>

                    <strong>
                        ${escapeHtml(
                            title
                        )}
                    </strong>

                    <span>
                        実施日：
                        ${escapeHtml(
                            formatDatePeriod(
                                date,
                                endDate
                            )
                        )}
                    </span>

                    ${
                        location
                            ? `
                                <span>
                                    場所：
                                    ${escapeHtml(
                                        location
                                    )}
                                </span>
                              `
                            : ""
                    }

                </div>


                <strong>
                    ${item.count}
                    <span>人</span>
                </strong>

            `;


            container.appendChild(
                row
            );

        }
    );

}


/* ==================================================
   年度サマリー
================================================== */

function renderFiscalYearSummary(
    participantCount,
    participationCount
) {

    setText(
        "analysisFiscalYearParticipants",
        participantCount
    );


    setText(
        "analysisFiscalYearParticipations",
        participationCount
    );

}


/* ==================================================
   ローディング
================================================== */

function showAnalysisLoading() {

    const ids = [

        "analysisTotalParticipants",

        "analysisActiveParticipants",

        "analysisInactiveParticipants",

        "analysisParticipationRate",

        "analysisAverageParticipation",

        "analysisRepeatParticipants",

        "analysisMasterParticipants",

        "analysisTopMasterParticipants",

        "analysisMasterRate",

        "analysisFiscalYearParticipants",

        "analysisFiscalYearParticipations"

    ];


    ids.forEach(
        id => {

            setText(
                id,
                "..."
            );

        }
    );


    const ranking =
        document.getElementById(
            "analysisRanking"
        );


    if (ranking) {

        ranking.innerHTML =
            `
            <div class="analysis-loading">
                読み込み中...
            </div>
            `;

    }


    const inactive =
        document.getElementById(
            "analysisInactiveList"
        );


    if (inactive) {

        inactive.innerHTML =
            `
            <div class="analysis-loading">
                読み込み中...
            </div>
            `;

    }


    const table =
        document.getElementById(
            "participantAnalysisTable"
        );


    if (table) {

        table.innerHTML =
            `
            <tr>
                <td colspan="4">
                    読み込み中...
                </td>
            </tr>
            `;

    }


    const trainingList =
        document.getElementById(
            "trainingAnalysisList"
        );


    if (trainingList) {

        trainingList.innerHTML =
            `
            <div class="analysis-loading">
                読み込み中...
            </div>
            `;

    }

}


/* ==================================================
   エラー
================================================== */

function showAnalysisError(
    message
) {

    const ranking =
        document.getElementById(
            "analysisRanking"
        );


    if (ranking) {

        ranking.innerHTML =
            `
            <div class="analysis-error">
                ${escapeHtml(
                    message
                )}
            </div>
            `;

    }


    const inactive =
        document.getElementById(
            "analysisInactiveList"
        );


    if (inactive) {

        inactive.innerHTML =
            `
            <div class="analysis-error">
                ${escapeHtml(
                    message
                )}
            </div>
            `;

    }


    const table =
        document.getElementById(
            "participantAnalysisTable"
        );


    if (table) {

        table.innerHTML =
            `
            <tr>
                <td colspan="4">
                    読み込みに失敗しました。
                </td>
            </tr>
            `;

    }

}


/* ==================================================
   年度判定
================================================== */

function isInFiscalYear(
    value,
    fiscalYear
) {

    const date =
        parseDateValue(
            value
        );


    if (!date) {

        return false;

    }


    const start =
        new Date(
            fiscalYear,
            3,
            1,
            0,
            0,
            0,
            0
        );


    const end =
        new Date(
            fiscalYear + 1,
            2,
            31,
            23,
            59,
            59,
            999
        );


    return (
        date >= start &&
        date <= end
    );

}


/* ==================================================
   日付解析
================================================== */

function parseDateValue(
    value
) {

    if (!value) {

        return null;

    }


    if (
        value instanceof Date
    ) {

        return isNaN(
            value.getTime()
        )
            ? null
            : value;

    }


    const text =
        String(
            value
        ).trim();


    if (!text) {

        return null;

    }


    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            text
        )
    ) {

        const [
            year,
            month,
            day
        ] =
            text
                .split("-")
                .map(Number);


        const date =
            new Date(
                year,
                month - 1,
                day
            );


        return isNaN(
            date.getTime()
        )
            ? null
            : date;

    }


    const date =
        new Date(
            text
        );


    return isNaN(
        date.getTime()
    )
        ? null
        : date;

}


/* ==================================================
   日付表示
================================================== */

function formatDate(
    value
) {

    const date =
        parseDateValue(
            value
        );


    if (!date) {

        return "-";

    }


    return (

        date.getFullYear() +

        "/" +

        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        ) +

        "/" +

        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        )

    );

}


/* ==================================================
   開催期間表示
   複数日開催に対応
================================================== */

function formatDatePeriod(
    startValue,
    endValue
) {

    const start =
        formatDate(
            startValue
        );


    if (
        !endValue ||
        String(endValue) === String(startValue)
    ) {

        return start;

    }


    const end =
        formatDate(
            endValue
        );


    if (
        end === "-"
    ) {

        return start;

    }


    return `${start}〜${end}`;

}


/* ==================================================
   ID正規化
================================================== */

function normalizeId(
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
    ).trim();

}


/* ==================================================
   テキスト
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
   HTMLエスケープ
================================================== */

function escapeHtml(
    value
) {

    return String(
        value ??
        ""
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
   admin.js から呼び出せるよう公開
================================================== */

window.loadParticipantAnalysis =
    loadParticipantAnalysis;


})();

/* ==================================================
   岩瀬自治会 防災アプリ
   参加者カルテ

   ・training_date 対応
   ・PDF出力対応
   ・複数日開催の表示に対応
   ・いわぽんトップ防災マイスターに対応
================================================== */

(function () {

"use strict";


/* ==================================================
   設定
================================================== */

const CURRENT_FISCAL_YEAR = 2026;


/*
 * いわぽん防災マイスター
 */

const CERTIFICATION_TARGET = 5;


/*
 * いわぽんトップ防災マイスター
 */

const TOP_CERTIFICATION_TARGET = 10;


/* ==================================================
   初期化
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        createParticipantCardModal();

        setupParticipantCardEvents();

        setupParticipantCardButtonObserver();

    }
);


/* ==================================================
   モーダル作成
================================================== */

function createParticipantCardModal() {

    if (
        document.getElementById(
            "participantCardModal"
        )
    ) {

        return;

    }


    const modal =
        document.createElement("div");


    modal.id =
        "participantCardModal";

    modal.className =
        "modal hidden";


    modal.innerHTML = `

        <div class="modal-content large-modal participant-card-modal">

            <div class="participant-card-modal-header">

                <h2 id="participantCardTitle">
                    参加者カルテ
                </h2>


                <div
                    style="
                        display:flex;
                        align-items:center;
                        gap:8px;
                        flex-wrap:wrap;
                    "
                >

                    <button
                        type="button"
                        id="exportParticipantCardPdfButton"
                        class="secondary-button"
                    >
                        📄 PDF出力
                    </button>


                    <button
                        type="button"
                        id="closeParticipantCardButton"
                        class="participant-card-close"
                        aria-label="閉じる"
                    >
                        ×
                    </button>

                </div>

            </div>


            <div
                id="participantCardContent"
                class="participant-card-content"
            >
                読み込み中...
            </div>


            <div class="modal-buttons">

                <button
                    type="button"
                    id="participantCardCloseButton"
                    class="secondary-button"
                >
                    閉じる
                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );

}


/* ==================================================
   イベント設定
================================================== */

function setupParticipantCardEvents() {

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    '[data-action="participant-card"]'
                );


            if (!button) {

                return;

            }


            event.preventDefault();


            const id =
                button.dataset.id;


            if (!id) {

                return;

            }


            openParticipantCard(
                id
            );

        }
    );


    document
        .getElementById(
            "closeParticipantCardButton"
        )
        ?.addEventListener(
            "click",
            closeParticipantCard
        );


    document
        .getElementById(
            "participantCardCloseButton"
        )
        ?.addEventListener(
            "click",
            closeParticipantCard
        );


    /*
     * PDF出力
     */

    document
        .getElementById(
            "exportParticipantCardPdfButton"
        )
        ?.addEventListener(
            "click",
            () => {

                if (
                    typeof window.exportParticipantCardPdf ===
                    "function"
                ) {

                    window.exportParticipantCardPdf();

                } else {

                    alert(
                        "PDF出力機能を読み込めませんでした。\n" +
                        "pdf-export.js が読み込まれているか確認してください。"
                    );

                }

            }
        );


    /*
     * モーダル外側クリック
     */

    document.addEventListener(
        "click",
        event => {

            const modal =
                document.getElementById(
                    "participantCardModal"
                );


            if (
                event.target === modal
            ) {

                closeParticipantCard();

            }

        }
    );

}


/* ==================================================
   既存参加者一覧のボタン監視
================================================== */

function setupParticipantCardButtonObserver() {

    replaceParticipantHistoryButtons();


    const observer =
        new MutationObserver(
            () => {

                replaceParticipantHistoryButtons();

            }
        );


    const target =
        document.getElementById(
            "participantsTable"
        );


    if (target) {

        observer.observe(
            target,
            {
                childList: true,
                subtree: true
            }
        );

    }

}


/* ==================================================
   参加履歴ボタン
   → 参加者カルテ
================================================== */

function replaceParticipantHistoryButtons() {

    const buttons =
        document.querySelectorAll(
            '#participantsTable [data-action="participant-history"]'
        );


    buttons.forEach(
        button => {

            button.dataset.action =
                "participant-card";


            button.textContent =
                "参加者カルテ";

        }
    );

}


/* ==================================================
   参加者カルテ
================================================== */

async function openParticipantCard(
    databaseId
) {

    const modal =
        document.getElementById(
            "participantCardModal"
        );


    const title =
        document.getElementById(
            "participantCardTitle"
        );


    const content =
        document.getElementById(
            "participantCardContent"
        );


    if (!modal || !content) {

        return;

    }


    modal.classList.remove(
        "hidden"
    );


    content.innerHTML = `
        <div class="participant-card-loading">
            読み込み中...
        </div>
    `;


    try {

        /* ==================================================
           参加者取得
        ================================================== */

        const {
            data: participant,
            error: participantError
        } =
            await adminSupabaseClient
                .from("participants")
                .select("*")
                .eq(
                    "id",
                    databaseId
                )
                .single();


        if (participantError) {

            throw participantError;

        }


        if (!participant) {

            throw new Error(
                "参加者が見つかりませんでした。"
            );

        }


        title.textContent =
            `${participant.name || "名前未登録"}さんの参加者カルテ`;


        /* ==================================================
           参加履歴取得
        ================================================== */

        const {
            data: participations,
            error: participationError
        } =
            await adminSupabaseClient
                .from("participations")
                .select(
                    "id, participant_id, training_id, registered_at"
                )
                .eq(
                    "participant_id",
                    participant.participant_id
                );


        if (participationError) {

            throw participationError;

        }


        const history =
            participations || [];


        /* ==================================================
           訓練情報取得
        ================================================== */

        const {
            data: trainings,
            error: trainingError
        } =
            await adminSupabaseClient
                .from("trainings")
                .select("*");


        if (trainingError) {

            throw trainingError;

        }


        const trainingList =
            trainings || [];


        /* ==================================================
           参加履歴と訓練情報を結合
        ================================================== */

        const detailedHistory =
            history.map(
                item => {

                    const participationTrainingId =
                        normalizeId(
                            item.training_id
                        );


                    const training =
                        trainingList.find(
                            training =>
                                normalizeId(
                                    training.training_id
                                ) ===
                                participationTrainingId
                        );


                    return {

                        ...item,

                        training,

                        /*
                         * registered_at は絶対に
                         * 実施日の代用にしない
                         */

                        eventDate:
                            getTrainingDate(
                                training
                            ),

                        eventEndDate:
                            training?.training_end_date ||
                            null

                    };

                }
            );


        /* ==================================================
           訓練実施日で並び替え
        ================================================== */

        detailedHistory.sort(
            (a, b) =>
                getDateTimestamp(
                    b.eventDate
                ) -
                getDateTimestamp(
                    a.eventDate
                )
        );


        /* ==================================================
           総参加回数
        ================================================== */

        const count =
            detailedHistory.length;


        /* ==================================================
           2026年度参加回数
        ================================================== */

        const fiscalYearHistory =
            detailedHistory.filter(
                item =>
                    isInFiscalYear(
                        item.eventDate,
                        CURRENT_FISCAL_YEAR
                    )
            );


        const fiscalYearCount =
            fiscalYearHistory.length;


        /* ==================================================
           参加種類
        ================================================== */

        const uniqueTrainingIds =
            new Set(
                detailedHistory
                    .map(
                        item =>
                            normalizeId(
                                item.training_id
                            )
                    )
                    .filter(Boolean)
            );


        const trainingCount =
            uniqueTrainingIds.size;


        /* ==================================================
           初回・最終参加
        ================================================== */

        const validHistory =
            detailedHistory.filter(
                item =>
                    !!parseDateValue(
                        item.eventDate
                    )
            );


        const chronologicalHistory =
            [...validHistory].sort(
                (a, b) =>
                    getDateTimestamp(
                        a.eventDate
                    ) -
                    getDateTimestamp(
                        b.eventDate
                    )
            );


        const first =
            chronologicalHistory.length
                ? chronologicalHistory[0]
                : null;


        const latest =
            chronologicalHistory.length
                ? chronologicalHistory[
                    chronologicalHistory.length - 1
                ]
                : null;


        /* ==================================================
           参加状態
        ================================================== */

        let participationStatus =
            "未参加";


        if (count === 1) {

            participationStatus =
                "初参加";

        }


        if (count >= 2) {

            participationStatus =
                "リピーター";

        }


        /* ==================================================
           いわぽん防災マイスター
           いわぽんトップ防災マイスター
        ================================================== */

        const certified =
            count >=
            CERTIFICATION_TARGET;


        const topCertified =
            count >=
            TOP_CERTIFICATION_TARGET;


        /*
         * 次に目指す認定
         */

        const nextTarget =
            certified
                ? TOP_CERTIFICATION_TARGET
                : CERTIFICATION_TARGET;


        const progress =
            Math.min(
                (
                    count /
                    nextTarget
                ) *
                100,
                100
            );


        const remaining =
            Math.max(
                nextTarget -
                count,
                0
            );


        const certificationClass =
            topCertified
                ? "top-certified"
                : certified
                    ? "certified"
                    : "not-certified";


        const certificationLabel =
            topCertified
                ? "★ いわぽんトップ防災マイスター"
                : certified
                    ? "いわぽん防災マイスター"
                    : participationStatus;


        /* ==================================================
           HTML
        ================================================== */

        content.innerHTML = `

            <div class="participant-card">


                <!-- ==========================================
                     基本情報
                =========================================== -->

                <div class="participant-card-profile">

                    <div class="participant-card-profile-main">

                        <div class="participant-card-eyebrow">
                            PARTICIPANT
                        </div>


                        <h3>
                            ${escapeHtml(
                                participant.name ||
                                "名前未登録"
                            )}
                        </h3>


                        <p>
                            参加者ID：
                            ${escapeHtml(
                                participant.participant_id ||
                                "-"
                            )}
                        </p>

                    </div>


                    <div
                        class="
                            participant-card-status
                            ${certificationClass}
                        "
                    >

                        ${certificationLabel}

                    </div>

                </div>


                <!-- ==========================================
                     統計
                =========================================== -->

                <div class="participant-card-stat-grid">


                    <div class="participant-card-stat">

                        <span>
                            総参加回数
                        </span>

                        <strong>
                            ${count}
                        </strong>

                        <small>
                            回
                        </small>

                    </div>


                    <div class="participant-card-stat">

                        <span>
                            2026年度
                        </span>

                        <strong>
                            ${fiscalYearCount}
                        </strong>

                        <small>
                            回
                        </small>

                    </div>


                    <div class="participant-card-stat">

                        <span>
                            参加種類
                        </span>

                        <strong>
                            ${trainingCount}
                        </strong>

                        <small>
                            種類
                        </small>

                    </div>


                    <div class="participant-card-stat">

                        <span>
                            最終参加
                        </span>

                        <strong>
                            ${
                                latest
                                    ? formatDate(
                                        latest.eventDate
                                    )
                                    : "-"
                            }
                        </strong>

                    </div>


                </div>


                <!-- ==========================================
                     初回・最終・登録日
                =========================================== -->

                <div class="participant-card-info">


                    <div>

                        <span>
                            初回参加日
                        </span>

                        <strong>
                            ${
                                first
                                    ? formatDate(
                                        first.eventDate
                                    )
                                    : "-"
                            }
                        </strong>

                    </div>


                    <div>

                        <span>
                            最終参加日
                        </span>

                        <strong>
                            ${
                                latest
                                    ? formatDate(
                                        latest.eventDate
                                    )
                                    : "-"
                            }
                        </strong>

                    </div>


                    <div>

                        <span>
                            登録日
                        </span>

                        <strong>
                            ${
                                participant.created_at
                                    ? formatDate(
                                        participant.created_at
                                    )
                                    : "-"
                            }
                        </strong>

                    </div>


                </div>


                <!-- ==========================================
                     2026年度
                =========================================== -->

                <div class="participant-card-progress">

                    <div
                        class="participant-card-progress-header"
                    >

                        <div>

                            <strong>
                                2026年度の参加状況
                            </strong>

                            <span>
                                4月1日〜翌年3月31日
                            </span>

                        </div>


                        <strong>
                            ${fiscalYearCount}回
                        </strong>

                    </div>


                    <p>

                        ${
                            fiscalYearCount === 0
                                ? "2026年度はまだ参加していません。"
                                : `2026年度に${fiscalYearCount}回参加しています。`
                        }

                    </p>

                </div>


                <!-- ==========================================
                     いわぽん防災マイスター
                =========================================== -->

                <div class="participant-card-progress">

                    <div
                        class="participant-card-progress-header"
                    >

                        <div>

                            <strong>
                                いわぽん防災マイスター認定状況
                            </strong>

                            <span>
                                ${CERTIFICATION_TARGET}回で防災マイスター／${TOP_CERTIFICATION_TARGET}回でトップ防災マイスター
                            </span>

                        </div>


                        <strong>
                            ${Math.min(
                                count,
                                nextTarget
                            )}
                            /
                            ${nextTarget}
                        </strong>

                    </div>


                    <div
                        class="participant-card-progress-track"
                    >

                        <div
                            class="participant-card-progress-bar"
                            style="width:${progress}%"
                        ></div>

                    </div>


                    <p>

                        ${
                            topCertified
                                ? "いわぽんトップ防災マイスターに認定されています。"
                                : certified
                                    ? `いわぽん防災マイスターに認定されています。あと${remaining}回の参加でトップ防災マイスターです。`
                                    : `あと${remaining}回の参加でいわぽん防災マイスターです。`
                        }

                    </p>

                </div>


                <!-- ==========================================
                     参加履歴
                =========================================== -->

                <div class="participant-card-history">


                    <div
                        class="participant-card-section-title"
                    >

                        <div>

                            <h3>
                                参加履歴
                            </h3>

                            <p>
                                この参加者のすべての参加記録
                            </p>

                        </div>


                        <span>
                            ${count}件
                        </span>

                    </div>


                    ${
                        detailedHistory.length === 0

                            ? `

                                <div
                                    class="participant-card-empty"
                                >
                                    参加履歴はありません。
                                </div>

                              `

                            : `

                                <div
                                    class="participant-card-history-list"
                                >

                                    ${
                                        detailedHistory
                                            .map(
                                                item =>
                                                    createHistoryItemHtml(
                                                        item
                                                    )
                                            )
                                            .join("")
                                    }

                                </div>

                              `
                    }

                </div>


            </div>

        `;


        /* ==================================================
           削除イベント
        ================================================== */

        content
            .querySelectorAll(
                ".participant-card-delete"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            const id =
                                String(
                                    button.dataset
                                        .participationId ||
                                    ""
                                ).trim();


                            if (!id) {

                                alert(
                                    "参加記録IDを取得できませんでした。"
                                );

                                return;

                            }


                            if (
                                !confirm(
                                    "この参加記録を削除しますか？"
                                )
                            ) {

                                return;

                            }


                            try {

                                const {
                                    error
                                } =
                                    await adminSupabaseClient
                                        .from(
                                            "participations"
                                        )
                                        .delete()
                                        .eq(
                                            "id",
                                            id
                                        );


                                if (error) {

                                    throw error;

                                }


                                alert(
                                    "参加記録を削除しました。"
                                );


                                /*
                                 * カルテ再読み込み
                                 */

                                await openParticipantCard(
                                    databaseId
                                );


                                /*
                                 * 参加者一覧も更新
                                 */

                                if (
                                    typeof loadAllData ===
                                    "function"
                                ) {

                                    await loadAllData();

                                }


                            } catch (error) {

                                console.error(
                                    "Delete participation error:",
                                    error
                                );


                                alert(
                                    "参加記録の削除に失敗しました。\n" +
                                    (
                                        error.message ||
                                        "不明なエラー"
                                    )
                                );

                            }

                        }
                    );

                }
            );


    } catch (error) {

        console.error(
            "Participant card error:",
            error
        );


        content.innerHTML = `

            <div class="participant-card-error">

                参加者カルテの読み込みに失敗しました。

                <br><br>

                ${escapeHtml(
                    error.message ||
                    "不明なエラー"
                )}

            </div>

        `;

    }

}


/* ==================================================
   参加履歴の1件分
================================================== */

function createHistoryItemHtml(
    item
) {

    const training =
        item.training;


    const title =
        training?.title ||
        item.training_id ||
        "訓練・講座";


    const location =
        training?.location ||
        "";


    const trainingDate =
        item.eventDate
            ? formatDatePeriod(
                item.eventDate,
                item.eventEndDate
            )
            : "-";


    const registeredDate =
        item.registered_at
            ? formatDate(
                item.registered_at
            )
            : "-";


    return `

        <div
            class="participant-card-history-item"
            data-history-id="${escapeHtml(
                String(
                    item.id
                )
            )}"
        >

            <div>

                <strong>
                    ${escapeHtml(
                        title
                    )}
                </strong>


                <span>
                    実施日：
                    ${escapeHtml(
                        trainingDate
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


                <span>
                    参加登録日：
                    ${escapeHtml(
                        registeredDate
                    )}
                </span>

            </div>


            <button
                type="button"
                class="
                    action-button
                    delete-button
                    participant-card-delete
                "
                data-participation-id="${escapeHtml(
                    String(
                        item.id
                    )
                )}"
            >
                削除
            </button>

        </div>

    `;

}


/* ==================================================
   訓練実施日取得

   正式カラム：training_date

   重要：
   registered_at は実施日の代用にしない
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


    /*
     * 旧 date カラムへの予備対応
     */

    if (
        training.date
    ) {

        return training.date;

    }


    return null;

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
   年度判定
================================================== */

function isInFiscalYear(
    dateValue,
    fiscalYear
) {

    const date =
        parseDateValue(
            dateValue
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
   日付Timestamp
================================================== */

function getDateTimestamp(
    value
) {

    const date =
        parseDateValue(
            value
        );


    return date
        ? date.getTime()
        : 0;

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
        String(value).trim();


    if (!text) {

        return null;

    }


    /*
     * YYYY-MM-DD
     *
     * UTC解釈を避けるため
     * ローカル日付として生成
     */

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


    const parsed =
        new Date(text);


    return isNaN(
        parsed.getTime()
    )
        ? null
        : parsed;

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
        ).padStart(2, "0") +
        "/" +
        String(
            date.getDate()
        ).padStart(2, "0")
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
   モーダルを閉じる
================================================== */

function closeParticipantCard() {

    const modal =
        document.getElementById(
            "participantCardModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }

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

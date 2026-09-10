/* ==================================================
   岩瀬自治会 防災アプリ
   参加者フォローアップ・参加者カルテ発展版

   機能
   ・最近参加していない人の自動抽出
   ・参加状態の自動判定
   ・最終参加日 / 経過日数の表示
   ・参加者分析から参加者カルテを開く
   ・参加者カルテに詳細な参加状態を追加

   判定基準
   180日以上参加なし → 最近不参加
   365日以上参加なし → 長期不参加
   参加履歴なし       → 訓練未参加

   要フォロー
   最近不参加 + 長期不参加 + 訓練未参加
================================================== */

(function () {

"use strict";


/* ==================================================
   設定
================================================== */

const RECENT_INACTIVE_DAYS = 180;

const LONG_INACTIVE_DAYS = 365;


/* ==================================================
   初期化
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupFollowup();

    }
);


/* ==================================================
   セットアップ
================================================== */

function setupFollowup() {

    createFollowupArea();

    observeAnalysisSection();

    observeParticipantCard();

}


/* ==================================================
   Supabase
================================================== */

function getClient() {

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
   フォローアップエリア作成
================================================== */

function createFollowupArea() {

    const section =
        document.getElementById(
            "participantAnalysisSection"
        );


    if (!section) {

        return;

    }


    if (
        document.getElementById(
            "participantFollowupArea"
        )
    ) {

        return;

    }


    const area =
        document.createElement("div");

    area.id =
        "participantFollowupArea";

    area.className =
        "participant-followup-area";


    area.innerHTML = `

        <div class="participant-followup-header">

            <div>

                <h3>
                    要フォローの参加者
                </h3>

                <p>
                    最近不参加・長期不参加・訓練未参加者を自動抽出しています。
                </p>

            </div>

            <button
                type="button"
                id="refreshParticipantFollowup"
                class="secondary-button"
            >
                ↻ 更新
            </button>

        </div>


        <div
            id="participantFollowupStats"
            class="participant-followup-stats"
        >

            <div class="followup-stat">
                <span>
                    最近不参加
                </span>
                <strong id="recentInactiveCount">
                    0
                </strong>
                <small>
                    180日以上
                </small>
            </div>


            <div class="followup-stat">
                <span>
                    長期不参加
                </span>
                <strong id="longInactiveCount">
                    0
                </strong>
                <small>
                    365日以上
                </small>
            </div>


            <div class="followup-stat">
                <span>
                    訓練未参加
                </span>
                <strong id="neverParticipatedCount">
                    0
                </strong>
                <small>
                    参加履歴なし
                </small>
            </div>


            <div class="followup-stat">
                <span>
                    要フォロー
                </span>
                <strong id="followupTargetCount">
                    0
                </strong>
                <small>
                    3区分の合計
                </small>
            </div>

        </div>


        <div
            id="participantFollowupList"
            class="participant-followup-list"
        >
            読み込み中...
        </div>

    `;


    const firstCard =
        section.querySelector(
            ".dashboard-card"
        );


    if (firstCard) {

        section.insertBefore(
            area,
            firstCard
        );

    } else {

        section.appendChild(area);

    }


    document
        .getElementById(
            "refreshParticipantFollowup"
        )
        ?.addEventListener(
            "click",
            loadFollowupData
        );


    loadFollowupData();

}


/* ==================================================
   分析画面監視
================================================== */

function observeAnalysisSection() {

    const section =
        document.getElementById(
            "participantAnalysisSection"
        );


    if (!section) {

        return;

    }


    const observer =
        new MutationObserver(
            mutations => {

                mutations.forEach(
                    mutation => {

                        if (
                            mutation.attributeName !==
                            "class"
                        ) {

                            return;

                        }


                        if (
                            !section.classList.contains(
                                "hidden"
                            )
                        ) {

                            loadFollowupData();

                        }

                    }
                );

            }
        );


    observer.observe(
        section,
        {
            attributes: true
        }
    );

}


/* ==================================================
   データ読み込み
================================================== */

async function loadFollowupData() {

    const client =
        getClient();


    const list =
        document.getElementById(
            "participantFollowupList"
        );


    if (!client || !list) {

        return;

    }


    list.innerHTML = `
        <div class="followup-loading">
            読み込み中...
        </div>
    `;


    try {

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
                    .select("*")

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


        const participants =
            participantsResult.data ||
            [];


        const participations =
            participationsResult.data ||
            [];


        const trainings =
            trainingsResult.data ||
            [];


        const records =
            createParticipantRecords(
                participants,
                participations,
                trainings
            );


        renderFollowup(
            records
        );


    } catch (error) {

        console.error(
            "Participant followup error:",
            error
        );


        list.innerHTML = `
            <div class="followup-error">
                参加者フォローアップ情報を
                読み込めませんでした。
                <br>
                ${escapeHtml(
                    error.message
                )}
            </div>
        `;

    }

}


/* ==================================================
   参加者データ作成
================================================== */

function createParticipantRecords(
    participants,
    participations,
    trainings
) {

    const today =
        new Date();


    const trainingMap =
        new Map();


    trainings.forEach(
        training => {

            trainingMap.set(
                String(
                    training.training_id
                ).trim(),
                training
            );

        }
    );


    return participants.map(
        participant => {

            const participantId =
                String(
                    participant.participant_id
                ).trim();


            const history =
                participations
                    .filter(
                        item =>
                            String(
                                item.participant_id
                            ).trim() ===
                            participantId
                    )
                    .map(
                        item => {

                            const training =
                                trainingMap.get(
                                    String(
                                        item.training_id
                                    ).trim()
                                );


                            const date =
                                getTrainingDate(
                                    training,
                                    item.registered_at
                                );


                            return {

                                ...item,

                                training,

                                eventDate:
                                    date

                            };

                        }
                    )
                    .filter(
                        item =>
                            item.eventDate
                    )
                    .sort(
                        (a, b) =>
                            getTimestamp(
                                b.eventDate
                            ) -
                            getTimestamp(
                                a.eventDate
                            )
                    );


            const latest =
                history.length
                    ? history[0]
                    : null;


            const first =
                history.length
                    ? history[
                        history.length - 1
                    ]
                    : null;


            let daysSinceLast =
                null;


            if (latest) {

                daysSinceLast =
                    Math.floor(
                        (
                            today.getTime() -
                            getTimestamp(
                                latest.eventDate
                            )
                        ) /
                        86400000
                    );

            }


            const status =
                determineStatus(
                    history,
                    daysSinceLast
                );


            return {

                participant,

                history,

                latest,

                first,

                daysSinceLast,

                status

            };

        }
    );

}


/* ==================================================
   状態判定

   priority
   3 長期不参加
   2 最近不参加
   1 訓練未参加
   0 継続参加
================================================== */

function determineStatus(
    history,
    daysSinceLast
) {

    if (
        history.length === 0
    ) {

        return {

            key: "never",

            label: "訓練未参加",

            className: "never",

            priority: 1

        };

    }


    if (
        daysSinceLast !== null &&
        daysSinceLast >=
        LONG_INACTIVE_DAYS
    ) {

        return {

            key: "long",

            label: "長期不参加",

            className: "long",

            priority: 3

        };

    }


    if (
        daysSinceLast !== null &&
        daysSinceLast >=
        RECENT_INACTIVE_DAYS
    ) {

        return {

            key: "recent",

            label: "最近不参加",

            className: "recent",

            priority: 2

        };

    }


    return {

        key: "active",

        label: "継続参加",

        className: "active",

        priority: 0

    };

}


/* ==================================================
   表示

   要フォロー対象
   ・最近不参加（180日以上）
   ・長期不参加（365日以上）
   ・訓練未参加（参加履歴なし）
================================================== */

function renderFollowup(
    records
) {

    const list =
        document.getElementById(
            "participantFollowupList"
        );


    if (!list) {

        return;

    }


    const recentCount =
        records.filter(
            record =>
                record.status.key ===
                "recent"
        ).length;


    const longCount =
        records.filter(
            record =>
                record.status.key ===
                "long"
        ).length;


    const neverCount =
        records.filter(
            record =>
                record.status.key ===
                "never"
        ).length;


    const followupTargets =
        records.filter(
            record =>
                record.status.key === "recent" ||
                record.status.key === "long" ||
                record.status.key === "never"
        );


    setText(
        "recentInactiveCount",
        recentCount
    );


    setText(
        "longInactiveCount",
        longCount
    );


    setText(
        "neverParticipatedCount",
        neverCount
    );


    setText(
        "followupTargetCount",
        followupTargets.length
    );


    if (
        followupTargets.length === 0
    ) {

        list.innerHTML = `
            <div class="followup-empty">
                <strong>
                    🎉 現在、フォローが必要な参加者はいません。
                </strong>
            </div>
        `;

        return;

    }


    /*
     * 並び順
     *
     * 長期不参加 → 最近不参加 → 訓練未参加
     * 同じ区分の中では経過日数の長い順
     * 訓練未参加は登録が古い順
     */

    followupTargets.sort(
        (a, b) => {

            if (
                a.status.priority !==
                b.status.priority
            ) {

                return (
                    b.status.priority -
                    a.status.priority
                );

            }


            const aDays =
                a.daysSinceLast ?? -1;


            const bDays =
                b.daysSinceLast ?? -1;


            if (
                aDays !== bDays
            ) {

                return bDays - aDays;

            }


            return (
                getTimestamp(
                    a.participant.created_at
                ) -
                getTimestamp(
                    b.participant.created_at
                )
            );

        }
    );


    list.innerHTML = "";


    followupTargets.forEach(
        record => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "participant-followup-item";


            const participantId =
                record.participant
                    .participant_id;


            const isNever =
                record.status.key ===
                "never";


            const daysText =
                isNever
                    ? "-"
                    : `${record.daysSinceLast}日`;


            const mainDateLabel =
                isNever
                    ? "登録日"
                    : "最終参加";


            const mainDateValue =
                isNever
                    ? formatDate(
                        record.participant.created_at
                    )
                    : (
                        record.latest
                            ? formatDate(
                                record.latest.eventDate
                            )
                            : "-"
                    );


            const trainingTitle =
                isNever
                    ? "参加履歴なし"
                    : (
                        record.latest?.training?.title ||
                        record.latest?.training_id ||
                        "-"
                    );


            item.innerHTML = `

                <div
                    class="followup-main"
                >

                    <div>

                        <strong>
                            ${escapeHtml(
                                record.participant.name ||
                                "名前未登録"
                            )}
                        </strong>

                        <span class="followup-id">
                            ID：
                            ${escapeHtml(
                                participantId
                            )}
                        </span>

                    </div>


                    <span
                        class="
                            followup-status
                            ${record.status.className}
                        "
                    >
                        ${record.status.label}
                    </span>

                </div>


                <div
                    class="followup-details"
                >

                    <div>

                        <span>
                            ${mainDateLabel}
                        </span>

                        <strong>
                            ${mainDateValue}
                        </strong>

                    </div>


                    <div>

                        <span>
                            経過
                        </span>

                        <strong>
                            ${daysText}
                        </strong>

                    </div>


                    <div>

                        <span>
                            最終参加訓練
                        </span>

                        <strong>
                            ${escapeHtml(
                                trainingTitle
                            )}
                        </strong>

                    </div>

                </div>


                <div
                    class="followup-actions"
                >

                    <button
                        type="button"
                        class="secondary-button"
                        data-action="participant-card"
                        data-id="${escapeHtml(
                            String(
                                record.participant.id
                            )
                        )}"
                    >
                        参加者カルテを見る
                    </button>

                </div>

            `;


            list.appendChild(
                item
            );

        }
    );

}


/* ==================================================
   参加者カルテ拡張
================================================== */

function observeParticipantCard() {

    const modal =
        document.getElementById(
            "participantCardModal"
        );


    if (!modal) {

        setTimeout(
            observeParticipantCard,
            500
        );

        return;

    }


    const observer =
        new MutationObserver(
            mutations => {

                mutations.forEach(
                    mutation => {

                        if (
                            mutation.attributeName !==
                            "class"
                        ) {

                            return;

                        }


                        if (
                            !modal.classList.contains(
                                "hidden"
                            )
                        ) {

                            setTimeout(
                                enhanceParticipantCard,
                                100
                            );

                        }

                    }
                );

            }
        );


    observer.observe(
        modal,
        {
            attributes: true
        }
    );

}


/* ==================================================
   カルテに参加状態を追加
================================================== */

async function enhanceParticipantCard() {

    const content =
        document.getElementById(
            "participantCardContent"
        );


    if (!content) {

        return;

    }


    if (
        content.querySelector(
            ".participant-followup-card"
        )
    ) {

        return;

    }


    const profileText =
        content.innerText || "";


    const idMatch =
        profileText.match(
            /参加者ID：\s*([^\s]+)/
        );


    if (!idMatch) {

        return;

    }


    const participantId =
        idMatch[1];


    const client =
        getClient();


    if (!client) {

        return;

    }


    try {

        const [
            participationsResult,
            trainingsResult
        ] =
            await Promise.all([

                client
                    .from("participations")
                    .select(
                        "id, participant_id, training_id, registered_at"
                    )
                    .eq(
                        "participant_id",
                        participantId
                    ),

                client
                    .from("trainings")
                    .select("*")

            ]);


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


        const history =
            participationsResult.data ||
            [];


        const trainings =
            trainingsResult.data ||
            [];


        const trainingMap =
            new Map();


        trainings.forEach(
            training => {

                trainingMap.set(
                    String(
                        training.training_id
                    ).trim(),
                    training
                );

            }
        );


        const detailedHistory =
            history
                .map(
                    item => {

                        const training =
                            trainingMap.get(
                                String(
                                    item.training_id
                                ).trim()
                            );


                        return {

                            ...item,

                            training,

                            eventDate:
                                getTrainingDate(
                                    training,
                                    item.registered_at
                                )

                        };

                    }
                )
                .filter(
                    item =>
                        item.eventDate
                )
                .sort(
                    (a, b) =>
                        getTimestamp(
                            b.eventDate
                        ) -
                        getTimestamp(
                            a.eventDate
                        )
                );


        const latest =
            detailedHistory.length
                ? detailedHistory[0]
                : null;


        let daysSinceLast =
            null;


        if (latest) {

            daysSinceLast =
                Math.floor(
                    (
                        Date.now() -
                        getTimestamp(
                            latest.eventDate
                        )
                    ) /
                    86400000
                );

        }


        const status =
            determineStatus(
                detailedHistory,
                daysSinceLast
            );


        const box =
            document.createElement(
                "div"
            );


        box.className =
            "participant-followup-card";


        box.innerHTML = `

            <div
                class="participant-followup-card-header"
            >

                <div>

                    <strong>
                        現在の参加状態
                    </strong>

                    <span>
                        参加履歴から自動判定
                    </span>

                </div>


                <span
                    class="
                        followup-status
                        ${status.className}
                    "
                >
                    ${status.label}
                </span>

            </div>


            <div
                class="participant-followup-card-grid"
            >

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
                        最終参加から
                    </span>

                    <strong>
                        ${
                            daysSinceLast === null
                                ? "-"
                                : `${daysSinceLast}日`
                        }
                    </strong>

                </div>


                <div>

                    <span>
                        累計参加
                    </span>

                    <strong>
                        ${detailedHistory.length}回
                    </strong>

                </div>

            </div>


            <div
                class="participant-followup-message"
            >

                ${createFollowupMessage(
                    status,
                    daysSinceLast,
                    detailedHistory
                )}

            </div>

        `;


        const profile =
            content.querySelector(
                ".participant-card-profile"
            );


        if (profile) {

            profile.after(box);

        } else {

            content.prepend(box);

        }

    } catch (error) {

        console.error(
            "Participant card enhancement error:",
            error
        );

    }

}


/* ==================================================
   フォローコメント
================================================== */

function createFollowupMessage(
    status,
    daysSinceLast,
    history
) {

    if (
        status.key ===
        "never"
    ) {

        return `
            まだ訓練・講座への参加履歴がありません。
            今後の参加案内の対象として確認できます。
        `;

    }


    if (
        status.key ===
        "long"
    ) {

        return `
            ⚠️ 1年以上参加していません。
            自治会からの案内・声かけなど、
            フォローアップを検討してください。
        `;

    }


    if (
        status.key ===
        "recent"
    ) {

        return `
            半年以上、訓練・講座への参加がありません。
            次回訓練の案内対象として確認できます。
        `;

    }


    return `
        現在も継続的に参加しています。
        引き続き参加状況を確認してください。
    `;

}


/* ==================================================
   訓練実施日取得

   複数日開催の場合は
   終了日を基準に経過日数を計算する
================================================== */

function getTrainingDate(
    training,
    registeredAt
) {

    if (training) {

        if (
            training.training_end_date
        ) {

            return training.training_end_date;

        }


        if (
            training.training_date
        ) {

            return training.training_date;

        }

    }


    return registeredAt ||
        null;

}


/* ==================================================
   日付
================================================== */

function getTimestamp(
    value
) {

    if (!value) {

        return 0;

    }


    const timestamp =
        new Date(
            value
        ).getTime();


    return Number.isNaN(
        timestamp
    )
        ? 0
        : timestamp;

}


/* ==================================================
   日付表示
================================================== */

function formatDate(
    value
) {

    if (!value) {

        return "-";

    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "-";

    }


    return `${date.getFullYear()}/` +
        `${String(
            date.getMonth() + 1
        ).padStart(2, "0")}/` +
        `${String(
            date.getDate()
        ).padStart(2, "0")}`;

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
        value ?? ""
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


})();

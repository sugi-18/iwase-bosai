/* ==================================================
   岩瀬自治会 防災アプリ
   お知らせ・緊急情報表示
   詳細表示・NEW表示対応
================================================== */

"use strict";


/* ==================================================
   Supabase設定
================================================== */

const ANNOUNCEMENT_SUPABASE_URL =
    "https://zumbqukrojdpgfpfekjr.supabase.co";


const ANNOUNCEMENT_SUPABASE_KEY =
    "sb_publishable_8YXsMHOxLr7MOTEYShUM3w_LsZvR3Qn";


let announcementClient = null;


/* ==================================================
   NEW表示期間
   公開から24時間以内のお知らせをNEWとする
================================================== */

const ANNOUNCEMENT_NEW_HOURS = 24;

/* ==================================================
   初期化
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            if (
                typeof window.supabase ===
                "undefined"
            ) {

                throw new Error(
                    "Supabaseが読み込まれていません。"
                );

            }


            announcementClient =
                window.supabase.createClient(
                    ANNOUNCEMENT_SUPABASE_URL,
                    ANNOUNCEMENT_SUPABASE_KEY
                );


            createAnnouncementModal();


            await loadPublicAnnouncements();


        } catch (error) {

            console.error(
                "お知らせ初期化エラー:",
                error
            );

            showAnnouncementError();

        }

    }
);


/* ==================================================
   お知らせ取得
================================================== */

async function loadPublicAnnouncements() {

    const container =
        document.getElementById(
            "announcementList"
        );


    if (!container) {

        return;

    }


    const now =
        new Date().toISOString();


    const {
        data,
        error
    } =
        await announcementClient
            .from(
                "announcements"
            )
            .select(
                "id,title,body,type,published_at,expires_at"
            )
            .eq(
                "is_published",
                true
            )
            .or(
                "expires_at.is.null,expires_at.gt." +
                now
            )
            .order(
                "published_at",
                {
                    ascending: false
                }
            )
            .limit(
                10
            );


    if (error) {

        throw error;

    }


    renderPublicAnnouncements(
        container,
        data || []
    );

}


/* ==================================================
   お知らせ表示
================================================== */

function renderPublicAnnouncements(
    container,
    announcements
) {

    container.innerHTML =
        "";


    if (
        announcements.length === 0
    ) {

        container.innerHTML = `

            <div class="announcement-empty">

                現在、お知らせはありません。

            </div>

        `;

        return;

    }


    /*
       緊急 → 重要 → 通常
       同じ種類の場合は新しい順
    */

    announcements.sort(
        (
            a,
            b
        ) => {

            const priority = {

                urgent: 0,

                important: 1,

                normal: 2

            };


            const priorityDifference =
                priority[a.type] -
                priority[b.type];


            if (
                priorityDifference !== 0
            ) {

                return priorityDifference;

            }


            return (
                new Date(
                    b.published_at
                ) -
                new Date(
                    a.published_at
                )
            );

        }
    );


    announcements.forEach(
        announcement => {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "announcement-card " +
                getPublicTypeClass(
                    announcement.type
                );


            const label =
                getPublicTypeLabel(
                    announcement.type
                );


            const date =
                formatPublicDate(
                    announcement.published_at
                );


            const isNew =
                isAnnouncementNew(
                    announcement.published_at
                );


            const newBadge =
                isNew
                    ? `
                        <span
                            class="announcement-new-badge"
                        >
                            NEW
                        </span>
                    `
                    : "";


            /*
               本文はトップページでは
               最大3行程度のプレビュー
            */

            const preview =
                createAnnouncementPreview(
                    announcement.body
                );


            card.innerHTML = `

                <div
                    class="announcement-card-header"
                >

                    <div
                        class="announcement-card-labels"
                    >

                        <span
                            class="announcement-badge"
                        >
                            ${label}
                        </span>

                        ${newBadge}

                    </div>


                    <time>
                        ${date}
                    </time>

                </div>


                <h3>
                    ${escapeHtml(
                        announcement.title
                    )}
                </h3>


                <p
                    class="announcement-preview"
                >
                    ${escapeHtml(
                        preview
                    )}
                </p>


                <div
                    class="announcement-card-footer"
                >

                    <button
                        type="button"
                        class="announcement-detail-button"
                        data-announcement-id="${announcement.id}"
                    >
                        詳細を見る
                    </button>

                </div>

            `;


            const detailButton =
                card.querySelector(
                    ".announcement-detail-button"
                );


            if (detailButton) {

                detailButton.addEventListener(
                    "click",
                    () => {

                        openAnnouncementDetail(
                            announcement
                        );

                    }
                );

            }


            container.appendChild(
                card
            );

        }
    );

}


/* ==================================================
   詳細モーダル作成
================================================== */

function createAnnouncementModal() {

    if (
        document.getElementById(
            "announcementDetailModal"
        )
    ) {

        return;

    }


    const modal =
        document.createElement(
            "div"
        );


    modal.id =
        "announcementDetailModal";


    modal.className =
        "announcement-detail-modal";


    modal.innerHTML = `

        <div
            class="announcement-detail-overlay"
            id="announcementDetailOverlay"
        ></div>


        <div
            class="announcement-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcementDetailTitle"
        >

            <button
                type="button"
                class="announcement-detail-close"
                id="announcementDetailClose"
                aria-label="閉じる"
            >
                ×
            </button>


            <div
                id="announcementDetailContent"
                class="announcement-detail-content"
            ></div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    document
        .getElementById(
            "announcementDetailClose"
        )
        ?.addEventListener(
            "click",
            closeAnnouncementDetail
        );


    document
        .getElementById(
            "announcementDetailOverlay"
        )
        ?.addEventListener(
            "click",
            closeAnnouncementDetail
        );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeAnnouncementDetail();

            }

        }
    );

}


/* ==================================================
   詳細表示
================================================== */

function openAnnouncementDetail(
    announcement
) {

    const modal =
        document.getElementById(
            "announcementDetailModal"
        );


    const content =
        document.getElementById(
            "announcementDetailContent"
        );


    if (
        !modal ||
        !content
    ) {

        return;

    }


    const label =
        getPublicTypeLabel(
            announcement.type
        );


    const typeClass =
        getPublicTypeClass(
            announcement.type
        );


    const date =
        formatPublicDateTime(
            announcement.published_at
        );


    const isNew =
        isAnnouncementNew(
            announcement.published_at
        );


    const newBadge =
        isNew
            ? `
                <span
                    class="announcement-new-badge"
                >
                    NEW
                </span>
            `
            : "";


    content.innerHTML = `

        <div
            class="announcement-detail-header
                   ${typeClass}"
        >

            <div
                class="announcement-detail-labels"
            >

                <span
                    class="announcement-badge"
                >
                    ${label}
                </span>

                ${newBadge}

            </div>


            <time>
                ${date}
            </time>

        </div>


        <h2
            id="announcementDetailTitle"
        >
            ${escapeHtml(
                announcement.title
            )}
        </h2>


        <div
            class="announcement-detail-body"
        >
            ${escapeHtml(
                announcement.body
            ).replace(
                /\n/g,
                "<br>"
            )}
        </div>

    `;


    modal.classList.add(
        "active"
    );


    document.body.classList.add(
        "announcement-modal-open"
    );

}


/* ==================================================
   詳細を閉じる
================================================== */

function closeAnnouncementDetail() {

    const modal =
        document.getElementById(
            "announcementDetailModal"
        );


    if (!modal) {

        return;

    }


    modal.classList.remove(
        "active"
    );


    document.body.classList.remove(
        "announcement-modal-open"
    );

}


/* ==================================================
   NEW判定
   公開から24時間以内ならNEWを表示
================================================== */

function isAnnouncementNew(
    publishedAt
) {

    if (!publishedAt) {

        return false;

    }


    const publishedDate =
        new Date(
            publishedAt
        );


    const now =
        new Date();


    if (
        Number.isNaN(
            publishedDate.getTime()
        )
    ) {

        return false;

    }


    const diff =
        now.getTime() -
        publishedDate.getTime();


    const hours =
        diff /
        (
            1000 *
            60 *
            60
        );


    return (
        hours >= 0 &&
        hours <=
        ANNOUNCEMENT_NEW_HOURS
    );

}

/* ==================================================
   本文プレビュー
================================================== */

function createAnnouncementPreview(
    body
) {

    if (!body) {

        return "";

    }


    const cleanText =
        String(
            body
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();


    const maxLength =
        90;


    if (
        cleanText.length <=
        maxLength
    ) {

        return cleanText;

    }


    return (
        cleanText.substring(
            0,
            maxLength
        ) +
        "..."
    );

}


/* ==================================================
   種類
================================================== */

function getPublicTypeClass(
    type
) {

    if (
        type ===
        "urgent"
    ) {

        return "announcement-urgent";

    }


    if (
        type ===
        "important"
    ) {

        return "announcement-important";

    }


    return "announcement-normal";

}


function getPublicTypeLabel(
    type
) {

    if (
        type ===
        "urgent"
    ) {

        return "🚨 緊急情報";

    }


    if (
        type ===
        "important"
    ) {

        return "⚠️ 重要なお知らせ";

    }


    return "📢 お知らせ";

}


/* ==================================================
   日付
================================================== */

function formatPublicDate(
    value
) {

    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "";

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


function formatPublicDateTime(
    value
) {

    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "";

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
        ) +
        " " +
        String(
            date.getHours()
        ).padStart(
            2,
            "0"
        ) +
        ":" +
        String(
            date.getMinutes()
        ).padStart(
            2,
            "0"
        )

    );

}


/* ==================================================
   エラー
================================================== */

function showAnnouncementError() {

    const container =
        document.getElementById(
            "announcementList"
        );


    if (!container) {

        return;

    }


    container.innerHTML = `

        <div
            class="announcement-error"
        >

            お知らせを取得できませんでした。

        </div>

    `;

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

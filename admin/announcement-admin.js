/* ==================================================
   岩瀬自治会 防災アプリ
   お知らせ・緊急情報 管理
================================================== */

"use strict";


/* ==================================================
   初期化
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupAnnouncementManagement();

    }
);


/* ==================================================
   セットアップ
================================================== */

function setupAnnouncementManagement() {

    const navButton =
        document.querySelector(
            '[data-target="contentManagementSection"]'
        );

    if (navButton) {

        navButton.addEventListener(
            "click",
            async () => {

                await loadAnnouncements();

            }
        );

    }


    const addButton =
        document.getElementById(
            "addAnnouncementButton"
        );

    if (addButton) {

        addButton.addEventListener(
            "click",
            () => {

                openAnnouncementEditor();

            }
        );

    }

}


/* ==================================================
   お知らせ読み込み
================================================== */

async function loadAnnouncements() {

    const container =
        document.getElementById(
            "announcementsManagementList"
        );

    if (!container) {

        return;

    }


    if (
        typeof adminSupabaseClient ===
        "undefined" ||
        !adminSupabaseClient
    ) {

        container.innerHTML =
            "Supabaseを利用できません。";

        return;

    }


    container.innerHTML =
        "読み込み中...";


    const {
        data,
        error
    } =
        await adminSupabaseClient
            .from("announcements")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "お知らせ取得エラー:",
            error
        );

        container.innerHTML =
            `
            <p class="content-error">
                お知らせを読み込めませんでした。
            </p>
            `;

        return;

    }


    container.innerHTML =
        "";


    if (
        !data ||
        data.length === 0
    ) {

        container.innerHTML =
            `
            <div class="content-empty-message">
                まだお知らせが登録されていません。
            </div>
            `;

        return;

    }


    data.forEach(
        announcement => {

            renderAnnouncement(
                container,
                announcement
            );

        }
    );

}


/* ==================================================
   お知らせ表示
================================================== */

function renderAnnouncement(
    container,
    announcement
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "announcement-management-item";


    const typeLabel =
        getAnnouncementTypeLabel(
            announcement.type
        );


    const typeClass =
        getAnnouncementTypeClass(
            announcement.type
        );


    const status =
        announcement.is_published
            ? "公開中"
            : "非公開";


    card.innerHTML = `

        <div class="announcement-management-header">

            <div>

                <span
                    class="announcement-type-badge ${typeClass}"
                >
                    ${typeLabel}
                </span>

                <span
                    class="announcement-status ${
                        announcement.is_published
                            ? "published"
                            : "unpublished"
                    }"
                >
                    ${status}
                </span>

            </div>

        </div>


        <h4>
            ${escapeHtml(
                announcement.title
            )}
        </h4>


        <p class="announcement-management-body">
            ${escapeHtml(
                announcement.body
            ).replace(
                /\n/g,
                "<br>"
            )}
        </p>


        <div class="announcement-management-date">

            公開開始：
            ${formatAnnouncementDate(
                announcement.published_at
            )}

            ${
                announcement.expires_at
                    ? `
                        <br>
                        公開終了：
                        ${formatAnnouncementDate(
                            announcement.expires_at
                        )}
                    `
                    : ""
            }

        </div>


        <div class="announcement-management-actions">

            <button
                type="button"
                class="secondary-button announcement-edit-button"
            >
                編集
            </button>


            <button
                type="button"
                class="secondary-button announcement-toggle-button"
            >
                ${
                    announcement.is_published
                        ? "非公開にする"
                        : "公開する"
                }
            </button>


            <button
                type="button"
                class="danger-button announcement-delete-button"
            >
                削除
            </button>

        </div>

    `;


    card
        .querySelector(
            ".announcement-edit-button"
        )
        ?.addEventListener(
            "click",
            () => {

                openAnnouncementEditor(
                    announcement
                );

            }
        );


    card
        .querySelector(
            ".announcement-toggle-button"
        )
        ?.addEventListener(
            "click",
            async () => {

                await toggleAnnouncement(
                    announcement
                );

            }
        );


    card
        .querySelector(
            ".announcement-delete-button"
        )
        ?.addEventListener(
            "click",
            async () => {

                await deleteAnnouncement(
                    announcement
                );

            }
        );


    container.appendChild(
        card
    );

}


/* ==================================================
   新規・編集フォーム
================================================== */

function openAnnouncementEditor(
    announcement = null
) {

    const modal =
        document.createElement(
            "div"
        );


    modal.className =
        "content-editor-modal";


    modal.innerHTML = `

        <div class="content-editor-modal-inner">

            <h3>
                ${
                    announcement
                        ? "お知らせを編集"
                        : "お知らせを追加"
                }
            </h3>


            <label>

                種類

                <select
                    id="announcementEditorType"
                >

                    <option
                        value="urgent"
                        ${
                            announcement?.type ===
                            "urgent"
                                ? "selected"
                                : ""
                        }
                    >
                        🚨 緊急情報
                    </option>

                    <option
                        value="important"
                        ${
                            announcement?.type ===
                            "important"
                                ? "selected"
                                : ""
                        }
                    >
                        ⚠️ 重要なお知らせ
                    </option>

                    <option
                        value="normal"
                        ${
                            !announcement ||
                            announcement?.type ===
                            "normal"
                                ? "selected"
                                : ""
                        }
                    >
                        📢 通常のお知らせ
                    </option>

                </select>

            </label>


            <label>

                タイトル

                <input
                    type="text"
                    id="announcementEditorTitle"
                    maxlength="100"
                    value="${escapeAttribute(
                        announcement?.title || ""
                    )}"
                    placeholder="例：大雨に伴う避難について"
                >

            </label>


            <label>

                内容

                <textarea
                    id="announcementEditorBody"
                    rows="7"
                    maxlength="2000"
                    placeholder="お知らせ内容を入力してください。"
                >${escapeHtml(
                    announcement?.body || ""
                )}</textarea>

            </label>


            <label>

                公開開始日時

                <input
                    type="datetime-local"
                    id="announcementEditorPublishedAt"
                    value="${toDateTimeLocal(
                        announcement?.published_at
                    )}"
                >

            </label>


            <label>

                公開終了日時

                <input
                    type="datetime-local"
                    id="announcementEditorExpiresAt"
                    value="${toDateTimeLocal(
                        announcement?.expires_at
                    )}"
                >

                <small>
                    ※空欄の場合は終了期限なし
                </small>

            </label>


            <label class="announcement-publish-check">

                <input
                    type="checkbox"
                    id="announcementEditorPublished"
                    ${
                        announcement?.is_published
                            ? "checked"
                            : ""
                    }
                >

                公開する

            </label>


            <div class="content-editor-actions">

                <button
                    type="button"
                    id="announcementEditorSave"
                    class="primary-button"
                >
                    保存
                </button>


                <button
                    type="button"
                    id="announcementEditorCancel"
                    class="secondary-button"
                >
                    キャンセル
                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    document
        .getElementById(
            "announcementEditorCancel"
        )
        ?.addEventListener(
            "click",
            () => {

                modal.remove();

            }
        );


    document
        .getElementById(
            "announcementEditorSave"
        )
        ?.addEventListener(
            "click",
            async () => {

                await saveAnnouncement(
                    announcement,
                    modal
                );

            }
        );

}


/* ==================================================
   保存
================================================== */

async function saveAnnouncement(
    existing,
    modal
) {

    const title =
        document
            .getElementById(
                "announcementEditorTitle"
            )
            ?.value
            .trim();


    const body =
        document
            .getElementById(
                "announcementEditorBody"
            )
            ?.value
            .trim();


    const type =
        document
            .getElementById(
                "announcementEditorType"
            )
            ?.value;


    const publishedAt =
        document
            .getElementById(
                "announcementEditorPublishedAt"
            )
            ?.value;


    const expiresAt =
        document
            .getElementById(
                "announcementEditorExpiresAt"
            )
            ?.value;


    const isPublished =
        document
            .getElementById(
                "announcementEditorPublished"
            )
            ?.checked;


    if (!title) {

        alert(
            "タイトルを入力してください。"
        );

        return;

    }


    if (!body) {

        alert(
            "内容を入力してください。"
        );

        return;

    }


    try {

        const payload = {

            title,

            body,

            type,

            is_published:
                isPublished,

            published_at:
                publishedAt
                    ? new Date(
                        publishedAt
                    ).toISOString()
                    : new Date().toISOString(),

            expires_at:
                expiresAt
                    ? new Date(
                        expiresAt
                    ).toISOString()
                    : null,

            updated_at:
                new Date().toISOString()

        };


        let result;


        if (existing?.id) {

            result =
                await adminSupabaseClient
                    .from(
                        "announcements"
                    )
                    .update(
                        payload
                    )
                    .eq(
                        "id",
                        existing.id
                    );

        } else {

            result =
                await adminSupabaseClient
                    .from(
                        "announcements"
                    )
                    .insert(
                        payload
                    );

        }


        if (result.error) {

            throw result.error;

        }


        modal.remove();


        alert(
            existing
                ? "お知らせを更新しました。"
                : "お知らせを登録しました。"
        );


        await loadAnnouncements();


    } catch (error) {

        console.error(
            "お知らせ保存エラー:",
            error
        );


        alert(
            "お知らせの保存に失敗しました。\n" +
            error.message
        );

    }

}


/* ==================================================
   公開・非公開
================================================== */

async function toggleAnnouncement(
    announcement
) {

    const nextState =
        !announcement.is_published;


    try {

        const {
            error
        } =
            await adminSupabaseClient
                .from(
                    "announcements"
                )
                .update({

                    is_published:
                        nextState,

                    updated_at:
                        new Date().toISOString()

                })
                .eq(
                    "id",
                    announcement.id
                );


        if (error) {

            throw error;

        }


        await loadAnnouncements();


    } catch (error) {

        console.error(
            "公開状態変更エラー:",
            error
        );


        alert(
            "公開状態の変更に失敗しました。"
        );

    }

}


/* ==================================================
   削除
================================================== */

async function deleteAnnouncement(
    announcement
) {

    if (
        !confirm(
            "このお知らせを削除しますか？"
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
                    "announcements"
                )
                .delete()
                .eq(
                    "id",
                    announcement.id
                );


        if (error) {

            throw error;

        }


        alert(
            "お知らせを削除しました。"
        );


        await loadAnnouncements();


    } catch (error) {

        console.error(
            "お知らせ削除エラー:",
            error
        );


        alert(
            "お知らせの削除に失敗しました。"
        );

    }

}


/* ==================================================
   種類
================================================== */

function getAnnouncementTypeLabel(
    type
) {

    if (type === "urgent") {

        return "🚨 緊急情報";

    }


    if (type === "important") {

        return "⚠️ 重要";

    }


    return "📢 お知らせ";

}


function getAnnouncementTypeClass(
    type
) {

    if (type === "urgent") {

        return "urgent";

    }


    if (type === "important") {

        return "important";

    }


    return "normal";

}


/* ==================================================
   日時
================================================== */

function formatAnnouncementDate(
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
   datetime-local変換
================================================== */

function toDateTimeLocal(
    value
) {

    if (!value) {

        return "";

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

        return "";

    }


    const offset =
        date.getTimezoneOffset();


    const local =
        new Date(
            date.getTime() -
            offset * 60000
        );


    return local
        .toISOString()
        .slice(
            0,
            16
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


function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );

}

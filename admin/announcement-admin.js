/* ==================================================
   岩瀬自治会 防災アプリ
   お知らせ・緊急情報 管理

   プッシュ通知の送信機能を追加した版。

   ・保存と同時に通知を送れる
   ・送信前に対象端末数と内容を確認する
   ・送信済みのお知らせには「通知済み」を表示する
   ・後からでも個別に送信できる

   前提：

     Edge Function「send-push」がデプロイ済みであること
     announcements テーブルに notified_at 列があること
     （03_announcement_notified_at.sql を実行）
================================================== */

"use strict";


/* ==================================================
   お知らせの種類と通知の対応

   種類を変えるだけで通知の強さも変わるようにしている。
   運用者が2つの概念を覚えなくて済むため。

   level
     0 … 通常表示
     2 … 自動で消えない・強い振動
     3 … 同上

   topic
     住民が受信可否を選べる区分。
     訓練案内を emergency で送ると、
     緊急通知そのものを切られる原因になる。
================================================== */

const ANNOUNCEMENT_PUSH_MAP = {

    urgent: {
        topic: "emergency",
        level: 3,
        label: "🚨 緊急情報として通知"
    },

    important: {
        topic: "warning",
        level: 2,
        label: "⚠️ 重要なお知らせとして通知"
    },

    normal: {
        topic: "announcement",
        level: 0,
        label: "📢 通常のお知らせとして通知"
    }

};


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


    /*
     * 通知済みかどうか。
     *
     * notified_at 列がまだ無い場合は undefined になるので、
     * その場合は何も表示しない。
     */

    const notifiedLabel =
        announcement.notified_at
            ? `
                <span
                    class="announcement-status published"
                    style="background:#2e7d32;"
                    title="${escapeAttribute(
                        formatAnnouncementDate(
                            announcement.notified_at
                        )
                    )} に通知しました"
                >
                    🔔 通知済み
                </span>
            `
            : "";


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

                ${notifiedLabel}

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
                class="secondary-button announcement-notify-button"
            >
                ${
                    announcement.notified_at
                        ? "🔔 もう一度通知"
                        : "🔔 通知を送る"
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
            ".announcement-notify-button"
        )
        ?.addEventListener(
            "click",
            async () => {

                await confirmAndSendAnnouncementPush(
                    announcement
                );

                await loadAnnouncements();

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


    /*
     * 通知チェックの初期値
     *
     * 新規作成のときだけ既定でオンにする。
     * 編集で既定オンにすると、
     * 誤字修正のたびに再通知してしまう。
     */

    const notifyDefault =
        announcement
            ? ""
            : "checked";


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


            <label class="announcement-publish-check">

                <input
                    type="checkbox"
                    id="announcementEditorNotify"
                    ${notifyDefault}
                >

                保存と同時にプッシュ通知を送る

                <small
                    id="announcementNotifyHint"
                    style="display:block;color:#777;"
                >
                </small>

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


    /*
     * 種類を変えたら通知の説明も変える。
     * 「緊急情報を選ぶと通知も緊急になる」ことを
     * その場で分かるようにするため。
     */

    const typeSelect =
        document.getElementById(
            "announcementEditorType"
        );


    const notifyHint =
        document.getElementById(
            "announcementNotifyHint"
        );


    const updateNotifyHint =
        () => {

            const mapping =
                ANNOUNCEMENT_PUSH_MAP[
                    typeSelect?.value
                ] ||
                ANNOUNCEMENT_PUSH_MAP.normal;

            if (notifyHint) {

                notifyHint.textContent =
                    "※ " + mapping.label;

            }

        };


    typeSelect
        ?.addEventListener(
            "change",
            updateNotifyHint
        );


    updateNotifyHint();


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


    const shouldNotify =
        document
            .getElementById(
                "announcementEditorNotify"
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


    /*
     * 非公開のまま通知するとちぐはぐになる。
     * 通知だけ届いてアプリに何も無い状態を防ぐ。
     */

    if (shouldNotify && !isPublished) {

        alert(
            "非公開のお知らせは通知できません。\n" +
            "「公開する」にチェックを入れるか、\n" +
            "通知のチェックを外してください。"
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
                    )
                    .select()
                    .single();

        } else {

            result =
                await adminSupabaseClient
                    .from(
                        "announcements"
                    )
                    .insert(
                        payload
                    )
                    .select()
                    .single();

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


        /*
         * 保存が成功してから通知する。
         *
         * 逆順にすると、
         * 通知は届いたのに保存に失敗した、
         * という最悪の状態が起こり得る。
         */

        if (shouldNotify) {

            await confirmAndSendAnnouncementPush(
                result.data || {
                    ...payload,
                    id: existing?.id
                }
            );

        }


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
   送信先URLの決定
================================================== */

function getSendPushUrl() {

    const base =
        typeof SUPABASE_URL !== "undefined" && SUPABASE_URL
            ? SUPABASE_URL
            : "https://zumbqukrojdpgfpfekjr.supabase.co";

    return base + "/functions/v1/send-push";

}


/* ==================================================
   Edge Function の呼び出し

   管理者としてログイン済みのトークンを使う。
   サービスロールキーは画面側に置かない。
================================================== */

async function callSendPush(payload) {

    const {
        data: {
            session
        }
    } =
        await adminSupabaseClient
            .auth
            .getSession();


    if (!session) {

        throw new Error(
            "ログイン情報を取得できませんでした。" +
            "一度ログインし直してください。"
        );

    }


    const response =
        await fetch(
            getSendPushUrl(),
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json",
                    "Authorization":
                        "Bearer " +
                        session.access_token
                },
                body: JSON.stringify(
                    payload
                )
            }
        );


    const result =
        await response.json();


    if (!response.ok) {

        throw new Error(
            result.error ||
            ("送信に失敗しました（" +
             response.status +
             "）")
        );

    }


    return result;

}


/* ==================================================
   通知を受け取れる端末数を調べる

   push_subscriptions は管理画面から直接読めない
   （RLSで塞いである）ため、
   Edge Function の設定確認モードを使う。
================================================== */

async function fetchActiveSubscriptionCount() {

    try {

        const result =
            await callSendPush({
                diagnostic: true
            });

        if (
            typeof result.active_subscriptions ===
            "number"
        ) {

            return result.active_subscriptions;

        }

        return null;

    } catch (error) {

        console.warn(
            "購読数を取得できませんでした:",
            error
        );

        return null;

    }

}


/* ==================================================
   確認ダイアログ

   プッシュ通知は取り消せない。
   誰に・何が届くのかを見せてから送る。
================================================== */

function showPushConfirmDialog(options) {

    return new Promise(
        resolve => {

            const modal =
                document.createElement(
                    "div"
                );


            modal.className =
                "content-editor-modal";


            const countText =
                options.count === null
                    ? "取得できませんでした"
                    : options.count + " 台";


            const countWarning =
                options.count === 0
                    ? `
                        <p style="color:#d62828;font-weight:bold;">
                            通知を受け取れる端末がまだありません。
                            送信しても誰にも届きません。
                        </p>
                    `
                    : "";


            modal.innerHTML = `

                <div class="content-editor-modal-inner">

                    <h3>
                        通知を送信しますか？
                    </h3>


                    <div
                        style="
                            background:#f5f5f5;
                            border-radius:8px;
                            padding:14px;
                            margin:12px 0;
                            text-align:left;
                        "
                    >

                        <div
                            style="
                                font-size:12px;
                                color:#777;
                            "
                        >
                            端末にはこう表示されます
                        </div>

                        <div
                            style="
                                font-weight:bold;
                                font-size:15px;
                                margin-top:6px;
                            "
                        >
                            ${escapeHtml(
                                options.title
                            )}
                        </div>

                        <div
                            style="
                                font-size:14px;
                                margin-top:4px;
                                white-space:pre-wrap;
                            "
                        >${escapeHtml(
                            options.body
                        )}</div>

                    </div>


                    <p style="text-align:left;font-size:14px;">
                        区分：${escapeHtml(
                            options.label
                        )}
                        <br>
                        送信先：${countText}
                    </p>


                    ${countWarning}


                    <p
                        style="
                            font-size:13px;
                            color:#d62828;
                            text-align:left;
                            line-height:1.7;
                        "
                    >
                        送信した通知は取り消せません。
                        内容に誤りがないか確認してください。
                    </p>


                    <div class="content-editor-actions">

                        <button
                            type="button"
                            id="pushConfirmSend"
                            class="primary-button"
                        >
                            送信する
                        </button>


                        <button
                            type="button"
                            id="pushConfirmCancel"
                            class="secondary-button"
                        >
                            送信しない
                        </button>

                    </div>

                </div>

            `;


            document.body.appendChild(
                modal
            );


            const finish =
                value => {

                    modal.remove();

                    resolve(value);

                };


            document
                .getElementById(
                    "pushConfirmSend"
                )
                ?.addEventListener(
                    "click",
                    () => {

                        finish(true);

                    }
                );


            document
                .getElementById(
                    "pushConfirmCancel"
                )
                ?.addEventListener(
                    "click",
                    () => {

                        finish(false);

                    }
                );

        }
    );

}


/* ==================================================
   確認してから送信する

   お知らせカードの「通知を送る」からも、
   保存直後からも、ここを通る。
================================================== */

async function confirmAndSendAnnouncementPush(
    announcement
) {

    if (
        !announcement ||
        !announcement.title
    ) {

        alert(
            "通知する内容がありません。"
        );

        return false;

    }


    const mapping =
        ANNOUNCEMENT_PUSH_MAP[
            announcement.type
        ] ||
        ANNOUNCEMENT_PUSH_MAP.normal;


    /*
     * 二重送信の確認。
     *
     * 訓練の再周知など、
     * あえて2回送りたい場面もあるので、
     * 禁止ではなく確認にとどめる。
     */

    if (announcement.notified_at) {

        const again =
            confirm(
                "このお知らせは " +
                formatAnnouncementDate(
                    announcement.notified_at
                ) +
                " に通知済みです。\n" +
                "もう一度送信しますか？"
            );

        if (!again) {

            return false;

        }

    }


    const count =
        await fetchActiveSubscriptionCount();


    const approved =
        await showPushConfirmDialog({
            title: announcement.title,
            body: announcement.body || "",
            label: mapping.label,
            count
        });


    if (!approved) {

        return false;

    }


    try {

        const result =
            await callSendPush({
                topic: mapping.topic,
                level: mapping.level,
                title: announcement.title,
                body: truncateForNotification(
                    announcement.body || ""
                ),
                url: "./"
            });


        /*
         * 送信履歴を残す。
         *
         * notified_at 列が無い環境でも
         * 送信自体は成功させたいので、
         * ここでの失敗は警告にとどめる。
         */

        if (announcement.id) {

            const {
                error
            } =
                await adminSupabaseClient
                    .from(
                        "announcements"
                    )
                    .update({
                        notified_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "id",
                        announcement.id
                    );

            if (error) {

                console.warn(
                    "通知日時の記録に失敗:",
                    error
                );

            }

        }


        alert(
            "通知を送信しました。\n\n" +
            "送信成功：" +
            (result.sent ?? 0) +
            " 台\n" +
            "失敗：" +
            ((result.failed ?? 0) +
             (result.gone ?? 0)) +
            " 台" +
            (result.message
                ? "\n" + result.message
                : "")
        );


        return true;


    } catch (error) {

        console.error(
            "通知送信エラー:",
            error
        );


        alert(
            "通知の送信に失敗しました。\n" +
            error.message
        );


        return false;

    }

}


/* ==================================================
   通知本文の長さ調整

   端末の通知欄は数行しか表示されない。
   長すぎる本文は途中で切って、
   続きはアプリで読んでもらう。
================================================== */

function truncateForNotification(
    value
) {

    const text =
        String(value || "")
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    if (text.length <= 120) {

        return text;

    }


    return text.slice(0, 117) + "…";

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

/* ==================================================
   岩瀬自治会 防災アプリ
   掲載コンテンツ管理

   ・次回訓練 最大3枚
   ・年間計画 最大3枚
   ・活動実績 最大3枚

   更新内容
   ・活動実績の写真を削除できるようにした
   ・画像の差し替え・削除時に
     ストレージ上の実ファイルも削除する
   ・他ファイルとの関数名衝突を避けるため
     全体をIIFEで囲んだ
================================================== */

(function () {

"use strict";


/* ==================================================
   設定
================================================== */

const CONTENT_BUCKET =
    "site-content";

const CONTENT_MAX_IMAGES =
    3;


/* ==================================================
   初期化
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupContentManagement();

    }
);


/* ==================================================
   セットアップ
================================================== */

function setupContentManagement() {

    const contentNavButton =
        document.querySelector(
            '[data-target="contentManagementSection"]'
        );


    if (!contentNavButton) {

        return;

    }


    contentNavButton.addEventListener(
        "click",
        async () => {

            await loadContentManagement();

        }
    );


    const addActivityButton =
        document.getElementById(
            "addActivityButton"
        );


    if (addActivityButton) {

        addActivityButton.addEventListener(
            "click",
            () => {

                openActivityEditor();

            }
        );

    }

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
   全体読み込み
================================================== */

async function loadContentManagement() {

    if (!getClient()) {

        console.error(
            "Supabaseクライアントが利用できません。"
        );

        return;

    }


    await Promise.all([

        loadSiteContent(
            "next_training"
        ),

        loadSiteContent(
            "annual_schedule"
        ),

        loadActivities()

    ]);

}


/* ==================================================
   固定コンテンツ読み込み
================================================== */

async function loadSiteContent(
    contentType
) {

    const containerId =
        contentType ===
        "next_training"
            ? "nextTrainingImages"
            : "annualScheduleImages";


    const container =
        document.getElementById(
            containerId
        );


    if (!container) {

        return;

    }


    container.innerHTML =
        "読み込み中...";


    const {
        data,
        error
    } =
        await getClient()
            .from(
                "site_contents"
            )
            .select("*")
            .eq(
                "content_type",
                contentType
            )
            .maybeSingle();


    if (error) {

        console.error(
            "コンテンツ取得エラー:",
            error
        );


        container.innerHTML =
            `<p class="content-error">
                読み込みに失敗しました。
            </p>`;

        return;

    }


    const row =
        data || {
            image1_url: null,
            image2_url: null,
            image3_url: null
        };


    renderSiteContent(
        container,
        contentType,
        row
    );

}


/* ==================================================
   固定コンテンツ表示
================================================== */

function renderSiteContent(
    container,
    contentType,
    row
) {

    container.innerHTML =
        "";


    for (
        let i = 1;
        i <= CONTENT_MAX_IMAGES;
        i++
    ) {

        const url =
            row[
                `image${i}_url`
            ];


        const card =
            document.createElement(
                "div"
            );

        card.className =
            "content-image-card";


        const title =
            document.createElement(
                "h4"
            );

        title.textContent =
            `画像${i}`;


        card.appendChild(
            title
        );


        if (url) {

            const preview =
                document.createElement(
                    "img"
                );

            preview.src =
                url;

            preview.alt =
                `${contentType} 画像${i}`;

            preview.className =
                "content-image-preview";


            card.appendChild(
                preview
            );

        } else {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "content-image-empty";

            empty.textContent =
                "画像未登録";

            card.appendChild(
                empty
            );

        }


        const fileInput =
            document.createElement(
                "input"
            );

        fileInput.type =
            "file";

        fileInput.accept =
            "image/*";

        fileInput.className =
            "content-file-input";


        const uploadButton =
            document.createElement(
                "button"
            );

        uploadButton.type =
            "button";

        uploadButton.className =
            "secondary-button";

        uploadButton.textContent =
            url
                ? "画像を変更"
                : "画像を追加";


        uploadButton.addEventListener(
            "click",
            () => {

                fileInput.click();

            }
        );


        fileInput.addEventListener(
            "change",
            async () => {

                const file =
                    fileInput.files?.[0];


                if (!file) {

                    return;

                }


                await uploadSiteImage(
                    contentType,
                    i,
                    file,
                    url
                );

            }
        );


        card.appendChild(
            fileInput
        );

        card.appendChild(
            uploadButton
        );


        if (url) {

            const deleteButton =
                document.createElement(
                    "button"
                );

            deleteButton.type =
                "button";

            deleteButton.className =
                "danger-button";

            deleteButton.textContent =
                "画像を削除";


            deleteButton.addEventListener(
                "click",
                async () => {

                    await deleteSiteImage(
                        contentType,
                        i,
                        url
                    );

                }
            );


            card.appendChild(
                deleteButton
            );

        }


        container.appendChild(
            card
        );

    }

}


/* ==================================================
   固定コンテンツ画像アップロード

   previousUrl
   差し替え前の画像URL
   ストレージから削除するために使用
================================================== */

async function uploadSiteImage(
    contentType,
    imageNumber,
    file,
    previousUrl
) {

    if (
        !validateImageFile(file)
    ) {

        return;

    }


    try {

        const extension =
            getFileExtension(
                file.name
            );


        const path =
            `${contentType}/image${imageNumber}_${Date.now()}.${extension}`;


        const {
            error: uploadError
        } =
            await getClient()
                .storage
                .from(
                    CONTENT_BUCKET
                )
                .upload(
                    path,
                    file,
                    {
                        upsert: false,
                        contentType:
                            file.type
                    }
                );


        if (uploadError) {

            throw uploadError;

        }


        const {
            data: publicData
        } =
            getClient()
                .storage
                .from(
                    CONTENT_BUCKET
                )
                .getPublicUrl(
                    path
                );


        const publicUrl =
            publicData.publicUrl;


        const column =
            `image${imageNumber}_url`;


        const {
            data: existing
        } =
            await getClient()
                .from(
                    "site_contents"
                )
                .select("id")
                .eq(
                    "content_type",
                    contentType
                )
                .maybeSingle();


        let updateError;


        if (existing?.id) {

            const result =
                await getClient()
                    .from(
                        "site_contents"
                    )
                    .update({
                        [column]:
                            publicUrl,
                        updated_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "id",
                        existing.id
                    );

            updateError =
                result.error;

        } else {

            const result =
                await getClient()
                    .from(
                        "site_contents"
                    )
                    .insert({
                        content_type:
                            contentType,
                        [column]:
                            publicUrl
                    });

            updateError =
                result.error;

        }


        if (updateError) {

            throw updateError;

        }


        /*
         * 差し替え前の画像を
         * ストレージから削除
         */

        if (previousUrl) {

            await removeStorageFile(
                previousUrl
            );

        }


        alert(
            "画像を保存しました。"
        );


        await loadSiteContent(
            contentType
        );


    } catch (error) {

        console.error(
            "画像アップロードエラー:",
            error
        );


        alert(
            "画像のアップロードに失敗しました。\n" +
            error.message
        );

    }

}


/* ==================================================
   固定コンテンツ画像削除
================================================== */

async function deleteSiteImage(
    contentType,
    imageNumber,
    url
) {

    if (
        !confirm(
            `画像${imageNumber}を削除しますか？\n\n` +
            "この操作は元に戻せません。"
        )
    ) {

        return;

    }


    try {

        const column =
            `image${imageNumber}_url`;


        /*
         * 先にDBの参照を消す
         *
         * ストレージ削除に失敗しても
         * 画面には残らないようにする
         */

        const {
            error
        } =
            await getClient()
                .from(
                    "site_contents"
                )
                .update({
                    [column]:
                        null,
                    updated_at:
                        new Date().toISOString()
                })
                .eq(
                    "content_type",
                    contentType
                );


        if (error) {

            throw error;

        }


        await removeStorageFile(
            url
        );


        alert(
            "画像を削除しました。"
        );


        await loadSiteContent(
            contentType
        );


    } catch (error) {

        console.error(
            "画像削除エラー:",
            error
        );


        alert(
            "画像の削除に失敗しました。\n" +
            (
                error.message ||
                "不明なエラー"
            )
        );

    }

}


/* ==================================================
   活動実績読み込み
================================================== */

async function loadActivities() {

    const container =
        document.getElementById(
            "activitiesManagementList"
        );


    if (!container) {

        return;

    }


    container.innerHTML =
        "読み込み中...";


    const {
        data,
        error
    } =
        await getClient()
            .from(
                "activities"
            )
            .select("*")
            .order(
                "display_order",
                {
                    ascending: true
                }
            )
            .order(
                "activity_date",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "活動実績取得エラー:",
            error
        );


        container.innerHTML =
            `<p class="content-error">
                活動実績を読み込めませんでした。
            </p>`;

        return;

    }


    container.innerHTML =
        "";


    if (
        !data ||
        data.length === 0
    ) {

        container.innerHTML =
            `<div class="content-empty-message">
                まだ活動実績が登録されていません。
            </div>`;

        return;

    }


    data.forEach(
        activity => {

            renderActivity(
                container,
                activity
            );

        }
    );

}


/* ==================================================
   活動実績表示
================================================== */

function renderActivity(
    container,
    activity
) {

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "activity-management-card";


    const header =
        document.createElement(
            "div"
        );

    header.className =
        "activity-management-header";


    const title =
        document.createElement(
            "h4"
        );

    title.textContent =
        activity.title;


    const status =
        document.createElement(
            "span"
        );

    status.className =
        activity.is_published
            ? "content-status published"
            : "content-status unpublished";

    status.textContent =
        activity.is_published
            ? "公開中"
            : "非公開";


    header.appendChild(
        title
    );

    header.appendChild(
        status
    );


    card.appendChild(
        header
    );


    if (
        activity.activity_date
    ) {

        const date =
            document.createElement(
                "p"
            );

        date.className =
            "activity-date";

        date.textContent =
            formatActivityDate(
                activity.activity_date
            );

        card.appendChild(
            date
        );

    }


    if (
        activity.description
    ) {

        const description =
            document.createElement(
                "p"
            );

        description.className =
            "activity-description";

        description.textContent =
            activity.description;

        card.appendChild(
            description
        );

    }


    /* ==================================================
       写真
    ================================================== */

    const gallery =
        document.createElement(
            "div"
        );

    gallery.className =
        "activity-management-gallery";


    for (
        let i = 1;
        i <= CONTENT_MAX_IMAGES;
        i++
    ) {

        const url =
            activity[
                `image${i}_url`
            ];


        const imageBox =
            document.createElement(
                "div"
            );

        imageBox.className =
            "activity-image-box";


        if (url) {

            const img =
                document.createElement(
                    "img"
                );

            img.src =
                url;

            img.alt =
                `${activity.title} 写真${i}`;

            imageBox.appendChild(
                img
            );

        } else {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "content-image-empty";

            empty.textContent =
                `写真${i} 未登録`;

            imageBox.appendChild(
                empty
            );

        }


        const input =
            document.createElement(
                "input"
            );

        input.type =
            "file";

        input.accept =
            "image/*";

        input.className =
            "content-file-input";


        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.className =
            "secondary-button";

        button.textContent =
            url
                ? `写真${i}を変更`
                : `写真${i}を追加`;


        button.addEventListener(
            "click",
            () => {

                input.click();

            }
        );


        input.addEventListener(
            "change",
            async () => {

                const file =
                    input.files?.[0];


                if (!file) {

                    return;

                }


                await uploadActivityImage(
                    activity,
                    i,
                    file
                );

            }
        );


        imageBox.appendChild(
            input
        );

        imageBox.appendChild(
            button
        );


        /* ------------------------------------------
           写真の削除ボタン

           登録されている写真にのみ表示
        ------------------------------------------ */

        if (url) {

            const deleteImageButton =
                document.createElement(
                    "button"
                );

            deleteImageButton.type =
                "button";

            deleteImageButton.className =
                "danger-button";

            deleteImageButton.textContent =
                `写真${i}を削除`;


            deleteImageButton.addEventListener(
                "click",
                async () => {

                    await deleteActivityImage(
                        activity,
                        i,
                        url
                    );

                }
            );


            imageBox.appendChild(
                deleteImageButton
            );

        }


        gallery.appendChild(
            imageBox
        );

    }


    card.appendChild(
        gallery
    );


    /* ==================================================
       操作ボタン
    ================================================== */

    const actions =
        document.createElement(
            "div"
        );

    actions.className =
        "activity-management-actions";


    const editButton =
        document.createElement(
            "button"
        );

    editButton.type =
        "button";

    editButton.className =
        "secondary-button";

    editButton.textContent =
        "編集";


    editButton.addEventListener(
        "click",
        () => {

            openActivityEditor(
                activity
            );

        }
    );


    const publishButton =
        document.createElement(
            "button"
        );

    publishButton.type =
        "button";

    publishButton.className =
        "secondary-button";

    publishButton.textContent =
        activity.is_published
            ? "非公開にする"
            : "公開する";


    publishButton.addEventListener(
        "click",
        async () => {

            await toggleActivityPublished(
                activity
            );

        }
    );


    const deleteButton =
        document.createElement(
            "button"
        );

    deleteButton.type =
        "button";

    deleteButton.className =
        "danger-button";

    deleteButton.textContent =
        "この活動実績を削除";


    deleteButton.addEventListener(
        "click",
        async () => {

            await deleteActivity(
                activity
            );

        }
    );


    actions.appendChild(
        editButton
    );

    actions.appendChild(
        publishButton
    );

    actions.appendChild(
        deleteButton
    );


    card.appendChild(
        actions
    );


    container.appendChild(
        card
    );

}


/* ==================================================
   活動編集
================================================== */

function openActivityEditor(
    activity = null
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
                ${activity
                    ? "活動実績を編集"
                    : "活動実績を追加"}
            </h3>

            <label>
                活動タイトル
                <input
                    type="text"
                    id="activityEditorTitle"
                    value="${escapeContentHtml(
                        activity?.title || ""
                    )}"
                    maxlength="100"
                >
            </label>

            <label>
                実施日
                <input
                    type="date"
                    id="activityEditorDate"
                    value="${
                        activity?.activity_date || ""
                    }"
                >
            </label>

            <label>
                活動内容
                <textarea
                    id="activityEditorDescription"
                    rows="5"
                    maxlength="1000"
                >${escapeContentHtml(
                    activity?.description || ""
                )}</textarea>
            </label>

            <div class="content-editor-actions">

                <button
                    type="button"
                    id="activityEditorSave"
                    class="primary-button"
                >
                    保存
                </button>

                <button
                    type="button"
                    id="activityEditorCancel"
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


    modal
        .querySelector(
            "#activityEditorCancel"
        )
        ?.addEventListener(
            "click",
            () => {

                modal.remove();

            }
        );


    modal
        .querySelector(
            "#activityEditorSave"
        )
        ?.addEventListener(
            "click",
            async () => {

                await saveActivity(
                    activity,
                    modal
                );

            }
        );

}


/* ==================================================
   活動保存
================================================== */

async function saveActivity(
    activity,
    modal
) {

    const title =
        modal
            .querySelector(
                "#activityEditorTitle"
            )
            ?.value
            .trim();


    const activityDate =
        modal
            .querySelector(
                "#activityEditorDate"
            )
            ?.value || null;


    const description =
        modal
            .querySelector(
                "#activityEditorDescription"
            )
            ?.value
            .trim() || null;


    if (!title) {

        alert(
            "活動タイトルを入力してください。"
        );

        return;

    }


    try {

        const payload = {

            title,

            activity_date:
                activityDate,

            description,

            updated_at:
                new Date().toISOString()

        };


        let error;


        if (activity) {

            const result =
                await getClient()
                    .from(
                        "activities"
                    )
                    .update(
                        payload
                    )
                    .eq(
                        "id",
                        activity.id
                    );

            error =
                result.error;

        } else {

            const result =
                await getClient()
                    .from(
                        "activities"
                    )
                    .insert({
                        ...payload,
                        is_published:
                            true
                    });

            error =
                result.error;

        }


        if (error) {

            throw error;

        }


        modal.remove();


        alert(
            "活動実績を保存しました。"
        );


        await loadActivities();


    } catch (error) {

        console.error(
            "活動保存エラー:",
            error
        );


        alert(
            "活動実績の保存に失敗しました。\n" +
            error.message
        );

    }

}


/* ==================================================
   活動写真アップロード
================================================== */

async function uploadActivityImage(
    activity,
    imageNumber,
    file
) {

    if (
        !validateImageFile(file)
    ) {

        return;

    }


    try {

        const extension =
            getFileExtension(
                file.name
            );


        const path =
            `activities/${activity.id}/image${imageNumber}_${Date.now()}.${extension}`;


        const {
            error: uploadError
        } =
            await getClient()
                .storage
                .from(
                    CONTENT_BUCKET
                )
                .upload(
                    path,
                    file,
                    {
                        upsert: false,
                        contentType:
                            file.type
                    }
                );


        if (uploadError) {

            throw uploadError;

        }


        const {
            data
        } =
            getClient()
                .storage
                .from(
                    CONTENT_BUCKET
                )
                .getPublicUrl(
                    path
                );


        const column =
            `image${imageNumber}_url`;


        /*
         * 差し替え前の写真URL
         */

        const previousUrl =
            activity[
                column
            ];


        const {
            error
        } =
            await getClient()
                .from(
                    "activities"
                )
                .update({
                    [column]:
                        data.publicUrl,
                    updated_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    activity.id
                );


        if (error) {

            throw error;

        }


        /*
         * 古い写真をストレージから削除
         */

        if (previousUrl) {

            await removeStorageFile(
                previousUrl
            );

        }


        alert(
            "写真を保存しました。"
        );


        await loadActivities();


    } catch (error) {

        console.error(
            "活動写真アップロードエラー:",
            error
        );


        alert(
            "写真のアップロードに失敗しました。\n" +
            error.message
        );

    }

}


/* ==================================================
   活動写真削除
================================================== */

async function deleteActivityImage(
    activity,
    imageNumber,
    url
) {

    if (
        !confirm(
            `「${activity.title}」の写真${imageNumber}を削除しますか？\n\n` +
            "この操作は元に戻せません。"
        )
    ) {

        return;

    }


    try {

        const column =
            `image${imageNumber}_url`;


        /*
         * 先にDBの参照を消す
         *
         * ストレージ削除に失敗しても
         * 画面と公開ページからは消える
         */

        const {
            error
        } =
            await getClient()
                .from(
                    "activities"
                )
                .update({
                    [column]:
                        null,
                    updated_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    activity.id
                );


        if (error) {

            throw error;

        }


        await removeStorageFile(
            url
        );


        alert(
            "写真を削除しました。"
        );


        await loadActivities();


    } catch (error) {

        console.error(
            "活動写真削除エラー:",
            error
        );


        alert(
            "写真の削除に失敗しました。\n" +
            (
                error.message ||
                "不明なエラー"
            )
        );

    }

}


/* ==================================================
   公開 / 非公開
================================================== */

async function toggleActivityPublished(
    activity
) {

    try {

        const {
            error
        } =
            await getClient()
                .from(
                    "activities"
                )
                .update({
                    is_published:
                        !activity.is_published,
                    updated_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    activity.id
                );


        if (error) {

            throw error;

        }


        await loadActivities();


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
   活動削除
================================================== */

async function deleteActivity(
    activity
) {

    if (
        !confirm(
            `「${activity.title}」を削除しますか？\n\n` +
            "登録されている写真もすべて削除されます。"
        )
    ) {

        return;

    }


    try {

        const {
            error
        } =
            await getClient()
                .from(
                    "activities"
                )
                .delete()
                .eq(
                    "id",
                    activity.id
                );


        if (error) {

            throw error;

        }


        /*
         * 登録されていた写真を
         * ストレージから削除
         */

        for (
            let i = 1;
            i <= CONTENT_MAX_IMAGES;
            i++
        ) {

            await removeStorageFile(
                activity[
                    `image${i}_url`
                ]
            );

        }


        alert(
            "活動実績を削除しました。"
        );


        await loadActivities();


    } catch (error) {

        console.error(
            "活動削除エラー:",
            error
        );


        alert(
            "活動実績の削除に失敗しました。\n" +
            (
                error.message ||
                "不明なエラー"
            )
        );

    }

}


/* ==================================================
   画像ファイル確認
================================================== */

function validateImageFile(
    file
) {

    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        alert(
            "画像ファイルを選択してください。"
        );

        return false;

    }


    if (
        file.size >
        10 * 1024 * 1024
    ) {

        alert(
            "画像サイズは10MB以下にしてください。"
        );

        return false;

    }


    return true;

}


/* ==================================================
   公開URL → ストレージ上のパス

   https://xxxx.supabase.co/storage/v1/object/public/
   site-content/activities/<id>/image1_1234.jpg
   ↓
   activities/<id>/image1_1234.jpg
================================================== */

function getStoragePathFromUrl(
    url
) {

    if (!url) {

        return null;

    }


    const marker =
        `/storage/v1/object/public/${CONTENT_BUCKET}/`;


    const text =
        String(url);


    const index =
        text.indexOf(marker);


    if (index === -1) {

        return null;

    }


    const path =
        text
            .slice(
                index + marker.length
            )
            .split("?")[0];


    try {

        return decodeURIComponent(
            path
        );

    } catch (error) {

        return path;

    }

}


/* ==================================================
   ストレージからファイルを削除

   DB側の参照はすでに消えているため
   ここでの失敗は致命的ではない。
   警告のみ出して処理を続ける。
================================================== */

async function removeStorageFile(
    url
) {

    const path =
        getStoragePathFromUrl(
            url
        );


    if (!path) {

        return;

    }


    try {

        const {
            error
        } =
            await getClient()
                .storage
                .from(
                    CONTENT_BUCKET
                )
                .remove([
                    path
                ]);


        if (error) {

            console.warn(
                "ストレージ削除エラー:",
                error
            );

        }

    } catch (error) {

        console.warn(
            "ストレージ削除エラー:",
            error
        );

    }

}


/* ==================================================
   拡張子
================================================== */

function getFileExtension(
    filename
) {

    const parts =
        String(filename)
            .split(".");


    return (
        parts
            .pop()
            ?.toLowerCase()
            .replace(
                /[^a-z0-9]/g,
                ""
            ) ||
        "jpg"
    );

}


/* ==================================================
   活動実施日の表示

   ※他ファイルにも formatDate があるため
     名前を分けて衝突を避けている
================================================== */

function formatActivityDate(
    value
) {

    if (!value) {

        return "";

    }


    const date =
        new Date(
            `${value}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);

    }


    return (
        `${date.getFullYear()}年` +
        `${date.getMonth() + 1}月` +
        `${date.getDate()}日`
    );

}


/* ==================================================
   HTMLエスケープ
================================================== */

function escapeContentHtml(
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

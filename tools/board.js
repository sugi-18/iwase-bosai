/* ==================================================
   岩瀬自治会 防災アプリ
   自治会掲示板

   ・投稿名は自由に決められる
   ・種類（ふだんの交流／おしらせ／被害報告）を選ぶ
   ・いいねを押せる。もう一度押すと取り消せる

   書き込みはすべて RPC を通す。
   一般利用者は Supabase Auth を使わないため、
   テーブルへ直接書き込ませない方針にしている。
================================================== */

(function () {

"use strict";


var NAME_STORAGE = "iwaseBoardName";

var PAGE_SIZE = 50;


/* いいね済みの投稿ID */

var likedPosts = {};


var currentFilter = "all";


/* ==================================================
   小さな道具
================================================== */

function esc(value) {

    return window.IwaseCommunity.escapeHtml(value);

}


function el(id) {

    return document.getElementById(id);

}


var CATEGORY_LABEL = {

    normal: "ふだんの交流",

    info:   "おしらせ",

    damage: "被害報告"

};


function categoryBadge(category) {

    var label =
        CATEGORY_LABEL[category] || CATEGORY_LABEL.normal;

    var cls = "tool-badge";

    if (category === "damage") {

        cls = "tool-badge tool-badge-damage";

    }
    else if (category === "info") {

        cls = "tool-badge tool-badge-info";

    }

    return '<span class="' + cls + '">' + esc(label) + '</span>';

}


/* ==================================================
   投稿名の初期値

   前回の投稿名 → 利用者情報の氏名 の順に使う。
================================================== */

function initName() {

    var input = el("boardName");

    if (!input) {
        return;
    }


    var stored = "";

    try {

        stored = localStorage.getItem(NAME_STORAGE) || "";

    }
    catch (error) {

        console.warn("投稿名の読み取りに失敗:", error);

    }


    if (stored) {

        input.value = stored;

        return;

    }


    var user = window.IwaseCommunity.currentUser();

    if (user && user.name) {

        input.value = user.name;

    }

}


function saveName(name) {

    try {

        localStorage.setItem(NAME_STORAGE, name);

    }
    catch (error) {

        console.warn("投稿名の保存に失敗:", error);

    }

}


/* ==================================================
   いいね済みの読み込み
================================================== */

async function loadLikes() {

    likedPosts = {};


    try {

        var result =
            await window.supabaseClient.rpc(
                "get_board_likes",
                {
                    p_client_key:
                        window.IwaseCommunity.clientKey()
                }
            );


        if (result.error) {
            throw result.error;
        }


        (result.data || []).forEach(function (row) {

            /*
             * 返り値は uuid の配列。
             * 実装によって { post_id: ... } で来ることも
             * あるため両方に備える。
             */

            var id =
                (row && row.post_id) ? row.post_id : row;

            if (id) {

                likedPosts[id] = true;

            }

        });


    }
    catch (error) {

        console.warn("いいね状態の取得に失敗:", error);

    }

}


/* ==================================================
   投稿一覧の読み込み
================================================== */

async function loadPosts() {

    var container = el("boardList");

    if (!container) {
        return;
    }


    container.innerHTML =
        '<div class="tool-loading">読み込み中...</div>';


    try {

        var query =
            window.supabaseClient
                .from("board_posts")
                .select(
                    "id, display_name, category, body, " +
                    "like_count, created_at"
                )
                .eq("is_hidden", false);


        if (currentFilter !== "all") {

            query = query.eq("category", currentFilter);

        }


        var result =
            await query
                .order("created_at", { ascending: false })
                .limit(PAGE_SIZE);


        if (result.error) {
            throw result.error;
        }


        var posts = result.data || [];


        if (posts.length === 0) {

            container.innerHTML =
                '<div class="tool-empty">' +
                'まだ投稿はありません。<br>' +
                '最初の投稿をしてみませんか。' +
                '</div>';

            return;

        }


        /*
         * コメントは投稿ごとに問い合わせると
         * 回数が増えるため、まとめて1回で取得する。
         */

        var comments = await loadComments(
            posts.map(function (post) {
                return post.id;
            })
        );


        container.innerHTML = "";


        posts.forEach(function (post) {

            container.appendChild(
                createPostElement(
                    post,
                    comments[post.id] || []
                )
            );

        });


    }
    catch (error) {

        console.error("投稿取得エラー:", error);

        container.innerHTML =
            '<div class="tool-error">' +
            '投稿を読み込めませんでした。<br>' +
            'しばらく時間をおいて再度お試しください。' +
            '</div>';

    }

}


/* ==================================================
   コメントの読み込み

   表示中の投稿の分だけをまとめて取得し、
   投稿IDごとに仕分けして返す。
================================================== */

async function loadComments(postIds) {

    var grouped = {};


    if (!postIds || postIds.length === 0) {

        return grouped;

    }


    try {

        var result =
            await window.supabaseClient
                .from("board_comments")
                .select(
                    "id, post_id, display_name, body, created_at"
                )
                .in("post_id", postIds)
                .eq("is_hidden", false)
                .order("created_at", { ascending: true });


        if (result.error) {
            throw result.error;
        }


        (result.data || []).forEach(function (comment) {

            if (!grouped[comment.post_id]) {

                grouped[comment.post_id] = [];

            }

            grouped[comment.post_id].push(comment);

        });


    }
    catch (error) {

        console.warn("コメントの取得に失敗:", error);

    }


    return grouped;

}


/* ==================================================
   投稿1件分の要素
================================================== */

function createPostElement(post, comments) {

    var article = document.createElement("article");

    article.className = "board-post";


    var liked = likedPosts[post.id] === true;


    article.innerHTML =

        '<div class="board-post-head">' +
        categoryBadge(post.category) +
        '<span class="board-post-name">' +
        esc(post.display_name) +
        '</span>' +
        '<span class="board-post-time">' +
        esc(
            window.IwaseCommunity.formatDateTime(
                post.created_at
            )
        ) +
        '</span>' +
        '</div>' +

        '<div class="board-post-body">' +
        esc(post.body) +
        '</div>';


    var button = document.createElement("button");

    button.type = "button";

    button.className =
        "board-like-button" + (liked ? " liked" : "");

    button.innerHTML =
        '<span>' + (liked ? "💙" : "🤍") + '</span>' +
        '<span class="like-count">' +
        (post.like_count || 0) +
        '</span>' +
        '<span>いいね</span>';


    button.addEventListener(
        "click",
        function () {
            toggleLike(post.id, button);
        }
    );


    /* ---------- ボタンの並び ---------- */

    var actions = document.createElement("div");

    actions.className = "board-post-actions";

    actions.appendChild(button);


    var list = comments || [];


    var replyButton = document.createElement("button");

    replyButton.type = "button";

    replyButton.className = "board-reply-button";

    replyButton.textContent =
        list.length > 0
            ? "💬 返信 " + list.length + "件"
            : "💬 返信する";


    actions.appendChild(replyButton);

    article.appendChild(actions);


    /* ---------- 返信欄 ---------- */

    var replyArea = document.createElement("div");

    replyArea.className = "board-reply-area";

    replyArea.style.display = "none";

    replyArea.appendChild(createCommentList(list));

    replyArea.appendChild(createCommentForm(post.id));

    article.appendChild(replyArea);


    replyButton.addEventListener(
        "click",
        function () {

            var isOpen =
                replyArea.style.display !== "none";

            replyArea.style.display =
                isOpen ? "none" : "block";

        }
    );


    /*
     * 返信が付いている投稿は最初から開いておく。
     * 押さないと気づかれないため。
     */

    if (list.length > 0) {

        replyArea.style.display = "block";

    }


    return article;

}


/* ==================================================
   返信の一覧
================================================== */

function createCommentList(comments) {

    var wrapper = document.createElement("div");

    wrapper.className = "board-comment-list";


    if (!comments || comments.length === 0) {

        wrapper.innerHTML =
            '<p class="board-comment-empty">' +
            'まだ返信はありません。' +
            '</p>';

        return wrapper;

    }


    wrapper.innerHTML =
        comments.map(function (comment) {

            return (
                '<div class="board-comment">' +
                '<div class="board-comment-head">' +
                '<span class="board-comment-name">' +
                esc(comment.display_name) +
                '</span>' +
                '<span class="board-post-time">' +
                esc(
                    window.IwaseCommunity.formatDateTime(
                        comment.created_at
                    )
                ) +
                '</span>' +
                '</div>' +
                '<div class="board-comment-body">' +
                esc(comment.body) +
                '</div>' +
                '</div>'
            );

        }).join("");


    return wrapper;

}


/* ==================================================
   返信の入力欄
================================================== */

function createCommentForm(postId) {

    var form = document.createElement("div");

    form.className = "board-comment-form";


    var storedName = "";

    try {

        storedName = localStorage.getItem(NAME_STORAGE) || "";

    }
    catch (error) {

        console.warn("投稿名の読み取りに失敗:", error);

    }


    if (!storedName) {

        var user = window.IwaseCommunity.currentUser();

        if (user && user.name) {

            storedName = user.name;

        }

    }


    form.innerHTML =

        '<input type="text" class="tool-input board-comment-name" ' +
        'maxlength="40" placeholder="お名前（自由に決められます）" ' +
        'value="' + esc(storedName) + '">' +

        '<textarea class="tool-textarea board-comment-input" ' +
        'maxlength="1000" ' +
        'placeholder="返信を書く"></textarea>' +

        '<div class="board-comment-message"></div>';


    var button = document.createElement("button");

    button.type = "button";

    button.className = "tool-button tool-button-sub";

    button.textContent = "返信する";


    button.addEventListener(
        "click",
        function () {

            submitComment(postId, form, button);

        }
    );


    form.appendChild(button);


    return form;

}


/* ==================================================
   返信の投稿
================================================== */

async function submitComment(postId, form, button) {

    var nameInput =
        form.querySelector(".board-comment-name");

    var bodyInput =
        form.querySelector(".board-comment-input");

    var message =
        form.querySelector(".board-comment-message");


    var name = nameInput.value.trim();

    var body = bodyInput.value.trim();


    if (body === "") {

        message.innerHTML =
            '<div class="tool-message tool-message-ng">' +
            '返信の内容を入力してください。' +
            '</div>';

        return;

    }


    if (name === "") {

        name = "名無し";

    }


    var user = window.IwaseCommunity.currentUser();


    button.disabled = true;

    button.textContent = "送信中...";

    message.innerHTML = "";


    try {

        var result =
            await window.supabaseClient.rpc(
                "create_board_comment",
                {
                    p_post_id: postId,

                    p_display_name: name,

                    p_body: body,

                    p_participant_id:
                        (user && user.id) ? user.id : null
                }
            );


        if (result.error) {
            throw result.error;
        }


        saveName(name);


        bodyInput.value = "";


        await loadPosts();


    }
    catch (error) {

        console.error("返信エラー:", error);


        var text =
            (error && error.message)
                ? error.message
                : "返信できませんでした。";


        message.innerHTML =
            '<div class="tool-message tool-message-ng">' +
            esc(text) +
            '</div>';


        button.disabled = false;

        button.textContent = "返信する";

    }

}


/* ==================================================
   いいね
================================================== */

async function toggleLike(postId, button) {

    button.disabled = true;


    try {

        var result =
            await window.supabaseClient.rpc(
                "toggle_board_like",
                {
                    p_post_id: postId,

                    p_client_key:
                        window.IwaseCommunity.clientKey()
                }
            );


        if (result.error) {
            throw result.error;
        }


        var data = result.data || {};

        var liked = data.liked === true;

        var count = data.like_count || 0;


        likedPosts[postId] = liked;


        button.className =
            "board-like-button" + (liked ? " liked" : "");

        button.innerHTML =
            '<span>' + (liked ? "💙" : "🤍") + '</span>' +
            '<span class="like-count">' + count + '</span>' +
            '<span>いいね</span>';


    }
    catch (error) {

        console.error("いいねエラー:", error);

        alert("いいねを反映できませんでした。");

    }
    finally {

        button.disabled = false;

    }

}


/* ==================================================
   投稿する
================================================== */

async function submitPost() {

    var message = el("boardMessage");

    var button  = el("boardSubmitButton");

    var name    = el("boardName").value.trim();

    var body    = el("boardBody").value.trim();

    var category = el("boardCategory").value;


    if (body === "") {

        message.innerHTML =
            '<div class="tool-message tool-message-ng">' +
            '内容を入力してください。' +
            '</div>';

        return;

    }


    if (name === "") {

        name = "名無し";

    }


    var user = window.IwaseCommunity.currentUser();


    button.disabled = true;

    button.textContent = "送信中...";

    message.innerHTML = "";


    try {

        var result =
            await window.supabaseClient.rpc(
                "create_board_post",
                {
                    p_display_name: name,

                    p_body: body,

                    p_category: category,

                    p_participant_id:
                        (user && user.id) ? user.id : null
                }
            );


        if (result.error) {
            throw result.error;
        }


        saveName(name);


        el("boardBody").value = "";


        message.innerHTML =
            '<div class="tool-message tool-message-ok">' +
            '投稿しました。' +
            '</div>';


        await loadPosts();


    }
    catch (error) {

        console.error("投稿エラー:", error);


        var text =
            (error && error.message)
                ? error.message
                : "投稿できませんでした。";


        message.innerHTML =
            '<div class="tool-message tool-message-ng">' +
            esc(text) +
            '</div>';

    }
    finally {

        button.disabled = false;

        button.textContent = "投稿する";

    }

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


        initName();


        el("boardSubmitButton")
            .addEventListener("click", submitPost);


        el("boardFilter")
            .addEventListener(
                "change",
                function (event) {

                    currentFilter = event.target.value;

                    loadPosts();

                }
            );


        await loadLikes();

        await loadPosts();

    }
);

})();

// ==================================================
// 岩瀬自治会 防災アプリ
// 利用者情報の保存・復元
//
// localStorage だけに保存していると、
//
//   ・iOS Safari が一定期間の未使用でストレージを破棄する
//   ・LINE内ブラウザのキャッシュ削除で消える
//   ・プライベートブラウズで保持されない
//
// といった理由で利用者情報が失われる。
//
// そこで
//
//   localStorage / Cookie / IndexedDB
//
// の3か所に同じ情報を書き、起動時にどれか1つでも
// 残っていれば残り2か所へ書き戻す。
//
// ※ ブラウザとLINE内ブラウザの間ではどの方式でも共有できない。
//   そちらは氏名＋暗証番号での再ログインで対応する。
// ==================================================

(function (global) {

    "use strict";


    var STORAGE_KEY = "iwaseStamp";

    var COOKIE_NAME = "iwase_uid";

    var COOKIE_MAX_AGE = 60 * 60 * 24 * 400;   // 400日

    var DB_NAME = "iwase";

    var DB_VERSION = 1;

    var STORE_NAME = "identity";

    var RECORD_KEY = "user";


    // ==================================================
    // 妥当性確認
    // ==================================================

    function isValid(data) {

        return !!(
            data &&
            typeof data.id === "string" &&
            data.id.trim() !== "" &&
            typeof data.name === "string" &&
            data.name.trim() !== ""
        );

    }


    function normalize(data) {

        if (!isValid(data)) {
            return null;
        }

        return {

            id: String(data.id).trim(),

            name: String(data.name).trim(),

            stamps: Array.isArray(data.stamps)
                ? data.stamps
                : []

        };

    }


    // ==================================================
    // localStorage
    // ==================================================

    function readLocal() {

        try {

            var raw = localStorage.getItem(STORAGE_KEY);

            if (!raw) {
                return null;
            }

            return normalize(JSON.parse(raw));

        }
        catch (error) {

            console.warn("localStorage読み込み失敗:", error);

            return null;

        }

    }


    function writeLocal(data) {

        try {

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(data)
            );

        }
        catch (error) {

            console.warn("localStorage書き込み失敗:", error);

        }

    }


    // ==================================================
    // Cookie
    //
    // スタンプ履歴は入れず、IDと氏名だけを保持する。
    // ==================================================

    function readCookie() {

        try {

            var parts = document.cookie.split(";");

            for (var i = 0; i < parts.length; i++) {

                var item = parts[i].trim();

                if (item.indexOf(COOKIE_NAME + "=") !== 0) {
                    continue;
                }

                var value = decodeURIComponent(
                    item.substring(COOKIE_NAME.length + 1)
                );

                return normalize(JSON.parse(value));

            }

            return null;

        }
        catch (error) {

            console.warn("Cookie読み込み失敗:", error);

            return null;

        }

    }


    function writeCookie(data) {

        try {

            var value = encodeURIComponent(
                JSON.stringify({
                    id: data.id,
                    name: data.name
                })
            );

            document.cookie =
                COOKIE_NAME + "=" + value +
                "; path=/" +
                "; max-age=" + COOKIE_MAX_AGE +
                "; SameSite=Lax" +
                (location.protocol === "https:" ? "; Secure" : "");

        }
        catch (error) {

            console.warn("Cookie書き込み失敗:", error);

        }

    }


    function clearCookie() {

        try {

            document.cookie =
                COOKIE_NAME + "=; path=/; max-age=0; SameSite=Lax";

        }
        catch (error) {

            console.warn("Cookie削除失敗:", error);

        }

    }


    // ==================================================
    // IndexedDB
    // ==================================================

    function openDb() {

        return new Promise(function (resolve) {

            try {

                if (!global.indexedDB) {
                    resolve(null);
                    return;
                }

                var request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = function () {

                    var db = request.result;

                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME);
                    }

                };

                request.onsuccess = function () {
                    resolve(request.result);
                };

                request.onerror = function () {
                    console.warn("IndexedDBを開けません:", request.error);
                    resolve(null);
                };

            }
            catch (error) {

                console.warn("IndexedDB初期化失敗:", error);

                resolve(null);

            }

        });

    }


    function readIdb() {

        return openDb().then(function (db) {

            if (!db) {
                return null;
            }

            return new Promise(function (resolve) {

                try {

                    var tx = db.transaction(STORE_NAME, "readonly");

                    var request = tx.objectStore(STORE_NAME).get(RECORD_KEY);

                    request.onsuccess = function () {
                        resolve(normalize(request.result));
                    };

                    request.onerror = function () {
                        resolve(null);
                    };

                }
                catch (error) {

                    console.warn("IndexedDB読み込み失敗:", error);

                    resolve(null);

                }

            });

        });

    }


    function writeIdb(data) {

        return openDb().then(function (db) {

            if (!db) {
                return;
            }

            return new Promise(function (resolve) {

                try {

                    var tx = db.transaction(STORE_NAME, "readwrite");

                    tx.objectStore(STORE_NAME).put(
                        {
                            id: data.id,
                            name: data.name
                        },
                        RECORD_KEY
                    );

                    tx.oncomplete = function () {
                        resolve();
                    };

                    tx.onerror = function () {
                        resolve();
                    };

                }
                catch (error) {

                    console.warn("IndexedDB書き込み失敗:", error);

                    resolve();

                }

            });

        });

    }


    function clearIdb() {

        return openDb().then(function (db) {

            if (!db) {
                return;
            }

            return new Promise(function (resolve) {

                try {

                    var tx = db.transaction(STORE_NAME, "readwrite");

                    tx.objectStore(STORE_NAME).delete(RECORD_KEY);

                    tx.oncomplete = function () {
                        resolve();
                    };

                    tx.onerror = function () {
                        resolve();
                    };

                }
                catch (error) {

                    resolve();

                }

            });

        });

    }


    // ==================================================
    // 読み込み
    //
    // 3か所を確認し、見つかったものを全体へ書き戻す。
    // スタンプ履歴を持つlocalStorageを優先する。
    // ==================================================

    function load() {

        return readIdb().then(function (fromIdb) {

            var fromLocal  = readLocal();

            var fromCookie = readCookie();

            var data =
                fromLocal ||
                fromCookie ||
                fromIdb;

            if (!data) {
                return null;
            }

            // 復元元がlocalStorage以外なら書き戻す
            if (!fromLocal) {

                console.log(
                    "利用者情報を別の保存先から復元しました:",
                    data.id
                );

            }

            return save(data).then(function () {
                return data;
            });

        });

    }


    // ==================================================
    // 保存
    // ==================================================

    function save(data) {

        var record = normalize(data);

        if (!record) {

            return Promise.resolve(null);

        }

        writeLocal(record);

        writeCookie(record);

        return writeIdb(record).then(function () {
            return record;
        });

    }


    // ==================================================
    // 削除
    //
    // 退会時のみ使用する。
    // 通信エラーや照合失敗では呼ばないこと。
    // ==================================================

    function clear() {

        try {
            localStorage.removeItem(STORAGE_KEY);
        }
        catch (error) {
            console.warn("localStorage削除失敗:", error);
        }

        clearCookie();

        return clearIdb();

    }


    global.IwaseIdentity = {

        load:  load,

        save:  save,

        clear: clear,

        read:  readLocal,

        STORAGE_KEY: STORAGE_KEY

    };

})(window);

// ==================================================
// 岩瀬自治会 防災アプリ
// Edge Function: fetch-jma-alerts
//
// 気象庁から警報・注意報を取ってきて alerts テーブルへ
// 反映し、新しく出た警報についてはプッシュ通知を送る。
//
// cron で 5分おきに叩く想定（02_cron_and_helpers.sql）。
//
// --------------------------------------------------
// なぜ端末から直接取りに行かないのか
//
//   ・全端末が気象庁へアクセスすると負荷になる
//   ・CORSが許可されている保証がない（非公式のJSON）
//   ・「いつ何が発表されたか」の履歴が残らない
//   ・通知を送るには結局サーバ側の判定が必要
//
// --------------------------------------------------
// 河川水位について（重要）
//
// 国交省「川の防災情報」(river.go.jp) は、
// 取り扱い上の注意で
// 「ツール等による定期的なデータ収集」を
// 商用・非商用を問わず控えるよう明記している。
// つまり水位ページを定期スクレイピングしてはいけない。
//
// 河川の危険度は、気象庁が国交省と共同で発表する
// 「指定河川洪水予報」を使う。
// これは気象庁防災情報XMLで公開されており、
// 江戸川・坂川もここに含まれる。
// 下の ENABLE_FLOOD で有効にできる。
//
// 生の水位数値がどうしても必要になったら、
// 有料の「水防災オープンデータ提供サービス」
// （河川情報センター）を検討すること。
// --------------------------------------------------

import { createClient } from "npm:@supabase/supabase-js@2.45.0";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;


// 千葉県
const PREF_CODE = Deno.env.get("JMA_PREF_CODE") ?? "120000";

// 松戸市（class20コード）
// 正しいコードは https://www.jma.go.jp/bosai/common/const/area.json で確認できる
const AREA_CODE = Deno.env.get("JMA_AREA_CODE") ?? "1220700";

const AREA_LABEL = Deno.env.get("JMA_AREA_LABEL") ?? "松戸市";


// この数値以上でプッシュ通知を送る（既定は警報以上）
const PUSH_MIN_LEVEL = Number(Deno.env.get("PUSH_MIN_LEVEL") ?? "2");

// 解除されたときも通知するか
const PUSH_ON_CLEAR =
    (Deno.env.get("PUSH_ON_CLEAR") ?? "false") === "true";

// 指定河川洪水予報を取り込むか
const ENABLE_FLOOD =
    (Deno.env.get("ENABLE_FLOOD") ?? "false") === "true";

// 監視する河川名（Headlineに含まれるかで判定する）
const FLOOD_KEYWORDS =
    (Deno.env.get("JMA_FLOOD_KEYWORDS") ?? "江戸川,坂川")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);


const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});


// ==================================================
// 気象庁の警報・注意報コード
// ==================================================

const WARNING_NAMES: Record<string, string> = {
    "02": "暴風雪警報",
    "03": "大雨警報",
    "04": "洪水警報",
    "05": "暴風警報",
    "06": "大雪警報",
    "07": "波浪警報",
    "08": "高潮警報",
    "09": "土砂災害警戒情報",
    "10": "大雨注意報",
    "12": "大雪注意報",
    "13": "風雪注意報",
    "14": "雷注意報",
    "15": "強風注意報",
    "16": "波浪注意報",
    "17": "融雪注意報",
    "18": "洪水注意報",
    "19": "高潮注意報",
    "20": "濃霧注意報",
    "21": "乾燥注意報",
    "22": "なだれ注意報",
    "23": "低温注意報",
    "24": "霜注意報",
    "25": "着氷注意報",
    "26": "着雪注意報",
    "27": "その他の注意報",
    "29": "土砂災害注意情報",
    "32": "暴風雪特別警報",
    "33": "大雨特別警報",
    "35": "暴風特別警報",
    "36": "大雪特別警報",
    "37": "波浪特別警報",
    "38": "高潮特別警報",
    "39": "土砂災害特別警報",
    "43": "大雨危険警報",
    "48": "高潮危険警報",
    "49": "土砂災害危険警報",
};


// 0 お知らせ / 1 注意報 / 2 警報 / 3 特別警報・危険
function levelOf(code: string): number {

    const value = Number(code);

    if (value >= 30) {
        return 3;
    }

    if (value >= 10) {
        return 1;
    }

    return 2;

}


// 住民に何をしてほしいかを一言添える
function adviceOf(level: number): string {

    if (level >= 3) {
        return "命を守る行動をとってください。";
    }

    if (level >= 2) {
        return "避難の準備を始め、市の発表を確認してください。";
    }

    return "今後の情報に注意してください。";

}


// ==================================================
// 警報・注意報JSONの取得
//
// エンドポイントは予告なく変わることがあるため、
// 既知のパスを順に試す。
// ==================================================

const WARNING_ENDPOINTS = [
    `https://www.jma.go.jp/bosai/warning/data/r8/${PREF_CODE}.json`,
    `https://www.jma.go.jp/bosai/warning/data/warning/${PREF_CODE}.json`,
];


interface JmaWarning {
    code?: string;
    status?: string;
}

interface JmaArea {
    code?: string;
    warnings?: JmaWarning[];
}

interface JmaAreaType {
    areas?: JmaArea[];
}

interface JmaWarningJson {
    reportDatetime?: string;
    areaTypes?: JmaAreaType[];
}


async function fetchWarningJson(): Promise<JmaWarningJson | null> {

    for (const url of WARNING_ENDPOINTS) {

        try {

            const response = await fetch(url, {
                headers: {
                    "User-Agent":
                        "iwase-bosai-app/1.0 (community disaster prevention)",
                },
            });

            if (!response.ok) {
                console.warn("取得できません:", url, response.status);
                continue;
            }

            return await response.json() as JmaWarningJson;

        } catch (error) {
            console.warn("取得例外:", url, error);
        }

    }

    return null;

}


// 発表中の警報コードを取り出す
function extractActiveCodes(json: JmaWarningJson): Set<string> {

    const active = new Set<string>();

    for (const areaType of json.areaTypes ?? []) {

        for (const area of areaType.areas ?? []) {

            if (area.code !== AREA_CODE) {
                continue;
            }

            for (const warning of area.warnings ?? []) {

                const code = warning.code ?? "";

                const status = warning.status ?? "";

                if (!WARNING_NAMES[code]) {
                    continue;
                }

                // 「解除」「発表警報・注意報はなし」は対象外
                if (status.includes("解除") || status.includes("なし")) {
                    continue;
                }

                active.add(code);

            }

        }

    }

    return active;

}


// ==================================================
// 指定河川洪水予報（Atomフィード）
//
// ※ 実データでの検証を必ず行うこと。
//    ENABLE_FLOOD=false の間は動かない。
// ==================================================

const FLOOD_FEED_URL =
    "https://www.data.jma.go.jp/developer/xml/feed/extra.xml";


function pickTag(xml: string, tag: string): string {

    const match = new RegExp(
        `<${tag}[^>]*>([\\s\\S]*?)</${tag}>`,
    ).exec(xml);

    return match ? match[1].trim() : "";

}


function floodLevelOf(title: string): number {

    if (title.includes("氾濫発生") || title.includes("氾濫危険")) {
        return 3;
    }

    if (title.includes("氾濫警戒")) {
        return 2;
    }

    if (title.includes("氾濫注意")) {
        return 1;
    }

    return 0;

}


interface FloodAlert {
    keyword: string;
    title: string;
    body: string;
    level: number;
    issuedAt: string;
    cleared: boolean;
}


async function fetchFloodAlerts(): Promise<FloodAlert[]> {

    const found: FloodAlert[] = [];

    try {

        const feedResponse = await fetch(FLOOD_FEED_URL, {
            headers: {
                "User-Agent":
                    "iwase-bosai-app/1.0 (community disaster prevention)",
            },
        });

        if (!feedResponse.ok) {
            console.warn("フィード取得失敗:", feedResponse.status);
            return found;
        }

        const feed = await feedResponse.text();

        const entries = feed.split("<entry>").slice(1);

        for (const entry of entries) {

            const entryTitle = pickTag(entry, "title");

            if (!entryTitle.includes("指定河川洪水予報")) {
                continue;
            }

            const linkMatch =
                /<link[^>]*href="([^"]+)"/.exec(entry);

            if (!linkMatch) {
                continue;
            }

            const xmlResponse = await fetch(linkMatch[1]);

            if (!xmlResponse.ok) {
                continue;
            }

            const xml = await xmlResponse.text();

            const headBlock = pickTag(xml, "Head");

            const title = pickTag(headBlock, "Title");

            const reportDateTime = pickTag(headBlock, "ReportDateTime");

            const headline = pickTag(pickTag(headBlock, "Headline"), "Text");


            const keyword = FLOOD_KEYWORDS.find(
                (word) => title.includes(word) || headline.includes(word),
            );

            if (!keyword) {
                continue;
            }


            found.push({
                keyword,
                title,
                body: headline.replace(/\s+/g, " ").slice(0, 300),
                level: floodLevelOf(title),
                issuedAt: reportDateTime || new Date().toISOString(),
                cleared: title.includes("解除"),
            });

        }

    } catch (error) {
        console.warn("洪水予報の取得に失敗:", error);
    }

    return found;

}


// ==================================================
// 通知の送信
// ==================================================

async function sendPush(input: {
    title: string;
    body: string;
    level: number;
    tag: string;
    alertId: string | null;
    url: string;
}) {

    const topic = input.level >= 3 ? "emergency" : "warning";

    try {

        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/send-push`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                    topic,
                    level: input.level,
                    title: input.title,
                    body: input.body,
                    url: input.url,
                    tag: input.tag,
                    alert_id: input.alertId,
                }),
            },
        );

        const result = await response.json();

        console.log("通知送信:", input.title, result);

    } catch (error) {
        console.error("通知送信に失敗:", error);
    }

}


// ==================================================
// 気象警報の反映
// ==================================================

async function syncWeatherWarnings(): Promise<string[]> {

    const messages: string[] = [];

    const json = await fetchWarningJson();

    if (!json) {
        messages.push("気象庁のデータを取得できませんでした。");
        return messages;
    }


    const activeCodes = extractActiveCodes(json);

    const issuedAt = json.reportDatetime ?? new Date().toISOString();


    const { data: existing, error } = await admin
        .from("alerts")
        .select("id, event_key, level, is_active")
        .eq("source", "jma_warning");

    if (error) {
        console.error("既存データの取得に失敗:", error);
        messages.push("既存データを読めませんでした。");
        return messages;
    }


    const byKey = new Map(
        (existing ?? []).map((row) => [row.event_key as string, row]),
    );


    /* ---------- 発表中のものを反映 ---------- */

    for (const code of activeCodes) {

        const eventKey = `${AREA_CODE}:${code}`;

        const name = WARNING_NAMES[code];

        const level = levelOf(code);

        const previous = byKey.get(eventKey);

        const isNew = !previous || previous.is_active === false;

        const isUpgrade =
            previous && previous.is_active && (previous.level as number) < level;


        const { data: saved, error: upsertError } = await admin
            .from("alerts")
            .upsert(
                {
                    source: "jma_warning",
                    event_key: eventKey,
                    category: "weather",
                    level,
                    title: `${AREA_LABEL}に${name}`,
                    body: adviceOf(level),
                    area_name: AREA_LABEL,
                    issued_at: issuedAt,
                    is_active: true,
                    resolved_at: null,
                    updated_at: new Date().toISOString(),
                    raw: { code, area: AREA_CODE },
                },
                { onConflict: "source,event_key" },
            )
            .select("id")
            .single();

        if (upsertError) {
            console.error("保存に失敗:", eventKey, upsertError);
            continue;
        }


        if ((isNew || isUpgrade) && level >= PUSH_MIN_LEVEL) {

            await sendPush({
                title: `${AREA_LABEL}に${name}`,
                body: adviceOf(level),
                level,
                tag: `jma-${code}`,
                alertId: saved?.id ?? null,
                url: "./water-timeline/",
            });

            await admin
                .from("alerts")
                .update({ notified_at: new Date().toISOString() })
                .eq("id", saved?.id);

            messages.push(`通知：${name}`);

        }

    }


    /* ---------- 解除されたものを閉じる ---------- */

    for (const row of existing ?? []) {

        if (!row.is_active) {
            continue;
        }

        const code = String(row.event_key).split(":")[1] ?? "";

        if (activeCodes.has(code)) {
            continue;
        }

        await admin
            .from("alerts")
            .update({
                is_active: false,
                resolved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);


        if (PUSH_ON_CLEAR && (row.level as number) >= PUSH_MIN_LEVEL) {

            await sendPush({
                title: `${AREA_LABEL}の${WARNING_NAMES[code] ?? "警報"}は解除されました`,
                body: "引き続き周囲の状況に注意してください。",
                level: 0,
                tag: `jma-${code}`,
                alertId: row.id as string,
                url: "./",
            });

        }

        messages.push(`解除：${WARNING_NAMES[code] ?? code}`);

    }


    return messages;

}


// ==================================================
// 指定河川洪水予報の反映
// ==================================================

async function syncFloodAlerts(): Promise<string[]> {

    const messages: string[] = [];

    const alerts = await fetchFloodAlerts();

    for (const alert of alerts) {

        const eventKey = `flood:${alert.keyword}`;

        const { data: previous } = await admin
            .from("alerts")
            .select("id, level, is_active")
            .eq("source", "jma_flood")
            .eq("event_key", eventKey)
            .maybeSingle();


        if (alert.cleared) {

            if (previous?.is_active) {

                await admin
                    .from("alerts")
                    .update({
                        is_active: false,
                        resolved_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", previous.id);

                messages.push(`解除：${alert.keyword}`);

            }

            continue;

        }


        const isNew = !previous || previous.is_active === false;

        const isUpgrade =
            previous && previous.is_active &&
            (previous.level as number) < alert.level;


        const { data: saved } = await admin
            .from("alerts")
            .upsert(
                {
                    source: "jma_flood",
                    event_key: eventKey,
                    category: "flood",
                    level: alert.level,
                    title: alert.title,
                    body: alert.body,
                    area_name: alert.keyword,
                    issued_at: alert.issuedAt,
                    is_active: true,
                    resolved_at: null,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "source,event_key" },
            )
            .select("id")
            .single();


        if ((isNew || isUpgrade) && alert.level >= PUSH_MIN_LEVEL) {

            await sendPush({
                title: alert.title,
                body: alert.body || adviceOf(alert.level),
                level: alert.level,
                tag: `flood-${alert.keyword}`,
                alertId: saved?.id ?? null,
                url: "./water-timeline/",
            });

            messages.push(`通知：${alert.title}`);

        }

    }

    return messages;

}


// ==================================================
// 本体
// ==================================================

Deno.serve(async (req) => {

    // cron からのみ呼ばれる想定。
    // 外部から叩かれても害はないが、
    // 念のためサービスロールキーを要求する。
    const token =
        (req.headers.get("Authorization") ?? "")
            .replace(/^Bearer\s+/i, "")
            .trim();

        const adminSecret = (Deno.env.get("PUSH_ADMIN_SECRET") ?? "").trim();

    const allowed =
        token === SERVICE_ROLE_KEY ||
        (adminSecret.length >= 16 && token === adminSecret);

    if (!allowed) {
        return new Response(
            JSON.stringify({ error: "認証情報が不正です。" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
        );
    }


    const messages: string[] = [];

    messages.push(...await syncWeatherWarnings());

    if (ENABLE_FLOOD) {
        messages.push(...await syncFloodAlerts());
    }


    return new Response(
        JSON.stringify({
            checked_at: new Date().toISOString(),
            area: AREA_LABEL,
            changes: messages,
        }),
        { headers: { "Content-Type": "application/json" } },
    );

});

// ========================================
// 岩瀬自治会 防災アプリ
// Supabase 接続設定
// ========================================

// Supabase プロジェクトURL
const SUPABASE_URL =
"https://zumbqukrojdpgfpfekjr.supabase.co";

// Supabase Publishable Key
const SUPABASE_PUBLISHABLE_KEY =
"sb_publishable_8YXsMHOxLr7MOTEYShUM3w_LsZvR3Qn";

// Supabase クライアント
const supabaseClient = window.supabase.createClient(
SUPABASE_URL,
SUPABASE_PUBLISHABLE_KEY
);

// 接続確認用
console.log("Supabase client initialized.");

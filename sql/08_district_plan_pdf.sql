/* ==================================================
   岩瀬自治会 防災アプリ
   岩瀬地区防災計画（PDF）

   Supabase の SQL Editor に貼り付けて実行する。
   何度実行しても壊れないように書いてある。

   前提：sql/03〜07 を実行済みであること。


   ■ 変更の内容

     地区防災計画は1つのPDFにまとまっているため、
     写真を3枚並べる作りをやめる。

     代わりに

       ・表紙の画像（1枚）
       ・計画のPDF本体

     を登録する形にする。

     PDFは外部サービスへのリンクではなく、
     Supabase Storage に置いたファイルを使う。
     こうするとアプリがファイルを取り込めるため、
     一度開いておけば通信が無くても読める。


   ■ 使う列

     site_contents（content_type = 'district_plan'）

       image1_url     … 表紙の画像
       pdf_url        … PDFの場所
       pdf_name       … もとのファイル名（表示用）
       pdf_updated_at … 差し替えた日時
================================================== */

alter table public.site_contents
    add column if not exists pdf_url text;

alter table public.site_contents
    add column if not exists pdf_name text;

alter table public.site_contents
    add column if not exists pdf_updated_at timestamptz;


/* 地区防災計画の行が無ければ作る */

insert into public.site_contents (content_type)
select 'district_plan'
where not exists (
    select 1
      from public.site_contents
     where content_type = 'district_plan'
);


/* ==================================================
   注意：ストレージの設定

   PDFは既存の site-content バケットに置く。

   バケットが「公開（Public）」でない場合、
   アプリからPDFを読めない。

   Supabase の Storage → site-content → Configuration で
   Public bucket が有効になっているか確認すること。

   また、アップロードできるファイルの種類を
   制限している場合は application/pdf を許可すること。
================================================== */

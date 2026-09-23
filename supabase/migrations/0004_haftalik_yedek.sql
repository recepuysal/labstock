-- Haftalık envanter yedeği e-postası. Ayarlar sayfasından açan kullanıcıya,
-- her Pazartesi sabahı kendi envanterinin özetini (kritik/az stoklu kalemler,
-- tahmini toplam değer) ve tam listeyi CSV eki olarak Resend üzerinden
-- gönderir — feedback_bildir() ile aynı altyapı (private.ayarlar.resend_api_key,
-- pg_net), bkz. 0001_init.sql. Zamanlama için pg_cron kullanılıyor.

create extension if not exists pg_cron;

alter table public.profiles add column if not exists haftalik_yedek_aktif boolean not null default false;
-- Boşsa hesabın giriş e-postası (auth.users.email) kullanılır; bazı
-- kullanıcıların giriş e-postasına (ör. Resend'de alan adı doğrulanmamışsa
-- kurumsal bir domaine) mail gönderimi başarısız olabiliyor, bu yüzden
-- isteğe bağlı bir alternatif adres tanımlanabiliyor.
alter table public.profiles add column if not exists yedek_eposta_adresi text;

create or replace function public.haftalik_envanter_yedegi_gonder()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  api_key       text;
  kullanici     record;
  satir         record;
  csv_metin     text;
  kritik_html   text;
  toplam_kalem  int;
  kritik_sayisi int;
  deger_html    text;
  html_govde    text;
  alici         text;
  bugun         text;
begin
  select deger into api_key from private.ayarlar where anahtar = 'resend_api_key';
  if api_key is null or api_key = '' then
    return;
  end if;

  bugun := to_char(now(), 'DD.MM.YYYY');

  for kullanici in
    select pr.id as user_id, coalesce(pr.yedek_eposta_adresi, au.email) as eposta
    from public.profiles pr
    join auth.users au on au.id = pr.id
    where pr.haftalik_yedek_aktif = true
  loop
    alici := kullanici.eposta;
    if alici is null or alici = '' then
      continue;
    end if;

    select count(*) into toplam_kalem from public.envanter where user_id = kullanici.user_id;
    if toplam_kalem = 0 then
      continue; -- envanteri boşsa yedeklenecek bir şey yok
    end if;

    -- CSV yedeği (Türkçe Excel virgülü ondalık ayracı olarak kullandığından
    -- noktalı virgül ile ayrılıyor — bkz. envanterDisaAktar, ayarlar/actions.ts).
    select string_agg(
      concat_ws(';',
        mpn, coalesce(uretici, ''), coalesce(aciklama, ''), coalesce(kategori, ''),
        coalesce(konum_adi, ''), adet, min_adet, durum,
        coalesce(tedarikci, ''), coalesce(alis_fiyati::text, ''), para_birimi
      ),
      chr(10) order by mpn
    ) into csv_metin
    from public.envanter where user_id = kullanici.user_id;

    csv_metin := 'MPN;Üretici;Açıklama;Kategori;Konum;Adet;Min. Adet;Durum;Tedarikçi;Alış Fiyatı;Para Birimi' || chr(10) || coalesce(csv_metin, '');

    select count(*) filter (where durum in ('kritik', 'az', 'yok')) into kritik_sayisi
    from public.envanter where user_id = kullanici.user_id;

    -- En kritik 10 kalem (önce tükenen, sonra kritik, sonra az kalanlar).
    kritik_html := '';
    for satir in
      select mpn, uretici, adet, min_adet, konum_adi, durum
      from public.envanter
      where user_id = kullanici.user_id and durum in ('kritik', 'az', 'yok')
      order by case durum when 'yok' then 0 when 'kritik' then 1 else 2 end, mpn
      limit 10
    loop
      kritik_html := kritik_html
        || '<tr><td style="padding:5px 8px;border-bottom:1px solid #eee2cf"><b>' || public.html_kacis(satir.mpn) || '</b>'
        || case when satir.uretici is not null then ' <span style="color:#a19787">(' || public.html_kacis(satir.uretici) || ')</span>' else '' end
        || '</td><td style="padding:5px 8px;border-bottom:1px solid #eee2cf;color:#a19787">' || case when satir.konum_adi is null then '—' else public.html_kacis(satir.konum_adi) end || '</td>'
        || '<td style="padding:5px 8px;border-bottom:1px solid #eee2cf;text-align:right">' || satir.adet || ' / min ' || satir.min_adet || '</td></tr>';
    end loop;

    -- Para birimine göre tahmini toplam stok değeri.
    select string_agg(para_birimi || ': ' || to_char(toplam, 'FM999G999G999D00'), ', ')
    into deger_html
    from (
      select para_birimi, sum(adet * coalesce(alis_fiyati, 0)) as toplam
      from public.envanter
      where user_id = kullanici.user_id
      group by para_birimi
      having sum(adet * coalesce(alis_fiyati, 0)) > 0
    ) t;

    html_govde := '<div style="background:#f2ede3;padding:32px 16px;font-family:Segoe UI,Arial,sans-serif">'
      || '<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fbf8f2;border:1px solid #e4dccb;border-radius:10px;overflow:hidden">'
      || '<tr><td style="background:#f2ede3;padding:20px 28px;border-bottom:3px solid #a3611f">'
      || '<img src="https://raw.githubusercontent.com/recepuysal/labstock/master/labstock-a1-logo/png/yatay-512.png" height="28" alt="LabStock">'
      || '</td></tr>'
      || '<tr><td style="padding:24px 28px">'
      || '<div style="font-size:11px;font-weight:600;letter-spacing:.08em;color:#a19787;text-transform:uppercase;margin-bottom:6px">Haftalık Envanter Özeti — ' || bugun || '</div>'
      || '<p style="font-size:13px;color:#4a4238;line-height:1.6;margin:0 0 18px">'
      || 'Deponda toplam <b>' || toplam_kalem || '</b> kalem var'
      || case when deger_html is not null then ', tahmini toplam değer ' || deger_html || '.' else '.' end
      || case when kritik_sayisi is not null and kritik_sayisi > 0
           then ' Bunlardan <b>' || kritik_sayisi || '</b> tanesi kritik/az stokta ya da tükenmiş, aşağıda listelendi.'
           else ' Kritik ya da az stokta kalem yok, her şey yeterli seviyede 👍'
         end
      || ' Tam liste bu e-postaya CSV olarak eklendi, isterse Excel ile açabilirsin.'
      || '</p>'
      || case when kritik_html <> '' then
        '<table role="presentation" style="width:100%;font-size:12.5px;color:#1f1b16;border-collapse:collapse">'
        || '<tr><td style="padding:5px 8px;font-size:10.5px;color:#a19787;text-transform:uppercase">Parça</td>'
        || '<td style="padding:5px 8px;font-size:10.5px;color:#a19787;text-transform:uppercase">Konum</td>'
        || '<td style="padding:5px 8px;font-size:10.5px;color:#a19787;text-transform:uppercase;text-align:right">Adet</td></tr>'
        || kritik_html || '</table>'
        else '' end
      || '</td></tr>'
      || '<tr><td style="padding:14px 28px;background:#f7f2e8;font-size:11px;color:#a19787">'
      || 'Bu e-posta, LabStock Ayarlar sayfasındaki "Haftalık yedek e-postası" tercihin açık olduğu için otomatik gönderildi — istediğin an oradan kapatabilirsin.'
      || '</td></tr>'
      || '</table></div>';

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'LabStock <onboarding@resend.dev>',
        'to', jsonb_build_array(alici),
        'subject', 'Haftalık envanter özeti ve yedeği — LabStock (' || bugun || ')',
        'html', html_govde,
        'attachments', jsonb_build_array(
          jsonb_build_object(
            'filename', 'labstock-envanter-yedegi.csv',
            'content', encode(convert_to(csv_metin, 'UTF8'), 'base64')
          )
        )
      )
    );
  end loop;
end;
$$;

-- Her Pazartesi 08:00 (Türkiye saati, UTC+3 sabit) = 05:00 UTC. Migration
-- yeniden çalıştırılırsa (ör. repair sonrası) aynı işi ikinci kez
-- zamanlamamak için önce (varsa) kaldırılıyor.
do $$
begin
  perform cron.unschedule('haftalik-envanter-yedegi');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'haftalik-envanter-yedegi',
  '0 5 * * 1',
  $$select public.haftalik_envanter_yedegi_gonder();$$
);

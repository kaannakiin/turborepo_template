# TODO: Ertelenen auth işleri

Auth v1 (2026-07-30) kapsamına bilinçli alınmayanlar:

## Password reset akışı

`AuthTokenPurpose.PASSWORD_RESET` şemada hazır ama endpoint yok. Gerekenler:

- `POST /auth/password-reset/request` — enumeration-safe: eşleşme olsun olmasın aynı 200 + aynı timing; `deletedAt: null` filtresi şart (tombstone'lanmış hesabı diriltmemek için); rate limit hem IP hem _ham identifier_ bazlı (userId bazlı olursa sahte identifier'lar hiç limitlenmez — bu da enumeration kanalıdır).
- `POST /auth/password-reset/confirm` — tek koşullu `UPDATE ... WHERE tokenHash=$1 AND consumedAt IS NULL AND expiresAt > now()` ile atomik consume (SELECT-then-UPDATE TOCTOU yasak); başarıda TÜM session'lar `PASSWORD_CHANGED` ile revoke edilir ve `passwordChangedAt` güncellenir; yeni session BASILMAZ (authenticated şifre değişiminden farkı).
- `AuthToken.target` consume anında kullanıcının GÜNCEL email/phone'u ile karşılaştırılmalı.

## Mailer / SMS entegrasyonu

`VerifyService` kodu üretiyor ama göndermiyor (dev'de debug log). Bir sağlayıcı (ör. Resend/Twilio) bağlanınca:

- Doğrulama linki e-postası, mutasyon yapan bir GET'e DEĞİL apps/web-portal'de tıklamayla POST atan bir sayfaya gitmeli (kurumsal mail tarayıcıları linkleri GET'ler — token sessizce yanar).
- Token/OTP asla query string'e konmamalı (`LoggingInterceptor` URL loglar — CWE-598).

## Redis throttler storage

`@nestjs/throttler` in-memory çalışıyor. Birden fazla API replikası, efektif limiti replika sayısıyla çarpar. Yatay ölçek öncesi `ThrottlerStorageRedisService` (veya eşdeğeri) bağlanmalı.

## Identifier bazlı login throttle

Mevcut limitler IP bazlı. Botnet/NAT arkasında dağıtık credential stuffing'i durdurmak için login'e normalize identifier (email/E.164) anahtarlı ikinci bir limit eklenmeli (custom `ThrottlerGuard.getTracker`).

## GeoIP doldurma

`UserSession`'daki `countryCode/region/city/timezone/lat/lon/asn/isp` kolonları v1'de null. MaxMind/IPinfo eklendiğinde login + rotation sırasında doldurulup session listesinde şehir/ülke gösterimi zenginleşir. Ham IP asla wire'a çıkarılmamalı (kontrat bilinçli olarak sadece city/countryCode taşır).

## Session-cap revoke reason

Soft cap (10) aşımında en eski session `revokeReason: NULL` ile revoke ediliyor çünkü enum'da uygun değer yok. `SessionRevokeReason`'a `SESSION_CAP_EVICTED` eklemek migration gerektirir.

## Anında revocation

Ayrı dosya: `instant-session-revocation.md`.

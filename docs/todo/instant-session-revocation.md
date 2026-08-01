# TODO: Anında session revocation

## Mevcut durum (bilinçli kabul)

Access token'lar stateless doğrulanır (`JwtStrategy` DB'ye bakmaz). Bir session revoke edildiğinde — "her yerden çıkış", şifre değişimi, admin suspend — o session'ın elindeki access token kendi TTL'i (`JWT_ACCESS_TTL`, varsayılan 15 dk) dolana kadar çalışmaya devam eder. Refresh her zaman DB kontrolü yaptığı için YENİ token üretilemez; artık pencere en fazla bir access-TTL'dir.

Bu, ürün kararı olarak kabul edildi (2026-07-30): tam stateless hot path > anında kesme.

## Anında kesme gerektiğinde yapılacaklar

1. **Denylist cache**: revoke anında `sid` (UserSession.publicId) TTL'li bir cache'e yazılır (tek instance: in-memory `Map` + süre; yatay ölçek: Redis `SETEX sid <kalan-ttl>`).
2. `JwtStrategy.validate` (veya `JwtAuthGuard`) her istekte cache'e bakar — O(1), DB'ye gitmez.
3. Cache girdisi access-TTL kadar yaşar; sonrasında token zaten expired olduğu için temizlenebilir.
4. Suspend/ban senaryosu için `sub` (user publicId) bazlı ikinci bir denylist gerekir (kullanıcının TÜM session'ları).

## Dikkat

- Bu değişiklik hot path'e cache bağımlılığı ekler; cache düşerse fail-open mı fail-closed mı davranılacağı ürünle netleştirilmeli.
- `passwordChangedAt` vs `iat` karşılaştırması alternatifi her istekte DB okuması gerektirir — reddedildi; denylist daha ucuz.

-- 외부 서비스 인증키 보관함 (2026-09-05).
--
-- ⚠ 값은 **암호문만** 들어간다(`src/lib/secret-box.ts` · AES-GCM 256).
--    마스터 키는 이 DB 안에 없다 — Worker 시크릿 `KEY_ENCRYPTION_KEY`,
--    없으면 `AUTH_SECRET`에서 파생하고 그 사실을 관리자 화면에 밝힌다.
-- ⚠ 이름(`name`)은 env 변수명과 같다. 그 이름이 암호화의 추가 인증 데이터로도 쓰여서,
--    한 행의 암호문을 다른 행에 복사해 넣어도 열리지 않는다.
-- ⚠ 세션·수집 시크릿(AUTH_SECRET·CRON_SECRET)은 여기 넣지 않는다.
--    앱이 자기 자신을 여는 열쇠라 DB에 두면 순환이 된다.
CREATE TABLE "ApiCredential" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "cipher" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * 예전에 있던 두 가지 우회(웹팩 WASM 실험 플래그 + Prisma 생성물 파일트레이싱 제외)는
 * 런타임에서 Prisma를 걷어내면서 **전부 불필요해져 지웠다**.
 * 문제를 우회하는 설정이 계속 쌓이면 나중에 왜 있는지 아무도 모르게 된다.
 * (경위는 web/CHANGELOG.md와 src/lib/d1.ts 주석에 남겨 두었다.)
 */
const nextConfig: NextConfig = {};

export default nextConfig;

/**
 * `next dev`에도 Cloudflare 바인딩(로컬 D1)을 붙인다.
 *
 * 이게 없으면 로컬은 DB 없이 돌고 배포만 D1을 쓰게 되는데, 그 경로 차이가
 * "로컬은 되는데 배포만 죽는" 사고를 만든다(2026-08-02 실제 사고).
 * 로컬과 운영이 같은 방식으로 DB에 붙게 맞춘다.
 */
void initOpenNextCloudflareForDev();

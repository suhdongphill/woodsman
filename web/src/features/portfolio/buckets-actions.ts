"use server";

/**
 * 포트폴리오 버킷 서버 액션 — 추가 · 이름/색/순서 변경 · 목표 구성비 저장 · 삭제.
 *
 * ⚠ `"use server"` 파일은 **async 함수만** export한다. 상수·타입은 `buckets-form-state.ts`로 뺀다
 *    (어기면 액션 호출이 500으로 죽는다 — 두 번 겪었다).
 * ⚠ 모든 액션이 `requireAdmin`을 먼저 부른다 — 미들웨어를 믿지 않는다(운영지침 §6).
 * ⚠ 판단은 전부 `lib/bucket-target.ts`가 한다. 여기서 다시 판단하지 않는다.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { classifyQuotaError } from "@/lib/quota";
import {
  BUCKET_COLOR_PATTERN,
  canDeleteBucket,
  validateNewBucket,
  validateTargets,
} from "@/lib/bucket-target";
import {
  countHoldingsInBucket,
  createBucket,
  deleteBucket,
  findBucket,
  loadBuckets,
  nextSortOrder,
  saveTargets,
  updateBucketMeta,
} from "./buckets-repo";
import { emptyBucketFormState, type BucketFormState } from "./buckets-form-state";

const ADMIN_PATH = "/admin/model-portfolio";

function text(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function optional(form: FormData, key: string): string | undefined {
  const v = text(form, key);
  return v === "" ? undefined : v;
}

/**
 * 숫자 칸.
 *
 * ⚠ 빈 칸은 `undefined`로 낸다. `Number("")`가 **0**이라 그대로 쓰면
 *    "안 적었다"가 "0%로 정했다"가 된다 — 두 뜻이 다르다.
 */
function num(form: FormData, key: string): number | undefined {
  const v = text(form, key);
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 실패를 삼키지 않고 화면이 읽을 문장으로 바꾼다(CLAUDE.md §3). */
function failure(what: string, error: unknown): BucketFormState {
  console.error(`[buckets] ${what} 실패`, error);
  const verdict = classifyQuotaError(error);
  return {
    error:
      verdict.kind === "no"
        ? `${what}에 실패했습니다. 서버 로그의 [buckets] 항목을 확인하세요.`
        : `${verdict.title} ${verdict.action}`,
  };
}

/**
 * 목표 구성비 저장 — 버킷 전부를 한 번에.
 *
 * ⚠ 합계가 100 **미만인 것은 막지 않는다.** 남는 몫은 현금·미배정이다.
 *    막는 것은 100 초과뿐이고, 그건 작성 중이 아니라 틀린 값이다.
 */
export async function saveBucketTargetsAction(
  _prev: BucketFormState,
  formData: FormData,
): Promise<BucketFormState> {
  await requireAdmin(ADMIN_PATH);

  try {
    const buckets = await loadBuckets();

    // 폼에 없는 버킷은 지금 값을 그대로 둔다 — 화면에 안 뜬 버킷을 0으로 만들지 않는다.
    const next = buckets.map((b) => ({
      ...b,
      targetPct: num(formData, `target.${b.key}`) ?? b.targetPct,
    }));

    const verdict = validateTargets(next);
    if (!verdict.ok) return { ...emptyBucketFormState, error: verdict.error };

    await saveTargets(next.map((b) => ({ key: b.key, targetPct: b.targetPct })));

    revalidatePath(ADMIN_PATH);
    revalidatePath("/portfolio");
    revalidatePath("/");
    return { savedAt: new Date().toISOString(), notice: "목표 구성비를 저장했습니다." };
  } catch (error) {
    return failure("목표 구성비 저장", error);
  }
}

/** 버킷 추가. ⚠ 목표 비중 0으로 만든다 — 만들자마자 배분을 차지하면 안 된다. */
export async function createBucketAction(
  _prev: BucketFormState,
  formData: FormData,
): Promise<BucketFormState> {
  await requireAdmin(ADMIN_PATH);

  const input = {
    key: text(formData, "key").toUpperCase(),
    name: text(formData, "name"),
    color: text(formData, "color") || "#5b7fa6",
  };

  try {
    const buckets = await loadBuckets();
    const verdict = validateNewBucket(input, buckets);
    if (!verdict.ok) return { ...emptyBucketFormState, error: verdict.error };

    await createBucket({
      ...input,
      description: optional(formData, "description"),
      sortOrder: await nextSortOrder(),
    });

    revalidatePath(ADMIN_PATH);
    revalidatePath("/portfolio");
    return {
      savedAt: new Date().toISOString(),
      notice: `${input.name} 버킷을 만들었습니다. 목표 비중은 0%이니 위에서 정하세요.`,
    };
  } catch (error) {
    return failure("버킷 추가", error);
  }
}

/**
 * 이름·설명·색·순서 변경.
 *
 * ⚠ **키는 못 바꾼다.** 보유 종목과 기존 보고서가 키를 참조하므로, 바꾸면 그 종목들이
 *    어느 버킷에도 속하지 않게 된다. 기본 버킷도 **이름은** 바꿀 수 있다.
 */
export async function updateBucketAction(
  _prev: BucketFormState,
  formData: FormData,
): Promise<BucketFormState> {
  await requireAdmin(ADMIN_PATH);

  const key = text(formData, "key");
  const name = text(formData, "name");
  const color = text(formData, "color") || "#5b7fa6";

  if (!key) return { ...emptyBucketFormState, error: "버킷 키가 없습니다." };
  if (!name) return { ...emptyBucketFormState, error: "버킷 이름을 적어 주세요." };
  if (!BUCKET_COLOR_PATTERN.test(color)) {
    return { ...emptyBucketFormState, error: "색은 #RRGGBB 모양이어야 합니다." };
  }

  try {
    const bucket = await findBucket(key);
    if (!bucket) return { ...emptyBucketFormState, error: "버킷을 찾을 수 없습니다." };

    await updateBucketMeta(key, {
      name,
      description: optional(formData, "description"),
      color,
      sortOrder: num(formData, "sortOrder") ?? bucket.sortOrder,
    });

    revalidatePath(ADMIN_PATH);
    revalidatePath("/portfolio");
    revalidatePath("/");
    return { savedAt: new Date().toISOString(), notice: `${name} 버킷을 고쳤습니다.` };
  } catch (error) {
    return failure("버킷 수정", error);
  }
}

/**
 * 버킷 삭제.
 *
 * ⚠ 기본 버킷과 **보유 종목이 든 버킷은 지우지 않는다**(`canDeleteBucket`).
 *    지워 버리면 그 종목들이 갈 곳 없는 분류를 갖게 되고, 비중 계산에서 조용히 빠진다.
 */
export async function deleteBucketAction(
  _prev: BucketFormState,
  formData: FormData,
): Promise<BucketFormState> {
  await requireAdmin(ADMIN_PATH);

  const key = text(formData, "key");
  if (!key) return { ...emptyBucketFormState, error: "버킷 키가 없습니다." };

  try {
    const bucket = await findBucket(key);
    if (!bucket) return { ...emptyBucketFormState, error: "버킷을 찾을 수 없습니다." };

    const used = await countHoldingsInBucket(key);
    const verdict = canDeleteBucket(bucket, used);
    if (!verdict.ok) return { ...emptyBucketFormState, error: verdict.error };

    await deleteBucket(key);

    revalidatePath(ADMIN_PATH);
    revalidatePath("/portfolio");
    revalidatePath("/");
    return { savedAt: new Date().toISOString(), notice: `${bucket.name} 버킷을 지웠습니다.` };
  } catch (error) {
    return failure("버킷 삭제", error);
  }
}

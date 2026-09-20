/**
 * 파생 계열 — 여러 계열을 합성해 만드는 지표. **순수 함수**(DB도 네트워크도 모른다).
 *
 * 볼트 금리 허브의 대표 지표 `netliq`(순유동성 = 연준 총자산 − TGA − 역레포)를 옮기려고
 * 만들었다(2026-08-25). 볼트는 수집 스크립트가 합성해 저장하지만, 이 사이트는
 * **원값을 저장하고 읽을 때 계산한다**(`registry.ts`의 "볼트와 일부러 다르게 한 것").
 * 파생도 같은 규칙을 따른다 — DB에 파생값을 쌓지 않는다. 성분이 수정되면 파생도 같이
 * 고쳐져야 하는데, 쌓아 두면 옛 합성값이 남는다.
 *
 * ## ⚠ 이 모듈이 막으려는 사고는 하나다 — "그럴듯한데 틀린 한 줄"
 * 파생은 성분이 조용히 빠져도 **선이 그려진다.** 세 계열 중 하나가 없는 날에 나머지
 * 둘만 더하면, 그 점은 순유동성이 아닌데 순유동성이라는 이름을 달고 화면에 남는다.
 * 그래서 여기서는 다음 셋을 지킨다.
 *
 *   1. **성분이 하나라도 비면 파생 자체가 없다**(빈 배열). 부분 합성을 하지 않는다.
 *   2. **기준일에 성분 값이 없으면 그 점을 버린다.** 0으로 채우지 않는다(CLAUDE.md §3).
 *   3. **앞선 값을 끌어다 쓰는 데 한도를 둔다**({@link MacroDerived.carryDays}).
 *      한도가 없으면 반년 전 TGA로 오늘 순유동성을 그리게 된다.
 *
 * ## ⚠ 단위는 여기서 다시 맞추지 않는다
 * 성분은 **각자의 변환(`levelM`·`levelK`)을 이미 거친 표시 단위**로 들어온다.
 * FRED가 같은 유동성 블록에서도 계열마다 백만·십억을 섞어 주기 때문에
 * (`sectors/liquidity.ts` 머리말), 단위를 맞추는 자리를 **성분 정의 한 곳**으로 몰았다.
 * 여기서 한 번 더 나누면 같은 판단이 두 곳에 생기고, 그러면 1000배가 조용히 어긋난다.
 */
import type { SeriesPoint } from "./series";

/**
 * 합성 방법.
 * - `subtract` — 첫 성분에서 나머지를 뺀다(성분 2개 이상).
 * - `ratioPct` — 첫 성분을 둘째 성분으로 나눈 **비율(%)**. 성분은 **정확히 둘**이다.
 *   ⚠ 두 성분의 **단위가 같아야** 뜻이 생긴다(둘 다 10억 달러). 단위가 다르면 100배가 조용히 어긋난다 —
 *   그래서 성분의 `transform`을 여기서 다시 건드리지 않는다(머리말의 「단위는 여기서 다시 맞추지 않는다」).
 *   ⚠ 분모가 0이면 **그 점을 버린다.** 무한대를 값이라고 내보내지 않는다.
 * - `realizedVolBp` — **성분 하나**(퍼센트 단위 금리)의 일간 변화로 **연율 실현변동성(bp)**을 만든다
 *   = 최근 `window`개 변화의 표본표준편차 × √252 × 100 (2026-09-14, R2b-3).
 *   ⚠ MOVE(옵션에 담긴 **예상** 변동성, ICE 라이선스)가 **아니다** — 이미 지나간 변동이다. 이름에 MOVE를 쓰지 않는다.
 *   ⚠ 성분 하나짜리지만 별칭이 아니다 — 값이 다른 계열을 만든다(`validateSectors`가 op마다 성분 수를 따로 본다).
 */
export type DerivedOp = "subtract" | "ratioPct" | "realizedVolBp";

export type MacroDerived = {
  op: DerivedOp;
  /** 성분 지표 키. ⚠ **첫 번째가 기준 계열**이다 — 날짜 눈금을 이 계열이 정한다. */
  from: string[];
  /**
   * 기준일에 성분 값이 없을 때 **앞선 값을 며칠까지** 끌어다 쓸지.
   *
   * ⚠ 발표 주기가 다른 계열을 맞추려면 끌어다 쓰는 것 자체는 피할 수 없다(주간 대차대조표와
   *   일간 역레포). 다만 한도가 없으면 낡은 값이 무한히 따라온다. 한도를 넘으면 **그 점을 버린다.**
   */
  carryDays: number;
  /** `realizedVolBp` 전용 — 변동성을 재는 일간 변화 개수(20 ≈ 한 달 영업일) */
  window?: number;
};

/**
 * 일간 변화의 이동 실현변동성(bp, 연율). 입력은 날짜 오름차순 · 퍼센트 단위.
 *
 * ⚠ 이웃 관측이 `carryDays`보다 멀면(긴 휴장·결측) **창을 처음부터 다시 채운다** — 한 달 비운 뒤의 변화를
 *   하루치 변화처럼 넣으면 변동성이 지어진다.
 * ⚠ 창이 다 차기 전의 날은 **내지 않는다**(짧은 창의 표준편차는 과장되거나 0이 된다).
 * 선형 시간 — 창의 합·제곱합을 굴린다.
 */
export function realizedVolBp(points: SeriesPoint[], window: number, carryDays: number): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  if (window < 2) return out;
  const diffs: number[] = [];
  let sum = 0;
  let sumSq = 0;
  for (let i = 1; i < points.length; i++) {
    const gap = dayIndex(points[i].date) - dayIndex(points[i - 1].date);
    if (gap > carryDays) {
      diffs.length = 0;
      sum = 0;
      sumSq = 0;
      continue;
    }
    const d = points[i].value - points[i - 1].value;
    diffs.push(d);
    sum += d;
    sumSq += d * d;
    if (diffs.length > window) {
      const old = diffs.shift()!;
      sum -= old;
      sumSq -= old * old;
    }
    if (diffs.length === window) {
      const variance = Math.max(0, (sumSq - (sum * sum) / window) / (window - 1));
      out.push({ date: points[i].date, value: Math.sqrt(variance) * Math.sqrt(252) * 100 });
    }
  }
  return out;
}

function dayIndex(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

/**
 * 기준일 이하의 값 중 **가장 최근 것**. 한도를 넘게 낡았으면 undefined.
 *
 * 입력은 날짜 오름차순을 전제한다(`applyTransform`이 그렇게 준다).
 */
export function valueAsOf(
  points: SeriesPoint[],
  date: string,
  carryDays: number,
): number | undefined {
  let found: SeriesPoint | undefined;
  for (const p of points) {
    if (p.date > date) break;
    found = p;
  }
  if (!found) return undefined;
  if (dayIndex(date) - dayIndex(found.date) > carryDays) return undefined;
  return found.value;
}

/**
 * 성분에서 파생 계열을 만든다.
 *
 * @param parts 성분 시계열. **각 성분의 변환까지 끝난 값**이어야 한다(머리말 참고).
 *              순서는 `spec.from`과 같아야 하고, 첫 번째가 기준 계열이다.
 */
export function composeDerived(
  spec: MacroDerived,
  parts: (SeriesPoint[] | undefined)[],
): SeriesPoint[] {
  if (parts.length !== spec.from.length) return [];
  // ⚠ 1. 성분이 하나라도 비면 파생 자체가 없다. 둘만으로 그린 선에 세 계열의 이름을 붙이지 않는다.
  if (parts.some((p) => !p || p.length === 0)) return [];
  if (spec.op === "realizedVolBp") {
    return realizedVolBp(parts[0] as SeriesPoint[], spec.window ?? 0, spec.carryDays);
  }

  const [base, ...others] = parts as SeriesPoint[][];
  const out: SeriesPoint[] = [];

  for (const point of base) {
    let value = point.value;
    let complete = true;

    for (const other of others) {
      const v = valueAsOf(other, point.date, spec.carryDays);
      // ⚠ 2. 짝을 못 찾으면 그 점을 버린다. 0을 빼면 "그날은 TGA가 0이었다"는 없는 사실이 생긴다.
      if (v === undefined) {
        complete = false;
        break;
      }
      if (spec.op === "ratioPct") {
        // ⚠ 분모가 0이면 그 점을 버린다 — 무한대는 값이 아니다.
        if (v === 0) {
          complete = false;
          break;
        }
        value = (value / v) * 100;
      } else {
        value -= v;
      }
    }

    if (complete) out.push({ date: point.date, value });
  }
  return out;
}

/**
 * 파생 계열의 기준일·수집시각.
 *
 * ⚠ **가장 최근이 아니라 가장 오래된 것**을 쓴다. 성분 하나가 오늘 것이라고 파생을
 *   "오늘 기준"이라 적으면, 묵은 성분이 섞인 선을 새것으로 읽게 된다
 *   (`service.ts`의 `fedHikeAsOf`와 같은 판단).
 * ⚠ 성분 하나라도 값이 없으면 `asOf`도 없다 — 위 규칙 1과 같은 이유다.
 */
export function derivedMeta(
  metas: ({ asOf?: string; fetchedAt?: string } | undefined)[],
): { asOf?: string; fetchedAt?: string } {
  const asOfs = metas.map((m) => m?.asOf);
  const asOf = asOfs.some((d) => !d) ? undefined : asOfs.slice().sort()[0];

  const fetched = metas.map((m) => m?.fetchedAt).filter((d): d is string => !!d);
  // 수집시각은 **가장 오래된 것** — 성분 하나만 끊겨도 파생은 끊긴 것으로 본다.
  const fetchedAt =
    fetched.length === metas.length ? fetched.slice().sort()[0] : undefined;

  return { asOf, fetchedAt };
}

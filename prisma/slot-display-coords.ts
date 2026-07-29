/**
 * 슬롯 착장 도식 좌표 (Phase 2 UI)
 *
 * 값은 도식 컨테이너 기준 백분율 [x%, y%]이며, 프론트 SlotDiagram이 띄우는
 * `public/slots/figure-front.png`(정면 전신, 3:4) 위 실제 위치를 측정해 정한 값이다.
 * 도식 이미지를 교체하면 이 좌표도 다시 측정해야 한다.
 *
 * 이미지 기준선 (y%):
 *   모자 크라운 4~9 / 모자챙 9~11 / 얼굴 11~17 / 카라 17~21 / 어깨 19~22
 *   소매 22~31 / 상의 21~41 / 벨트 40~42 / 하의 42~92 / 신발 92~96
 */
export const SLOT_DISPLAY_COORDS: Record<string, [number, number]> = {
  // 모자 — 크라운 x 45~55, 챙은 y 9~11에서 앞으로 나온다
  CAP_BACK: [50, 5],
  CAP_FRONT: [50, 7.5],
  CAP_SIDE_L: [46.5, 7.5],
  CAP_SIDE_R: [53.5, 7.5],
  CAP_BRIM_TOP: [50, 10],

  // 상의 — 카라 안쪽 → 어깨 상단 → 어깨 끝(소매 이음선) 순으로 벌어진다
  COLLAR_L: [46.5, 19],
  COLLAR_R: [53.5, 19],
  BACK_SHOULDER_L: [41.5, 20.5],
  BACK_SHOULDER_R: [58.5, 20.5],
  SHOULDER_LINE_L: [37, 22],
  SHOULDER_LINE_R: [63, 22],
  SLEEVE_L: [36.5, 27],
  SLEEVE_R: [63.5, 27],
  CHEST_L: [43.5, 26],
  CHEST_R: [56.5, 26],

  // 하의 — 오른쪽(타격 방향) 바깥 라인. 해당 높이의 바지 끝선이 x 61 부근이다
  PANTS_HIP_SIDE_FACING: [59.5, 47],
  PANTS_THIGH_SIDE_FACING: [59.5, 58],
};

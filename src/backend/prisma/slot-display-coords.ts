/**
 * 슬롯 착장 도식 좌표 (Phase 2 UI)
 *
 * 값은 도식 컨테이너 기준 백분율 [x%, y%]이며, 프론트의 SlotDiagram 실루엣과 짝을 이룬다.
 * 실루엣을 수정하면 이 좌표도 함께 맞춰야 한다.
 *
 * 실루엣 기준선 (y%):
 *   모자 4~17 / 머리 10~27 / 어깨 29 / 상의 29~57 / 소매 31~46 / 하의 57~96
 */
export const SLOT_DISPLAY_COORDS: Record<string, [number, number]> = {
  CAP_BACK: [50, 6],
  CAP_FRONT: [50, 10],
  CAP_SIDE_L: [41, 11],
  CAP_SIDE_R: [59, 11],
  CAP_BRIM_TOP: [50, 16],
  COLLAR_L: [45.5, 29],
  COLLAR_R: [54.5, 29],
  SHOULDER_LINE_L: [32, 31],
  SHOULDER_LINE_R: [68, 31],
  BACK_SHOULDER_L: [38, 33],
  BACK_SHOULDER_R: [62, 33],
  SLEEVE_L: [24, 39],
  SLEEVE_R: [76, 39],
  CHEST_L: [42, 41],
  CHEST_R: [58, 41],
  PANTS_HIP_SIDE_FACING: [64, 61],
  PANTS_THIGH_SIDE_FACING: [64, 73],
};

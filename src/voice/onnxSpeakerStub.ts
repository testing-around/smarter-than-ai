/**
 * Future on-device speaker embedding (ECAPA / WeSpeaker ONNX).
 *
 * This PR ships `sta-bands-v1` (log-energy + ZCR + 8-band Goertzel) so
 * enrollment persists and airplane-mode matching works without a native
 * ONNX runtime in the Expo APK.
 *
 * To swap in a real model later:
 * 1. Add a small ONNX runtime that Expo/Android can load (or a custom
 *    Expo module wrapping ONNX Runtime Mobile).
 * 2. Drop an ECAPA-TDNN / WeSpeaker `.onnx` under `assets/models/`.
 * 3. Implement `embedWithOnnx(pcm)` with the same `number[]` contract.
 * 4. Bump `EMBEDDING_MODEL` and re-enroll (old `sta-bands-v1` vectors
 *    must not mix with a new space).
 */
export const ONNX_SPEAKER_STATUS = 'stub' as const;

export function onnxSpeakerAvailable(): boolean {
  return false;
}

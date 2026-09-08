// Badoo's real voice-note waveform (#122): computed client-side via the
// Web Audio API since the server has no audio-decoding capability of its
// own (see voiceNotes.ts) — downsampled into a fixed number of amplitude
// peaks, normalized 0-1 for easy bar-height rendering.
const WAVEFORM_POINTS = 40;

export async function computeWaveform(blob: Blob): Promise<number[]> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextClass();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPoint = Math.max(1, Math.floor(channelData.length / WAVEFORM_POINTS));

    const peaks: number[] = [];
    for (let i = 0; i < WAVEFORM_POINTS; i++) {
      const start = i * samplesPerPoint;
      const end = Math.min(start + samplesPerPoint, channelData.length);
      let sum = 0;
      for (let j = start; j < end; j++) sum += Math.abs(channelData[j]);
      peaks.push(end > start ? sum / (end - start) : 0);
    }

    const max = Math.max(...peaks, 0.0001);
    return peaks.map((peak) => Math.min(1, peak / max));
  } finally {
    audioContext.close();
  }
}

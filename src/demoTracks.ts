export interface LyricData {
  times: number[] | null;
  lines: string[];
  synced: boolean;
}

export interface TrackItem {
  id: string;
  name: string;
  size?: number;
  url: string;
  file?: File;
  isDemo?: boolean;
  coverUrl?: string;
  artist?: string;
  title?: string;
  lyrics?: LyricData;
  duration?: number;
}

// Convert AudioBuffer to WAV Blob
function bufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const samples = buffer.length;
  const dataSize = samples * blockAlign;
  const bufferLen = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferLen);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function generateDemoTracks(): TrackItem[] {
  const sampleRate = 22050;
  const tracks: {
    name: string;
    artist: string;
    title: string;
    duration: number;
    theme: 'synth' | 'lofi' | 'ambient';
    lyrics: LyricData;
  }[] = [
    {
      name: 'Starlight Prism - Neon Skyline.wav',
      artist: 'Starlight Prism',
      title: 'Neon Skyline',
      duration: 16,
      theme: 'synth',
      lyrics: {
        synced: true,
        times: [0, 4, 8, 12],
        lines: [
          '♪ Electronic pulse through the midnight air ♪',
          'Glowing prisms in the neon flare',
          'Chasing echoes of a crystal sound',
          'Harmonies spinning round and round ♪',
        ],
      },
    },
    {
      name: 'Lunar Horizon - Midnight Chill.wav',
      artist: 'Lunar Horizon',
      title: 'Midnight Chill',
      duration: 16,
      theme: 'lofi',
      lyrics: {
        synced: true,
        times: [0, 4, 8, 12],
        lines: [
          '♪ Soft warm vinyl spins at night ♪',
          'Shadows dancing in the lantern light',
          'Gentle rhythm calming every thought',
          'In this tranquil dream we caught ♪',
        ],
      },
    },
    {
      name: 'Celestial Dawn - Ambient Echoes.wav',
      artist: 'Celestial Dawn',
      title: 'Ambient Echoes',
      duration: 16,
      theme: 'ambient',
      lyrics: {
        synced: true,
        times: [0, 4, 8, 12],
        lines: [
          '♪ Distant chimes across the galaxy ♪',
          'Ethereal waves floating peacefully',
          'Infinite stars shining pure and bright',
          'Guiding us gently through the night ♪',
        ],
      },
    },
  ];

  return tracks.map((t, idx) => {
    const totalSamples = sampleRate * t.duration;
    const channelData: Float32Array[] = [
      new Float32Array(totalSamples),
      new Float32Array(totalSamples),
    ];

    if (t.theme === 'synth') {
      const chordNotes = [
        [220.0, 261.63, 329.63, 440.0],
        [174.61, 220.0, 261.63, 349.23],
        [261.63, 329.63, 392.0, 523.25],
        [196.0, 246.94, 293.66, 392.0],
      ];
      const barSamples = Math.floor(totalSamples / 4);
      const noteSamples = Math.floor(barSamples / 8);

      for (let i = 0; i < totalSamples; i++) {
        const chordIdx = Math.min(3, Math.floor(i / barSamples));
        const chord = chordNotes[chordIdx];
        const step = Math.floor((i % barSamples) / noteSamples);
        const freq = chord[step % chord.length];
        const tSec = i / sampleRate;
        const noteProgress = (i % noteSamples) / noteSamples;
        const env = Math.exp(-noteProgress * 4);
        const bass = Math.sin(2 * Math.PI * (chord[0] / 2) * tSec) * 0.25;
        const lead =
          (Math.sin(2 * Math.PI * freq * tSec) +
            0.3 * Math.sin(4 * Math.PI * freq * tSec)) *
          env *
          0.3;
        const val = bass + lead;
        channelData[0][i] = val;
        channelData[1][i] =
          val * 0.95 + 0.05 * Math.sin(2 * Math.PI * (freq + 1) * tSec);
      }
    } else if (t.theme === 'lofi') {
      const freqs = [293.66, 349.23, 440.0, 523.25];
      for (let i = 0; i < totalSamples; i++) {
        const tSec = i / sampleRate;
        let sum = 0;
        for (let k = 0; k < freqs.length; k++) {
          sum += Math.sin(2 * Math.PI * freqs[k] * tSec) * 0.12;
        }
        const tremolo = 0.8 + 0.2 * Math.sin(2 * Math.PI * 2 * tSec);
        const kick =
          i % (sampleRate / 2) < sampleRate * 0.08
            ? Math.sin(2 * Math.PI * 60 * tSec) * 0.3
            : 0;
        channelData[0][i] = (sum * tremolo + kick) * 0.7;
        channelData[1][i] = (sum * tremolo + kick) * 0.7;
      }
    } else {
      const bells = [523.25, 659.25, 783.99, 1046.5];
      for (let i = 0; i < totalSamples; i++) {
        const tSec = i / sampleRate;
        const sub = Math.sin(2 * Math.PI * 110 * tSec) * 0.15;
        let bellsVal = 0;
        for (let b = 0; b < bells.length; b++) {
          const beat = (tSec + b * 1.5) % 3;
          const env = Math.exp(-beat * 2);
          bellsVal += Math.sin(2 * Math.PI * bells[b] * tSec) * env * 0.1;
        }
        channelData[0][i] = sub + bellsVal;
        channelData[1][i] = sub + bellsVal * 0.9;
      }
    }

    const mockBuffer = {
      numberOfChannels: 2,
      sampleRate,
      length: totalSamples,
      getChannelData: (ch: number) => channelData[ch],
    } as unknown as AudioBuffer;

    const blob = bufferToWav(mockBuffer);
    const url = URL.createObjectURL(blob);

    return {
      id: `demo-track-${idx + 1}`,
      name: t.name,
      artist: t.artist,
      title: t.title,
      size: blob.size,
      url,
      isDemo: true,
      coverUrl: '/cover.jpg',
      lyrics: t.lyrics,
      duration: t.duration,
    };
  });
}

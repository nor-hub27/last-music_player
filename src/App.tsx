import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { generateDemoTracks, TrackItem, LyricData } from './demoTracks';

export default function App() {
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(60);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [history, setHistory] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'queue' | 'lyrics'>('queue');
  const [isPopping, setIsPopping] = useState<boolean>(false);
  const [bumpButton, setBumpButton] = useState<string | null>(null);
  const [autoLyrics, setAutoLyrics] = useState<boolean>(() => {
    return localStorage.getItem('auto_lyrics') === 'true';
  });
  const [lyricsStatus, setLyricsStatus] = useState<string>('Play a song to see its lyrics');
  const [currentLyrics, setCurrentLyrics] = useState<LyricData | null>(null);
  const [currentLyricIndex, setCurrentLyricIndex] = useState<number>(-1);
  const [isSearchingLyrics, setIsSearchingLyrics] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const lyricsListRef = useRef<HTMLDivElement | null>(null);

  // Initialize audio and preloaded demo tracks
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 0.6;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    const initialTracks = generateDemoTracks();
    setTracks(initialTracks);
    if (initialTracks.length > 0) {
      setCurrentIndex(0);
      audio.src = initialTracks[0].url;
      if (initialTracks[0].lyrics) {
        setCurrentLyrics(initialTracks[0].lyrics);
        setLyricsStatus('Synced lyrics · demo track');
      }
    }

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Format seconds to mm:ss
  const fmt = (sec: number) => {
    if (isNaN(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const triggerBump = (name: string) => {
    setBumpButton(name);
    setTimeout(() => setBumpButton(null), 280);
  };

  // Play specific track
  const playTrack = useCallback(
    (i: number, recordHistory = true) => {
      const audio = audioRef.current;
      if (!audio || tracks.length === 0) return;

      const safeIndex = (i + tracks.length) % tracks.length;
      const track = tracks[safeIndex];
      if (!track) return;

      if (isShuffle && recordHistory && currentIndex !== null && currentIndex !== safeIndex) {
        setHistory((prev) => [...prev.slice(-100), currentIndex]);
      }

      setCurrentIndex(safeIndex);
      setIsPopping(true);
      setTimeout(() => setIsPopping(false), 400);

      audio.src = track.url;
      audio.load();

      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((e: Error) => {
          console.warn('Playback error:', e.message);
          setIsPlaying(false);
        });

      // Load lyrics
      if (track.lyrics) {
        setCurrentLyrics(track.lyrics);
        setLyricsStatus(track.lyrics.synced ? 'Synced lyrics · embedded' : 'Lyrics · embedded');
      } else {
        setCurrentLyrics(null);
        setLyricsStatus('No lyrics saved for this song.');
        if (autoLyrics) {
          searchOnlineLyrics(track);
        }
      }
    },
    [tracks, isShuffle, currentIndex, autoLyrics]
  );

  // Play/pause toggle
  const togglePlay = () => {
    triggerBump('play');
    const audio = audioRef.current;
    if (!audio) return;

    if (tracks.length === 0) {
      const demos = generateDemoTracks();
      setTracks(demos);
      playTrack(0);
      return;
    }

    if (currentIndex === null) {
      playTrack(0);
      return;
    }

    if (audio.paused) {
      if (!audio.src && tracks[currentIndex]) {
        playTrack(currentIndex);
      } else {
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => playTrack(currentIndex));
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  // Next track
  const nextTrack = useCallback(() => {
    triggerBump('next');
    if (tracks.length === 0) return;
    if (currentIndex === null) {
      playTrack(0);
      return;
    }

    if (isShuffle && tracks.length > 1) {
      let nxt = Math.floor(Math.random() * tracks.length);
      while (nxt === currentIndex && tracks.length > 1) {
        nxt = Math.floor(Math.random() * tracks.length);
      }
      playTrack(nxt);
    } else {
      const nxt = (currentIndex + 1) % tracks.length;
      playTrack(nxt);
    }
  }, [tracks, currentIndex, isShuffle, playTrack]);

  // Prev track
  const prevTrack = useCallback(() => {
    triggerBump('prev');
    if (tracks.length === 0) return;
    if (currentIndex === null) {
      playTrack(0);
      return;
    }

    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (isShuffle && history.length > 0) {
      const lastIndex = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      playTrack(lastIndex, false);
      return;
    }

    const prev = (currentIndex - 1 + tracks.length) % tracks.length;
    playTrack(prev);
  }, [tracks, currentIndex, isShuffle, history, playTrack]);

  // Handle track ended
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (tracks.length === 0) return;
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      if (repeatMode === 'off' && currentIndex === tracks.length - 1 && !isShuffle) {
        setIsPlaying(false);
        return;
      }
      nextTrack();
    };

    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [tracks, currentIndex, repeatMode, isShuffle, nextTrack]);

  // Sync lyrics position
  useEffect(() => {
    if (!currentLyrics || !currentLyrics.synced || !currentLyrics.times) return;
    const times = currentLyrics.times;
    let idx = -1;
    for (let i = 0; i < times.length; i++) {
      if (currentTime >= times[i]) {
        idx = i;
      } else {
        break;
      }
    }
    if (idx !== currentLyricIndex) {
      setCurrentLyricIndex(idx);
      if (idx >= 0 && lyricsListRef.current) {
        const lineElem = lyricsListRef.current.children[idx] as HTMLElement;
        if (lineElem) {
          lineElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [currentTime, currentLyrics, currentLyricIndex]);

  // Search lyrics online via lrclib.net
  const searchOnlineLyrics = async (track = currentTrack) => {
    if (!track) return;
    setIsSearchingLyrics(true);
    setLyricsStatus('Searching online…');

    try {
      const query = `${track.artist || ''} ${track.title || track.name}`.replace(/\.[^/.]+$/, '').trim();
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const best = data.find((r) => r.syncedLyrics || r.plainLyrics) || data[0];
        const raw = best.syncedLyrics || best.plainLyrics;
        if (raw) {
          const parsed = parseLrc(raw);
          setCurrentLyrics(parsed);
          setLyricsStatus(`Synced lyrics · from lrclib.net`);
          setIsSearchingLyrics(false);
          return;
        }
      }
      setLyricsStatus('No lyrics found online for this song.');
    } catch {
      setLyricsStatus("Couldn't reach the lyrics service. Check your internet.");
    } finally {
      setIsSearchingLyrics(false);
    }
  };

  // Parse LRC strings
  function parseLrc(text: string): LyricData {
    const lines: string[] = [];
    const times: number[] = [];
    let synced = false;
    const re = /\[(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)\]/g;

    const rawLines = text.split(/\r?\n/);
    for (const raw of rawLines) {
      const match = re.exec(raw);
      if (match) {
        synced = true;
        const mins = parseInt(match[1], 10);
        const secs = parseFloat(match[2]);
        times.push(mins * 60 + secs);
        lines.push(raw.replace(/\[.*?\]/g, '').trim());
      } else if (!raw.startsWith('[') && raw.trim()) {
        lines.push(raw.trim());
      }
    }

    return {
      times: synced ? times : null,
      lines,
      synced,
    };
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        nextTrack();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        prevTrack();
      } else if (e.code === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Adding local audio files
  const addFiles = (files: File[]) => {
    const valid = files.filter((f) =>
      /\.(mp3|wav|ogg|flac|m4a|opus|mkv|webm|mp4)$/i.test(f.name) || f.type.startsWith('audio/')
    );
    if (valid.length === 0) return;

    const newTracks: TrackItem[] = valid.map((f, i) => {
      const cleanName = f.name.replace(/\.[^/.]+$/, '');
      const parts = cleanName.split(' - ');
      return {
        id: `track-${f.name}-${Date.now()}-${i}`,
        name: f.name,
        artist: parts.length > 1 ? parts[0].trim() : '',
        title: parts.length > 1 ? parts[1].trim() : cleanName,
        url: URL.createObjectURL(f),
        file: f,
        size: f.size,
        coverUrl: '/cover.jpg',
      };
    });

    setTracks((prev) => [...prev, ...newTracks]);
    if (currentIndex === null) {
      playTrack(0);
    }
  };

  const removeSelected = () => {
    if (currentIndex === null || tracks.length === 0) return;
    const newTracks = tracks.filter((_, idx) => idx !== currentIndex);
    setTracks(newTracks);
    if (newTracks.length === 0) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setCurrentIndex(null);
      setIsPlaying(false);
    } else {
      const nextIdx = Math.min(currentIndex, newTracks.length - 1);
      playTrack(nextIdx);
    }
  };

  const clearAll = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setTracks([]);
    setCurrentIndex(null);
    setIsPlaying(false);
    setCurrentLyrics(null);
    setLyricsStatus('Play a song to see its lyrics');
  };

  const currentTrack = currentIndex !== null ? tracks[currentIndex] : null;

  // Seek bar click
  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  const subtitleText = useMemo(() => {
    if (currentIndex !== null && tracks.length > 0) {
      return `Track ${currentIndex + 1} of ${tracks.length}`;
    }
    if (tracks.length > 0) {
      return `${tracks.length} songs in queue`;
    }
    return 'Add songs to get started';
  }, [currentIndex, tracks.length]);

  return (
    <div
      className={`app-viewport ${isDraggingFile ? 'file-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        if (e.dataTransfer.files) {
          addFiles(Array.from(e.dataTransfer.files));
        }
      }}
    >
      <div className="main-layout">
        {/* ================= LEFT COLUMN: Now playing ================= */}
        <div className="now-playing-col">
          {/* Cover Art with Pop Animation */}
          <div className="cover-wrapper">
            <img
              src="/cover.jpg"
              alt="Cover Art"
              className={`cover-img ${isPopping ? 'cover-pop' : ''}`}
            />
          </div>

          {/* Title & Subtitle */}
          <div className="track-title" key={currentTrack?.id || 'empty'}>
            {currentTrack ? currentTrack.name.replace(/\.[^/.]+$/, '') : 'No song loaded'}
          </div>
          <div className="track-subtitle">{subtitleText}</div>

          {/* Seek Bar Row */}
          <div className="slider-row-box">
            <span className="time-label">{fmt(currentTime)}</span>
            <div className="seek-slider-track" onClick={handleSeekClick}>
              <div className="seek-groove">
                <div
                  className="seek-fill"
                  style={{
                    width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                  }}
                />
                <div
                  className="seek-thumb"
                  style={{
                    left: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>
            <span className="time-label right">{fmt(duration)}</span>
          </div>

          {/* Controls Row */}
          <div className="controls-row">
            {/* Shuffle */}
            <button
              type="button"
              className={`btn-icon ${isShuffle ? 'active' : ''} ${
                bumpButton === 'shuffle' ? 'bump' : ''
              }`}
              onClick={() => {
                triggerBump('shuffle');
                setIsShuffle(!isShuffle);
              }}
              title="Shuffle"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
              {isShuffle && <span className="active-dot" />}
            </button>

            {/* Prev */}
            <button
              type="button"
              className={`btn-icon ${bumpButton === 'prev' ? 'bump' : ''}`}
              onClick={prevTrack}
              title="Previous Track (Left Arrow)"
            >
              <svg width="24" height="24" viewBox="0 0 64 64" fill="currentColor">
                <rect x="14" y="16" width="6" height="32" rx="2" />
                <polygon points="50,16 50,48 24,32" />
              </svg>
            </button>

            {/* Play / Pause (Large Circle) */}
            <button
              type="button"
              className={`btn-play ${bumpButton === 'play' ? 'bump' : ''}`}
              onClick={togglePlay}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? (
                <svg width="28" height="28" viewBox="0 0 64 64" fill="currentColor">
                  <rect x="18" y="14" width="10" height="36" rx="3" />
                  <rect x="36" y="14" width="10" height="36" rx="3" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 64 64" fill="currentColor" style={{ marginLeft: 3 }}>
                  <polygon points="22,14 22,50 52,32" />
                </svg>
              )}
            </button>

            {/* Next */}
            <button
              type="button"
              className={`btn-icon ${bumpButton === 'next' ? 'bump' : ''}`}
              onClick={nextTrack}
              title="Next Track (Right Arrow)"
            >
              <svg width="24" height="24" viewBox="0 0 64 64" fill="currentColor">
                <rect x="44" y="16" width="6" height="32" rx="2" />
                <polygon points="14,16 14,48 40,32" />
              </svg>
            </button>

            {/* Repeat */}
            <button
              type="button"
              className={`btn-icon ${repeatMode !== 'off' ? 'active' : ''} ${
                bumpButton === 'repeat' ? 'bump' : ''
              }`}
              onClick={() => {
                triggerBump('repeat');
                setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
              }}
              title={`Repeat: ${repeatMode}`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              {repeatMode === 'one' && (
                <span style={{ position: 'absolute', fontSize: 9, fontWeight: 700, top: 18 }}>1</span>
              )}
              {repeatMode !== 'off' && <span className="active-dot" />}
            </button>
          </div>

          {/* Volume Row */}
          <div className="vol-box">
            <span className="vol-icon" onClick={() => setVolume(0)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="4,9.5 8,9.5 13,5.5 13,18.5 8,14.5 4,14.5" />
                <path d="M16 9 A5 5 0 0 1 16 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <div
              className="vol-slider-wrap"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setVolume(Math.round(ratio * 100));
              }}
            >
              <div className="seek-groove">
                <div className="seek-fill" style={{ width: `${volume}%` }} />
                <div className="seek-thumb" style={{ left: `${volume}%` }} />
              </div>
            </div>
            <span className="vol-icon" onClick={() => setVolume(100)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="4,9.5 8,9.5 13,5.5 13,18.5 8,14.5 4,14.5" />
                <path d="M16 9 A5 5 0 0 1 16 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M19 6 A9 9 0 0 1 19 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: Queue & Lyrics Card ================= */}
        <div className="queue-card">
          {/* Header with Tabs */}
          <div className="queue-head">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
              onClick={() => setActiveTab('queue')}
            >
              Queue
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'lyrics' ? 'active' : ''}`}
              onClick={() => setActiveTab('lyrics')}
            >
              Lyrics
            </button>
            <span className="count-label">
              {tracks.length ? `${tracks.length} song${tracks.length === 1 ? '' : 's'}` : ''}
            </span>
          </div>

          {/* Tab 1: Queue Content */}
          {activeTab === 'queue' && (
            <div className="tab-content">
              {tracks.length === 0 ? (
                <div className="empty-hint">
                  Drop songs or folders here
                  <br />
                  or use ＋ Files
                </div>
              ) : (
                <div className="track-list">
                  {tracks.map((t, idx) => {
                    const isSelected = idx === currentIndex;
                    const ext = t.name.split('.').pop()?.toUpperCase() || 'AUDIO';
                    return (
                      <div
                        key={t.id}
                        className={`track-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => playTrack(idx)}
                      >
                        {/* Rounded thumbnail with note symbol or art */}
                        <div className="track-thumb">
                          <img
                            src="/cover.jpg"
                            alt=""
                            style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover' }}
                          />
                        </div>

                        {/* Title and details */}
                        <div className="track-info">
                          <div className={`track-name ${isSelected ? 'playing' : ''}`}>
                            {t.name.replace(/\.[^/.]+$/, '')}
                          </div>
                          <div className="track-meta">
                            {String(idx + 1).padStart(2, '0')} · {ext}
                          </div>
                        </div>

                        {/* Equalizer animation when playing */}
                        {isSelected && isPlaying && (
                          <div className="eq-bars">
                            <div className="eq-bar" />
                            <div className="eq-bar" />
                            <div className="eq-bar" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom buttons */}
              <div className="queue-bottom">
                <button
                  type="button"
                  className="btn-primary-pill"
                  onClick={() => fileInputRef.current?.click()}
                >
                  ＋ Files
                </button>
                <button
                  type="button"
                  className="btn-primary-pill"
                  onClick={() => folderInputRef.current?.click()}
                >
                  ＋ Folder
                </button>
                <button type="button" className="btn-pill" onClick={removeSelected}>
                  Remove
                </button>
                <button type="button" className="btn-pill" onClick={clearAll}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Lyrics Content */}
          {activeTab === 'lyrics' && (
            <div className="tab-content">
              <div className="lyrics-status">{lyricsStatus}</div>

              <div className="lyrics-scroll-box" ref={lyricsListRef}>
                {currentLyrics && currentLyrics.lines.length > 0 ? (
                  currentLyrics.lines.map((line, lIdx) => (
                    <div
                      key={lIdx}
                      className={`lyric-line ${lIdx === currentLyricIndex ? 'active' : ''}`}
                      onClick={() => {
                        if (currentLyrics.synced && currentLyrics.times && currentLyrics.times[lIdx] !== undefined) {
                          if (audioRef.current) {
                            audioRef.current.currentTime = currentLyrics.times[lIdx];
                          }
                        }
                      }}
                    >
                      {line || '♪'}
                    </div>
                  ))
                ) : (
                  <div className="empty-hint">No lyrics available for this track</div>
                )}
              </div>

              {/* Lyrics controls */}
              <div className="lyrics-bottom">
                <button
                  type="button"
                  className="btn-primary-pill"
                  disabled={isSearchingLyrics}
                  onClick={() => searchOnlineLyrics()}
                >
                  {isSearchingLyrics ? 'Searching…' : 'Find lyrics online'}
                </button>
                <label className="auto-checkbox">
                  <input
                    type="checkbox"
                    checked={autoLyrics}
                    onChange={(e) => {
                      setAutoLyrics(e.target.checked);
                      localStorage.setItem('auto_lyrics', String(e.target.checked));
                    }}
                  />
                  Find automatically
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden File and Folder Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.opus,.webm"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) addFiles(Array.from(e.target.files));
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard for folder picker in modern browsers
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) addFiles(Array.from(e.target.files));
        }}
      />
    </div>
  );
}

// State Management
const state = {
  currentPath: '',
  absoluteDataDir: '',
  items: [],
  playlist: [], // Current directory music files
  originalPlaylist: [], // Backup of original order when shuffled
  currentIndex: -1,
  isPlaying: false,
  isMuted: false,
  volume: 0.7,
  preMuteVolume: 0.7,
  repeatMode: 0, // 0 = off, 1 = repeat all, 2 = repeat one
  layout: 'grid', // 'grid' or 'list'
  searchQuery: '',
  userPlaylists: {}, // Custom user-created playlists
  userPlaylistOrder: [], // Custom user playlist display order
  currentQueueType: 'folder', // 'folder' or 'playlist'
  folderSongs: [], // Songs loaded in current Explorer directory
  currentPlaylistName: '', // Name of playing custom playlist
  editingNotesTrackPath: '', // Path of track currently being edited in notes
  showRemainingTime: false,
  loadThumbnails: localStorage.getItem('loadThumbnails') === 'true',
  
  // Audio Visualizer Setup
  audioContext: null,
  analyser: null,
  source: null,
  dataArray: null,
  animationId: null,
  visualizerTheme: 'bars',
  sensitivity: 3
};

const themeColors = [
  { name: 'green', label: 'Verde' },
  { name: 'yellow', label: 'Amarelo' },
  { name: 'purple', label: 'Roxo (Padrão)' },
  { name: 'red', label: 'Vermelho' },
  { name: 'orange', label: 'Laranja' },
  { name: 'white', label: 'Branco' }
];

// Load theme color from localStorage
const savedTheme = localStorage.getItem('themeColor') || 'purple';
let currentThemeIndex = themeColors.findIndex(t => t.name === savedTheme);
if (currentThemeIndex === -1) currentThemeIndex = 2; // default to purple

let activeThemeColorHex = '#7952e9';
let activeThemeColorRGB = '121, 82, 233';

function getThemeColorHex() {
  const theme = themeColors[currentThemeIndex];
  switch (theme.name) {
    case 'green': return '#16a34a';
    case 'yellow': return '#ffb703';
    case 'purple': return '#7952e9';
    case 'red': return '#dc2626';
    case 'orange': return '#ea580c';
    case 'white': return '#ffffff';
    default: return '#7952e9';
  }
}

function getThemeColorRGB() {
  const theme = themeColors[currentThemeIndex];
  switch (theme.name) {
    case 'green': return '22, 163, 74';
    case 'yellow': return '255, 183, 3';
    case 'purple': return '121, 82, 233';
    case 'red': return '220, 38, 38';
    case 'orange': return '234, 88, 12';
    case 'white': return '255, 255, 255';
    default: return '121, 82, 233';
  }
}

let defaultAudioIcon = '';
let defaultVideoIcon = '';

function updateDefaultIcons() {
  const audioSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${activeThemeColorHex}" stroke-width="1.5" style="background:#18152c;width:100%;height:100%;padding:4px;box-sizing:border-box;"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
  const videoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${activeThemeColorHex}" stroke-width="1.5" style="background:#18152c;width:100%;height:100%;padding:4px;box-sizing:border-box;"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>`;

  defaultAudioIcon = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(audioSvg)))}`;
  defaultVideoIcon = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(videoSvg)))}`;
}

function applyThemeColor() {
  const theme = themeColors[currentThemeIndex];
  document.body.setAttribute('data-theme-color', theme.name);
  localStorage.setItem('themeColor', theme.name);
  
  // Cache colors for visualizer and icons
  activeThemeColorHex = getThemeColorHex();
  activeThemeColorRGB = getThemeColorRGB();
  updateDefaultIcons();
  
  const btnText = document.querySelector('#btn-theme-color-cycle span');
  if (btnText) {
    btnText.innerText = `Cor: ${theme.label}`;
  }
  
  // Re-render Explorer to sync icons instantly
  renderExplorer();
  
  // Update current track thumbnail images if elements are already loaded
  if (state.currentIndex !== -1 && state.playlist[state.currentIndex]) {
    const track = state.playlist[state.currentIndex];
    const isVideo = ['.mp4', '.mkv', '.webm', '.mov', '.avi'].some(ext => track.path.toLowerCase().endsWith(ext));
    if (elements.canvasCardThumb) {
      elements.canvasCardThumb.src = (isVideo && state.loadThumbnails) ? defaultVideoIcon : defaultAudioIcon;
      if (isVideo && state.loadThumbnails) {
        generateVideoThumbnail(track.path).then(dataUrl => {
          if (dataUrl && elements.canvasCardThumb) {
            elements.canvasCardThumb.src = dataUrl;
          }
        });
      }
    }
  } else {
    if (elements.canvasCardThumb) {
      elements.canvasCardThumb.src = defaultAudioIcon;
    }
  }
  
  // Refresh playlist drawer if it is currently open
  if (elements.playlistDrawer && elements.playlistDrawer.classList.contains('open')) {
    renderDrawerPlaylist();
  }
}

const thumbnailCache = new Map();

// DOM Elements
const elements = {
  mainHeader: document.querySelector('.main-header'),
  explorerContainer: document.getElementById('explorer-container'),
  breadcrumbs: document.getElementById('breadcrumbs'),
  folderTitle: document.getElementById('folder-name-title'),
  itemCount: document.getElementById('item-count'),
  btnBack: document.getElementById('btn-back'),
  searchInput: document.getElementById('search-input'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  
  layoutGrid: document.getElementById('layout-grid'),
  layoutList: document.getElementById('layout-list'),
  
  // Views
  btnLibrary: document.getElementById('btn-library'),
  btnVisualizerToggle: document.getElementById('btn-visualizer-toggle'),
  viewExplorer: document.getElementById('view-explorer'),
  viewVisualizer: document.getElementById('view-visualizer'),
  
  // Player
  player: document.getElementById('main-player'),
  btnPlayPause: document.getElementById('btn-play-pause'),
  playIcon: document.getElementById('play-icon'),
  pauseIcon: document.getElementById('pause-icon'),
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  btnSeekBack: document.getElementById('btn-seek-back'),
  btnSeekForward: document.getElementById('btn-seek-forward'),
  btnShuffle: document.getElementById('btn-shuffle'),
  btnRepeat: document.getElementById('btn-repeat'),
  repeatBadge: document.getElementById('repeat-badge'),
  
  progressTrack: document.getElementById('progress-track'),
  progressFill: document.getElementById('progress-fill'),
  progressHandle: document.getElementById('progress-handle'),
  timeElapsed: document.getElementById('time-elapsed'),
  timeDuration: document.getElementById('time-duration'),
  
  playerBar: document.querySelector('.player-bar'),
  playerSongTitle: document.getElementById('player-song-title'),
  playerSongArtist: document.getElementById('player-song-artist'),
  playerTrackThumb: document.getElementById('player-track-thumb'),
  
  canvasCard: document.getElementById('canvas-card'),
  canvasCardThumb: document.getElementById('canvas-card-thumb'),
  canvasSongTitle: document.getElementById('canvas-song-title'),
  canvasSongFolder: document.getElementById('canvas-song-folder'),
  
  // Volume
  btnMute: document.getElementById('btn-mute'),
  volumeTrack: document.getElementById('volume-track'),
  volumeFill: document.getElementById('volume-fill'),
  volumeHandle: document.getElementById('volume-handle'),
  volumeHigh: document.getElementById('volume-high'),
  volumeMuted: document.getElementById('volume-muted'),
  
  // Video Floating Panel
  btnVideoToggle: document.getElementById('btn-video-toggle'),
  videoPanel: document.getElementById('video-panel'),
  btnMinimizeVideo: document.getElementById('btn-minimize-video'),
  btnCloseVideo: document.getElementById('btn-close-video'),
  videoPlaceholder: document.getElementById('video-placeholder'),
  videoResizeHandle: document.getElementById('video-resize-handle'),
  videoResizeHandleLeft: document.getElementById('video-resize-handle-left'),
  
  // Canvas Visualizer
  visualizerCanvas: document.getElementById('visualizer-canvas'),
  visualizerThemeSelect: document.getElementById('visualizer-theme'),
  visualizerSensitivity: document.getElementById('visualizer-sensitivity'),
  visualizerVideoToggle: document.getElementById('visualizer-video-toggle'),
  btnCanvasPlaylist: document.getElementById('btn-canvas-playlist'),
  playlistDrawer: document.getElementById('playlist-drawer'),
  playlistDrawerList: document.getElementById('playlist-drawer-list'),
  canvasCardWrapper: document.getElementById('canvas-card-wrapper'),
  btnCardUp: document.getElementById('btn-card-up'),
  btnCardDown: document.getElementById('btn-card-down'),
  btnCardAdd: document.getElementById('btn-card-add'),
  btnCardRemove: document.getElementById('btn-card-remove'),
  btnCreatePlaylistCard: document.getElementById('btn-create-playlist-card'),
  
  // Music Notes Modal Elements
  btnMusicNotes: document.getElementById('btn-music-notes'),
  musicNotesModal: document.getElementById('music-notes-modal'),
  btnCloseNotes: document.getElementById('btn-close-notes'),
  btnSaveNotes: document.getElementById('btn-save-notes'),
  notesTextarea: document.getElementById('notes-textarea'),
  notesModalTitle: document.getElementById('notes-modal-title'),
  notesSaveStatus: document.getElementById('notes-save-status'),
  
  // Music Lyrics Modal Elements
  btnMusicLyrics: document.getElementById('btn-music-lyrics'),
  musicLyricsModal: document.getElementById('music-lyrics-modal'),
  btnCloseLyrics: document.getElementById('btn-close-lyrics'),
  btnSaveLyrics: document.getElementById('btn-save-lyrics'),
  lyricsTextarea: document.getElementById('lyrics-textarea'),
  lyricsModalTitle: document.getElementById('lyrics-modal-title'),
  lyricsSaveStatus: document.getElementById('lyrics-save-status'),
  lyricsZoomSlider: document.getElementById('lyrics-zoom-slider'),
  btnLyricsBold: document.getElementById('btn-lyrics-bold'),
  btnLyricsTheme: document.getElementById('btn-lyrics-theme'),
  lyricsTextareaWrapper: document.querySelector('.lyrics-textarea-wrapper'),
  btnSaveTrackVolume: document.getElementById('btn-save-track-volume'),
  
  btnMapDir: document.getElementById('btn-map-dir'),
  mapDirectoryModal: document.getElementById('map-directory-modal'),
  btnCloseMapDir: document.getElementById('btn-close-map-dir'),
  inputMapDir: document.getElementById('input-map-dir'),
  btnBrowseLocalDir: document.getElementById('btn-browse-local-dir'),
  btnSubmitMapDir: document.getElementById('btn-submit-map-dir'),
  mapDirError: document.getElementById('map-dir-error'),
  mapDirStatus: document.getElementById('map-dir-status'),
  mapDirWarning: document.getElementById('map-dir-warning'),
  
  
  btnImportPlaylists: document.getElementById('btn-import-playlists'),
  btnExportPlaylists: document.getElementById('btn-export-playlists'),
  playlistImportInput: document.getElementById('playlist-import-input'),
  btnToggleThumbs: document.getElementById('btn-toggle-thumbs')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  state.userPlaylists = JSON.parse(localStorage.getItem('userPlaylists') || '{}');
  state.userPlaylistOrder = JSON.parse(localStorage.getItem('userPlaylistOrder') || '[]');
  
  // Sync migration
  const keys = Object.keys(state.userPlaylists);
  keys.forEach(k => {
    if (!state.userPlaylistOrder.includes(k)) {
      state.userPlaylistOrder.push(k);
    }
  });
  state.userPlaylistOrder = state.userPlaylistOrder.filter(k => keys.includes(k));
  localStorage.setItem('userPlaylistOrder', JSON.stringify(state.userPlaylistOrder));

  setupEventListeners();
  renderSidebarPlaylists();
  loadDirectory('');
  elements.player.volume = state.volume;
  updateVolumeUI();
  applyThemeColor();
  updateThumbsButtonUI();
});

// Event Listeners Configuration
function setupEventListeners() {
  // Navigation
  elements.btnBack.addEventListener('click', navigateUp);
  elements.searchInput.addEventListener('input', handleSearch);
  elements.btnClearSearch.addEventListener('click', clearSearch);
  
  // Layout Controls
  elements.layoutGrid.addEventListener('click', () => changeLayout('grid'));
  elements.layoutList.addEventListener('click', () => changeLayout('list'));
  
  if (elements.btnToggleThumbs) {
    elements.btnToggleThumbs.addEventListener('click', toggleLoadThumbnails);
  }
  
  // Views Toggle
  elements.btnLibrary.addEventListener('click', () => switchView('explorer'));
  elements.btnVisualizerToggle.addEventListener('click', () => switchView('visualizer'));
  
  // Player Controls
  elements.btnPlayPause.addEventListener('click', togglePlayPause);
  elements.btnPrev.addEventListener('click', playPrevious);
  elements.btnNext.addEventListener('click', playNext);
  elements.btnSeekBack.addEventListener('click', () => seekRelative(-5));
  elements.btnSeekForward.addEventListener('click', () => seekRelative(5));
  elements.btnShuffle.addEventListener('click', toggleShuffle);
  elements.btnRepeat.addEventListener('click', toggleRepeat);
  
  // Progress Bar click/drag
  setupSliderDragging(elements.progressTrack, elements.progressFill, elements.progressHandle, handleProgressSeek);
  elements.player.addEventListener('timeupdate', updatePlaybackProgress);
  elements.player.addEventListener('loadedmetadata', updateTrackDuration);
  elements.player.addEventListener('ended', handlePlaybackEnded);
  
  if (elements.timeDuration) {
    elements.timeDuration.addEventListener('click', () => {
      state.showRemainingTime = !state.showRemainingTime;
      updateTrackDuration();
      if (state.showRemainingTime) {
        updatePlaybackProgress();
      }
    });
  }
  
  // Volume controls click/drag
  setupSliderDragging(elements.volumeTrack, elements.volumeFill, elements.volumeHandle, handleVolumeChange);
  elements.btnMute.addEventListener('click', toggleMute);
  
  // Video Panel Controls
  elements.btnVideoToggle.addEventListener('click', toggleVideoPanel);
  elements.btnMinimizeVideo.addEventListener('click', minimizeVideoPanel);
  elements.btnCloseVideo.addEventListener('click', () => {
    elements.videoPanel.classList.remove('active');
    elements.btnVideoToggle.classList.remove('active');
    elements.videoPanel.classList.remove('minimized');
    
    // Clear custom dimensions to reset to stylesheet defaults
    elements.videoPanel.style.width = '';
    elements.videoPanel.style.left = '';
    elements.videoPanel.style.top = '';
    elements.videoPanel.style.right = '';
    elements.videoPanel.style.bottom = '';
    const videoWrapper = elements.videoPanel.querySelector('.video-wrapper');
    if (videoWrapper) videoWrapper.style.height = '';
    
    if (elements.visualizerVideoToggle) {
      elements.visualizerVideoToggle.checked = false;
    }
  });
  
  if (elements.visualizerVideoToggle) {
    elements.visualizerVideoToggle.addEventListener('change', (e) => {
      const showVideo = e.target.checked;
      if (showVideo) {
        elements.videoPanel.classList.add('active');
        elements.btnVideoToggle.classList.add('active');
        elements.videoPanel.classList.remove('minimized');
      } else {
        elements.videoPanel.classList.remove('active');
        elements.btnVideoToggle.classList.remove('active');
      }
    });
  }
  
  // Visualizer controls
  elements.visualizerThemeSelect.addEventListener('change', (e) => {
    state.visualizerTheme = e.target.value;
  });
  elements.visualizerSensitivity.addEventListener('input', (e) => {
    state.sensitivity = parseFloat(e.target.value);
  });
  
  const btnThemeCycle = document.getElementById('btn-theme-color-cycle');
  if (btnThemeCycle) {
    btnThemeCycle.addEventListener('click', () => {
      currentThemeIndex = (currentThemeIndex + 1) % themeColors.length;
      applyThemeColor();
    });
  }
  
  // Window resize for visualizer canvas
  window.addEventListener('resize', resizeCanvas);
  
  // Enable drag and resize for floating video panel
  setupDragAndResize();
  
  // Enable playlist toggle drawer
  if (elements.btnCanvasPlaylist) {
    elements.btnCanvasPlaylist.addEventListener('click', togglePlaylistDrawer);
  }
  if (elements.canvasCard) {
    elements.canvasCard.addEventListener('click', () => {
      if (elements.playlistDrawer) {
        const isOpen = elements.playlistDrawer.classList.contains('open');
        if (!isOpen) {
          togglePlaylistDrawer();
        }
      }
    });
  }
  if (elements.btnCardUp) {
    elements.btnCardUp.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentIndex > 0) {
        movePlaylistItem(state.currentIndex, 'up');
      }
    });
  }
  if (elements.btnCardDown) {
    elements.btnCardDown.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentIndex < state.playlist.length - 1) {
        movePlaylistItem(state.currentIndex, 'down');
      }
    });
  }
  if (elements.btnCardAdd) {
    elements.btnCardAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentIndex !== -1 && state.playlist[state.currentIndex]) {
        showAddToPlaylistMenu(e, state.playlist[state.currentIndex]);
      }
    });
  }
  if (elements.btnCardRemove) {
    elements.btnCardRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentIndex !== -1 && state.playlist[state.currentIndex]) {
        const activeTrack = state.playlist[state.currentIndex];
        showRemoveFromPlaylistMenu(e, activeTrack.path, activeTrack.name);
      }
    });
  }
  
  if (elements.btnCreatePlaylistCard) {
    elements.btnCreatePlaylistCard.addEventListener('click', () => {
      const name = prompt("Nome da nova playlist:");
      if (name && name.trim()) {
        createPlaylist(name.trim());
      }
    });
  }

  // Playlist Import/Export Event Listeners
  if (elements.btnExportPlaylists) {
    elements.btnExportPlaylists.addEventListener('click', () => {
      try {
        const playlistsData = JSON.stringify(state.userPlaylists, null, 2);
        const blob = new Blob([playlistsData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'flowplayer_playlists.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Playlists exportadas com sucesso!');
      } catch (err) {
        console.error(err);
        showToast('Erro ao exportar playlists.', true);
      }
    });
  }

  if (elements.btnImportPlaylists && elements.playlistImportInput) {
    elements.btnImportPlaylists.addEventListener('click', () => {
      elements.playlistImportInput.click();
    });

    elements.playlistImportInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (imported && typeof imported === 'object') {
            let importedCount = 0;
            // Merge playlists
            for (const key in imported) {
              if (Array.isArray(imported[key])) {
                if (!state.userPlaylists[key]) {
                  state.userPlaylists[key] = [];
                }
                imported[key].forEach(track => {
                  if (track && track.path) {
                    const exists = state.userPlaylists[key].some(t => t.path === track.path);
                    if (!exists) {
                      state.userPlaylists[key].push(track);
                      importedCount++;
                    }
                  }
                });
              }
            }
            
            // Sync userPlaylistOrder order list to match userPlaylists keys
            Object.keys(state.userPlaylists).forEach(name => {
              if (!state.userPlaylistOrder.includes(name)) {
                state.userPlaylistOrder.push(name);
              }
            });
            
            localStorage.setItem('userPlaylists', JSON.stringify(state.userPlaylists));
            localStorage.setItem('userPlaylistOrder', JSON.stringify(state.userPlaylistOrder));
            renderSidebarPlaylists();
            showToast(`Playlists importadas! ${importedCount} novas músicas.`);
          } else {
            showToast('Formato de arquivo inválido.', true);
          }
        } catch (err) {
          console.error(err);
          showToast('Erro ao processar o arquivo.', true);
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
  }

  // Music Notes Modal Event Listeners
  if (elements.btnMusicNotes) {
    elements.btnMusicNotes.addEventListener('click', () => {
      // Get currently selected/playing song
      const currentTrack = state.playlist[state.currentIndex];
      if (!currentTrack) {
        alert("Por favor, selecione e execute uma música primeiro!");
        return;
      }
      
      // Store the specific track path we are opening the notes for
      state.editingNotesTrackPath = currentTrack.path;
      
      // Update modal title with track name (clean extension)
      elements.notesModalTitle.innerText = `Anotações: ${cleanExtension(currentTrack.name)}`;
      
      // Load stored notes from localStorage
      const allNotes = JSON.parse(localStorage.getItem('musicNotes') || '{}');
      const trackNotes = allNotes[currentTrack.path] || '';
      elements.notesTextarea.value = trackNotes;
      
      // Reset save status message
      elements.notesSaveStatus.innerText = 'Não modificado';
      elements.notesSaveStatus.style.color = 'var(--text-muted)';
      
      // Open modal
      elements.musicNotesModal.classList.add('open');
    });
  }

  if (elements.btnCloseNotes) {
    elements.btnCloseNotes.addEventListener('click', () => {
      elements.musicNotesModal.classList.remove('open');
    });
  }

  if (elements.btnSaveNotes) {
    elements.btnSaveNotes.addEventListener('click', () => {
      const targetPath = state.editingNotesTrackPath;
      if (!targetPath) return;
      
      const allNotes = JSON.parse(localStorage.getItem('musicNotes') || '{}');
      allNotes[targetPath] = elements.notesTextarea.value;
      localStorage.setItem('musicNotes', JSON.stringify(allNotes));
      
      elements.notesSaveStatus.innerText = 'Salvo com sucesso!';
      elements.notesSaveStatus.style.color = '#4caf50';
      
      updateNotesButtonIndicator();
      
      setTimeout(() => {
        elements.musicNotesModal.classList.remove('open');
      }, 800);
    });
  }

  if (elements.notesTextarea) {
    elements.notesTextarea.addEventListener('input', () => {
      elements.notesSaveStatus.innerText = 'Alterações não salvas...';
      elements.notesSaveStatus.style.color = '#ff9800';
    });
  }

  if (elements.btnMusicLyrics) {
    elements.btnMusicLyrics.addEventListener('click', () => {
      const currentTrack = state.playlist[state.currentIndex];
      if (!currentTrack) {
        alert("Por favor, selecione e execute uma música primeiro!");
        return;
      }
      
      state.editingLyricsTrackPath = currentTrack.path;
      elements.lyricsModalTitle.innerText = `Letra da Música: ${cleanExtension(currentTrack.name)}`;
      
      const allLyrics = JSON.parse(localStorage.getItem('musicLyrics') || '{}');
      const trackLyrics = allLyrics[currentTrack.path] || '';
      elements.lyricsTextarea.value = trackLyrics;
      
      const savedZoom = localStorage.getItem('lyricsZoomPreference') || '20';
      if (elements.lyricsZoomSlider) {
        elements.lyricsZoomSlider.value = savedZoom;
      }
      if (elements.lyricsTextarea) {
        elements.lyricsTextarea.style.fontSize = `${savedZoom}px`;
      }
      const zoomValDisplay = document.getElementById('zoom-value-display');
      if (zoomValDisplay) {
        zoomValDisplay.innerText = `${savedZoom}px`;
      }

      // Load bold preference
      const isBold = localStorage.getItem('lyricsBoldPreference') === 'true';
      if (elements.btnLyricsBold) {
        if (isBold) {
          elements.btnLyricsBold.classList.add('active');
        } else {
          elements.btnLyricsBold.classList.remove('active');
        }
      }
      if (elements.lyricsTextarea) {
        elements.lyricsTextarea.style.fontWeight = isBold ? 'bold' : 'normal';
      }

      // Load theme preference
      const isLightTheme = localStorage.getItem('lyricsThemePreference') === 'light';
      if (elements.lyricsTextareaWrapper) {
        if (isLightTheme) {
          elements.lyricsTextareaWrapper.classList.add('light-theme');
        } else {
          elements.lyricsTextareaWrapper.classList.remove('light-theme');
        }
      }
      if (elements.btnLyricsTheme) {
        if (isLightTheme) {
          elements.btnLyricsTheme.classList.add('active');
        } else {
          elements.btnLyricsTheme.classList.remove('active');
        }
      }
      
      elements.lyricsSaveStatus.innerText = 'Não modificado';
      elements.lyricsSaveStatus.style.color = 'var(--text-muted)';
      
      elements.musicLyricsModal.classList.add('open');
    });
  }

  if (elements.btnCloseLyrics) {
    elements.btnCloseLyrics.addEventListener('click', () => {
      elements.musicLyricsModal.classList.remove('open');
    });
  }

  if (elements.btnSaveLyrics) {
    elements.btnSaveLyrics.addEventListener('click', () => {
      const targetPath = state.editingLyricsTrackPath;
      if (!targetPath) return;
      
      const allLyrics = JSON.parse(localStorage.getItem('musicLyrics') || '{}');
      allLyrics[targetPath] = elements.lyricsTextarea.value;
      localStorage.setItem('musicLyrics', JSON.stringify(allLyrics));
      
      elements.lyricsSaveStatus.innerText = 'Salvo com sucesso!';
      elements.lyricsSaveStatus.style.color = '#4caf50';
      
      updateLyricsButtonIndicator();
      
      setTimeout(() => {
        elements.musicLyricsModal.classList.remove('open');
      }, 800);
    });
  }

  if (elements.lyricsTextarea) {
    elements.lyricsTextarea.addEventListener('input', () => {
      elements.lyricsSaveStatus.innerText = 'Alterações não salvas...';
      elements.lyricsSaveStatus.style.color = '#ff9800';
    });
  }

  if (elements.lyricsZoomSlider) {
    elements.lyricsZoomSlider.addEventListener('input', () => {
      const zoomVal = elements.lyricsZoomSlider.value;
      if (elements.lyricsTextarea) {
        elements.lyricsTextarea.style.fontSize = `${zoomVal}px`;
      }
      const zoomValDisplay = document.getElementById('zoom-value-display');
      if (zoomValDisplay) {
        zoomValDisplay.innerText = `${zoomVal}px`;
      }
      localStorage.setItem('lyricsZoomPreference', zoomVal);
    });
  }

  if (elements.btnLyricsBold) {
    elements.btnLyricsBold.addEventListener('click', () => {
      const isCurrentlyBold = elements.btnLyricsBold.classList.toggle('active');
      if (elements.lyricsTextarea) {
        elements.lyricsTextarea.style.fontWeight = isCurrentlyBold ? 'bold' : 'normal';
      }
      localStorage.setItem('lyricsBoldPreference', isCurrentlyBold);
    });
  }

  if (elements.btnLyricsTheme) {
    elements.btnLyricsTheme.addEventListener('click', () => {
      const isLight = elements.lyricsTextareaWrapper.classList.toggle('light-theme');
      elements.btnLyricsTheme.classList.toggle('active', isLight);
      localStorage.setItem('lyricsThemePreference', isLight ? 'light' : 'dark');
    });
  }

  if (elements.btnSaveTrackVolume) {
    elements.btnSaveTrackVolume.addEventListener('click', () => {
      const currentTrack = state.playlist[state.currentIndex];
      if (!currentTrack) {
        alert("Nenhuma música está tocando no momento.");
        return;
      }
      
      const savedVolumes = JSON.parse(localStorage.getItem('trackVolumes') || '{}');
      savedVolumes[currentTrack.path] = state.volume;
      localStorage.setItem('trackVolumes', JSON.stringify(savedVolumes));
      
      elements.btnSaveTrackVolume.classList.add('has-custom-volume', 'saved-flash');
      setTimeout(() => {
        elements.btnSaveTrackVolume.classList.remove('saved-flash');
      }, 1000);
    });
  }

  if (elements.btnMapDir) {
    elements.btnMapDir.addEventListener('click', () => {
      elements.inputMapDir.value = state.absoluteDataDir || '';
      elements.mapDirError.style.display = 'none';
      elements.mapDirStatus.style.display = 'none';
      if (elements.mapDirWarning) elements.mapDirWarning.style.display = 'none';
      elements.mapDirectoryModal.classList.add('open');
    });
  }

  if (elements.btnBrowseLocalDir) {
    elements.btnBrowseLocalDir.addEventListener('click', async () => {
      elements.mapDirError.style.display = 'none';
      elements.mapDirStatus.innerText = 'segure alt+tab e clique na janela "Procurar Pasta"';
      elements.mapDirStatus.style.color = '#2ecc71';
      elements.mapDirStatus.style.fontWeight = 'bold';
      elements.mapDirStatus.style.display = 'inline';
      if (elements.mapDirWarning) elements.mapDirWarning.style.display = 'block';
      elements.btnBrowseLocalDir.disabled = true;

      try {
        const response = await fetch('/api/select-directory');
        if (!response.ok) throw new Error('Não foi possível abrir o seletor de arquivos.');
        
        const data = await response.json();
        if (data.cancelled) {
          elements.mapDirStatus.style.display = 'none';
          if (elements.mapDirWarning) elements.mapDirWarning.style.display = 'none';
        } else if (data.path) {
          elements.inputMapDir.value = data.path;
          elements.mapDirStatus.innerText = 'Pasta selecionada!';
          if (elements.mapDirWarning) elements.mapDirWarning.style.display = 'none';
          setTimeout(() => {
            elements.mapDirStatus.style.display = 'none';
          }, 1500);
        } else {
          throw new Error(data.error || 'Erro ao selecionar a pasta.');
        }
      } catch (err) {
        elements.mapDirStatus.style.display = 'none';
        if (elements.mapDirWarning) elements.mapDirWarning.style.display = 'none';
        elements.mapDirError.innerText = err.message;
        elements.mapDirError.style.display = 'block';
      } finally {
        elements.btnBrowseLocalDir.disabled = false;
      }
    });
  }

  if (elements.btnCloseMapDir) {
    elements.btnCloseMapDir.addEventListener('click', () => {
      elements.mapDirectoryModal.classList.remove('open');
    });
  }

  if (elements.mapDirectoryModal) {
    elements.mapDirectoryModal.addEventListener('click', (e) => {
      if (e.target === elements.mapDirectoryModal) {
        elements.mapDirectoryModal.classList.remove('open');
      }
    });
  }

  if (elements.btnSubmitMapDir) {
    elements.btnSubmitMapDir.addEventListener('click', async () => {
      const newPath = elements.inputMapDir.value.trim();
      if (!newPath) {
        elements.mapDirError.innerText = 'Por favor, digite um caminho válido.';
        elements.mapDirError.style.display = 'block';
        return;
      }

      elements.mapDirError.style.display = 'none';
      elements.mapDirStatus.innerText = 'Mapeando...';
      elements.mapDirStatus.style.display = 'inline';
      if (elements.mapDirWarning) elements.mapDirWarning.style.display = 'none';
      elements.btnSubmitMapDir.disabled = true;

      try {
        const response = await fetch('/api/set-directory', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ dirPath: newPath })
         });

        const data = await response.json();
        if (response.ok && data.success) {
          state.absoluteDataDir = data.currentPath;
          elements.mapDirStatus.style.color = '#2ecc71';
          elements.mapDirStatus.style.fontWeight = 'bold';
          elements.mapDirStatus.innerText = 'Sucesso!';
          if (elements.mapDirWarning) elements.mapDirWarning.style.display = 'none';
          setTimeout(() => {
            elements.mapDirectoryModal.classList.remove('open');
            elements.btnSubmitMapDir.disabled = false;
            window.location.reload();
          }, 1000);
        } else {
          throw new Error(data.error || 'Erro ao mapear a pasta.');
        }
      } catch (err) {
        elements.mapDirStatus.style.display = 'none';
        if (elements.mapDirWarning) elements.mapDirWarning.style.display = 'none';
        elements.mapDirError.innerText = err.message;
        elements.mapDirError.style.display = 'block';
        elements.btnSubmitMapDir.disabled = false;
      }
    });
  }

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Ignore if inside text input or textarea
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }

    // n - salvar volume da musica
    if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (elements.btnSaveTrackVolume) elements.btnSaveTrackVolume.click();
    }
    // backspace - voltar diretorios
    else if (e.key === 'Backspace') {
      e.preventDefault();
      if (elements.btnBack) elements.btnBack.click();
    }
    // space - reproduzir/pausar
    else if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (elements.btnPlayPause) elements.btnPlayPause.click();
    }
    // ctrl + up/down - volume
    else if (e.ctrlKey && e.key === 'ArrowUp') {
      e.preventDefault();
      adjustVolumeDelta(0.01);
    } else if (e.ctrlKey && e.key === 'ArrowDown') {
      e.preventDefault();
      adjustVolumeDelta(-0.01);
    }
    // ctrl + shift + left - aleatorio
    else if (e.ctrlKey && e.shiftKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      if (elements.btnShuffle) elements.btnShuffle.click();
    }
    // ctrl + shift + right - repetir
    else if (e.ctrlKey && e.shiftKey && e.key === 'ArrowRight') {
      e.preventDefault();
      if (elements.btnRepeat) elements.btnRepeat.click();
    }
    // ctrl + left/right - anterior/proxima
    else if (e.ctrlKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      if (elements.btnPrev) elements.btnPrev.click();
    } else if (e.ctrlKey && e.key === 'ArrowRight') {
      e.preventDefault();
      if (elements.btnNext) elements.btnNext.click();
    }
    // m - mudo
    else if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      if (elements.btnMute) elements.btnMute.click();
    }
    // ArrowUp - avançar 1 segundo
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      seekRelative(1);
    }
    // ArrowDown - voltar 1 segundo
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      seekRelative(-1);
    }
    // ArrowLeft - voltar 5 segundos
    else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      seekRelative(-5);
    }
    // ArrowRight - avançar 5 segundos
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      seekRelative(5);
    }
  });

  let volumeTooltipTimeout = null;
  function adjustVolumeDelta(delta) {
    if (state.isMuted) {
      toggleMute();
    }
    state.volume = Math.max(0, Math.min(1, state.volume + delta));
    elements.player.volume = state.volume;
    updateVolumeUI();
    showVolumeHUD(state.volume);

    const track = document.getElementById('volume-track');
    if (track) {
      track.classList.add('dragging');
      if (volumeTooltipTimeout) clearTimeout(volumeTooltipTimeout);
      volumeTooltipTimeout = setTimeout(() => {
        track.classList.remove('dragging');
      }, 1200);
    }
  }

  function seekRelative(seconds) {
    if (elements.player && !isNaN(elements.player.duration)) {
      let newTime = Math.max(0, Math.min(elements.player.duration, elements.player.currentTime + seconds));
      elements.player.currentTime = newTime;
      updatePlaybackProgress();
    }
  }
}

// ----------------------------------------------------
// Folder Browsing & Search Logic
// ----------------------------------------------------

async function loadDirectory(path) {
  showLoading(true);
  try {
    const res = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('Não foi possível carregar esta pasta.');
    
    const data = await res.json();
    state.currentPath = data.currentPath;
    state.absoluteDataDir = data.absoluteDataDir || '';
    state.items = data.items;
    
    // Store currently loaded folder songs
    state.folderSongs = state.items.filter(item => !item.isDir);
    
    // Only overwrite active playlist if we are in 'folder' mode
    if (state.currentQueueType !== 'playlist') {
      state.currentQueueType = 'folder';
      state.currentPlaylistName = 'Pasta Atual';
      state.playlist = [...state.folderSongs];
      state.originalPlaylist = [...state.playlist];
      
      // If shuffle is active, shuffle the loaded playlist immediately
      if (state.isShuffle) {
        for (let i = state.playlist.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [state.playlist[i], state.playlist[j]] = [state.playlist[j], state.playlist[i]];
        }
      }
      
      updateCurrentIndexFromPlaying();
    }
    
    renderBreadcrumbs();
    renderExplorer();
    updateItemCount();
    
    // Enable/disable navigation back arrow
    elements.btnBack.disabled = state.currentPath === '';
    
    // Update drawer list if open
    if (elements.playlistDrawer && elements.playlistDrawer.classList.contains('open')) {
      moveCardToActiveIndex();
    }
    
  } catch (error) {
    console.error(error);
    showError(error.message);
  } finally {
    showLoading(false);
  }
}

function updateCurrentIndexFromPlaying() {
  if (state.playlist.length === 0 || !elements.player.src) {
    state.currentIndex = -1;
    return;
  }
  
  const currentSrc = decodeURIComponent(new URL(elements.player.src).searchParams.get('path') || '');
  state.currentIndex = state.playlist.findIndex(item => item.path === currentSrc);
}

function renderExplorer() {
  const container = elements.explorerContainer;
  container.innerHTML = '';
  
  // Filter items based on search query
  const filteredItems = state.items.filter(item => 
    item.name.toLowerCase().includes(state.searchQuery.toLowerCase())
  );
  
  if (filteredItems.length === 0) {
    const isFirstTime = !state.searchQuery && !state.currentPath;
    if (isFirstTime) {
      document.body.classList.add('first-time-active');
      container.innerHTML = `
        <div class="empty-state first-time-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 80px; height: 80px; color: var(--accent-color); margin-bottom: 20px;">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 12px; color: var(--text-main);">Bem-vindo ao FlowPlayer!</h2>
          <p style="max-width: 440px; margin: 0 auto 120px; color: var(--text-muted); font-size: 14px; line-height: 1.6;">
            Sua biblioteca está vazia. Clique abaixo para escolher a pasta no seu computador onde estão armazenadas suas músicas e vídeos.
          </p>
        </div>
      `;
    } else {
      document.body.classList.remove('first-time-active');
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <p>${state.searchQuery ? 'Nenhum resultado para a busca.' : 'Esta pasta está vazia.'}</p>
        </div>
      `;
    }
    return;
  }
  document.body.classList.remove('first-time-active');
  
  // Toggle grid/list class
  if (state.layout === 'list') {
    container.classList.add('list-view');
  } else {
    container.classList.remove('list-view');
  }
  
  filteredItems.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'explorer-item';
    
    // Highlight if currently playing (exact file or parent directory)
    const playingPath = elements.player.src ? decodeURIComponent(new URL(elements.player.src).searchParams.get('path') || '') : '';
    let isPlayingThis = false;
    let isDirContainsPlaying = false;
    
    if (playingPath) {
      if (!item.isDir) {
        isPlayingThis = (item.path === playingPath);
      } else {
        isDirContainsPlaying = playingPath.startsWith(item.path + '/');
      }
    }
      
    if (isPlayingThis || isDirContainsPlaying) {
      itemEl.classList.add('playing-now');
    }
    
    // File Extension badge
    let badgeHtml = '';
    let addToPlaylistHtml = '';
    if (!item.isDir) {
      const ext = item.name.substring(item.name.lastIndexOf('.')).replace('.', '');
      badgeHtml = `<span class="item-badge">${ext}</span>`;
      
      const containingPlaylists = getPlaylistsContainingTrack(item.path);
      addToPlaylistHtml = `
        <div class="explorer-action-buttons-group">
          <button class="btn-add-to-playlist" title="Adicionar à Playlist">+</button>
          ${containingPlaylists.length > 0 ? `
            <button class="btn-remove-from-playlist" title="Remover da Playlist">-</button>
          ` : ''}
        </div>
      `;
    }
    
    // Icon definition
    let iconHtml = '';
    let isWrapperMp4Class = '';
    if (item.isDir) {
      iconHtml = `<svg class="item-icon item-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    } else if (item.name.toLowerCase().endsWith('.mp4')) {
      isWrapperMp4Class = ' is-video-thumb';
      iconHtml = `
        <img class="item-thumb-img" src="" style="display: none; width: 100%; height: 100%; object-fit: cover; z-index: 1;">
        <svg class="item-icon item-music placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
      `;
    } else {
      iconHtml = `<svg class="item-icon item-music" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
    }
      
    const sizeString = item.isDir ? 'Pasta' : formatBytes(item.size);
    
    itemEl.innerHTML = `
      <div class="item-icon-wrapper${isWrapperMp4Class}">
        ${iconHtml}
      </div>
      <div class="item-info-text">
        <div class="item-name" title="${item.name}">${item.name}</div>
        <div class="item-meta">${sizeString}</div>
      </div>
      ${badgeHtml}
      ${(isPlayingThis || isDirContainsPlaying) && state.isPlaying ? `
        <div class="playing-indicator">
          <div class="playing-bar"></div>
          <div class="playing-bar"></div>
          <div class="playing-bar"></div>
        </div>
      ` : ''}
      ${addToPlaylistHtml}
    `;

    // Asynchronously load video thumbnail
    if (!item.isDir && item.name.toLowerCase().endsWith('.mp4') && state.loadThumbnails) {
      generateVideoThumbnail(item.path).then(dataUrl => {
        if (dataUrl) {
          const imgEl = itemEl.querySelector('.item-thumb-img');
          const placeholder = itemEl.querySelector('.placeholder-icon');
          if (imgEl) {
            imgEl.src = dataUrl;
            imgEl.style.display = 'block';
          }
          if (placeholder) {
            placeholder.style.display = 'none';
          }
        }
      });
    }
    
    // Navigation and click triggers
    itemEl.addEventListener('click', () => {
      if (item.isDir) {
        // Open folder on click/double-click (we'll make it single click for quick web navigation, feels faster and cleaner)
        loadDirectory(item.path);
      } else {
        // Play song: Stop custom playlist, load current folder files as active queue
        state.currentQueueType = 'folder';
        state.currentPlaylistName = state.currentPath.split('/').pop() || 'Biblioteca';
        state.playlist = [...state.folderSongs];
        state.originalPlaylist = [...state.folderSongs];
        
        if (state.isShuffle) {
          // Shuffle folder files
          for (let i = state.playlist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [state.playlist[i], state.playlist[j]] = [state.playlist[j], state.playlist[i]];
          }
        }
        
        playTrackByPath(item.path);
      }
    });
    
    if (!item.isDir) {
      const btnAdd = itemEl.querySelector('.btn-add-to-playlist');
      if (btnAdd) {
        btnAdd.addEventListener('click', (e) => {
          e.stopPropagation();
          showAddToPlaylistMenu(e, item);
        });
      }
      const btnRemove = itemEl.querySelector('.btn-remove-from-playlist');
      if (btnRemove) {
        btnRemove.addEventListener('click', (e) => {
          e.stopPropagation();
          showRemoveFromPlaylistMenu(e, item.path, item.name);
        });
      }
    }
    
    container.appendChild(itemEl);
  });
}

function renderBreadcrumbs() {
  const container = elements.breadcrumbs;
  container.innerHTML = '';
  
  // Home node
  const homeNode = document.createElement('span');
  homeNode.className = 'breadcrumb-item';
  homeNode.innerText = 'Biblioteca';
  homeNode.addEventListener('click', () => loadDirectory(''));
  container.appendChild(homeNode);
  
  if (!state.currentPath) {
    elements.folderTitle.innerText = 'Minhas Músicas';
    return;
  }
  
  const parts = state.currentPath.split('/');
  let accumulatedPath = '';
  
  parts.forEach((part, index) => {
    // Add separator
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-separator';
    sep.innerText = ' / ';
    container.appendChild(sep);
    
    accumulatedPath += (index === 0 ? '' : '/') + part;
    
    const node = document.createElement('span');
    node.className = 'breadcrumb-item';
    node.innerText = part;
    
    // Click navigates to that parent folder
    const target = accumulatedPath;
    node.addEventListener('click', () => loadDirectory(target));
    
    container.appendChild(node);
    
    // Update main section title to active folder name
    if (index === parts.length - 1) {
      elements.folderTitle.innerText = part;
    }
  });
}

function navigateUp() {
  if (!state.currentPath) return;
  const parts = state.currentPath.split('/');
  parts.pop();
  const parentPath = parts.join('/');
  loadDirectory(parentPath);
}

function handleSearch(e) {
  state.searchQuery = e.target.value;
  elements.btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
  renderExplorer();
  updatePlaylistFromSearch();
}

function clearSearch() {
  elements.searchInput.value = '';
  state.searchQuery = '';
  elements.btnClearSearch.style.display = 'none';
  renderExplorer();
  updatePlaylistFromSearch();
}

function updatePlaylistFromSearch() {
  if (state.currentQueueType === 'playlist') {
    return; // Don't disrupt playing custom playlist when searching in explorer
  }
  // Filter playable files from items that match the search query
  const filtered = state.items.filter(item => 
    !item.isDir && item.name.toLowerCase().includes(state.searchQuery.toLowerCase())
  );
  
  state.playlist = filtered;
  state.originalPlaylist = [...filtered];
  
  // If shuffle is active, shuffle this filtered playlist
  if (state.isShuffle) {
    for (let i = state.playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.playlist[i], state.playlist[j]] = [state.playlist[j], state.playlist[i]];
    }
  }
  
  updateCurrentIndexFromPlaying();
  
  // Re-render visual list
  if (elements.playlistDrawer && elements.playlistDrawer.classList.contains('open')) {
    moveCardToActiveIndex();
  }
}

function changeLayout(type) {
  state.layout = type;
  if (type === 'grid') {
    elements.layoutGrid.classList.add('active');
    elements.layoutList.classList.remove('active');
  } else {
    elements.layoutList.classList.add('active');
    elements.layoutGrid.classList.remove('active');
  }
  renderExplorer();
}

function updateItemCount() {
  const folders = state.items.filter(item => item.isDir).length;
  const files = state.items.filter(item => !item.isDir).length;
  
  let label = '';
  if (folders > 0 && files > 0) {
    label = `${folders} ${folders === 1 ? 'pasta' : 'pastas'}, ${files} ${files === 1 ? 'música' : 'músicas'}`;
  } else if (folders > 0) {
    label = `${folders} ${folders === 1 ? 'pasta' : 'pastas'}`;
  } else {
    label = `${files} ${files === 1 ? 'música' : 'músicas'}`;
  }
  
  elements.itemCount.innerText = label;
}

// ----------------------------------------------------
// Media Playback Logic
// ----------------------------------------------------

function playTrackByPath(filePath) {
  // Find index in current playlist
  state.currentIndex = state.playlist.findIndex(item => item.path === filePath);
  
  if (state.currentIndex === -1) {
    console.warn("Track not in loaded list.");
  }
  
  // Update the playlist drawer title dynamically based on the current queue type
  const drawerTitle = document.getElementById('playlist-drawer-title');
  if (drawerTitle) {
    if (state.currentQueueType === 'playlist') {
      drawerTitle.innerText = `Playlist: ${state.currentPlaylistName || 'Biblioteca'}`;
    } else {
      drawerTitle.innerText = `Pasta: ${state.currentPlaylistName || 'Biblioteca'}`;
    }
  }
  
  const streamUrl = `/api/stream?path=${encodeURIComponent(filePath)}`;
  
  // Load custom track volume if exists
  const savedVolumes = JSON.parse(localStorage.getItem('trackVolumes') || '{}');
  if (savedVolumes[filePath] !== undefined) {
    handleVolumeChange(savedVolumes[filePath]);
  }
  
  elements.player.src = streamUrl;
  elements.player.load();
  
  // Initialize and/or resume Audio Visualizer context
  initAudioVisualizer();
  
  // Play track
  elements.player.play()
    .then(() => {
      state.isPlaying = true;
      updatePlaybackUI(filePath);
      renderSidebarPlaylists();
    })
    .catch(error => {
      console.error("Playback start error:", error);
      showError("Não foi possível reproduzir a música. Verifique o formato.");
    });
}

function togglePlayPause() {
  if (!elements.player.src || elements.player.src === window.location.href) {
    // No track selected yet, play the first track in folder if available
    if (state.playlist.length > 0) {
      playTrackByPath(state.playlist[0].path);
    }
    return;
  }
  
  if (state.isPlaying) {
    elements.player.pause();
    state.isPlaying = false;
    updatePlaybackUI();
  } else {
    // Resume visualizer context
    if (state.audioContext && state.audioContext.state === 'suspended') {
      state.audioContext.resume();
    }
    elements.player.play()
      .then(() => {
        state.isPlaying = true;
        updatePlaybackUI();
      })
      .catch(err => console.error(err));
  }
}

function playNext() {
  if (state.playlist.length === 0) return;
  
  state.currentIndex++;
  if (state.currentIndex >= state.playlist.length) {
    if (state.repeatMode === 1) { // Repeat All
      state.currentIndex = 0;
    } else {
      state.currentIndex = state.playlist.length - 1;
      state.isPlaying = false;
      elements.player.pause();
      updatePlaybackUI();
      return; // Stopped
    }
  }
  
  playTrackByPath(state.playlist[state.currentIndex].path);
}

function playPrevious() {
  if (state.playlist.length === 0) return;
  
  // If track has been playing for more than 3 seconds, restart it instead of going back
  if (elements.player.currentTime > 3) {
    elements.player.currentTime = 0;
    return;
  }
  
  state.currentIndex--;
  if (state.currentIndex < 0) {
    if (state.repeatMode === 1) {
      state.currentIndex = state.playlist.length - 1;
    } else {
      state.currentIndex = 0;
    }
  }
  
  playTrackByPath(state.playlist[state.currentIndex].path);
}

function handlePlaybackEnded() {
  if (state.repeatMode === 2) {
    // Repeat One
    elements.player.currentTime = 0;
    elements.player.play();
  } else {
    // Autoplay next
    playNext();
  }
}

function toggleShuffle() {
  state.isShuffle = !state.isShuffle;
  elements.btnShuffle.classList.toggle('active', state.isShuffle);
  
  if (state.isShuffle) {
    // Backup original alphabetical order
    state.originalPlaylist = [...state.playlist];
    
    // Remember current track so it doesn't interrupt
    const currentTrack = state.playlist[state.currentIndex];
    
    // Fisher-Yates Shuffle on state.playlist
    for (let i = state.playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.playlist[i], state.playlist[j]] = [state.playlist[j], state.playlist[i]];
    }
    
    // Find new index of current track in shuffled array
    if (currentTrack) {
      state.currentIndex = state.playlist.findIndex(t => t.path === currentTrack.path);
    }
  } else {
    // Restore original alphabetical order
    if (state.originalPlaylist && state.originalPlaylist.length > 0) {
      const currentTrack = state.playlist[state.currentIndex];
      state.playlist = [...state.originalPlaylist];
      if (currentTrack) {
        state.currentIndex = state.playlist.findIndex(t => t.path === currentTrack.path);
      }
    }
  }
  
  // Re-render visual list to match new physical sequence
  if (elements.playlistDrawer && elements.playlistDrawer.classList.contains('open')) {
    moveCardToActiveIndex();
  }
}

function toggleRepeat() {
  // Modes: 0 = Off, 1 = Repeat All, 2 = Repeat One
  state.repeatMode = (state.repeatMode + 1) % 3;
  
  if (state.repeatMode === 0) {
    elements.btnRepeat.classList.remove('active');
    elements.repeatBadge.style.display = 'none';
  } else if (state.repeatMode === 1) {
    elements.btnRepeat.classList.add('active');
    elements.repeatBadge.style.display = 'none';
  } else if (state.repeatMode === 2) {
    elements.btnRepeat.classList.add('active');
    elements.repeatBadge.style.display = 'flex';
  }
}

// ----------------------------------------------------
// Custom Slider Dragging Support (No Input Range)
// ----------------------------------------------------

function setupSliderDragging(trackEl, fillEl, handleEl, callback) {
  let isDragging = false;
  
  const getPercentage = (clientX) => {
    const rect = trackEl.getBoundingClientRect();
    const pos = clientX - rect.left;
    let pct = pos / rect.width;
    if (pct < 0) pct = 0;
    if (pct > 1) pct = 1;
    return pct;
  };
  
  const onMouseDown = (e) => {
    isDragging = true;
    trackEl.classList.add('dragging');
    const pct = getPercentage(e.clientX);
    callback(pct);
    
    // Add document-wide drag events
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
  
  const onMouseMove = (e) => {
    if (!isDragging) return;
    const pct = getPercentage(e.clientX);
    callback(pct);
  };
  
  const onMouseUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    trackEl.classList.remove('dragging');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  
  trackEl.addEventListener('mousedown', onMouseDown);
  
  // Touch support for mobile devices
  trackEl.addEventListener('touchstart', (e) => {
    isDragging = true;
    trackEl.classList.add('dragging');
    const pct = getPercentage(e.touches[0].clientX);
    callback(pct);
    
    const onTouchMove = (evt) => {
      if (!isDragging) return;
      const p = getPercentage(evt.touches[0].clientX);
      callback(p);
    };
    
    const onTouchEnd = () => {
      isDragging = false;
      trackEl.classList.remove('dragging');
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
    
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  }, { passive: true });
}

function handleProgressSeek(pct) {
  if (!elements.player.src || isNaN(elements.player.duration)) return;
  const seekTime = pct * elements.player.duration;
  elements.player.currentTime = seekTime;
  updateProgressUI(pct, seekTime);
}

function handleVolumeChange(pct) {
  state.volume = pct;
  elements.player.volume = pct;
  state.isMuted = pct === 0;
  
  updateVolumeUI();
}

// ----------------------------------------------------
// UI Update Sync Functions
// ----------------------------------------------------

function updatePlaybackUI(filePath) {
  // Sync playlist visual playing items
  renderExplorer();
  
  if (state.isPlaying) {
    elements.playIcon.style.display = 'none';
    elements.pauseIcon.style.display = 'block';
    elements.playerBar.classList.add('playing');
    if (elements.canvasCard) elements.canvasCard.classList.add('playing');
  } else {
    elements.playIcon.style.display = 'block';
    elements.pauseIcon.style.display = 'none';
    elements.playerBar.classList.remove('playing');
    if (elements.canvasCard) elements.canvasCard.classList.remove('playing');
  }
  
  if (filePath) {
    const parts = filePath.split('/');
    const title = parts.pop();
    const folder = parts.join('/') || 'Raiz';
    
    // Update player labels
    elements.playerSongTitle.innerText = cleanExtension(title);
    elements.playerSongArtist.innerText = folder;
    
    // Update canvas card labels
    if (elements.canvasSongTitle) elements.canvasSongTitle.innerText = cleanExtension(title);
    if (elements.canvasSongFolder) elements.canvasSongFolder.innerText = folder;
    
    // Update canvas card thumbnail asynchronously
    const isVideo = ['.mp4', '.mkv', '.webm', '.mov', '.avi'].some(ext => filePath.toLowerCase().endsWith(ext));
    if (elements.canvasCardThumb) {
      elements.canvasCardThumb.src = (isVideo && state.loadThumbnails) ? defaultVideoIcon : defaultAudioIcon;
      if (isVideo && state.loadThumbnails) {
        generateVideoThumbnail(filePath).then(dataUrl => {
          const currentPath = decodeURIComponent(new URL(elements.player.src).searchParams.get('path') || '');
          if (dataUrl && currentPath === filePath && elements.canvasCardThumb) {
            elements.canvasCardThumb.src = dataUrl;
          }
        });
      }
    }
    
    // Update active card remove button visibility
    const containingPlaylists = getPlaylistsContainingTrack(filePath);
    const btnCardRemove = document.getElementById('btn-card-remove');
    if (btnCardRemove) {
      btnCardRemove.style.display = containingPlaylists.length > 0 ? 'flex' : 'none';
    }
    
    // Smoothly animate the card to its new active index in the drawer if open
    if (elements.playlistDrawer && elements.playlistDrawer.classList.contains('open')) {
      moveCardToActiveIndex();
    }
    
    // Trigger ghost text title overlay
    triggerGhostTitle(title);
    
    // Update browser title
    document.title = `▶ ${cleanExtension(title)} - FlowPlayer`;
    
    // Check if it's an MP4 file, display/hide placeholder based on whether video panel is open
    const ext = title.substring(title.lastIndexOf('.')).toLowerCase();
    if (ext === '.mp4') {
      elements.videoPlaceholder.style.display = 'none';
    } else {
      elements.videoPlaceholder.style.display = 'flex';
    }
  }
  updateNotesButtonIndicator();
  updateLyricsButtonIndicator();
  updateCustomVolumeButtonIndicator();
}

function updateNotesButtonIndicator() {
  const currentTrack = state.playlist[state.currentIndex];
  const btn = document.getElementById('btn-music-notes');
  if (!btn) return;
  
  if (currentTrack) {
    const allNotes = JSON.parse(localStorage.getItem('musicNotes') || '{}');
    const trackNotes = allNotes[currentTrack.path] || '';
    if (trackNotes.trim().length > 0) {
      btn.classList.add('has-notes');
    } else {
      btn.classList.remove('has-notes');
    }
  } else {
    btn.classList.remove('has-notes');
  }
}

function updateLyricsButtonIndicator() {
  const currentTrack = state.playlist[state.currentIndex];
  const btn = document.getElementById('btn-music-lyrics');
  if (!btn) return;
  
  if (currentTrack) {
    const allLyrics = JSON.parse(localStorage.getItem('musicLyrics') || '{}');
    const trackLyrics = allLyrics[currentTrack.path] || '';
    if (trackLyrics.trim().length > 0) {
      btn.classList.add('has-lyrics');
    } else {
      btn.classList.remove('has-lyrics');
    }
  } else {
    btn.classList.remove('has-lyrics');
  }
}

function updateCustomVolumeButtonIndicator() {
  const currentTrack = state.playlist[state.currentIndex];
  const btn = document.getElementById('btn-save-track-volume');
  if (!btn) return;
  
  if (currentTrack) {
    const savedVolumes = JSON.parse(localStorage.getItem('trackVolumes') || '{}');
    if (savedVolumes[currentTrack.path] !== undefined) {
      btn.classList.add('has-custom-volume');
    } else {
      btn.classList.remove('has-custom-volume');
    }
  } else {
    btn.classList.remove('has-custom-volume');
  }
}

let volumeHudTimeout = null;
function showVolumeHUD(volumePct) {
  let hud = document.getElementById('volume-hud');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'volume-hud';
    hud.className = 'volume-hud-overlay';
    hud.innerHTML = `
      <span class="volume-hud-icon">🔊</span>
      <span class="volume-hud-percentage">0%</span>
      <div class="volume-hud-bar">
        <div class="volume-hud-fill" id="volume-hud-fill"></div>
      </div>
    `;
    document.body.appendChild(hud);
  }
  
  const iconSpan = hud.querySelector('.volume-hud-icon');
  if (volumePct === 0) {
    iconSpan.innerText = '🔇';
  } else if (volumePct < 0.3) {
    iconSpan.innerText = '🔈';
  } else if (volumePct < 0.7) {
    iconSpan.innerText = '🔉';
  } else {
    iconSpan.innerText = '🔊';
  }
  
  hud.querySelector('.volume-hud-percentage').innerText = `${Math.round(volumePct * 100)}%`;
  const fill = hud.querySelector('#volume-hud-fill');
  if (fill) {
    fill.style.width = `${volumePct * 100}%`;
  }
  
  hud.offsetHeight; // force reflow
  hud.classList.add('visible');
  
  if (volumeHudTimeout) {
    clearTimeout(volumeHudTimeout);
  }
  volumeHudTimeout = setTimeout(() => {
    hud.classList.remove('visible');
  }, 1200);
}

function updatePlaybackProgress() {
  if (isNaN(elements.player.currentTime) || isNaN(elements.player.duration)) return;
  const pct = elements.player.currentTime / elements.player.duration;
  updateProgressUI(pct, elements.player.currentTime);
  if (state.showRemainingTime) {
    updateTrackDuration();
  }
}

function updateProgressUI(pct, time) {
  elements.progressFill.style.width = `${pct * 100}%`;
  elements.progressHandle.style.left = `${pct * 100}%`;
  elements.timeElapsed.innerText = formatTime(time);
  
  // Update discreet progress bars in the panels
  const videoProgress = document.getElementById('video-panel-progress');
  const notesProgress = document.getElementById('notes-panel-progress');
  const lyricsProgress = document.getElementById('lyrics-panel-progress');
  if (videoProgress) videoProgress.style.width = `${pct * 100}%`;
  if (notesProgress) notesProgress.style.width = `${pct * 100}%`;
  if (lyricsProgress) lyricsProgress.style.width = `${pct * 100}%`;
}

function updateTrackDuration() {
  if (isNaN(elements.player.duration)) return;
  if (state.showRemainingTime) {
    const remaining = Math.max(0, elements.player.duration - elements.player.currentTime);
    elements.timeDuration.innerText = `-${formatTime(remaining)}`;
  } else {
    elements.timeDuration.innerText = formatTime(elements.player.duration);
  }
}

function updateVolumeUI() {
  const volPct = Math.round(state.volume * 100);
  elements.volumeFill.style.width = `${state.volume * 100}%`;
  elements.volumeHandle.style.left = `${state.volume * 100}%`;
  
  const tooltip = document.getElementById('volume-tooltip');
  if (tooltip) {
    tooltip.innerText = `${volPct}%`;
    tooltip.style.left = `${state.volume * 100}%`;
  }
  
  if (state.isMuted || state.volume === 0) {
    elements.volumeHigh.style.display = 'none';
    elements.volumeMuted.style.display = 'block';
  } else {
    elements.volumeHigh.style.display = 'block';
    elements.volumeMuted.style.display = 'none';
  }
}

function toggleMute() {
  state.isMuted = !state.isMuted;
  
  if (state.isMuted) {
    state.preMuteVolume = state.volume;
    state.volume = 0;
    elements.player.volume = 0;
  } else {
    state.volume = state.preMuteVolume > 0 ? state.preMuteVolume : 0.7;
    elements.player.volume = state.volume;
  }
  
  updateVolumeUI();
}

// ----------------------------------------------------
// Views & Layout panels toggle
// ----------------------------------------------------

function switchView(viewName) {
  if (viewName === 'explorer') {
    elements.btnLibrary.classList.add('active');
    elements.btnVisualizerToggle.classList.remove('active');
    elements.viewExplorer.classList.add('active');
    elements.viewVisualizer.classList.remove('active');
    if (elements.mainHeader) {
      elements.mainHeader.style.display = 'flex';
    }
    
    // Cleanly close playlist drawer if moving away from visualizer view
    if (elements.playlistDrawer && elements.playlistDrawer.classList.contains('open')) {
      togglePlaylistDrawer();
    }
  } else if (viewName === 'visualizer') {
    elements.btnLibrary.classList.remove('active');
    elements.btnVisualizerToggle.classList.add('active');
    elements.viewExplorer.classList.remove('active');
    elements.viewVisualizer.classList.add('active');
    if (elements.mainHeader) {
      elements.mainHeader.style.display = 'none';
    }
    
    // Canvas sizing initialization on open
    setTimeout(() => {
      resizeCanvas();
    }, 100);
  }
}

// Video floating screen operations
function toggleVideoPanel() {
  const isActive = elements.videoPanel.classList.contains('active');
  if (isActive) {
    elements.videoPanel.classList.remove('active');
    elements.btnVideoToggle.classList.remove('active');
    elements.videoPanel.classList.remove('minimized');
    
    // Clear dimensions to restore defaults
    elements.videoPanel.style.width = '';
    elements.videoPanel.style.left = '';
    elements.videoPanel.style.top = '';
    elements.videoPanel.style.right = '';
    elements.videoPanel.style.bottom = '';
    const videoWrapper = elements.videoPanel.querySelector('.video-wrapper');
    if (videoWrapper) videoWrapper.style.height = '';
    
    if (elements.visualizerVideoToggle) {
      elements.visualizerVideoToggle.checked = false;
    }
  } else {
    // Always reset to standard dimensions when opening
    elements.videoPanel.style.width = '';
    elements.videoPanel.style.left = '';
    elements.videoPanel.style.top = '';
    elements.videoPanel.style.right = '';
    elements.videoPanel.style.bottom = '';
    const videoWrapper = elements.videoPanel.querySelector('.video-wrapper');
    if (videoWrapper) videoWrapper.style.height = '';
    
    elements.videoPanel.classList.add('active');
    elements.btnVideoToggle.classList.add('active');
    elements.videoPanel.classList.remove('minimized');
    if (elements.visualizerVideoToggle) {
      elements.visualizerVideoToggle.checked = true;
    }
  }
}

function minimizeVideoPanel() {
  const isMinimized = elements.videoPanel.classList.contains('minimized');
  const videoWrapper = elements.videoPanel.querySelector('.video-wrapper');
  const minimizeBtn = document.getElementById('btn-minimize-video');
  
  if (!isMinimized) {
    // Save current width, height coordinates before minimizing
    state.savedWidth = elements.videoPanel.style.width;
    state.savedHeight = videoWrapper ? videoWrapper.style.height : '';
    
    // Add minimized class
    elements.videoPanel.classList.add('minimized');
    
    // Clear inline dimensions width/height so CSS stylesheet rules take over (leaves positions left/top untouched!)
    elements.videoPanel.style.width = '';
    if (videoWrapper) videoWrapper.style.height = '';
    
    if (minimizeBtn) {
      minimizeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
      minimizeBtn.title = "Maximizar";
    }
  } else {
    // Remove minimized class
    elements.videoPanel.classList.remove('minimized');
    
    // Restore custom dimensions if they exist
    if (state.savedWidth) elements.videoPanel.style.width = state.savedWidth;
    if (state.savedHeight && videoWrapper) videoWrapper.style.height = state.savedHeight;
    
    if (minimizeBtn) {
      minimizeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
      minimizeBtn.title = "Minimizar";
    }
  }
}

// ----------------------------------------------------
// Web Audio API Visualizer Engine
// ----------------------------------------------------

function initAudioVisualizer() {
  if (state.audioContext) {
    // Resume context if suspended (browser rule)
    if (state.audioContext.state === 'suspended') {
      state.audioContext.resume();
    }
    return;
  }
  
  try {
    // Create AudioContext
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContext();
    
    // Create AnalyserNode
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256; // 128 bins
    
    // Connect <video> source to Analyser
    state.source = state.audioContext.createMediaElementSource(elements.player);
    state.source.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);
    
    const bufferLength = state.analyser.frequencyBinCount;
    state.dataArray = new Uint8Array(bufferLength);
    
    // Trigger visualizer canvas drawing loop
    drawVisualizer();
    
  } catch (e) {
    console.error("Audio Context initialization failed (might be CORS or security context):", e);
  }
}

function drawVisualizer() {
  state.animationId = requestAnimationFrame(drawVisualizer);
  
  if (!state.analyser || !elements.visualizerCanvas) return;
  
  const canvas = elements.visualizerCanvas;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // Clear canvas
  ctx.fillStyle = '#06040c';
  ctx.fillRect(0, 0, width, height);
  
  if (!state.isPlaying) {
    // Draw resting line when paused
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(${activeThemeColorRGB}, 0.2)`;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    return;
  }
  
  state.analyser.getByteFrequencyData(state.dataArray);
  const bufferLength = state.analyser.frequencyBinCount;
  
  // Custom Visualizer Styles
  if (state.visualizerTheme === 'bars') {
    const barWidth = (width / bufferLength) * 1.5;
    let barHeight;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      barHeight = (state.dataArray[i] * state.sensitivity) * 0.8;
      
      const grad = ctx.createLinearGradient(0, height, 0, height - barHeight);
      grad.addColorStop(0, `rgba(${activeThemeColorRGB}, 0.3)`);
      grad.addColorStop(0.6, activeThemeColorHex);
      grad.addColorStop(1, '#ffffff');
      
      ctx.fillStyle = grad;
      ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
      
      x += barWidth;
    }
  } 
  else if (state.visualizerTheme === 'wave') {
    // Time Domain Data for Waveform representation
    const timeDomainArray = new Uint8Array(bufferLength);
    state.analyser.getByteTimeDomainData(timeDomainArray);
    
    ctx.lineWidth = 3;
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, `rgba(${activeThemeColorRGB}, 0.2)`);
    grad.addColorStop(0.5, activeThemeColorHex);
    grad.addColorStop(1, `rgba(${activeThemeColorRGB}, 0.2)`);
    ctx.strokeStyle = grad;
    
    ctx.beginPath();
    const sliceWidth = width / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const v = timeDomainArray[i] / 128.0;
      const y = (v * height / 2) + ((v - 1) * state.sensitivity * 5);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  } 
  else if (state.visualizerTheme === 'circle') {
    const centerX = width / 2;
    const centerY = height / 2;
    // Calculate volume index
    let totalFreq = 0;
    for (let i = 0; i < bufferLength; i++) {
      totalFreq += state.dataArray[i];
    }
    const avgVolume = totalFreq / bufferLength;
    const baseRadius = 80 + (avgVolume * state.sensitivity * 0.2);
    
    // Draw pulsing center background circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(${activeThemeColorRGB}, 0.05)`;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${activeThemeColorRGB}, 0.2)`;
    ctx.stroke();
    
    // Draw explosion of bars around circle
    const numBars = 60;
    for (let i = 0; i < numBars; i++) {
      // Map index to frequency array
      const freqIndex = Math.floor((i / numBars) * bufferLength);
      const amplitude = state.dataArray[freqIndex] * state.sensitivity * 0.6;
      
      const angle = (i / numBars) * 2 * Math.PI;
      const xStart = centerX + Math.cos(angle) * baseRadius;
      const yStart = centerY + Math.sin(angle) * baseRadius;
      const xEnd = centerX + Math.cos(angle) * (baseRadius + amplitude);
      const yEnd = centerY + Math.sin(angle) * (baseRadius + amplitude);
      
      const grad = ctx.createLinearGradient(xStart, yStart, xEnd, yEnd);
      grad.addColorStop(0, activeThemeColorHex);
      grad.addColorStop(1, '#ffffff');
      
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xStart, yStart);
      ctx.lineTo(xEnd, yEnd);
      ctx.stroke();
    }
  }
  else if (state.visualizerTheme === 'retro') {
    const gridCols = 32;
    const gridRows = 16;
    const blockWidth = width / gridCols;
    const blockHeight = height / gridRows;
    
    for (let c = 0; c < gridCols; c++) {
      const freqIndex = Math.floor((c / gridCols) * bufferLength);
      const colVolume = state.dataArray[freqIndex] * state.sensitivity;
      const activeRows = Math.floor((colVolume / 255) * gridRows);
      
      for (let r = 0; r < gridRows; r++) {
        const isLit = r < activeRows;
        if (isLit) {
          // Color based on height
          const ratio = r / gridRows;
          if (ratio > 0.8) ctx.fillStyle = '#ffffff'; // White top
          else if (ratio > 0.4) ctx.fillStyle = activeThemeColorHex; // Theme mid
          else ctx.fillStyle = `rgba(${activeThemeColorRGB}, 0.4)`; // Theme low transparent
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        }
        
        ctx.fillRect(
          c * blockWidth + 1,
          height - (r * blockHeight) - blockHeight + 1,
          blockWidth - 2,
          blockHeight - 2
        );
      }
    }
  }
}

function resizeCanvas() {
  const canvas = elements.visualizerCanvas;
  if (!canvas) return;
  const rect = canvas.parentNode.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

// ----------------------------------------------------
// Utility Functions
// ----------------------------------------------------

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatTime(secs) {
  if (isNaN(secs)) return '0:00';
  const minutes = Math.floor(secs / 60);
  const seconds = Math.floor(secs % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function cleanExtension(fileName) {
  if (!fileName) return '';
  return fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
}

function triggerGhostTitle(fileName) {
  if (state.ghostTitleTimeout) {
    clearTimeout(state.ghostTitleTimeout);
  }
  
  const ghostOverlay = document.getElementById('ghost-title-overlay');
  const ghostText = document.getElementById('ghost-title-text');
  
  if (ghostOverlay && ghostText) {
    ghostText.innerText = cleanExtension(fileName);
    
    // Reset animation states instantly (without transition)
    ghostOverlay.style.transition = 'none';
    ghostOverlay.classList.remove('active');
    ghostOverlay.offsetHeight; // Force reflow layout check
    
    // Start animation transition
    ghostOverlay.style.transition = 'opacity 1s ease, transform 5s cubic-bezier(0.1, 0.8, 0.25, 1)';
    ghostOverlay.classList.add('active');
    
    // Fade out after 5 seconds
    state.ghostTitleTimeout = setTimeout(() => {
      ghostOverlay.classList.remove('active');
    }, 5000);
  }
}

function showLoading(isLoading) {
  if (isLoading) {
    elements.explorerContainer.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Carregando diretório...</p>
      </div>
    `;
  }
}

function showError(msg) {
  elements.explorerContainer.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="#d90429" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p style="color: #ff4d6d; font-weight: 600;">Ocorreu um erro</p>
      <p style="font-size: 13px; margin-top: 4px;">${msg}</p>
    </div>
  `;
}

// ----------------------------------------------------
// Drag and Resize Implementation for Floating Panel
// ----------------------------------------------------
function setupDragAndResize() {
  const panel = elements.videoPanel;
  const header = document.querySelector('.video-panel-header');
  const handle = elements.videoResizeHandle;
  
  if (!panel || !header || !handle) return;
  
  // Dragging state variables
  let dragStartX = 0, dragStartY = 0;
  let panelStartX = 0, panelStartY = 0;
  let isDragging = false;
  
  header.style.cursor = 'move';
  
  header.addEventListener('mousedown', (e) => {
    // Only drag with primary mouse button
    if (e.button !== 0) return;
    
    e.preventDefault();
    
    const rect = panel.getBoundingClientRect();
    
    // Convert computed right/top stylesheet rules to inline coordinates for free dragging
    panel.style.left = rect.left + 'px';
    panel.style.top = rect.top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    panelStartX = rect.left;
    panelStartY = rect.top;
    isDragging = true;
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
  
  function onMouseMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    
    let newTop = panelStartY + dy;
    let newLeft = panelStartX + dx;
    
    // Boundary check so window is always readable inside viewport
    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    
    newTop = Math.max(0, Math.min(viewHeight - 60, newTop));
    newLeft = Math.max(-panelWidth / 2, Math.min(viewWidth - panelWidth / 2, newLeft));
    
    panel.style.top = newTop + 'px';
    panel.style.left = newLeft + 'px';
  }
  
  function onMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
  
  // Resizing state variables
  let resizeStartX = 0, resizeStartY = 0;
  let panelStartWidth = 0, panelStartHeight = 0;
  let panelStartLeft = 0;
  let isResizing = false;
  let isResizingLeft = false;
  
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation(); // Stop propagation to prevent header dragging
    
    if (panel.classList.contains('minimized')) {
      minimizeVideoPanel();
    }
    
    const rect = panel.getBoundingClientRect();
    panel.style.left = rect.left + 'px';
    panel.style.top = rect.top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    panelStartWidth = rect.width;
    panelStartHeight = rect.height;
    isResizing = true;
    
    document.addEventListener('mousemove', onResizeMouseMove);
    document.addEventListener('mouseup', onResizeMouseUp);
  });
  
  function onResizeMouseMove(e) {
    if (!isResizing) return;
    e.preventDefault();
    
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;
    
    const newWidth = Math.max(240, Math.min(800, panelStartWidth + dx));
    const newHeight = Math.max(180, Math.min(600, panelStartHeight + dy));
    
    panel.style.width = newWidth + 'px';
    
    const videoWrapper = panel.querySelector('.video-wrapper');
    if (videoWrapper) {
      // Header has height of ~45px, adjust wrapper to take remaining height
      videoWrapper.style.height = (newHeight - 45) + 'px';
    }
  }
  
  function onResizeMouseUp() {
    isResizing = false;
    document.removeEventListener('mousemove', onResizeMouseMove);
    document.removeEventListener('mouseup', onResizeMouseUp);
  }

  // Left resize handle dragging
  const handleLeft = elements.videoResizeHandleLeft;
  if (handleLeft) {
    handleLeft.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      
      if (panel.classList.contains('minimized')) {
        minimizeVideoPanel();
      }
      
      const rect = panel.getBoundingClientRect();
      panel.style.left = rect.left + 'px';
      panel.style.top = rect.top + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      panelStartWidth = rect.width;
      panelStartHeight = rect.height;
      panelStartLeft = rect.left;
      isResizingLeft = true;
      
      document.addEventListener('mousemove', onResizeLeftMouseMove);
      document.addEventListener('mouseup', onResizeLeftMouseUp);
    });
  }
  
  function onResizeLeftMouseMove(e) {
    if (!isResizingLeft) return;
    e.preventDefault();
    
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;
    
    let newWidth = panelStartWidth - dx;
    let newLeft = panelStartLeft + dx;
    
    if (newWidth < 240) {
      const diff = 240 - newWidth;
      newWidth = 240;
      newLeft = newLeft - diff;
    } else if (newWidth > 800) {
      const diff = newWidth - 800;
      newWidth = 800;
      newLeft = newLeft + diff;
    }
    
    const newHeight = Math.max(180, Math.min(600, panelStartHeight + dy));
    
    panel.style.width = newWidth + 'px';
    panel.style.left = newLeft + 'px';
    
    const videoWrapper = panel.querySelector('.video-wrapper');
    if (videoWrapper) {
      videoWrapper.style.height = (newHeight - 45) + 'px';
    }
  }
  
  function onResizeLeftMouseUp() {
    isResizingLeft = false;
    document.removeEventListener('mousemove', onResizeLeftMouseMove);
    document.removeEventListener('mouseup', onResizeLeftMouseUp);
  }
}

// ----------------------------------------------------
// FLIP Transition and Rendering for Playlist Drawer
// ----------------------------------------------------
function togglePlaylistDrawer() {
  const wrapper = elements.canvasCardWrapper;
  const drawer = elements.playlistDrawer;
  const card = elements.canvasCard;
  const listContainer = elements.playlistDrawerList;
  const btn = elements.btnCanvasPlaylist;
  
  if (!drawer || !card || !listContainer || !wrapper || !btn) return;
  
  const isOpen = drawer.classList.contains('open');
  const span = btn.querySelector('span');
  
  // FLIP: Record the FIRST bounding rectangle
  const firstRect = card.getBoundingClientRect();
  
  if (isOpen) {
    // Closing action
    btn.classList.remove('active');
    if (span) span.innerText = 'Exibir lista de reprodução';
    drawer.classList.remove('open');
    
    // Move card back to absolute canvas wrapper
    wrapper.appendChild(card);
    card.classList.remove('in-drawer');
    
    // FLIP: Record the LAST bounding rectangle
    const lastRect = card.getBoundingClientRect();
    
    // FLIP: Invert position changes using CSS translate
    const dx = firstRect.left - lastRect.left;
    const dy = firstRect.top - lastRect.top;
    
    card.style.transition = 'none';
    card.style.transform = `translate(${dx}px, ${dy}px)`;
    card.offsetHeight; // Force browser layout recalculation
    
    // FLIP: Play animation back to standard layout position
    card.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
    card.style.transform = 'translate(0, 0)';
  } else {
    // Opening action
    btn.classList.add('active');
    if (span) span.innerText = 'esconder lista de reprodução';
    
    // Populate drawer rows, skipping the index slot of current track
    renderDrawerPlaylist();
    
    drawer.classList.add('open');
    
    // Find slot for active song and replace placeholder with real card
    const placeholder = listContainer.querySelector('.playlist-placeholder-slot');
    if (placeholder) {
      listContainer.replaceChild(card, placeholder);
    } else {
      listContainer.appendChild(card);
    }
    card.classList.add('in-drawer');
    
    // FLIP: Record the LAST bounding rectangle
    const lastRect = card.getBoundingClientRect();
    
    // FLIP: Invert position changes
    const dx = firstRect.left - lastRect.left;
    const dy = firstRect.top - lastRect.top;
    
    card.style.transition = 'none';
    card.style.transform = `translate(${dx}px, ${dy}px)`;
    card.offsetHeight; // Force reflow check
    
    // FLIP: Play animation
    card.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
    card.style.transform = 'translate(0, 0)';
    
    // Scroll active item smoothly into view
    setTimeout(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 200);
  }
}

function moveCardToActiveIndex() {
  const card = elements.canvasCard;
  const listContainer = elements.playlistDrawerList;
  const drawer = elements.playlistDrawer;
  
  if (!card || !listContainer || !drawer || !drawer.classList.contains('open')) return;
  
  const activeTrack = state.playlist[state.currentIndex];
  if (activeTrack) {
    const containingPlaylists = getPlaylistsContainingTrack(activeTrack.path);
    const btnCardRemove = document.getElementById('btn-card-remove');
    if (btnCardRemove) {
      btnCardRemove.style.display = containingPlaylists.length > 0 ? 'flex' : 'none';
    }
  }
  
  // FLIP: Record FIRST state
  const firstRect = card.getBoundingClientRect();
  
  // Move card temporarily to body to prevent duplication or deletion during re-render
  document.body.appendChild(card);
  
  // Rebuild the drawer tracks list
  renderDrawerPlaylist();
  
  // Find new slot and insert active card
  const placeholder = listContainer.querySelector('.playlist-placeholder-slot');
  if (placeholder) {
    listContainer.replaceChild(card, placeholder);
  } else {
    listContainer.appendChild(card);
  }
  card.classList.add('in-drawer');
  
  // FLIP: Record LAST state
  const lastRect = card.getBoundingClientRect();
  
  // FLIP: Invert position changes
  const dx = firstRect.left - lastRect.left;
  const dy = firstRect.top - lastRect.top;
  
  card.style.transition = 'none';
  card.style.transform = `translate(${dx}px, ${dy}px)`;
  card.offsetHeight; // Force reflow check
  
  // FLIP: Play slide animation
  card.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
  card.style.transform = 'translate(0, 0)';
  
  // Scroll active item smoothly into view
  setTimeout(() => {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 150);
}

function renderDrawerPlaylist() {
  const listContainer = elements.playlistDrawerList;
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  
  if (state.playlist.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state" style="padding: 20px 0;">
        <p style="font-size: 12px; color: var(--text-muted);">Fila de reprodução vazia</p>
      </div>
    `;
    return;
  }
  
  state.playlist.forEach((track, index) => {
    // For currently playing track, render a temporary hidden slot to hold its index position
    if (index === state.currentIndex) {
      const placeholder = document.createElement('div');
      placeholder.className = 'playlist-placeholder-slot';
      placeholder.style.height = '74px';
      placeholder.style.display = 'none';
      listContainer.appendChild(placeholder);
      return;
    }
    
    const itemEl = document.createElement('div');
    itemEl.className = 'playlist-drawer-item';
    
    const parts = track.path.split('/');
    const cleanName = cleanExtension(track.name);
    parts.pop();
    const folderName = parts.join('/') || 'Raiz';
    
    const isVideo = ['.mp4', '.mkv', '.webm', '.mov', '.avi'].some(ext => track.path.toLowerCase().endsWith(ext));
    const defaultSrc = (isVideo && state.loadThumbnails) ? defaultVideoIcon : defaultAudioIcon;
    
    const containingPlaylists = getPlaylistsContainingTrack(track.path);
    
    itemEl.innerHTML = `
      <div class="playlist-item-thumb-wrapper">
        <img class="playlist-item-thumb" src="${defaultSrc}" alt="Thumbnail">
        <div class="playlist-item-badge-num">${index + 1}</div>
        <button class="playlist-thumb-btn add-btn" title="Adicionar à Playlist">+</button>
        ${containingPlaylists.length > 0 ? `
          <button class="playlist-thumb-btn remove-btn" title="Remover da Playlist">-</button>
        ` : ''}
      </div>
      <div class="playlist-item-info">
        <div class="playlist-item-title" title="${cleanName}">${cleanName}</div>
        <div class="playlist-item-folder" title="${folderName}">${folderName}</div>
      </div>
      <div class="playlist-item-actions">
        <button class="reorder-btn up-btn" title="Mover para Cima">▲</button>
        <button class="reorder-btn down-btn" title="Mover para Baixo">▼</button>
      </div>
    `;
    
    if (isVideo && state.loadThumbnails) {
      const imgEl = itemEl.querySelector('.playlist-item-thumb');
      generateVideoThumbnail(track.path).then(dataUrl => {
        if (dataUrl && imgEl) {
          imgEl.src = dataUrl;
        }
      });
    }
    
    const btnUp = itemEl.querySelector('.up-btn');
    const btnDown = itemEl.querySelector('.down-btn');
    const btnAdd = itemEl.querySelector('.add-btn');
    const btnRemove = itemEl.querySelector('.remove-btn');
    
    if (btnUp) {
      btnUp.addEventListener('click', (e) => {
        e.stopPropagation();
        movePlaylistItem(index, 'up');
      });
    }
    if (btnDown) {
      btnDown.addEventListener('click', (e) => {
        e.stopPropagation();
        movePlaylistItem(index, 'down');
      });
    }
    if (btnAdd) {
      btnAdd.addEventListener('click', (e) => {
        e.stopPropagation();
        showAddToPlaylistMenu(e, track);
      });
    }
    if (btnRemove) {
      btnRemove.addEventListener('click', (e) => {
        e.stopPropagation();
        showRemoveFromPlaylistMenu(e, track.path, track.name);
      });
    }
    
    itemEl.addEventListener('click', () => {
      playTrackByPath(track.path);
    });
    
    listContainer.appendChild(itemEl);
  });
}

function generateVideoThumbnail(videoPath) {
  if (thumbnailCache.has(videoPath)) {
    return Promise.resolve(thumbnailCache.get(videoPath));
  }
  
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = `/api/stream?path=${encodeURIComponent(videoPath)}`;
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    video.addEventListener('loadedmetadata', () => {
      const seekTime = Math.min(30, video.duration / 2 || 0);
      video.currentTime = seekTime;
    });
    
    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 160;
        const ctx = canvas.getContext('2d');
        
        const minDim = Math.min(video.videoWidth, video.videoHeight);
        const sx = (video.videoWidth - minDim) / 2;
        const sy = (video.videoHeight - minDim) / 2;
        
        ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, 160, 160);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        thumbnailCache.set(videoPath, dataUrl);
        resolve(dataUrl);
      } catch (e) {
        console.error("Error drawing thumbnail for", videoPath, e);
        resolve(null);
      }
      video.src = '';
      video.load();
    });
    
    video.addEventListener('error', () => {
      resolve(null);
    });
    
    setTimeout(() => {
      resolve(null);
      video.src = '';
    }, 4000);
  });
}

function movePlaylistItem(index, direction) {
  if (direction === 'up' && index > 0) {
    const currentTrack = state.playlist[state.currentIndex];
    
    // Swap items
    const temp = state.playlist[index];
    state.playlist[index] = state.playlist[index - 1];
    state.playlist[index - 1] = temp;
    
    if (currentTrack) {
      state.currentIndex = state.playlist.findIndex(t => t.path === currentTrack.path);
    }
    moveCardToActiveIndex();
  } else if (direction === 'down' && index < state.playlist.length - 1) {
    const currentTrack = state.playlist[state.currentIndex];
    
    // Swap items
    const temp = state.playlist[index];
    state.playlist[index] = state.playlist[index + 1];
    state.playlist[index + 1] = temp;
    
    if (currentTrack) {
      state.currentIndex = state.playlist.findIndex(t => t.path === currentTrack.path);
    }
    moveCardToActiveIndex();
  }
}

// ----------------------------------------------------
// Custom Playlist Management Logic
// ----------------------------------------------------

function createPlaylist(name) {
  if (state.userPlaylists[name]) {
    alert("Já existe uma playlist com esse nome!");
    return;
  }
  
  state.userPlaylists[name] = [];
  state.userPlaylistOrder.push(name);
  localStorage.setItem('userPlaylists', JSON.stringify(state.userPlaylists));
  localStorage.setItem('userPlaylistOrder', JSON.stringify(state.userPlaylistOrder));
  renderSidebarPlaylists();
}

function loadPlaylistByName(playlistName) {
  const playlistTracks = state.userPlaylists[playlistName];
  if (!playlistTracks || playlistTracks.length === 0) {
    alert("Esta playlist está vazia! Adicione músicas nela a partir do Explorer.");
    return;
  }
  
  // Set current playlist to the tracks inside the user playlist
  state.currentQueueType = 'playlist';
  state.currentPlaylistName = playlistName;
  state.playlist = [...playlistTracks];
  state.originalPlaylist = [...state.playlist];
  
  // Reset shuffle state to match the playlist order
  state.isShuffle = false;
  elements.btnShuffle.classList.remove('active');
  
  // Play the first track
  playTrackByPath(state.playlist[0].path);
  
  // Switch view to visualizer
  switchView('visualizer');
  
  // Open the playlist drawer to show the tracks list on the right side
  if (elements.playlistDrawer && !elements.playlistDrawer.classList.contains('open')) {
    elements.playlistDrawer.classList.add('open');
    elements.btnCanvasPlaylist.classList.add('active');
    const toggleLabel = elements.btnCanvasPlaylist.querySelector('span') || elements.btnCanvasPlaylist;
    if (toggleLabel) toggleLabel.innerText = 'esconder lista de reprodução';
  }
  
  // Force update active index in drawer
  moveCardToActiveIndex();
}

function deletePlaylist(playlistName, event) {
  event.stopPropagation(); // Prevent loading the playlist
  if (confirm(`Tem certeza que deseja excluir a playlist "${playlistName}"?`)) {
    delete state.userPlaylists[playlistName];
    state.userPlaylistOrder = state.userPlaylistOrder.filter(n => n !== playlistName);
    localStorage.setItem('userPlaylists', JSON.stringify(state.userPlaylists));
    localStorage.setItem('userPlaylistOrder', JSON.stringify(state.userPlaylistOrder));
    renderSidebarPlaylists();
  }
}

function movePlaylist(index, direction) {
  if (direction === 'up' && index > 0) {
    const temp = state.userPlaylistOrder[index];
    state.userPlaylistOrder[index] = state.userPlaylistOrder[index - 1];
    state.userPlaylistOrder[index - 1] = temp;
    localStorage.setItem('userPlaylistOrder', JSON.stringify(state.userPlaylistOrder));
    renderSidebarPlaylists();
  } else if (direction === 'down' && index < state.userPlaylistOrder.length - 1) {
    const temp = state.userPlaylistOrder[index];
    state.userPlaylistOrder[index] = state.userPlaylistOrder[index + 1];
    state.userPlaylistOrder[index + 1] = temp;
    localStorage.setItem('userPlaylistOrder', JSON.stringify(state.userPlaylistOrder));
    renderSidebarPlaylists();
  }
}

function getPlaylistsContainingTrack(trackPath) {
  const containingPlaylists = [];
  for (const plName in state.userPlaylists) {
    if (state.userPlaylists[plName].some(t => t.path === trackPath)) {
      containingPlaylists.push(plName);
    }
  }
  return containingPlaylists;
}

function removeTrackFromPlaylist(playlistName, trackPath) {
  if (!state.userPlaylists[playlistName]) return;
  
  state.userPlaylists[playlistName] = state.userPlaylists[playlistName].filter(t => t.path !== trackPath);
  localStorage.setItem('userPlaylists', JSON.stringify(state.userPlaylists));
  
  // If active queue is playing this playlist, update it dynamically
  if (state.currentQueueType === 'playlist' && state.currentPlaylistName === playlistName) {
    state.playlist = state.playlist.filter(t => t.path !== trackPath);
    state.originalPlaylist = state.originalPlaylist.filter(t => t.path !== trackPath);
    
    const playingPath = elements.player.src ? decodeURIComponent(new URL(elements.player.src).searchParams.get('path') || '') : '';
    if (playingPath === trackPath) {
      if (state.playlist.length > 0) {
        state.currentIndex = Math.min(state.currentIndex, state.playlist.length - 1);
        playTrackByPath(state.playlist[state.currentIndex].path);
      } else {
        elements.player.pause();
        state.isPlaying = false;
        state.currentIndex = -1;
        updatePlaybackUI();
      }
    } else {
      state.currentIndex = state.playlist.findIndex(t => t.path === playingPath);
    }
    
    renderDrawerPlaylist();
    moveCardToActiveIndex();
  }
  
  showToast(`Música removida de "${playlistName}"`);
  renderExplorer();
  renderSidebarPlaylists();
}

function showRemoveFromPlaylistMenu(e, trackPath, trackName) {
  e.stopPropagation();
  
  const existing = document.querySelector('.add-playlist-menu-popup');
  if (existing) existing.remove();
  
  const containingPlaylists = getPlaylistsContainingTrack(trackPath);
  if (containingPlaylists.length === 0) return;
  
  const menu = document.createElement('div');
  menu.className = 'add-playlist-menu-popup';
  menu.style.position = 'fixed';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  
  let html = `<div class="menu-popup-header">Remover de:</div>`;
  containingPlaylists.forEach(plName => {
    html += `<div class="menu-popup-item" data-playlist="${plName}">${plName}</div>`;
  });
  
  menu.innerHTML = html;
  document.body.appendChild(menu);
  
  const closeMenu = (event) => {
    if (!menu.contains(event.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 50);
  
  menu.querySelectorAll('.menu-popup-item').forEach(item => {
    item.addEventListener('click', () => {
      const plName = item.getAttribute('data-playlist');
      removeTrackFromPlaylist(plName, trackPath);
      menu.remove();
      document.removeEventListener('click', closeMenu);
    });
  });
}

function addTrackToPlaylist(playlistName, track) {
  if (!state.userPlaylists[playlistName]) {
    state.userPlaylists[playlistName] = [];
  }
  
  // Prevent duplicate tracks in the same playlist
  const alreadyExists = state.userPlaylists[playlistName].some(t => t.path === track.path);
  if (alreadyExists) {
    alert(`"${cleanExtension(track.name)}" já está na playlist "${playlistName}".`);
    return;
  }
  
  state.userPlaylists[playlistName].push(track);
  localStorage.setItem('userPlaylists', JSON.stringify(state.userPlaylists));
  
  // Update playlist count in the list UI
  renderSidebarPlaylists();
}

function showAddToPlaylistMenu(e, track) {
  e.stopPropagation(); // Prevent playing track
  
  // Remove existing menus
  const existing = document.querySelector('.add-playlist-menu-popup');
  if (existing) existing.remove();
  
  const playlistNames = state.userPlaylistOrder || [];
  if (playlistNames.length === 0) {
    alert("Crie uma playlist primeiro no menu lateral!");
    return;
  }
  
  const menu = document.createElement('div');
  menu.className = 'add-playlist-menu-popup';
  menu.style.position = 'fixed';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  
  let html = `<div class="menu-popup-header">Adicionar a:</div>`;
  playlistNames.forEach(name => {
    html += `<div class="menu-popup-item" data-playlist="${name}">${name}</div>`;
  });
  
  menu.innerHTML = html;
  document.body.appendChild(menu);
  
  // Close on clicking outside
  const closeMenu = (event) => {
    if (!menu.contains(event.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  // Delay to prevent immediate close
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 50);
  
  // Handle item click
  menu.querySelectorAll('.menu-popup-item').forEach(item => {
    item.addEventListener('click', () => {
      const plName = item.getAttribute('data-playlist');
      addTrackToPlaylist(plName, track);
      menu.remove();
      document.removeEventListener('click', closeMenu);
    });
  });
}

function renderSidebarPlaylists() {
  const listContainer = document.getElementById('playlist-sidebar-list');
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  
  const playlistNames = state.userPlaylistOrder || [];
  if (playlistNames.length === 0) {
    listContainer.innerHTML = `
      <div style="padding: 12px; text-align: center; font-size: 11px; color: var(--text-muted);">
        Nenhuma playlist criada.
      </div>
    `;
    return;
  }
  
  playlistNames.forEach((name, index) => {
    const tracksCount = state.userPlaylists[name] ? state.userPlaylists[name].length : 0;
    const itemEl = document.createElement('div');
    itemEl.className = 'playlist-sidebar-item';
    if (state.currentQueueType === 'playlist' && state.currentPlaylistName === name) {
      itemEl.classList.add('active');
    }
    
    itemEl.innerHTML = `
      <div class="playlist-sidebar-item-info">
        <div class="playlist-sidebar-item-name" title="${name}">${name}</div>
        <div class="playlist-sidebar-item-count">${tracksCount} ${tracksCount === 1 ? 'música' : 'músicas'}</div>
      </div>
      <div class="playlist-sidebar-actions">
        <button class="reorder-btn playlist-up-btn" title="Mover para Cima">▲</button>
        <button class="reorder-btn playlist-down-btn" title="Mover para Baixo">▼</button>
        <button class="btn-delete-playlist" title="Excluir Playlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    
    itemEl.addEventListener('click', () => {
      loadPlaylistByName(name);
    });
    
    const deleteBtn = itemEl.querySelector('.btn-delete-playlist');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        deletePlaylist(name, e);
      });
    }
    
    const upBtn = itemEl.querySelector('.playlist-up-btn');
    if (upBtn) {
      upBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        movePlaylist(index, 'up');
      });
    }
    
    const downBtn = itemEl.querySelector('.playlist-down-btn');
    if (downBtn) {
      downBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        movePlaylist(index, 'down');
      });
    }
    
    listContainer.appendChild(itemEl);
  });
}

function showToast(message, isError = false) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 110px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: rgba(var(--theme-bg-dark-rgb), 0.9);
    backdrop-filter: blur(12px);
    border: 1px solid ${isError ? '#dc2626' : 'var(--selected-color)'};
    color: var(--text-main);
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 8px ${isError ? 'rgba(220, 38, 38, 0.2)' : 'var(--accent-glow)'};
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: auto;
  `;

  const iconSvg = isError 
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--selected-color)" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  container.appendChild(toast);

  // Trigger reflow
  toast.offsetHeight;

  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, 3000);
}

function toggleLoadThumbnails() {
  state.loadThumbnails = !state.loadThumbnails;
  localStorage.setItem('loadThumbnails', state.loadThumbnails);
  updateThumbsButtonUI();
  
  // Re-render Explorer to show/hide thumbnails immediately
  renderExplorer();
  
  // Re-render playlist drawer if open to show/hide thumbnails immediately
  if (elements.playlistDrawer && elements.playlistDrawer.classList.contains('open')) {
    renderDrawerPlaylist();
    moveCardToActiveIndex();
  }
  
  // Update canvas card thumbnail to default or real thumbnail
  if (state.currentIndex !== -1 && state.playlist[state.currentIndex]) {
    const track = state.playlist[state.currentIndex];
    const isVideo = ['.mp4', '.mkv', '.webm', '.mov', '.avi'].some(ext => track.path.toLowerCase().endsWith(ext));
    if (elements.canvasCardThumb) {
      elements.canvasCardThumb.src = (isVideo && state.loadThumbnails) ? defaultVideoIcon : defaultAudioIcon;
      if (isVideo && state.loadThumbnails) {
        generateVideoThumbnail(track.path).then(dataUrl => {
          if (dataUrl && elements.canvasCardThumb) {
            elements.canvasCardThumb.src = dataUrl;
          }
        });
      }
    }
  }
  
  showToast(state.loadThumbnails ? "Carregamento de miniaturas ativado" : "Carregamento de miniaturas desativado (HD Lento)");
}

function updateThumbsButtonUI() {
  if (elements.btnToggleThumbs) {
    if (state.loadThumbnails) {
      elements.btnToggleThumbs.classList.add('active');
    } else {
      elements.btnToggleThumbs.classList.remove('active');
    }
  }
}

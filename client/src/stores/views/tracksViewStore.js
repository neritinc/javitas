import { defineStore } from "pinia";
import { markRaw } from "vue";
import service from "@/api/trackService";
import genreService from "@/api/genreService";
import artistService from "@/api/artistService";
import albumService from "@/api/albumService";
import { storageUrl } from "@/utils/storageUrl";
import { useSearchStore } from "@/stores/searchStore";

const initialForm = () => ({
  track_title: "",
  album_id: "",
  album_title: "",
  genre_names: [""],
  artist_names: [""],
  bpm_value: null,
  track_price_eur: 1.99,
  release_date: "",
  track_length_sec: null,
  preview_start_at: 0,
  preview_end_at: 30,
});

const toClean = (value) => String(value || "").trim();
const toCleanLower = (value) => toClean(value).toLowerCase();
const normalizeList = (list) => (list || []).map((x) => toClean(x)).filter(Boolean);

export const useTracksViewStore = defineStore("tracksView", {
  state: () => ({
    tracks: [],
    genres: [],
    artists: [],
    albums: [],
    form: initialForm(),
    submitting: false,
    analyzing: false,
    formError: "",
    validationErrors: {},
    audioFile: null,
    coverFile: null,
    coverPreviewUrl: "",
    isDraggingCover: false,
    audioPreviewUrl: "",
    isPreviewPlaying: false,
    previewStopTimer: null,
    previewHint: "",
    previewSeekTime: 0,
    isDraggingAudio: false,
    isFullTrackPlaying: false,
    fullTrackDuration: 0,
    fullTrackCurrentTime: 0,
    selectedGenreFilter: "",
    selectedArtistFilter: "",
    selectedBpmFilter: "",
    refs: {},
  }),
  getters: {
    filteredTracks(state) {
      const searchStore = useSearchStore();
      const word = toCleanLower(searchStore.searchWord);
      return state.tracks.filter((t) => {
        const genreFilter = toCleanLower(state.selectedGenreFilter);
        if (genreFilter) {
          const hasGenre =
            toCleanLower(t.genre?.genre_name) === genreFilter
            || (t.genres || []).some((g) => toCleanLower(g?.genre_name) === genreFilter);
          if (!hasGenre) return false;
        }

        const artistFilter = toCleanLower(state.selectedArtistFilter);
        if (artistFilter) {
          const hasArtist = (t.artists || []).some((a) => toCleanLower(a?.artist_name) === artistFilter);
          if (!hasArtist) return false;
        }

        const bpmFilter = Number(state.selectedBpmFilter || 0);
        if (bpmFilter > 0 && Number(t?.bpm_value || 0) !== bpmFilter) {
          return false;
        }

        if (!word) return true;
        const hay = [
          t.track_title,
          t.genre?.genre_name,
          ...(t.artists || []).map((a) => a.artist_name),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(word);
      });
    },
    bpmFilterOptions(state) {
      const values = (state.tracks || [])
        .map((t) => Number(t?.bpm_value || 0))
        .filter((bpm) => Number.isFinite(bpm) && bpm > 0);
      return Array.from(new Set(values)).sort((a, b) => a - b);
    },
    previewDuration(state) {
      return Math.max(0, Number(state.form.preview_end_at || 0) - Number(state.form.preview_start_at || 0));
    },
    previewWindowSize(state) {
      const length = Number(state.form.track_length_sec || 0);
      if (!Number.isFinite(length) || length <= 0) return 30;
      return Math.min(30, Math.max(5, Math.floor(length * 0.2)));
    },
    maxPreviewStart(state) {
      const length = Number(state.form.track_length_sec || 0);
      if (!Number.isFinite(length) || length <= 0) return 999999;
      const windowSize = this.previewWindowSize;
      return Math.max(0, length - windowSize);
    },
    maxPreviewEnd(state) {
      const length = Number(state.form.track_length_sec || 0);
      if (!Number.isFinite(length) || length <= 0) return 999999;
      return Math.max(1, length);
    },
  },
  actions: {
    resolveDomRef(refOrElement) {
      if (refOrElement && typeof refOrElement === "object" && "value" in refOrElement) {
        return refOrElement.value || null;
      }
      return refOrElement || null;
    },
    bindRefs(refs) {
      this.refs = markRaw({ ...this.refs, ...refs });
    },
    trackId(track) {
      return track?.track_id || track?.id || track?.trackId || track?.trackID;
    },
    coverUrl(file) {
      if (!file) return "https://placehold.co/300x300?text=Cover";
      const normalized = String(file).replace(/\\/g, "/").trim();
      if (/^https?:\/\//i.test(normalized)) return normalized;
      if (String(file).includes("/")) return storageUrl(String(file).replace(/^storage\//, ""));
      return storageUrl(`track-covers/${normalized}`);
    },
    onImgError(e) {
      const img = e.target;
      const current = img.getAttribute("src") || "";
      const alreadyRetried = img.dataset.retriedExt === "1";

      if (!alreadyRetried && /\.png($|\?)/i.test(current)) {
        img.dataset.retriedExt = "1";
        img.src = current.replace(/\.png($|\?)/i, ".jpg$1");
        return;
      }

      img.src = "https://placehold.co/300x300?text=Cover";
    },
    artistNames(track) {
      const list = track?.artists || [];
      if (!Array.isArray(list) || list.length === 0) {
        return track?.artist?.artist_name || "Unknown";
      }
      return list
        .map((a) => a?.artist_name)
        .filter(Boolean)
        .join(", ");
    },
    genreNames(track) {
      const list = track?.genres || [];
      if (!Array.isArray(list) || list.length === 0) {
        return track?.genre?.genre_name || "Unknown";
      }
      return list
        .map((g) => g?.genre_name)
        .filter(Boolean)
        .join(", ");
    },
    shuffleArray(list) {
      const arr = [...list];
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    shuffleTracks() {
      this.tracks = this.shuffleArray(this.tracks);
    },
    resetTrackFilters() {
      this.selectedGenreFilter = "";
      this.selectedArtistFilter = "";
      this.selectedBpmFilter = "";
    },
    applyGenreFromRouteQuery(genre) {
      const next = String(genre || "").trim();
      this.selectedGenreFilter = next;
    },
    scrollToSection(section) {
      const map = {
        basic: "basicSection",
        album: "albumSection",
        meta: "metaSection",
        timing: "timingSection",
        media: "mediaSection",
      };
      const key = map[section];
      const target = key ? this.resolveDomRef(this.refs?.[key]) : null;
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    normalizePreviewWindow() {
      const length = Number(this.form.track_length_sec || 0);
      if (!Number.isFinite(length) || length <= 0) return;
      let start = Number(this.form.preview_start_at || 0);
      const windowSize = this.previewWindowSize;
      if (start < 0) start = 0;
      if (start + windowSize > length) start = Math.max(0, length - windowSize);
      let end = start + windowSize;
      if (end > length) end = length;
      this.form.preview_start_at = start;
      this.form.preview_end_at = end;
    },
    normalizePreviewWindowEnd() {
      const length = Number(this.form.track_length_sec || 0);
      if (!Number.isFinite(length) || length <= 0) return;
      let end = Number(this.form.preview_end_at || 0);
      const windowSize = this.previewWindowSize;
      if (end > length) end = length;
      let start = end - windowSize;
      if (start < 0) start = 0;
      this.form.preview_start_at = start;
      this.form.preview_end_at = end;
    },
    stopPreviewSegment() {
      if (this.previewStopTimer) {
        clearTimeout(this.previewStopTimer);
        this.previewStopTimer = null;
      }
      const audio = this.resolveDomRef(this.refs?.previewAudioRef);
      if (audio && typeof audio.pause === "function") {
        audio.pause();
      }
      this.isPreviewPlaying = false;
    },
    stopFullTrack() {
      const audio = this.resolveDomRef(this.refs?.fullAudioRef);
      if (audio && typeof audio.pause === "function") {
        audio.pause();
      }
      this.isFullTrackPlaying = false;
    },
    async playPreviewSegment() {
      if (!this.audioPreviewUrl) return;
      const start = Number(this.form.preview_start_at || 0);
      const end = Number(this.form.preview_end_at || 0);
      if (end <= start) return;
      const audio = this.resolveDomRef(this.refs?.previewAudioRef);
      if (!audio) return;

      this.stopPreviewSegment();
      try {
        if (!audio.src) {
          this.previewHint = "Preview source is missing.";
          return;
        }
        if (Number(audio.readyState || 0) === 0) {
          audio.load();
        }
        audio.currentTime = start;
        await audio.play();
        this.previewSeekTime = start;
        this.isPreviewPlaying = true;
        this.previewHint = `Playing ${start}s-${end}s`;

        this.previewStopTimer = setTimeout(() => {
          this.stopPreviewSegment();
        }, Math.max(0, (end - start) * 1000));
      } catch (_err) {
        this.isPreviewPlaying = false;
        this.previewHint = "Preview playback failed. Check browser sound/autoplay permission.";
      }
    },
    regeneratePreviewSegment() {
      this.normalizePreviewWindow();
      this.previewHint = "Preview regenerated with current start/end";
    },
    onPreviewSeekInput(event) {
      const next = Number(event?.target?.value || this.form.preview_start_at || 0);
      const min = Number(this.form.preview_start_at || 0);
      const max = Number(this.form.preview_end_at || 0);
      const clamped = Math.min(Math.max(next, min), max);
      this.previewSeekTime = clamped;
      const audio = this.resolveDomRef(this.refs?.previewAudioRef);
      if (audio) audio.currentTime = clamped;
    },
    onPreviewTimeUpdate() {
      const audio = this.resolveDomRef(this.refs?.previewAudioRef);
      if (!audio) return;
      this.previewSeekTime = Number(audio.currentTime || this.form.preview_start_at || 0);
      if (this.previewSeekTime >= Number(this.form.preview_end_at || 0)) {
        this.stopPreviewSegment();
      }
    },
    onPreviewError() {
      this.isPreviewPlaying = false;
      this.previewHint = "Preview audio could not be loaded.";
    },
    onPreviewStartInput() {
      this.normalizePreviewWindow();
      this.previewSeekTime = Number(this.form.preview_start_at || 0);
    },
    onPreviewEndInput() {
      this.normalizePreviewWindowEnd();
      this.previewSeekTime = Number(this.form.preview_start_at || 0);
    },
    onFullTrackLoadedMetadata(event) {
      const audio = event?.target;
      if (!audio) return;
      this.fullTrackDuration = Number(audio.duration || 0);
    },
    async toggleFullTrackPlay() {
      const audio = this.resolveDomRef(this.refs?.fullAudioRef);
      if (!audio) return;
      if (this.isFullTrackPlaying) {
        audio.pause();
        this.isFullTrackPlaying = false;
        this.previewHint = "";
        return;
      }
      try {
        if (!audio.src) {
          this.previewHint = "Full track source is missing.";
          return;
        }
        if (Number(audio.readyState || 0) === 0) {
          audio.load();
        }
        audio.currentTime = Number(this.fullTrackCurrentTime || 0);
        await audio.play();
        this.isFullTrackPlaying = true;
        this.previewHint = "";
      } catch (_err) {
        this.isFullTrackPlaying = false;
        this.previewHint = "Full track playback failed. Check browser sound/autoplay permission.";
      }
    },
    onFullTrackTimeUpdate(event) {
      const audio = event?.target;
      if (!audio) return;
      this.fullTrackCurrentTime = Number(audio.currentTime || 0);
    },
    onFullTrackSeekInput(event) {
      const next = Number(event?.target?.value || 0);
      const audio = this.resolveDomRef(this.refs?.fullAudioRef);
      this.fullTrackCurrentTime = next;
      if (audio) audio.currentTime = next;
    },
    onFullTrackEnded() {
      this.isFullTrackPlaying = false;
      this.fullTrackCurrentTime = 0;
    },
    onFullTrackError() {
      this.isFullTrackPlaying = false;
      this.previewHint = "The uploaded audio file could not be decoded by the browser.";
    },
    formatTime(value) {
      const total = Math.max(0, Math.floor(Number(value) || 0));
      const min = Math.floor(total / 60);
      const sec = total % 60;
      return `${min}:${String(sec).padStart(2, "0")}`;
    },
    formatPrice(value) {
      const amount = Number(value);
      const safeAmount = Number.isFinite(amount) ? amount : 1.99;
      return `€${safeAmount.toFixed(2)}`;
    },
    onAudioChange(event) {
      const file = event.target.files?.[0] || null;
      this.handleAudioSelected(file);
    },
    onAudioDrop(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      this.isDraggingAudio = false;
      const itemFile = event.dataTransfer?.items?.[0]?.getAsFile?.() || null;
      const file = itemFile || event.dataTransfer?.files?.[0] || null;
      this.syncAudioInputFile(file);
      this.handleAudioSelected(file);
    },
    syncAudioInputFile(file) {
      const input = this.resolveDomRef(this.refs?.audioInputRef);
      if (!input || !file) return;
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
      } catch (_err) {
      }
    },
    releaseAudioPreviewUrl() {
      const currentUrl = String(this.audioPreviewUrl || "");
      if (!currentUrl) return;

      const previewAudio = this.resolveDomRef(this.refs?.previewAudioRef);
      const fullAudio = this.resolveDomRef(this.refs?.fullAudioRef);

      [previewAudio, fullAudio].forEach((el) => {
        if (!el) return;
        try {
          el.pause();
          el.removeAttribute("src");
          el.load();
        } catch (_err) {
        }
      });

      this.audioPreviewUrl = "";
      setTimeout(() => {
        try {
          URL.revokeObjectURL(currentUrl);
        } catch (_err) {
        }
      }, 0);
    },
    handleAudioSelected(file) {
      this.stopPreviewSegment();
      this.stopFullTrack();
      this.previewHint = "";
      this.audioFile = file;
      this.releaseAudioPreviewUrl();
      if (!file) return;
      this.audioPreviewUrl = URL.createObjectURL(file);
      this.previewSeekTime = Number(this.form.preview_start_at || 0);
      this.fullTrackCurrentTime = 0;
      this.fullTrackDuration = 0;
      this.applyFilenameFallback(file.name);

      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.src = URL.createObjectURL(file);
      audio.onloadedmetadata = () => {
        const duration = Math.floor(audio.duration || 0);
        if (duration > 0) {
          this.form.track_length_sec = duration;
          if (this.form.preview_end_at > duration) {
            this.form.preview_end_at = duration;
          }
          this.normalizePreviewWindow();
        }
        URL.revokeObjectURL(audio.src);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audio.src);
      };

      this.analyzeAudioFile(file);
    },
    applyFilenameFallback(fileName) {
      const base = String(fileName || "").replace(/\.[^/.]+$/, "");
      const clean = base.replace(/_/g, " ").replace(/\s+/g, " ").trim();
      if (!clean) return;

      const parts = clean.split(" - ");
      if (parts.length >= 2) {
        const artistRaw = parts[0].trim();
        const titleRaw = parts.slice(1).join(" - ").trim();

        if (!this.form.track_title && titleRaw) {
          this.form.track_title = titleRaw;
        }

        const artistNames = artistRaw
          .split(/,|&| feat\. | feat | ft\. | ft | featuring | x | and |;/i)
          .map((x) => x.trim())
          .filter(Boolean);

        const hasExistingArtists = this.form.artist_names.some((name) => String(name || "").trim() !== "");
        if (!hasExistingArtists && artistNames.length > 0) {
          this.form.artist_names = artistNames;
        }
        return;
      }

      if (!this.form.track_title) {
        this.form.track_title = clean;
      }
    },
    async analyzeAudioFile(file) {
      this.analyzing = true;
      this.clearValidationErrors();
      try {
        const res = await service.analyzeUpload(file);
        const analyzed = res?.data && typeof res.data === "object" ? res.data : (res || {});
        this.applyAnalyzedMetadata(analyzed);
        if (analyzed?.track_length_sec) {
          this.form.track_length_sec = Number(analyzed.track_length_sec) || this.form.track_length_sec;
          this.normalizePreviewWindow();
        }
        if (analyzed?.cover_data_url && !this.coverFile) {
          this.setCoverFromDataUrl(analyzed.cover_data_url, file?.name);
        }
        if (!analyzed?.bpm_value && !this.form.bpm_value) {
          const fallbackBpm = await this.estimateBpmFromAudioFile(file);
          if (fallbackBpm) {
            this.form.bpm_value = fallbackBpm;
          }
        }
        this.normalizePreviewWindow();
      } catch (err) {
        this.setValidationErrorsFromResponse(err);
        this.formError = err?.response?.data?.message || "Audio analyze failed, fallback from filename used.";
      } finally {
        this.analyzing = false;
      }
    },
    applyAnalyzedMetadata(analyzed) {
      if (!analyzed || typeof analyzed !== "object") return;
      if (analyzed?.track_title && !this.form.track_title) {
        this.form.track_title = String(analyzed.track_title || "");
      }
      if (analyzed?.artist_name && this.form.artist_names.every((name) => !String(name || "").trim())) {
        this.form.artist_names = [String(analyzed.artist_name)];
      }
      if (analyzed?.genre_name && this.form.genre_names.every((name) => !String(name || "").trim())) {
        this.form.genre_names = [String(analyzed.genre_name)];
      }
      if (analyzed?.bpm_value && !this.form.bpm_value) {
        this.form.bpm_value = Number(analyzed.bpm_value);
      }
    },
    setCoverFromDataUrl(dataUrl, originalAudioName) {
      const data = String(dataUrl || "");
      const match = data.match(/^data:(.*?);base64,(.*)$/);
      if (!match) return;

      const mime = match[1] || "image/jpeg";
      const b64 = match[2] || "";
      if (!b64) return;

      try {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }

        const baseName = String(originalAudioName || "cover").replace(/\.[^/.]+$/, "").trim() || "cover";
        const ext = mime.includes("png") ? "png" : (mime.includes("webp") ? "webp" : "jpg");
        const file = new File([bytes], `${baseName}-cover.${ext}`, { type: mime });
        this.setCoverFile(file);
      } catch (_err) {
      }
    },
    async estimateBpmFromAudioFile(file) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;

        const ctx = new AudioCtx();
        try {
          const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          const data = buffer.getChannelData(0);
          const frameSize = 2048;
          const hop = 512;
          const envelope = [];

          for (let i = 0; i + frameSize < data.length; i += hop) {
            let e = 0;
            for (let j = 0; j < frameSize; j += 1) {
              const s = data[i + j];
              e += s * s;
            }
            envelope.push(Math.sqrt(e / frameSize));
          }

          if (envelope.length < 16) return null;

          const mean = envelope.reduce((a, b) => a + b, 0) / envelope.length;
          const threshold = mean * 1.3;
          const peaks = [];

          for (let i = 1; i < envelope.length - 1; i += 1) {
            if (envelope[i] > threshold && envelope[i] > envelope[i - 1] && envelope[i] >= envelope[i + 1]) {
              peaks.push(i);
            }
          }

          if (peaks.length < 8) return null;

          const bpmBins = new Map();
          for (let i = 0; i < peaks.length; i += 1) {
            for (let j = i + 1; j < Math.min(i + 20, peaks.length); j += 1) {
              const deltaFrames = peaks[j] - peaks[i];
              if (deltaFrames <= 0) continue;
              let bpm = (60 * buffer.sampleRate) / (deltaFrames * hop);
              while (bpm < 70) bpm *= 2;
              while (bpm > 180) bpm /= 2;
              const rounded = Math.round(bpm);
              if (rounded >= 70 && rounded <= 180) {
                bpmBins.set(rounded, (bpmBins.get(rounded) || 0) + 1);
              }
            }
          }

          let best = null;
          let score = -1;
          bpmBins.forEach((v, k) => {
            if (v > score) {
              score = v;
              best = k;
            }
          });

          return best;
        } finally {
          await ctx.close();
        }
      } catch (_err) {
        return null;
      }
    },
    openCoverPicker() {
      this.resolveDomRef(this.refs?.coverInputRef)?.click?.();
    },
    syncCoverInputFile(file) {
      const input = this.resolveDomRef(this.refs?.coverInputRef);
      if (!input || !file) return;
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
      } catch (_err) {
      }
    },
    setCoverFile(file) {
      this.coverFile = file;
      if (this.coverPreviewUrl) {
        URL.revokeObjectURL(this.coverPreviewUrl);
      }
      this.coverPreviewUrl = file ? URL.createObjectURL(file) : "";
    },
    onCoverChange(event) {
      const file = event.target.files?.[0] || null;
      this.setCoverFile(file);
    },
    onCoverDrop(event) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      this.isDraggingCover = false;
      const itemFile = event.dataTransfer?.items?.[0]?.getAsFile?.() || null;
      const file = itemFile || event.dataTransfer?.files?.[0] || null;
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        this.formError = "Only image files can be used as track cover.";
        return;
      }
      this.formError = "";
      this.syncCoverInputFile(file);
      this.setCoverFile(file);
    },
    addGenreField() {
      this.form.genre_names.push("");
    },
    removeGenreField(index) {
      if (this.form.genre_names.length > 1) {
        this.form.genre_names.splice(index, 1);
      }
    },
    addArtistField() {
      this.form.artist_names.push("");
    },
    removeArtistField(index) {
      if (this.form.artist_names.length > 1) {
        this.form.artist_names.splice(index, 1);
      }
    },
    firstError(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) {
        if (this.validationErrors?.[key]) return this.validationErrors[key];
      }
      return "";
    },
    toValidationError(err) {
      const errors = err?.response?.data?.errors;
      if (!errors || typeof errors !== "object") {
        return err?.response?.data?.message || "Track creation failed.";
      }

      const firstKey = Object.keys(errors)[0];
      if (!firstKey) return "Validation error.";
      const firstValue = errors[firstKey];
      if (Array.isArray(firstValue) && firstValue.length > 0) return firstValue[0];
      return "Validation error.";
    },
    clearValidationErrors() {
      this.validationErrors = {};
    },
    setValidationErrorsFromResponse(err) {
      const errors = err?.response?.data?.errors;
      if (errors && typeof errors === "object") {
        const mapped = {};
        Object.entries(errors).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0) {
            mapped[key] = value[0];
          } else if (typeof value === "string") {
            mapped[key] = value;
          }
        });
        this.validationErrors = mapped;
      }

      const uploadError = err?.response?.data?.data?.upload_error;
      if (uploadError) {
        this.validationErrors = {
          ...this.validationErrors,
          track_audio: uploadError,
        };
      }
    },
    async load() {
      const [tracksRes, genresRes, artistsRes, albumsRes] = await Promise.allSettled([
        service.list(),
        genreService.list(),
        artistService.list(),
        albumService.list(),
      ]);

      this.tracks = tracksRes.status === "fulfilled" ? this.shuffleArray(tracksRes.value.data || []) : [];
      this.genres = genresRes.status === "fulfilled" ? (genresRes.value.data || []) : [];
      this.artists = artistsRes.status === "fulfilled" ? (artistsRes.value.data || []) : [];
      this.albums = albumsRes.status === "fulfilled" ? (albumsRes.value.data || []) : [];

      if (tracksRes.status !== "fulfilled") {
        throw tracksRes.reason;
      }
    },
    async createTrack() {
      this.formError = "";
      this.clearValidationErrors();
      this.normalizePreviewWindow();
      this.stopPreviewSegment();

      if (!this.audioFile) {
        this.formError = "Audio file is required.";
        return;
      }

      const artistNames = normalizeList(this.form.artist_names);

      if (artistNames.length === 0) {
        this.formError = "At least one artist is required.";
        return;
      }

      if (this.previewDuration > 30) {
        this.formError = "Preview duration cannot exceed 30 seconds.";
        return;
      }

      this.submitting = true;
      try {
        const payload = new FormData();
        payload.append("track_title", this.form.track_title);
        if (this.form.album_id) {
          payload.append("album_id", String(this.form.album_id));
        } else if (String(this.form.album_title || "").trim() !== "") {
          payload.append("album_title", String(this.form.album_title).trim());
        }

        const genreNames = normalizeList(this.form.genre_names);
        if (genreNames.length === 0) {
          this.formError = "At least one genre is required.";
          this.submitting = false;
          return;
        }

        const existingByName = new Map(
          (this.genres || []).map((g) => [toCleanLower(g.genre_name), g])
        );

        const genreIds = [];
        const newGenreNames = [];
        for (const genreName of genreNames) {
          const existing = existingByName.get(genreName.toLowerCase());
          if (existing?.genre_id) {
            genreIds.push(existing.genre_id);
          } else {
            newGenreNames.push(genreName);
          }
        }

        genreIds.forEach((id, index) => payload.append(`genre_ids[${index}]`, String(id)));
        newGenreNames.forEach((name, index) => payload.append(`genre_names[${index}]`, name));

        payload.append("preview_start_at", String(this.form.preview_start_at));
        payload.append("preview_end_at", String(this.form.preview_end_at));
        payload.append("track_audio", this.audioFile);

        artistNames.forEach((name, index) => payload.append(`artist_names[${index}]`, name));

        if (this.form.bpm_value) payload.append("bpm_value", String(this.form.bpm_value));
        payload.append("track_price_eur", String(Number(this.form.track_price_eur ?? 1.99).toFixed(2)));
        if (this.form.release_date) payload.append("release_date", this.form.release_date);
        if (this.form.track_length_sec) payload.append("track_length_sec", String(this.form.track_length_sec));
        if (this.coverFile) payload.append("track_cover_file", this.coverFile);

        await service.create(payload);
        this.form = initialForm();
        this.clearValidationErrors();
        this.audioFile = null;
        this.stopFullTrack();
        this.releaseAudioPreviewUrl();
        this.previewHint = "";
        this.setCoverFile(null);
        await this.load();
      } catch (err) {
        this.setValidationErrorsFromResponse(err);
        this.formError = this.toValidationError(err);
      } finally {
        this.submitting = false;
      }
    },
    cleanup() {
      this.stopPreviewSegment();
      this.stopFullTrack();
      this.releaseAudioPreviewUrl();
      if (this.coverPreviewUrl) {
        URL.revokeObjectURL(this.coverPreviewUrl);
      }
    },
  },
});


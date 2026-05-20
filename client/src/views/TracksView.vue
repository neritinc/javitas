<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="h5 m-0">Tracks</h2>
      <span class="badge text-bg-dark">{{ filteredTracks.length }} items</span>
    </div>

    <div class="card card-body mb-3">
      <div class="row g-2 align-items-end">
        <div class="col-md-3">
          <label class="form-label mb-1">Filter by genre</label>
          <select v-model="selectedGenreFilter" class="form-select">
            <option value="">All genres</option>
            <option v-for="g in genres" :key="`filter-genre-${g.genre_id}`" :value="g.genre_name">{{ g.genre_name }}
            </option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label mb-1">Filter by artist</label>
          <select v-model="selectedArtistFilter" class="form-select">
            <option value="">All artists</option>
            <option v-for="a in artists" :key="`filter-artist-${a.artist_id}`" :value="a.artist_name">{{ a.artist_name
            }}</option>
          </select>
        </div>
        <div class="col-md-2">
          <label class="form-label mb-1">Filter by BPM</label>
          <select v-model="selectedBpmFilter" class="form-select">
            <option value="">All BPM</option>
            <option v-for="bpm in bpmFilterOptions" :key="`filter-bpm-${bpm}`" :value="String(bpm)">{{ bpm }}</option>
          </select>
        </div>
        <div class="col-md-4 d-flex gap-2 filter-actions">
          <button class="btn btn-outline-secondary" type="button" @click="shuffleTracks">
            Shuffle order
          </button>
          <button class="btn btn-outline-danger" type="button" @click="resetTrackFilters">
            Reset filters
          </button>
        </div>
      </div>
    </div>

    <form v-if="isAdmin" class="card card-body mb-3" @submit.prevent="createTrack">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h3 class="h6 m-0">Create new track (Admin)</h3>
        <div class="d-flex gap-2 align-items-center">
          <button class="btn btn-outline-secondary btn-sm" type="button" @click="showCreateEditor = !showCreateEditor">
            {{ showCreateEditor ? "Hide editor" : "Show editor" }}
          </button>
          <span class="section-chip">Structured editor</span>
        </div>
      </div>
      <div v-if="!showCreateEditor" class="text-muted small">
        The create-track editor is hidden.
      </div>
      <template v-else>
      <div class="d-flex flex-wrap gap-2 mb-3">
        <button class="btn btn-outline-secondary btn-sm" type="button" @click="scrollToSection('basic')">Basic</button>
        <button class="btn btn-outline-secondary btn-sm" type="button" @click="scrollToSection('album')">Album</button>
        <button class="btn btn-outline-secondary btn-sm" type="button" @click="scrollToSection('meta')">Artists and
          genres</button>
        <button class="btn btn-outline-secondary btn-sm" type="button"
          @click="scrollToSection('timing')">Timing</button>
        <button class="btn btn-outline-secondary btn-sm" type="button" @click="scrollToSection('media')">Media
          files</button>
      </div>

      <div v-if="formError" class="alert alert-danger py-2 mb-3">{{ formError }}</div>

      <div ref="basicSection" class="editor-section mb-3">
        <div class="section-title">Basic info</div>
        <div class="row g-2">
          <div class="col-lg-6">
            <label class="form-label mb-1">Track title</label>
            <input v-model="form.track_title" class="form-control" placeholder="Track title" required />
            <small v-if="firstError(['track_title'])" class="text-danger">{{ firstError(['track_title']) }}</small>
          </div>
          <div class="col-md-3">
            <label class="form-label mb-1">BPM</label>
            <input v-model.number="form.bpm_value" class="form-control" type="number" min="1" max="999"
              placeholder="BPM" />
          </div>
          <div class="col-md-3">
            <label class="form-label mb-1">Price (EUR)</label>
            <input v-model.number="form.track_price_eur" class="form-control" type="number" min="0" step="0.01"
              placeholder="1.99" />
          </div>
        </div>
      </div>

      <div ref="albumSection" class="editor-section mb-3">
        <div class="section-title">Album</div>
        <div class="row g-2">
          <div class="col-md-6">
            <label class="form-label mb-1">Choose existing album</label>
            <select v-model="form.album_id" class="form-select">
              <option value="">No album</option>
              <option v-for="album in albums" :key="`album-${album.id}`" :value="String(album.id)">{{ album.title }}
              </option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label mb-1">Or create new album</label>
            <input v-model="form.album_title" class="form-control" placeholder="New album title" />
          </div>
        </div>
      </div>

      <div ref="metaSection" class="editor-section mb-3">
        <div class="section-title">Genres and artists</div>
        <div class="row g-3">
          <div class="col-lg-6">
            <label class="form-label mb-1">Genres</label>
            <div v-for="(genre, idx) in form.genre_names" :key="`genre-${idx}`" class="d-flex gap-2 mb-1">
              <input v-model="form.genre_names[idx]" class="form-control" placeholder="Genre name"
                list="genre-options" />
              <button v-if="form.genre_names.length > 1" class="btn btn-outline-danger btn-sm" type="button"
                @click="removeGenreField(idx)">
                -
              </button>
            </div>
            <datalist id="genre-options">
              <option v-for="genre in genres" :key="genre.genre_id" :value="genre.genre_name"></option>
            </datalist>
            <small class="text-muted d-block">Select existing genres or type new ones.</small>
            <small v-if="firstError(['genre_name', 'genre_ids', 'genre_ids.0', 'genre_names', 'genre_names.0'])"
              class="text-danger d-block">
              {{ firstError(['genre_name', 'genre_ids', 'genre_ids.0', 'genre_names', 'genre_names.0']) }}
            </small>
            <button class="btn btn-outline-secondary btn-sm mt-1" type="button" @click="addGenreField">+ Add
              genre</button>
          </div>

          <div class="col-lg-6">
            <label class="form-label mb-1">Artists</label>
            <div v-for="(artist, idx) in form.artist_names" :key="`artist-${idx}`" class="d-flex gap-2 mb-1">
              <input v-model="form.artist_names[idx]" class="form-control" :placeholder="`Artist ${idx + 1}`"
                list="artist-options" />
              <button v-if="form.artist_names.length > 1" class="btn btn-outline-danger btn-sm" type="button"
                @click="removeArtistField(idx)">
                -
              </button>
            </div>
            <datalist id="artist-options">
              <option v-for="artist in artists" :key="artist.artist_id" :value="artist.artist_name"></option>
            </datalist>
            <small class="text-muted d-block">Select existing artists or type new ones.</small>
            <small v-if="firstError(['artist_names', 'artist_ids', 'artist_ids.0', 'artist_names.0'])"
              class="text-danger d-block">
              {{ firstError(['artist_names', 'artist_ids', 'artist_ids.0', 'artist_names.0']) }}
            </small>
            <button class="btn btn-outline-secondary btn-sm mt-1" type="button" @click="addArtistField">+ Add
              artist</button>
          </div>
        </div>
      </div>

      <div ref="timingSection" class="editor-section mb-3">
        <div class="section-title">Timing and preview</div>
        <div class="row g-2">
          <div class="col-md-3">
            <label class="form-label mb-1">Release date</label>
            <input v-model="form.release_date" class="form-control" type="date" />
          </div>
          <div class="col-md-3">
            <label class="form-label mb-1">Track length (sec)</label>
            <input v-model.number="form.track_length_sec" class="form-control" type="number" min="1"
              placeholder="Track length (sec)" />
          </div>
          <div class="col-md-3">
            <label class="form-label mb-1">Preview start (sec)</label>
            <input v-model.number="form.preview_start_at" class="form-control" type="number" min="0"
              :max="maxPreviewStart" placeholder="Preview start (sec)" @input="onPreviewStartInput" />
            <small class="text-muted">Format: {{ formatTime(form.preview_start_at) }}</small>
          </div>
          <div class="col-md-3">
            <label class="form-label mb-1">Preview end (sec)</label>
            <input v-model.number="form.preview_end_at" class="form-control" type="number" min="1" :max="maxPreviewEnd"
              placeholder="Preview end (sec)" @input="onPreviewEndInput" />
            <small class="text-muted">Format: {{ formatTime(form.preview_end_at) }}</small>
            <small v-if="firstError(['preview_end_at'])" class="text-danger d-block">{{ firstError(['preview_end_at'])
            }}</small>
          </div>
        </div>

        <div class="small text-muted mt-2">
          Preview duration: {{ previewDuration }} sec (max 30 sec)
        </div>
        <div class="d-flex gap-2 align-items-center mt-2 flex-wrap">
          <button class="btn btn-outline-primary btn-sm" type="button"
            :disabled="!audioPreviewUrl || previewDuration <= 0" @click="playPreviewSegment">
            Preview segment
          </button>
          <button class="btn btn-outline-secondary btn-sm" type="button"
            :disabled="!audioPreviewUrl || previewDuration <= 0" @click="regeneratePreviewSegment">
            Regenerate preview
          </button>
          <button class="btn btn-outline-danger btn-sm" type="button" :disabled="!isPreviewPlaying"
            @click="stopPreviewSegment">
            Stop
          </button>
          <small class="text-muted">{{ previewHint }}</small>
        </div>
        <div v-if="audioPreviewUrl" class="preview-seek-wrap mt-2">
          <input class="form-range" type="range" :min="form.preview_start_at" :max="form.preview_end_at" step="0.1"
            :value="previewSeekTime" @input="onPreviewSeekInput" />
          <div class="small text-muted d-flex justify-content-between">
            <span>{{ formatTime(previewSeekTime) }}</span>
            <span>{{ formatTime(form.preview_end_at) }}</span>
          </div>
        </div>
        <div v-if="audioPreviewUrl" class="preview-seek-wrap mt-3">
          <div class="d-flex align-items-center gap-2 mb-1">
            <button class="btn btn-outline-dark btn-sm" type="button" @click="toggleFullTrackPlay">
              {{ isFullTrackPlaying ? "Pause full track" : "Play full track" }}
            </button>
            <small class="text-muted">Full upload preview</small>
          </div>
          <input class="form-range" type="range" min="0" :max="fullTrackDuration" step="0.1"
            :value="fullTrackCurrentTime" @input="onFullTrackSeekInput" />
          <div class="small text-muted d-flex justify-content-between">
            <span>{{ formatTime(fullTrackCurrentTime) }}</span>
            <span>{{ formatTime(fullTrackDuration) }}</span>
          </div>
        </div>
      </div>

      <div ref="mediaSection" class="editor-section mb-3">
        <div class="section-title">Media files</div>
        <div class="row g-2 mt-1">
          <div class="col-md-6">
            <label class="form-label fw-semibold">Audio file</label>
            <div class="audio-dropzone mb-2" :class="{ 'is-over': isDraggingAudio }"
              @dragenter.prevent="isDraggingAudio = true" @dragover.prevent="isDraggingAudio = true"
              @dragleave.prevent="isDraggingAudio = false" @drop.prevent="onAudioDrop">
              Drop audio here
            </div>
            <input ref="audioInputRef" class="form-control" type="file" accept=".mp3,.wav,.ogg,.m4a,.flac,audio/*"
              @change="onAudioChange" required />
            <small class="text-muted">Supported: mp3, wav, ogg, m4a, flac (max 50 MB)</small>
            <small v-if="firstError(['track_audio'])" class="text-danger d-block">{{ firstError(['track_audio'])
            }}</small>
            <small v-if="analyzing" class="d-block text-primary mt-1">Analyzing audio metadata...</small>
          </div>

          <div class="col-md-6">
            <label class="form-label fw-semibold">Cover image (drag and drop)</label>
            <div class="cover-dropzone" :class="{ 'is-over': isDraggingCover }"
              @dragenter.prevent="isDraggingCover = true" @dragover.prevent="isDraggingCover = true"
              @dragleave.prevent="isDraggingCover = false" @drop.prevent="onCoverDrop" @click="openCoverPicker">
              <input ref="coverInputRef" class="d-none" type="file" accept="image/*" @change="onCoverChange" />

              <template v-if="coverPreviewUrl">
                <img :src="coverPreviewUrl" alt="Cover preview" class="cover-preview" />
              </template>
              <template v-else>
                <p class="m-0 fw-semibold">Drop image here or click to browse</p>
                <small class="text-muted">JPG, PNG, WEBP - max 5 MB</small>
              </template>
            </div>
            <small v-if="firstError(['track_cover_file'])" class="text-danger d-block">{{
              firstError(['track_cover_file'])
            }}</small>
          </div>
        </div>
      </div>

      <div class="track-submit-sticky mt-2">
        <button :disabled="submitting" class="btn btn-primary btn-sm">
          {{ submitting ? "Saving..." : "Create track" }}
        </button>
        <button class="btn btn-outline-secondary btn-sm" type="button" @click="scrollToSection('basic')">
          Back to top
        </button>
      </div>

      <audio ref="previewAudioRef" :src="audioPreviewUrl" preload="auto" class="d-none" @ended="stopPreviewSegment"
        @timeupdate="onPreviewTimeUpdate" @error="onPreviewError"></audio>
      <audio ref="fullAudioRef" :src="audioPreviewUrl" preload="metadata" class="d-none"
        @loadedmetadata="onFullTrackLoadedMetadata" @timeupdate="onFullTrackTimeUpdate"
        @ended="onFullTrackEnded" @error="onFullTrackError"></audio>
      </template>
    </form>

    <div class="row g-3">
      <div class="col-sm-6 col-lg-4 col-xl-3" v-for="t in filteredTracks" :key="trackId(t)">
        <RouterLink class="track-card-link" :to="`/tracks/${trackId(t)}`">
          <div class="card h-100 shadow-sm track-card">
            <img class="card-img-top track-cover" :src="coverUrl(t.track_cover)" :alt="t.track_title"
              @error="onImgError" />

            <div class="card-body d-flex flex-column track-meta">
              <h3 class="h5 card-title mb-2 track-title">{{ t.track_title }}</h3>
              <p class="mb-2 track-artist">Artist: {{ artistNames(t) }}</p>
              <p class="mb-2 track-artist">Genres: {{ genreNames(t) }}</p>
              <p class="mb-2 track-artist">Price: {{ formatPrice(t.track_price_eur) }}</p>
            </div>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { storeToRefs } from "pinia";
import { useTracksViewStore } from "@/stores/views/tracksViewStore";
import { useUserLoginLogoutStore } from "@/stores/userLoginLogoutStore";
import { RouterLink, useRoute } from "vue-router";

export default {
  components: { RouterLink },
  setup() {
    const store = useTracksViewStore();
    const { isAdmin } = storeToRefs(useUserLoginLogoutStore());
    const route = useRoute();
    const showCreateEditor = ref(true);

    const previewAudioRef = ref(null);
    const fullAudioRef = ref(null);
    const audioInputRef = ref(null);
    const coverInputRef = ref(null);
    const basicSection = ref(null);
    const albumSection = ref(null);
    const metaSection = ref(null);
    const timingSection = ref(null);
    const mediaSection = ref(null);

    store.bindRefs({
      previewAudioRef,
      fullAudioRef,
      audioInputRef,
      coverInputRef,
      basicSection,
      albumSection,
      metaSection,
      timingSection,
      mediaSection,
    });

    const storeRefs = storeToRefs(store);

    watch(
      () => route.query.genre,
      (value) => {
        store.applyGenreFromRouteQuery(value);
      },
    );

    onMounted(async () => {
      await store.load();
      store.applyGenreFromRouteQuery(route.query.genre);
    });

    onBeforeUnmount(() => {
      store.cleanup();
    });

    const {
      bindRefs,
      load,
      applyGenreFromRouteQuery,
      cleanup,
      trackId,
      coverUrl,
      onImgError,
      artistNames,
      genreNames,
      shuffleTracks,
      resetTrackFilters,
      scrollToSection,
      playPreviewSegment,
      regeneratePreviewSegment,
      stopPreviewSegment,
      onPreviewSeekInput,
      onPreviewTimeUpdate,
      onPreviewError,
      onPreviewStartInput,
      onPreviewEndInput,
      toggleFullTrackPlay,
      onFullTrackLoadedMetadata,
      onFullTrackTimeUpdate,
      onFullTrackSeekInput,
      onFullTrackEnded,
      onFullTrackError,
      formatTime,
      formatPrice,
      onAudioChange,
      onAudioDrop,
      openCoverPicker,
      onCoverChange,
      onCoverDrop,
      addGenreField,
      removeGenreField,
      addArtistField,
      removeArtistField,
      firstError,
      createTrack,
    } = store;

    return {
      ...storeRefs,
      isAdmin,
      showCreateEditor,
      previewAudioRef,
      fullAudioRef,
      audioInputRef,
      coverInputRef,
      basicSection,
      albumSection,
      metaSection,
      timingSection,
      mediaSection,
      bindRefs,
      load,
      applyGenreFromRouteQuery,
      cleanup,
      trackId,
      coverUrl,
      onImgError,
      artistNames,
      genreNames,
      shuffleTracks,
      resetTrackFilters,
      scrollToSection,
      playPreviewSegment,
      regeneratePreviewSegment,
      stopPreviewSegment,
      onPreviewSeekInput,
      onPreviewTimeUpdate,
      onPreviewError,
      onPreviewStartInput,
      onPreviewEndInput,
      toggleFullTrackPlay,
      onFullTrackLoadedMetadata,
      onFullTrackTimeUpdate,
      onFullTrackSeekInput,
      onFullTrackEnded,
      onFullTrackError,
      formatTime,
      formatPrice,
      onAudioChange,
      onAudioDrop,
      openCoverPicker,
      onCoverChange,
      onCoverDrop,
      addGenreField,
      removeGenreField,
      addArtistField,
      removeArtistField,
      firstError,
      createTrack,
    };
  },
};
</script>

<style scoped>
:root {
  color-scheme: light;
}

.card.card-body {
  border: 1px solid #d8e3f3;
  border-radius: 14px;
  background:
    radial-gradient(1200px 420px at 0% -20%, rgba(59, 130, 246, 0.07), transparent 55%),
    linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
  box-shadow: 0 10px 26px rgba(26, 58, 112, 0.08);
}

.h6,
.h5 {
  color: #0f172a;
  font-weight: 700;
}

.badge.text-bg-dark {
  background: #1e293b !important;
  border-radius: 999px;
  padding: 0.35rem 0.55rem;
}

.form-control,
.form-select {
  border-color: #c8d6ea;
  background: #ffffff;
  border-radius: 10px;
  min-height: 42px;
  box-shadow: none;
}

.form-control:focus,
.form-select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 0.16rem rgba(59, 130, 246, 0.2);
}

.form-label {
  margin-bottom: 0.35rem;
  color: #1e293b;
  font-weight: 600;
}

.text-muted {
  color: #64748b !important;
}

.section-chip {
  display: inline-flex;
  align-items: center;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1e3a8a;
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 600;
}

.editor-section {
  border: 1px solid #dbe7f7;
  border-radius: 12px;
  background: #f8fbff;
  padding: 0.85rem;
}

.section-title {
  font-weight: 700;
  font-size: 0.94rem;
  color: #0f172a;
  margin-bottom: 0.65rem;
}

.track-submit-sticky {
  position: sticky;
  bottom: 10px;
  z-index: 5;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  width: fit-content;
  padding: 0.45rem;
  border-radius: 12px;
  border: 1px solid #dbe7f7;
  background: rgba(248, 251, 255, 0.96);
  backdrop-filter: blur(3px);
}

.btn {
  border-radius: 10px;
}

.btn-primary {
  background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
  border-color: #1d4ed8;
  font-weight: 600;
}

.btn-outline-primary {
  border-color: #3b82f6;
  color: #1d4ed8;
}

.btn-outline-primary:hover {
  background: #dbeafe;
  color: #1e3a8a;
}

.btn-outline-secondary {
  border-color: #c8d6ea;
  color: #334155;
}

.btn-outline-danger {
  border-color: #fca5a5;
  color: #dc2626;
}

.btn-outline-danger:hover {
  background: #fee2e2;
}

.form-range {
  height: 1.2rem;
}

.form-range::-webkit-slider-runnable-track {
  height: 0.42rem;
  border-radius: 999px;
  background: linear-gradient(90deg, #dbeafe 0%, #bfdbfe 100%);
}

.form-range::-webkit-slider-thumb {
  margin-top: -5px;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #2563eb;
  border: 2px solid #ffffff;
}

.form-range::-moz-range-track {
  height: 0.42rem;
  border-radius: 999px;
  background: linear-gradient(90deg, #dbeafe 0%, #bfdbfe 100%);
}

.form-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #2563eb;
  border: 2px solid #ffffff;
}

.track-cover {
  width: 72%;
  margin: 0.9rem auto 0;
  border-radius: 0.75rem;
  aspect-ratio: 1 / 1;
  height: auto;
  object-fit: cover;
}

.track-card-link {
  display: block;
  text-decoration: none;
  color: inherit;
}

.track-card {
  background: #ffffff;
  border: 1px solid #d9e3f1;
  border-radius: 14px;
  box-shadow: 0 8px 20px rgba(20, 37, 63, 0.06);
  transition: transform 0.16s ease, box-shadow 0.16s ease;
  overflow: hidden;
}

.track-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 26px rgba(20, 37, 63, 0.11);
}

.track-meta {
  color: #1f2937;
}

.track-title {
  font-size: 1.2rem;
  line-height: 1.1;
  letter-spacing: 0.01em;
  min-height: 2.65rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.track-artist {
  color: #4b5563;
  font-weight: 600;
  min-height: 1.55rem;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preview-seek-wrap {
  padding: 0.35rem 0.15rem;
}

.cover-dropzone {
  min-height: 150px;
  border: 2px dashed #93c5fd;
  border-radius: 12px;
  background: linear-gradient(180deg, #eff6ff 0%, #edf3fc 100%);
  color: #1e3a8a;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.audio-dropzone {
  border: 2px dashed #93c5fd;
  border-radius: 12px;
  padding: 0.65rem 0.8rem;
  text-align: center;
  color: #1e3a8a;
  background: linear-gradient(180deg, #eff6ff 0%, #edf3fc 100%);
}

.audio-dropzone.is-over {
  border-color: #2563eb;
  background: #dbeafe;
}

.cover-dropzone.is-over {
  border-color: #2563eb;
  background: #dbeafe;
}

.cover-preview {
  max-width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 10px;
}

@media (max-width: 992px) {
  .card.card-body {
    padding: 0.9rem;
  }
}

@media (max-width: 768px) {
  .filter-actions {
    flex-wrap: wrap;
    width: 100%;
  }

  .filter-actions .btn {
    flex: 1 1 100%;
  }

  .track-submit-sticky {
    position: static;
    width: 100%;
    justify-content: space-between;
  }

  .track-cover {
    width: 86%;
  }

  .track-title {
    font-size: 1.05rem;
    min-height: auto;
  }

  .track-artist {
    min-height: auto;
  }
}
</style>


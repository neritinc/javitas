# Zene feltöltés folyamata, metaadat-olvasás és CSV export

## 1. dia - Áttekintés (end-to-end folyamat)

1. Frontend feltölti a `track_audio` fájlt (`FormData`).
2. Frontend opcionálisan meghívja az `analyze-upload` végpontot metaadat-javaslatokra.
3. Backend validál (formátum, méret, preview időintervallum, egyedi cím).
4. Backend elmenti az eredeti audio fájlt (`track_path`).
5. Backend FFmpeg-gel generál 30 mp-es preview-t (`preview_path`).
6. Track mentése után automatikusan frissül a `tracks.csv` és `track_previews.csv`.

Érintett fájlok:
- `client/src/views/TracksView.vue`
- `client/src/api/trackService.js`
- `server/routes/api.php`
- `server/app/Http/Controllers/TrackController.php`
- `server/app/Http/Requests/StoreTrackRequest.php`
- `server/app/Jobs/GenerateTrackPreview.php`
- `server/app/Models/Track.php`

---

## 2. dia - Milyen bővítmény / csomag kellett?

Projekt oldali csomag:
- `php-ffmpeg/php-ffmpeg` (Composer dependency)

Környezeti követelmény:
- telepített `ffmpeg` bináris
- telepített `ffprobe` bináris

Laravel komponensek:
- `Symfony\Component\Process\Process` (FFmpeg parancs futtatása)
- `Storage` facade (fájlkezelés)

Részlet (`server/composer.json`):

```json
"require": {
  "php": "^8.2",
  "laravel/framework": "^12.0",
  "php-ffmpeg/php-ffmpeg": "^1.4"
}
```

Funkció:
- A projektbe behúzza a PHP-FFMpeg csomagot, amivel a backend tud FFprobe-ot és FFmpeg-et használni.

Miért kell:
- Enélkül nem lenne megbízható metaadat-olvasás és preview-vágás backend oldalon.

---

## 3. dia - Frontend upload + analyze hívás

A frontend küldi a zenét:

```js
const payload = new FormData();
payload.append("track_audio", this.audioFile);
payload.append("preview_start_at", String(this.form.preview_start_at));
payload.append("preview_end_at", String(this.form.preview_end_at));
await service.create(payload);
```

Funkció:
- Összerakja a feltöltési kérést a zenével és a preview időablakkal.

Miért kell:
- A backend csak így kapja meg egyszerre a fájlt és a preview-hoz szükséges paramétereket.

Metaadat-előtöltés (`analyze-upload`):

```js
const res = await service.analyzeUpload(file);
const analyzed = res?.data && typeof res.data === "object" ? res.data : (res || {});
this.applyAnalyzedMetadata(analyzed);
```

Funkció:
- Feltöltés előtt lefuttat egy elemzést, és visszatölti az űrlapba a javasolt metaadatokat.

Miért kell:
- Gyorsabb admin munka: kevesebb kézi adatbevitel (cím, artist, BPM, hossz, cover).

Service oldalon:

```js
analyzeUpload(file) {
  const payload = new FormData();
  payload.append("track_audio", file);
  return apiClient.post(`${route}/analyze-upload`, payload);
}
```

Funkció:
- Külön API metódusban intézi a fájlelemző hívást.

Miért kell:
- Tiszta, újrahasználható API-réteg; a view komponens egyszerűbb marad.

---

## 4. dia - Backend upload és validáció

Vonalak:
- `POST /tracks/analyze-upload`
- `POST /tracks`

Kulcs validációk:
- audio típus: `mp3, wav, ogg, m4a, flac`
- preview hossz <= 30 mp
- egyedi `track_title`

Részlet (`StoreTrackRequest`):

```php
if (($end - $start) > 30) {
    $validator->errors()->add('preview_end_at', 'Preview duration can be at most 30 seconds.');
}

$ext = strtolower((string) $audio->getClientOriginalExtension());
$allowed = ['mp3', 'wav', 'ogg', 'm4a', 'flac'];
if ($ext === '' || ! in_array($ext, $allowed, true)) {
    $validator->errors()->add('track_audio', 'The track audio field must be a file of type: mp3, wav, ogg, m4a, flac.');
}
```

Funkció:
- Kiszűri a túl hosszú preview-t és a nem támogatott audio fájlokat.

Miért kell:
- Üzleti szabály védelem (max 30 mp preview), plusz hibás/veszélyes formátumok kizárása.

---

## 5. dia - Metaadatok kiolvasása (cím, artist, műfaj, dátum, BPM, hossz, cover)

Az `analyzeUpload()` endpointben:
- `FFProbe` olvassa a format és stream tageket.
- Tag-ekből kinyeri: title, genre, date/year, artist.
- BPM: először tagból, ha nincs, akkor FFmpeg `bpm` filteres fallback.
- Beágyazott borítókép: FFmpeg `image2pipe` + base64 data URL.

Részlet:

```php
$ffprobe = FFProbe::create($this->ffmpegConfig());
$format = $ffprobe->format($path);
$tags = (array) ($format->get('tags') ?? []);
$duration = (int) round((float) ($format->get('duration') ?? 0));

$suggestedTitle = trim((string) $this->firstTagValue(['title'], $tags, ...$streamTags));
$suggestedGenre = trim((string) $this->firstTagValue(['genre'], $tags, ...$streamTags));
$suggestedDate = trim((string) $this->firstTagValue(['date', 'year'], $tags, ...$streamTags));
$suggestedBpm = $this->extractBpmFromTags($tags, ...$streamTags);
if ($suggestedBpm === null) {
    $suggestedBpm = $this->detectBpmFromAudio($path);
}
$coverDataUrl = $this->extractEmbeddedCoverDataUrl($path);
```

Funkció:
- Egységesen kinyeri a fő zenei metaadatokat és előkészíti frontend visszaadásra.

Miért kell:
- A fájlok metaadatai eltérő minőségűek; ezért kell tag + fallback stratégia, hogy minél több adat automatikusan kitöltődjön.

---

## 6. dia - Preview generálás FFmpeg-gel

A mentett teljes fájlból (`track_path`) 30 mp-es preview készül:
- kezdés: `preview_start_at`
- hossz: `preview_end_at - preview_start_at`

Részlet (`GenerateTrackPreview`):

```php
$process = new Process([
    $ffmpegBinary,
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-ss', (string) $previewStart,
    '-t', (string) $duration,
    '-i', $sourcePath,
    '-vn',
    '-acodec', 'libmp3lame',
    '-b:a', '192k',
    $outputPath,
]);
$process->run();
```

Funkció:
- FFmpeg parancsot futtat, ami kivágja a kívánt szakaszt és MP3 preview fájlt készít.

Miért kell:
- A vásárló csak rövid ízelítőt halljon; a teljes fájlt ne kapja meg nyilvános lejátszásra.

Eredmény:
- fájl: `storage/app/public/previews/...mp3`
- DB mezőben tárolva: `preview_path`

---

## 7. dia - Hogyan kerül be CSV-be?

A `Track` model `saved/deleted` eseményekre CSV szinkront indít:
- `syncPreviewCsv()` -> `database/csv/track_previews.csv`
- `syncTracksCsv()` -> `database/csv/tracks.csv`

Részlet (`Track::booted`):

```php
if (
    $track->wasRecentlyCreated
    || $track->wasChanged('preview_path')
    || $track->wasChanged('preview_start_at')
    || $track->wasChanged('preview_end_at')
) {
    self::syncPreviewCsv();
}

if ($shouldSyncTracksCsv) {
    self::syncTracksCsv();
}
```

Funkció:
- Figyeli a releváns változásokat, és azonnal frissíti az export fájlokat.

Miért kell:
- A CSV mindig tükrözze az adatbázis aktuális állapotát (integrációk, riportok, külső feldolgozás miatt).

CSV írás:

```php
$csvPath = database_path('csv/tracks.csv');
$dir = dirname($csvPath);
if (! File::exists($dir)) {
    File::makeDirectory($dir, 0755, true);
}
File::put($csvPath, implode(PHP_EOL, $lines) . PHP_EOL);
```

Funkció:
- Létrehozza a célmappát (ha nincs), majd felülírja a CSV fájlt a friss tartalommal.

Miért kell:
- Biztosítja, hogy hiányzó mappa miatt ne bukjon az export, és mindig teljes, konzisztens fájl szülessen.

---

## 8. dia - CSV szerkezet (mit tartalmaz)

`tracks.csv` fejléc:

```php
$lines = ['"id";"genre_id";"album_id";"track_title";"bpm_value";"artist_id";"artist_ids";"genre_ids";"release_date";"track_length";"track_price_eur";"track_cover";"track_path";"preview_start_at";"preview_end_at";"preview_path"'];
```

Funkció:
- Meghatározza a CSV oszlopait fix sorrendben.

Miért kell:
- A későbbi importok/riportok csak stabil oszlopsorrenddel működnek megbízhatóan.

`track_previews.csv` fejléc:

```php
$lines = ['"id";"preview_path";"preview_start_at";"preview_end_at"'];
```

Funkció:
- Külön, könnyű exportot ad a preview lejátszáshoz szükséges mezőkről.

Miért kell:
- Ha csak preview-adat kell, nem kell a teljes track exportot feldolgozni.

---

## Külön beilleszthető kódrészletek (gyors copy)

### A) Audio fájl mentése backenden

```php
$trackPath = $data['track_path'] ?? null;
if ($request->hasFile('track_audio')) {
    /** @var UploadedFile $audioFile */
    $audioFile = $request->file('track_audio');
    $trackPath = $this->storeUploadedAudioFile($audioFile);
}
```

Funkció:
- Ha ténylegesen fájl jön, elmenti, és a mentett útvonalat teszi a `trackPath`-ba.

Miért kell:
- A DB-be nem a nyers fájl kerül, hanem egy stabil, később streamelhető elérési út.

### B) Fájlnév + random végű tárolás

```php
$safeBase = Str::slug($baseName, '_');
$fileName = $safeBase . '_' . Str::lower(Str::random(8)) . '.' . $extension;
return $file->storeAs('tracks', $fileName, 'public');
```

Funkció:
- Biztonságos fájlnevet generál, majd a `public` disk `tracks` mappájába ment.

Miért kell:
- Elkerüli a névütközést és a problémás karaktereket tartalmazó fájlneveket.

### C) BPM fallback FFmpeg filterrel

```php
$process = new Process([
    $ffmpegBinary,
    '-hide_banner',
    '-nostats',
    '-i', $audioPath,
    '-vn',
    '-af', 'bpm',
    '-f', 'null',
    '-',
]);
$process->run();
```

Funkció:
- Futásidőben BPM-becslést kér az audióból, ha tagből nem volt megbízható BPM.

Miért kell:
- Sok zenefájlban hiányzik vagy rossz a BPM tag; így mégis adható automatikus javaslat.

### D) Teljes CSV export újragenerálása

```php
public static function syncCsvExports(bool $includePreview = true): void
{
    if ($includePreview) {
        self::syncPreviewCsv();
    }
    self::syncTracksCsv();
}
```

Funkció:
- Egy hívással frissíti az összes releváns track-exportot.

Miért kell:
- A controllernek nem kell külön-külön exportfüggvényeket menedzselnie; kevesebb hiba, tisztább kód.

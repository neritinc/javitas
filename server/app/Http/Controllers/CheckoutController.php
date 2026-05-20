<?php

namespace App\Http\Controllers;

use App\Models\Album;
use App\Models\Track;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Throwable;

class CheckoutController extends Controller
{
    public function checkout(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $cart = $user->carts()
            ->with(['items.track', 'items.album.tracks'])
            ->where('id', $id)
            ->first();

        if (! $cart) {
            return response()->json([
                'message' => 'Cart not found',
                'data' => null,
            ], 404);
        }

        if ($cart->items->isEmpty()) {
            return response()->json([
                'message' => 'Cart is empty',
                'data' => null,
            ], 422);
        }

        $now = Carbon::now();
        $expiresAt = $now->copy()->addDays(7);

        $downloadItems = [];
        $seenTrackIds = [];
        $seenAlbumIds = [];

        foreach ($cart->items as $item) {
            if ($item->track_id) {
                if (isset($seenTrackIds[$item->track_id])) {
                    continue;
                }
                /** @var Track|null $track */
                $track = $item->track;
                if (! $track) {
                    continue;
                }

                $signedUrl = URL::temporarySignedRoute(
                    'download.signed',
                    $expiresAt,
                    ['type' => 'track', 'id' => $track->id]
                );

                $downloadItems[] = [
                    'type' => 'track',
                    'title' => (string) ($track->track_title ?? 'Track'),
                    'url' => $signedUrl,
                ];
                $seenTrackIds[$item->track_id] = true;
            }

            if ($item->album_id) {
                if (isset($seenAlbumIds[$item->album_id])) {
                    continue;
                }
                /** @var Album|null $album */
                $album = $item->album;
                if (! $album) {
                    continue;
                }

                $signedUrl = URL::temporarySignedRoute(
                    'download.signed',
                    $expiresAt,
                    ['type' => 'album', 'id' => $album->id]
                );

                $downloadItems[] = [
                    'type' => 'album',
                    'title' => (string) ($album->title ?? 'Album'),
                    'url' => $signedUrl,
                ];
                $seenAlbumIds[$item->album_id] = true;
            }
        }

        if (empty($downloadItems)) {
            return response()->json([
                'message' => 'No downloadable items found',
                'data' => null,
            ], 422);
        }

        $payload = [
            'name' => (string) ($user->name ?? ''),
            'items' => $downloadItems,
            'expires_at' => $expiresAt->toDateTimeString(),
        ];

        $mailSent = true;
        $mailError = null;

        try {
            Mail::send([
                'html' => 'emails.purchase',
                'text' => 'emails.purchase-plain',
            ], $payload, function ($message) use ($user): void {
                $message->to((string) $user->email)
                    ->subject('Your Doomshop purchase is ready to download');
            });
        } catch (Throwable $e) {
            $mailSent = false;
            $mailError = $e->getMessage();
            Log::error('Checkout email sending failed.', [
                'user_id' => $user->id,
                'cart_id' => $id,
                'email' => (string) $user->email,
                'exception' => $e,
            ]);
        }

        // Clear cart after simulated checkout
        $cart->items()->delete();
        $cart->delete();

        return response()->json([
            'message' => $mailSent
                ? 'Checkout complete'
                : 'Checkout complete, but email could not be sent',
            'data' => [
                'download_items' => $downloadItems,
                'expires_at' => $expiresAt->toDateTimeString(),
                'mail_sent' => $mailSent,
                'mail_error' => $mailError,
            ],
        ]);
    }

    // Signed URLs handle expiry without DB tokens.
}

<!doctype html>
<html lang="en">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your download links</title>
  <style>
    :root {
      color-scheme: light;
    }

    body {
      margin: 0;
      background: #f3f4f6;
      font-family: "Segoe UI", Tahoma, Arial, sans-serif;
      color: #0f172a;
    }

    .wrapper {
      padding: 24px;
    }

    .card {
      max-width: 640px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 22px 24px;
    }

    .header h1 {
      margin: 0;
      font-size: 20px;
      letter-spacing: 0.2px;
    }

    .content {
      padding: 20px 24px 10px;
    }

    .lead {
      margin: 0 0 12px;
      font-size: 15px;
      color: #1f2937;
    }

    .list {
      display: grid;
      gap: 12px;
      margin: 14px 0 4px;
    }

    .item {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 14px;
      background: #f9fafb;
    }

    .item-title {
      font-weight: 700;
      margin: 0 0 8px;
    }

    .btn {
      display: inline-block;
      background: #2563eb;
      color: #ffffff !important;
      padding: 10px 14px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
    }

    .meta {
      color: #6b7280;
      font-size: 12px;
      padding: 0 24px 18px;
    }

    .footer {
      border-top: 1px solid #e5e7eb;
      padding: 14px 24px 20px;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>

<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>Your Doomshop download links</h1>
      </div>
      <div class="content">
        <p class="lead">Hi{{ isset($name) && $name !== '' ? ' ' . e($name) : '' }},</p>
        <p class="lead">Thanks for your purchase! Use the links below to download your full audio files.</p>

        @if (!empty($items))
          <div class="list">
            @foreach ($items as $item)
              <div class="item">
                <p class="item-title">{{ ucfirst($item['type'] ?? 'item') }}: {{ $item['title'] ?? '' }}</p>
                @if (!empty($item['url']))
                  <a class="btn" href="{{ $item['url'] }}">Download</a>
                @endif
              </div>
            @endforeach
          </div>
        @endif
      </div>
      <div class="meta">
        Links valid until: {{ $expires_at ?? '' }}
      </div>
      <div class="footer">
        If you did not request this email, you can safely ignore it.
      </div>
    </div>
  </div>
</body>

</html>

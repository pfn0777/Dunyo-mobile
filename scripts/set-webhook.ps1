# Sets the Telegram webhook for the Dunyo Mobile bot (api/src/routes/webhook.ts,
# mounted at /tg/webhook) and verifies it. Adapted from XUMO MARKET's
# scripts/set-webhook.ps1 for a self-hosted API behind a custom domain
# instead of a Supabase Edge Function URL.
#
# allowed_updates MUST include BOTH `message` and `callback_query`: with
# only `message`, the shop group's inline order-status buttons (the ones
# admins tap to move an order to "shipped"/"delivered"/etc.) silently do
# nothing -- Telegram never sends the callback_query update for a button
# tap, so the bot never even sees it.
#
# Bot token and webhook secret are always prompted for as SecureString and
# are never written to Write-Host/Write-Output or passed as plaintext
# command-line arguments, so neither ends up in shell history, a
# transcript, or this script's own output.
#
#   .\scripts\set-webhook.ps1
#   .\scripts\set-webhook.ps1 -Domain shop.example.com

[CmdletBinding()]
param(
    [string]$Domain
)

$ErrorActionPreference = 'Stop'

if (-not $Domain) {
    $Domain = Read-Host 'Domain (masalan shop.example.com -- deploy/.env dagi DOMAIN qiymati)'
}
$Domain = $Domain.Trim()
if (-not $Domain) {
    throw 'Domain bo`sh bo`lishi mumkin emas.'
}

$TokenSecure  = Read-Host 'Bot token (BotFather)' -AsSecureString
$SecretSecure = Read-Host 'TELEGRAM_WEBHOOK_SECRET (deploy/.env)' -AsSecureString

function ConvertFrom-SecureStringPlain {
    param([Security.SecureString]$Value)
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

$Token  = (ConvertFrom-SecureStringPlain $TokenSecure).Trim()
$Secret = (ConvertFrom-SecureStringPlain $SecretSecure).Trim()

if ($Token -notmatch '^\d+:[A-Za-z0-9_-]+$') {
    throw "Token ko'rinishi noto'g'ri (kutilgan format: 123456789:AAF...). Uzunligi: $($Token.Length)"
}
if (-not $Secret) {
    throw 'Webhook secret bo`sh.'
}

$api = "https://api.telegram.org/bot$Token"

$me = Invoke-RestMethod -Uri "$api/getMe"
Write-Host "Bot: @$($me.result.username)" -ForegroundColor Green

$body = @{
    url             = "https://$Domain/tg/webhook"
    secret_token    = $Secret
    allowed_updates = @('message', 'callback_query')
} | ConvertTo-Json

$set = Invoke-RestMethod -Method Post -Uri "$api/setWebhook" -ContentType 'application/json' -Body $body
Write-Host "setWebhook: $($set.description)" -ForegroundColor Green

$info = (Invoke-RestMethod -Uri "$api/getWebhookInfo").result
Write-Host "url             : $($info.url)"
Write-Host "allowed_updates : $($info.allowed_updates -join ', ')"
Write-Host "pending_updates : $($info.pending_update_count)"
Write-Host "last_error      : $($info.last_error_message)"

# Clear plaintext copies from local variables now that both calls are done.
$Token = $null
$Secret = $null

if ($info.allowed_updates -notcontains 'callback_query') {
    throw 'callback_query allowed_updates ichida yo`q -- guruhdagi buyurtma holati tugmalari ishlamaydi.'
}
if ($info.allowed_updates -notcontains 'message') {
    throw 'message allowed_updates ichida yo`q.'
}
Write-Host 'OK: webhook message + callback_query bilan o`rnatildi.' -ForegroundColor Green

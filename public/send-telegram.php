<?php
/**
 * Telegram Send Message Proxy
 * Proxies sendMessage requests from the frontend to api.telegram.org server-side
 * to avoid CORS (browsers cannot call Telegram API directly).
 *
 * POST JSON body: { "botToken": "...", "chatId": "...", "text": "...", "replyMarkup": {...}, "parseMode": "HTML" }
 * Omit parseMode or use "" for plain text.
 * Returns: Telegram API response as JSON
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Cache-Control: no-cache, no-store, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit();
}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

if (json_last_error() !== JSON_ERROR_NONE || !is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON body']);
    exit();
}

$botToken = isset($body['botToken']) ? trim((string) $body['botToken']) : '';
$chatId = isset($body['chatId']) ? trim((string) $body['chatId']) : '';
$text = isset($body['text']) ? (string) $body['text'] : '';
$replyMarkup = isset($body['replyMarkup']) ? $body['replyMarkup'] : null;
$parseMode = array_key_exists('parseMode', $body) ? trim((string) $body['parseMode']) : 'HTML';

if ($botToken === '' || $chatId === '' || $text === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing required fields: botToken, chatId, text']);
    exit();
}

$url = 'https://api.telegram.org/bot' . $botToken . '/sendMessage';

$data = [
    'chat_id' => $chatId,
    'text' => $text,
];

if ($parseMode !== '') {
    $data['parse_mode'] = $parseMode;
}

if ($replyMarkup !== null && (is_array($replyMarkup) || is_object($replyMarkup))) {
    $data['reply_markup'] = json_encode($replyMarkup);
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

$response = curl_exec($ch);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    error_log('send-telegram.php cURL error: ' . $curlError);
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'Proxy request failed: ' . $curlError]);
    exit();
}

$decoded = json_decode($response, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('send-telegram.php invalid Telegram response: ' . substr($response, 0, 200));
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'Invalid response from Telegram API']);
    exit();
}

http_response_code(200);
echo json_encode($decoded);

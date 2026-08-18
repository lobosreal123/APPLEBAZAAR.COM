<?php
/**
 * API Proxy for sickw.com
 * This file handles API requests server-side to avoid CORS issues
 * 
 * Usage: /api-proxy.php?action=balance&key=API_KEY
 *        /api-proxy.php?format=beta&key=API_KEY&imei=IMEI&service=SERVICE_ID
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Whitelist allowed parameters for security
$allowedParams = ['action', 'format', 'key', 'imei', 'service'];
$params = array_intersect_key($_GET, array_flip($allowedParams));

// Validate required parameters exist if needed
if (empty($params)) {
    http_response_code(400);
    echo json_encode(['error' => true, 'message' => 'Missing required parameters']);
    exit();
}

// Build the URL for sickw.com API
$apiUrl = 'https://sickw.com/api.php?' . http_build_query($params);

// Initialize cURL
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
// SSL Verification: Enable for security (prevents MITM attacks)
// If sickw.com has certificate issues, set to false (NOT RECOMMENDED)
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (compatible; POS-System/1.0)');
curl_setopt($ch, CURLOPT_MAXREDIRS, 5);

// Execute request
$response = curl_exec($ch);

// Check for cURL errors before getting other info
if ($response === false) {
    $error = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Proxy error: ' . $error,
        'curl_error' => $error
    ]);
    exit();
}

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

// Handle errors
if ($error) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Proxy error: ' . $error,
        'curl_error' => $error
    ]);
    exit();
}

// Handle HTTP errors
if ($httpCode >= 400) {
    http_response_code($httpCode);
    echo json_encode([
        'error' => true,
        'message' => 'API request failed',
        'http_code' => $httpCode,
        'response' => $response
    ]);
    exit();
}

// Set HTTP status code
http_response_code($httpCode);

// For balance action, return plain text
if (isset($params['action']) && $params['action'] === 'balance') {
    header('Content-Type: text/plain');
    echo $response;
} else {
    // For other actions, return JSON
    header('Content-Type: application/json');
    // If response is not valid JSON, wrap it
    $decoded = json_decode($response, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        echo $response;
    } else {
        // If response is not JSON, return as JSON with response as string
        echo json_encode([
            'result' => $response,
            'raw' => true
        ]);
    }
}
?>


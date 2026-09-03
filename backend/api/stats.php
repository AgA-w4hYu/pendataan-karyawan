<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/helpers.php';

function stats_get(): void
{
    $pdo = db();
    $total = (int)$pdo->query('SELECT COUNT(*) FROM employees')->fetchColumn();
    $newThisMonth = (int)$pdo->query(
        "SELECT COUNT(*) FROM employees WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')"
    )->fetchColumn();
    json_response([
        'total'          => $total,
        'new_this_month' => $newThisMonth,
    ]);
}
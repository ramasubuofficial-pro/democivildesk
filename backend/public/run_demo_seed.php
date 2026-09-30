<?php
// Standalone runner for Karur Demo Data
error_reporting(E_ALL);
ini_set('display_errors', '1');

header('Content-Type: text/html; charset=utf-8');

$hostname = 'localhost';
$username = 'u589483802_civilpro';
$password = 'Civilpro@123#';
$database = 'u589483802_civilpro';
$port     = 3306;

echo "<h2>CivilDesk ERP - Karur Demo Data Seeder</h2>";
echo "<p>Connecting to database <strong>{$database}</strong>...</p>";

$mysqli = @new mysqli($hostname, $username, $password, $database, $port);
if ($mysqli->connect_error) {
    // Try fallback database credentials from .env if any
    $username = 'u589483802_democivil';
    $password = 'Gowtham@1472004';
    $database = 'u589483802_democivil';
    $mysqli = @new mysqli($hostname, $username, $password, $database, $port);
}

if ($mysqli->connect_error) {
    die("<div style='color:red; font-weight:bold;'>Database Connection Failed: " . htmlspecialchars($mysqli->connect_error) . "</div>");
}

echo "<div style='color:green; font-weight:bold;'>✓ Database Connected Successfully.</div>";

$sqlFile = dirname(__DIR__) . '/db/demo_seed_data.sql';
if (!file_exists($sqlFile)) {
    die("<div style='color:red;'>SQL file not found at: {$sqlFile}</div>");
}

$sqlContent = file_get_contents($sqlFile);

// Execute multi query
if ($mysqli->multi_query($sqlContent)) {
    $executed = 0;
    do {
        if ($result = $mysqli->store_result()) {
            $result->free();
        }
        $executed++;
    } while ($mysqli->more_results() && $mysqli->next_result());

    if ($mysqli->error) {
        echo "<div style='color:orange;'>Executed with notice: " . htmlspecialchars($mysqli->error) . "</div>";
    } else {
        echo "<div style='color:green; font-size:18px; font-weight:bold; margin-top:20px;'>";
        echo "✓ Successfully Seeded All Karur Demo Data!<br><br>";
        echo "</div>";
        echo "<ul>";
        echo "<li><strong>4 Projects:</strong> KMC hospital, Valluvar hotel, Bosch Showroom, Chettinad college</li>";
        echo "<li><strong>8 Sites:</strong> 2 sites per project (KMC Inpatient & ICU Block, Doctors Quarters, Valluvar Grand Hotel, Convention Center, Bosch Service Hub, Bosch Showroom Arena, Chettinad Academic Complex, Student Hostel)</li>";
        echo "<li><strong>24 Zone & Work Locations:</strong> 3 zones per site</li>";
        echo "<li><strong>Contractors, Labours, Work Orders, Budgets, DPRs, Expenses & Payments</strong></li>";
        echo "</ul>";
    }
} else {
    echo "<div style='color:red;'>Multi Query Failed: " . htmlspecialchars($mysqli->error) . "</div>";
}

$mysqli->close();
?>
